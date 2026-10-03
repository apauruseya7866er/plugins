// Shared live-check core.
//
// Extracted from scripts/live-check-plugin.js so the per-plugin CLI report and
// the whole-catalogue health table (scripts/source-health-table.js) exercise
// plugins through identical logic. If these two ever disagree, the table stops
// being evidence about what the CLI would have said.

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import os from 'os';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..', '..');

const MIN_CHAPTER_LENGTH = 200;
const STEP_TIMEOUT_MS = 30_000;
const CLOUDFLARE_HEADER_HINTS = ['cf-ray', 'cf-cache-status', 'cf-request-id'];

/**
 * Distinguish "the site is behind Cloudflare's CDN" from "Cloudflare blocked
 * us". These are not the same and conflating them produces false accusations.
 *
 * Every Cloudflare-fronted site serves cf-ray and cf-cache-status on perfectly
 * healthy responses, because those headers describe the CDN edge, not a
 * challenge. novelping.com, novelarchive.cc and a large share of the catalogue
 * sit behind Cloudflare and return 200 with both headers present.
 *
 * A block looks different: 403/503 *plus* cf-mitigated: challenge, or a
 * cf-ray with no cf-cache-status (a challenged response is not cacheable).
 */
function describeBlock(status, headers) {
  const get = name => {
    const v = headers?.get?.(name) ?? headers?.[name];
    return typeof v === 'string' ? v : undefined;
  };
  const mit = get('cf-mitigated');
  const reason = get('cf-chl-bypass') ? undefined : undefined;
  if (mit) return `${status} blocked by Cloudflare (cf-mitigated: ${mit})`;
  if (reason) return `${status} blocked by Cloudflare`;
  // 403/503 on a Cloudflare-fronted host with no cache-status is the classic
  // challenge fingerprint. Say "edge challenge" rather than asserting the
  // plugin is at fault: the request may simply have come from a blocked region.
  const cfHeaders = CLOUDFLARE_HEADER_HINTS.some(h => get(h) !== undefined);
  if (cfHeaders) {
    return `${status} Cloudflare edge challenge (bot rule)`;
  }
  return `${status} (likely anti-bot block)`;
}

/**
 * Classify a thrown error as "the network or the site blocked us" rather than
 * "the plugin is broken". Only 403/503 count as a block: a cf-ray or
 * cf-cache-status header alone just means the site sits behind Cloudflare's
 * CDN, which is true of a large share of the web and proves nothing.
 */
export function isNetworkOrBlockError(error) {
  const code = error?.code || error?.cause?.code;
  const message = String(error?.message || '');
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    // DNS could not resolve. That is a fact about the site or this network's
    // resolver - it is not evidence about the scraper either way.
    return { inconclusive: true, reason: `DNS lookup failed (${code})` };
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code)) {
    return { inconclusive: true, reason: `Network error (${code})` };
  }
  if (/timed? ?out/i.test(message)) {
    return { inconclusive: true, reason: 'Timeout' };
  }
  const status = error?.response?.status ?? error?.status;
  if (status === 403 || status === 503) {
    const headers = error?.response?.headers;
    return {
      inconclusive: true,
      reason: describeBlock(status, headers),
    };
  }
  return { inconclusive: false };
}

export async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error(`${label} timed out`), { code: 'ETIMEDOUT' }),
        ),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function bundlePlugin(pluginPath) {
  const absPath = path.resolve(REPO_ROOT, pluginPath);
  const result = await esbuild.build({
    entryPoints: [absPath],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    write: false,
    logLevel: 'silent',
    alias: {
      '@libs': path.join(REPO_ROOT, 'src/libs'),
      '@': path.join(REPO_ROOT, 'src'),
    },
  });
  const code = result.outputFiles[0].text;
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpFile = path.join(
    os.tmpdir(),
    `live-check-${path.basename(pluginPath, '.ts')}-${unique}.cjs`,
  );
  await fs.writeFile(tmpFile, code, 'utf8');
  return tmpFile;
}

