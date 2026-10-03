#!/usr/bin/env node

// Live health table for the English plugin set.
//
// Reuses the exact check semantics of scripts/live-check-plugin.js (popular ->
// search -> novel -> chapter, with the same Cloudflare-aware network classifier)
// but runs the whole language directory concurrently and renders one summary row
// per plugin instead of a per-step report.
//
// Output is a Markdown table meant to be committed into README.md between the
// SOURCE_HEALTH markers by .github/workflows/source-health.yml. Because it is a
// committed snapshot rather than a live badge, every row is a point-in-time
// observation and the table carries the run timestamp for that reason.
//
// Usage:
//   node scripts/source-health-table.js [--lang english] [--concurrency 8]
//                                       [--out docs/source-health.md]
//                                       [--json]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkPlugin } from './lib/plugin-health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    lang: 'english',
    concurrency: 8,
    out: null,
    json: false,
    only: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') opts.lang = argv[++i];
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--only')
      opts.only = argv[++i].split(',').map(s => s.trim());
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!Number.isFinite(opts.concurrency) || opts.concurrency < 1) {
    throw new Error('--concurrency must be a positive number');
  }
  return opts;
}

/**
 * Discover plugin sources for a language.
 *
 * Multisrc-generated files (Foo[template].ts) are excluded: they are produced
 * from plugins/multisrc/<lang>/template.ts at build time, so the checked-in tree
 * has no `plugins/<lang>/Foo[template].ts` to test. This matches
 * plugin-live-check.yml.
 *
 * `*.broken.ts` is excluded too. That suffix is a deliberate, reviewed marker
 * meaning "do not ship this", so such a plugin is already known-unavailable and
 * would contribute a permanent red row that says nothing new. They are counted
 * separately so the omission is visible rather than silent.
 */
async function discoverPlugins(lang) {
  const dir = path.join(REPO_ROOT, 'plugins', lang);
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    throw new Error(`No plugin directory for language '${lang}' at ${dir}`);
  }

  const generated = entries.filter(f => f.includes('[') || f.includes(']'));
  const broken = entries.filter(f => f.endsWith('.broken.ts'));
  const live = entries.filter(
    f =>
      f.endsWith('.ts') &&
      !f.includes('[') &&
      !f.includes(']') &&
      !f.endsWith('.broken.ts'),
  );

  return {
    paths: live.sort().map(f => `plugins/${lang}/${f}`),
    skipped: { generated: generated.length, broken: broken.length },
  };
}

/** Run checks with a bounded worker pool so one slow site cannot stall the run. */
async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i], i);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

const ICON = { PASS: '✅', FAIL: '❌', UNKNOWN: '❔' };

/**
 * Worst-status-wins rollup.
 *
 * UNKNOWN is deliberately separate from INCONCLUSIVE. "We were blocked and
 * could not find out" is a different statement from "we got through and the
 * scraper is broken", and collapsing them into one grey bucket made a blocked
 * row read as an accusation against a plugin that may work perfectly in the
 * app. UNKNOWN means the health of this plugin is genuinely undetermined; it is
 * never evidence of a defect.
 */
function overallVerdict(steps, loadError) {
  if (loadError) return 'FAIL';
  if (steps.some(s => s.status === 'FAIL')) return 'FAIL';
  if (steps.some(s => s.status === 'INCONCLUSIVE')) return 'UNKNOWN';
  return 'PASS';
}

/** Most useful short reason: the failing step, else the blocked-site reason. */
function summarise(steps, loadError) {
  if (loadError) return 'failed to load';
  const fail = steps.find(s => s.status === 'FAIL');
  if (fail) return fail.detail || fail.name;
  const inc = steps.find(s => s.status === 'INCONCLUSIVE');
  if (inc) return inc.detail || inc.name;
  const novel = steps.find(s => s.name === 'parseNovel');
  const chapter = steps.find(s => s.name === 'parseChapter');
  if (novel?.status === 'PASS' && chapter?.status === 'PASS') {
    return `${novel.detail}, ${chapter.detail}`;
  }
  return steps.map(s => s.status).join('/');
}

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function renderTable(rows, generatedAt, lang, counts, skipped) {
  const lines = [];
  lines.push(`<!-- SOURCE_HEALTH:START -->`);
  lines.push('');
  lines.push('## 📡 Source health');
  lines.push('');
  lines.push(
    `Live check of every \`${lang}\` plugin against its real site, run daily by`,
  );
  lines.push(
    '[`.github/workflows/source-health.yml`](./.github/workflows/source-health.yml).',
  );
  lines.push('');
  lines.push(
    'Each plugin is exercised the way the app uses it: **popular → search → novel',
    '→ chapter**. A plugin only counts as healthy if all four return real data.',
  );
  lines.push('');
  lines.push(
    `**${counts.total} checked** · ${ICON.PASS} ${counts.pass} passing · ${ICON.FAIL} ${counts.fail} failing · ${ICON.UNKNOWN} ${counts.unknown} undetermined`,
  );
  lines.push('');
  lines.push(
    `Last run: \`${generatedAt}\`. This is a committed snapshot, not a live badge —`,
    'a row reflects the site at that moment and can change without this page being',
    'edited.',
  );
  lines.push('');
  lines.push(
    '**Read the three states carefully.**',
    '',
    `- ${ICON.PASS} **PASS** — all four checks returned real data from a live request.`,
    `- ${ICON.FAIL} **FAIL** — the checks ran and the plugin is broken. This is a real`,
    '  defect worth an issue or a pull request.',
    `- ${ICON.UNKNOWN} **UNKNOWN** — the runner never got through, so the plugin's health`,
    '  was not determined. This is **not** a verdict on the plugin. GitHub Actions',
    '  runners are datacentre IPs; large novel sites block or challenge them by',
    '  policy. Plenty of sources in this state work normally in the app on a phone,',
    '  and the app resolves some of them with its own Cloudflare handling. Treat',
    '  UNKNOWN as "not measured", never as "broken".',
  );
  lines.push('');
  lines.push('| Source | Site | Health | Detail |');
  lines.push('| --- | --- | :---: | --- |');

  for (const row of rows) {
    lines.push(
      `| **${escapeCell(row.name)}** | ${escapeCell(row.site)} | ${ICON[row.verdict]} ${row.verdict} | ${escapeCell(row.detail)} |`,
    );
  }

  const skipBits = [];
  if (skipped.broken) {
    skipBits.push(
      `${skipped.broken} marked \`.broken.ts\` (deliberately unshipped)`,
    );
  }
  if (skipped.generated) {
    skipBits.push(`${skipped.generated} multi-source generated at build time`);
  }
  if (skipBits.length) {
    lines.push('');
    lines.push(`Not listed: ${skipBits.join(', ')}.`);
  }

  lines.push('');
  lines.push(
    'Reproduce a single row locally:',
    '',
    '```bash',
    'npm run check:plugin -- plugins/english/ao3.ts',
    '```',
  );
  lines.push('');
  lines.push(`<!-- SOURCE_HEALTH:END -->`);
  return lines.join('\n');
}

