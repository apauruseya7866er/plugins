// Logic shared by the committed-README table (source-health-table.js) and the
// published site (publish-health.js). Both must agree: if the README table and
// the live page disagreed about the same run, neither could be trusted.

import fs from 'fs/promises';
import path from 'path';

export const ICON = { PASS: '✅', FAIL: '❌', UNKNOWN: '❔' };

export const VERDICT_ORDER = ['PASS', 'FAIL', 'UNKNOWN'];

/**
 * Worst-status-wins rollup.
 *
 * UNKNOWN is deliberately separate from FAIL. "We were blocked and could not
 * find out" is a different statement from "we got through and the scraper is
 * broken", and collapsing them made a blocked row read as an accusation against
 * a plugin that may work perfectly in the app.
 */
export function overallVerdict(steps, loadError) {
  if (loadError) return 'FAIL';
  if (steps.some(s => s.status === 'FAIL')) return 'FAIL';
  if (steps.some(s => s.status === 'INCONCLUSIVE')) return 'UNKNOWN';
  return 'PASS';
}

/** Most useful short reason: the failing step, else the blocked-site reason. */
export function summarise(steps, loadError) {
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

/**
 * Discover plugin sources for a language.
 *
 * Multisrc-generated files (Foo[template].ts) are excluded: they are produced at
 * build time and are gitignored, so the checked-in tree has nothing authored to
 * test. `*.broken.ts` is excluded because that suffix is a reviewed "do not
 * ship" marker - already known-unavailable, so it would add a permanent red row
 * that says nothing new. Both counts are reported rather than dropped silently.
 */
export async function discoverPlugins(repoRoot, lang) {
  const dir = path.join(repoRoot, 'plugins', lang);
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    throw new Error(`No plugin directory for language '${lang}' at ${dir}`);
  }

  const ts = entries.filter(f => f.endsWith('.ts'));
  const generated = ts.filter(f => f.includes('[') || f.includes(']'));
  const broken = ts.filter(f => f.endsWith('.broken.ts'));
  const live = ts.filter(
    f => !f.includes('[') && !f.includes(']') && !f.endsWith('.broken.ts'),
  );

  return {
    paths: live.sort().map(f => `plugins/${lang}/${f}`),
    skipped: { generated: generated.length, broken: broken.length },
  };
}

/** Run an async worker over items with a bounded pool. */
export async function runPool(items, limit, worker) {
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

/** Replace the managed block in a markdown file, or append it if absent. */
export function spliceIntoReadme(readme, block) {
  const START = '<!-- SOURCE_HEALTH:START -->';
  const END = '<!-- SOURCE_HEALTH:END -->';
  const startIdx = readme.indexOf(START);
  if (startIdx === -1) {
    const sep = readme.endsWith('\n') ? '\n' : '\n\n';
    return `${readme}${sep}${block}\n`;
  }
  const endIdx = readme.indexOf(END, startIdx);
  if (endIdx === -1) {
    throw new Error('README has a SOURCE_HEALTH:START with no matching END');
  }
  return `${readme.slice(0, startIdx)}${block}${readme.slice(endIdx + END.length)}`;
}