async function loadPluginInstance(pluginPath) {
  const bundledPath = await bundlePlugin(pluginPath);
  try {
    // Plain CJS require(), not ESM import(): importing a CJS module from an ESM
    // context wraps the whole `module.exports` as `.default`, double-nesting a
    // `default` named export. require() resolves it as the author wrote it.
    const mod = require(bundledPath);
    return mod.default ?? mod;
  } finally {
    delete require.cache[require.resolve(bundledPath)];
    await fs.unlink(bundledPath).catch(() => undefined);
  }
}

function makeStep(name) {
  return { name, status: 'FAIL', detail: '' };
}

/**
 * The app always calls popularNovels with the plugin's own declared filter
 * values, never a bare undefined (undefined is only valid for plugins that
 * declare no filters). Sending undefined to a plugin that reads
 * filters.language.value crashes it for a reason that is the harness's fault,
 * not the plugin's.
 */
function defaultFilterValues(plugin) {
  if (!plugin.filters) return undefined;
  return Object.fromEntries(
    Object.entries(plugin.filters).map(([key, filter]) => [
      key,
      { value: filter.value, type: filter.type },
    ]),
  );
}

async function runChecks(plugin) {
  const steps = [];
  const filters = defaultFilterValues(plugin);

  const popularStep = makeStep('popularNovels');
  steps.push(popularStep);
  let popular;
  try {
    popular = await withTimeout(
      plugin.popularNovels(1, { filters }),
      STEP_TIMEOUT_MS,
      'popularNovels',
    );
    if (!Array.isArray(popular) || popular.length === 0) {
      popularStep.status = 'FAIL';
      popularStep.detail = 'Returned no novels';
      return steps;
    }
    popularStep.status = 'PASS';
    popularStep.detail = `${popular.length} novels`;
  } catch (error) {
    const net = isNetworkOrBlockError(error);
    popularStep.status = net.inconclusive ? 'INCONCLUSIVE' : 'FAIL';
    popularStep.detail = net.reason || error.message;
    return steps;
  }

  const firstNovel = popular[0];

  const searchStep = makeStep('searchNovels');
  steps.push(searchStep);
  try {
    const results = await withTimeout(
      plugin.searchNovels(firstNovel.name, 1),
      STEP_TIMEOUT_MS,
      'searchNovels',
    );
    if (!Array.isArray(results)) {
      searchStep.status = 'FAIL';
      searchStep.detail = 'Did not return an array';
    } else {
      searchStep.status = 'PASS';
      searchStep.detail = `${results.length} results for "${firstNovel.name}"`;
    }
  } catch (error) {
    const net = isNetworkOrBlockError(error);
    searchStep.status = net.inconclusive ? 'INCONCLUSIVE' : 'FAIL';
    searchStep.detail = net.reason || error.message;
  }

  const parseNovelStep = makeStep('parseNovel');
  steps.push(parseNovelStep);
  let novel;
  try {
    novel = await withTimeout(
      plugin.parseNovel(firstNovel.path),
      STEP_TIMEOUT_MS,
      'parseNovel',
    );
    const isPagePlugin = typeof plugin.parsePage === 'function';
    let chapters = novel?.chapters;
    if (isPagePlugin && (!chapters || chapters.length === 0)) {
      const page = await withTimeout(
        plugin.parsePage(firstNovel.path, '1'),
        STEP_TIMEOUT_MS,
        'parsePage',
      );
      chapters = page?.chapters;
    }
    if (!novel?.name || !chapters || chapters.length === 0) {
      parseNovelStep.status = 'FAIL';
      parseNovelStep.detail = !novel?.name
        ? 'Missing novel name'
        : 'No chapters returned';
      return steps;
    }
    parseNovelStep.status = 'PASS';
    parseNovelStep.detail = `${chapters.length} chapters`;
    novel = { ...novel, chapters };
  } catch (error) {
    const net = isNetworkOrBlockError(error);
    parseNovelStep.status = net.inconclusive ? 'INCONCLUSIVE' : 'FAIL';
    parseNovelStep.detail = net.reason || error.message;
    return steps;
  }

  const parseChapterStep = makeStep('parseChapter');
  steps.push(parseChapterStep);
  try {
    const firstChapter = novel.chapters[0];
    const content = await withTimeout(
      plugin.parseChapter(firstChapter.path),
      STEP_TIMEOUT_MS,
      'parseChapter',
    );
    const length = typeof content === 'string' ? content.trim().length : 0;
    if (length < MIN_CHAPTER_LENGTH) {
      parseChapterStep.status = 'FAIL';
      parseChapterStep.detail = `Content too short (${length} chars, expected >= ${MIN_CHAPTER_LENGTH})`;
    } else {
      parseChapterStep.status = 'PASS';
      parseChapterStep.detail = `${length} chars`;
    }
  } catch (error) {
    const net = isNetworkOrBlockError(error);
    parseChapterStep.status = net.inconclusive ? 'INCONCLUSIVE' : 'FAIL';
    parseChapterStep.detail = net.reason || error.message;
  }

  return steps;
}