/** Replace the managed block in README.md, or append it if absent. */
function spliceIntoReadme(readme, block) {
  const START = '<!-- SOURCE_HEALTH:START -->';
  const END = '<!-- SOURCE_HEALTH:END -->';
  const startIdx = readme.indexOf(START);
  if (startIdx === -1) {
    const sep = readme.endsWith('\n') ? '\n' : '\n\n';
    return `${readme}${sep}${block}\n`;
  }
  const endIdx = readme.indexOf(END, startIdx);
  if (endIdx === -1) {
    // Unbalanced markers: refuse to guess, leave the file alone.
    throw new Error('README has a SOURCE_HEALTH:START with no matching END');
  }
  const before = readme.slice(0, startIdx);
  const after = readme.slice(endIdx + END.length);
  return `${before}${block}${after}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const discovered = await discoverPlugins(opts.lang);
  const targets = opts.only
    ? discovered.paths.filter(p => opts.only.some(o => p.includes(o)))
    : discovered.paths;

  if (targets.length === 0) {
    throw new Error('No plugins matched');
  }

  console.error(
    `Live-checking ${targets.length} '${opts.lang}' plugins (concurrency ${opts.concurrency})...`,
  );

  let done = 0;
  const raw = await runPool(targets, opts.concurrency, async pluginPath => {
    const result = await checkPlugin(pluginPath);
    done += 1;
    if (done % 10 === 0 || done === targets.length) {
      console.error(`  ${done}/${targets.length}`);
    }
    return result;
  });

  const rows = raw.map(r => {
    const verdict = overallVerdict(r.steps, r.loadError);
    return {
      pluginPath: r.pluginPath,
      id: r.pluginId ?? '',
      name: r.pluginName ?? path.basename(r.pluginPath, '.ts'),
      version: r.pluginVersion ?? '',
      site: r.pluginSite ?? '',
      verdict,
      detail: summarise(r.steps, r.loadError),
      steps: r.steps,
      loadError: r.loadError,
    };
  });

  // Healthy first, then broken, then undetermined - proven facts before
  // unmeasured rows, so the table cannot be skimmed into a pile of accusations.
  const rank = { PASS: 0, FAIL: 1, UNKNOWN: 2 };
  rows.sort(
    (a, b) =>
      rank[a.verdict] - rank[b.verdict] ||
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );

  const counts = {
    total: rows.length,
    pass: rows.filter(r => r.verdict === 'PASS').length,
    fail: rows.filter(r => r.verdict === 'FAIL').length,
    unknown: rows.filter(r => r.verdict === 'UNKNOWN').length,
  };
  const generatedAt =
    new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  if (opts.json) {
    console.log(JSON.stringify({ generatedAt, counts, rows }, null, 2));
    return;
  }

  const block = renderTable(
    rows,
    generatedAt,
    opts.lang,
    counts,
    discovered.skipped,
  );

  if (opts.out) {
    await fs.writeFile(path.resolve(REPO_ROOT, opts.out), `${block}\n`, 'utf8');
    console.error(`Wrote ${opts.out}`);
  } else {
    const readmePath = path.join(REPO_ROOT, 'README.md');
    const readme = await fs.readFile(readmePath, 'utf8');
    await fs.writeFile(readmePath, spliceIntoReadme(readme, block), 'utf8');
    console.error('Updated README.md');
  }

  console.error(
    `\n${counts.total} checked: ${counts.pass} pass, ${counts.fail} fail, ${counts.unknown} undetermined`,
  );
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