/**
 * fetchText/fetchFile in this repo swallow network and non-2xx errors and
 * resolve to '' instead of throwing (see src/lib/fetch.ts), so a plugin using
 * them surfaces a site-down or anti-bot block as an empty result rather than an
 * exception. Probe the plugin's base site first so a known-blocked site
 * short-circuits to INCONCLUSIVE before the real checks run.
 */
async function probeSiteReachability(site) {
  const headers = { 'User-Agent': 'Mozilla/5.0 live-check-plugin' };

  const send = async method => {
    try {
      return await withTimeout(
        fetch(site, { method, headers }),
        STEP_TIMEOUT_MS,
        'site probe',
      );
    } catch (error) {
      const net = isNetworkOrBlockError(error);
      return { threw: true, reason: net.reason || error.message };
    }
  };

  // HEAD is cheap but a fair number of hosts reject it outright (405/501)
  // while serving GET perfectly well - bestlightnovel.com is one. Retrying
  // those with GET avoids reporting a working source as blocked, which is the
  // difference between an accurate health table and a misleading one.
  let res = await send('HEAD');
  if (!res.threw && (res.status === 405 || res.status === 501)) {
    res = await send('GET');
  }

  if (res.threw) {
    return { reachable: false, reason: res.reason };
  }
  if (res.status >= 200 && res.status < 400) {
    return { reachable: true };
  }
  if (res.status === 403 || res.status === 503) {
    return {
      reachable: false,
      reason: describeBlock(res.status, res.headers),
    };
  }
  return { reachable: false, reason: `HTTP ${res.status}` };
}

/**
 * Load one plugin, probe its site, then run the four checks.
 * Always resolves; per-plugin status lives in the returned steps so a single
 * bad plugin cannot abort a whole-catalogue run.
 */
export async function checkPlugin(pluginPath) {
  const result = {
    pluginPath,
    steps: [],
    loadError: null,
    pluginId: null,
    pluginName: null,
    pluginVersion: null,
    pluginSite: null,
  };

  let plugin;
  try {
    plugin = await loadPluginInstance(pluginPath);
  } catch (error) {
    result.loadError = error.message;
    return result;
  }

  result.pluginId = plugin.id ?? null;
  result.pluginName = plugin.name ?? null;
  result.pluginVersion = plugin.version ?? null;
  result.pluginSite = plugin.site ?? '';

  const probe = await probeSiteReachability(plugin.site);
  if (!probe.reachable) {
    const step = makeStep('siteReachability');
    step.status = 'INCONCLUSIVE';
    step.detail = probe.reason;
    result.steps = [step];
    return result;
  }

  result.steps = await runChecks(plugin);
  return result;
}
