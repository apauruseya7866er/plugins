#!/usr/bin/env node

// Publishes the live-check results as static artefacts under site/:
//
//   site/source-health.json   machine-readable, consumed by the Pages page
//   site/health.svg            summary badge, safe to embed in any README
//   site/index.html            the full table, rendered client-side from JSON
//
// The JSON is the source of truth. index.html fetches it at view time, so the
// page shows the newest published run rather than whatever was baked into the
// HTML - a committed HTML table would go stale the moment the workflow finished,
// which is the same snapshot problem in a different file.
//
// Nothing here is generated from a template engine; it is string assembly to
// keep the workflow dependency-free.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkPlugin } from './lib/plugin-health.js';
import {
  discoverPlugins,
  runPool,
  overallVerdict,
  summarise,
  ICON,
} from './lib/health-shared.js';
import { renderSummaryBadge } from './lib/health-badge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');
const SITE_DIR = path.join(REPO_ROOT, 'site');

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * Client-rendered table page. The markup ships empty on purpose: rows are built
 * from source-health.json after fetch, so a page cached before the latest run
 * still updates itself the moment the JSON changes.
 */
function renderIndexHtml(generatedAt) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Source health — Inkbound plugins</title>
<style>
  :root {
    color-scheme: light dark;
    --fg: #1f2328; --muted: #59636e; --bg: #ffffff;
    --border: #d1d9e0; --row: #f6f8fa;
    --pass: #1a7f37; --fail: #cf222e; --unknown: #6e7781;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #e6edf3; --muted: #9198a1; --bg: #0d1117;
      --border: #3d444d; --row: #161b22;
      --pass: #3fb950; --fail: #f85149; --unknown: #8b949e;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1rem; background: var(--bg); color: var(--fg);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .sub { color: var(--muted); font-size: .9rem; margin-bottom: 1.5rem; }
  .tally { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1.25rem; }
  .pill {
    border: 1px solid var(--border); border-radius: 999px;
    padding: .2rem .7rem; font-size: .82rem; background: var(--row);
  }
  .pill b { font-variant-numeric: tabular-nums; }
  .ok b { color: var(--pass); } .bad b { color: var(--fail); } .unk b { color: var(--unknown); }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--border); }
  th { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  td.name { font-weight: 600; }
  td.site a { color: inherit; opacity: .75; text-decoration: none; }
  td.site a:hover { text-decoration: underline; opacity: 1; }
  td.health { white-space: nowrap; }
  td.detail { color: var(--muted); }
  .v-pass { color: var(--pass); } .v-fail { color: var(--fail); } .v-unknown { color: var(--unknown); }
  footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: .82rem; }
  code { background: var(--row); padding: .1rem .3rem; border-radius: 4px; font-size: .85em; }
  #err { color: var(--fail); }
</style>
</head>
<body>
<main>
  <h1>Source health</h1>
  <div class="sub">
    Every shipped English plugin checked against its live site &mdash;
    <strong>popular &rarr; search &rarr; novel &rarr; chapter</strong>.
    Refreshed daily by
    <a href="https://github.com/apauruseya7866er/plugins/actions/workflows/source-health.yml">source-health.yml</a>.
  </div>

  <div class="tally" id="tally"></div>
  <p class="sub" id="stamp"></p>

  <table>
    <thead><tr><th>Source</th><th>Site</th><th>Health</th><th>Detail</th></tr></thead>
    <tbody id="rows"></tbody>
  </table>

  <footer>
    <p><strong>Read the three states carefully.</strong></p>
    <ul>
      <li><span class="v-pass">PASS</span> &mdash; all four checks returned real data from a live request.</li>
      <li><span class="v-fail">FAIL</span> &mdash; the checks ran and the plugin is broken. A real defect.</li>
      <li><span class="v-unknown">UNKNOWN</span> &mdash; the runner never got through, so the plugin was
        never tested. <strong>Not a verdict.</strong> GitHub Actions runners are datacentre IPs and
        large novel sites challenge them by policy; many of these work normally in the app on a phone.</li>
    </ul>
    <p>Reproduce any row locally: <code>npm run check:plugin -- plugins/english/ao3.ts</code></p>
    <p>Generated <code>${esc(generatedAt)}</code>. Data lives in
      <a href="./source-health.json">source-health.json</a>.</p>
  </footer>
</main>

<script>
const VERDICT_CLASS = { PASS: 'v-pass', FAIL: 'v-fail', UNKNOWN: 'v-unknown' };
const ICON = ${JSON.stringify(ICON)};

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

fetch('./source-health.json', { cache: 'no-store' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => {
    const tally = document.getElementById('tally');
    const add = (cls, label, n) => {
      const p = el('span', undefined, 'pill ' + cls);
      p.append(el('b', String(n)), document.createTextNode(' ' + label));
      tally.append(p);
    };
    add('ok', 'passing', d.counts.pass);
    add('bad', 'failing', d.counts.fail);
    add('unk', 'undetermined', d.counts.unknown);
    add('', 'checked', d.counts.total);

    document.getElementById('stamp').textContent =
      'Last run: ' + d.generatedAt + ' (this page reads the JSON at load, so it is never stale).';

    const body = document.getElementById('rows');
    for (const row of d.rows) {
      const tr = el('tr');
      tr.append(el('td', row.name, 'name'));

      const site = el('td', undefined, 'site');
      if (row.site) {
        const a = el('a', row.site.replace(/^https?:\\/\\//, ''));
        a.href = row.site;
        a.rel = 'noreferrer noopener';
        site.append(a);
      }
      tr.append(site);

      tr.append(el('td', (ICON[row.verdict] || '') + ' ' + row.verdict,
                   'health ' + (VERDICT_CLASS[row.verdict] || '')));
      tr.append(el('td', row.detail, 'detail'));
      body.append(tr);
    }
  })
  .catch(e => {
    document.getElementById('rows').replaceChildren(
      el('tr').appendChild(el('td', 'Could not load source-health.json — ' + e.message, 'v-fail')).parentElement
    );
  });
</script>
</body>
</html>
`;
}

async function main() {
  const lang = process.argv[2] || 'english';
  const concurrency = Number(process.argv[3] || 8);

  const discovered = await discoverPlugins(REPO_ROOT, lang);
  const targets = discovered.paths;
  console.error(`Checking ${targets.length} '${lang}' plugins...`);

  let done = 0;
  const raw = await runPool(targets, concurrency, async pluginPath => {
    const r = await checkPlugin(pluginPath);
    done += 1;
    if (done % 10 === 0 || done === targets.length) {
      console.error(`  ${done}/${targets.length}`);
    }
    return r;
  });

  const rows = raw.map(r => {
    const verdict = overallVerdict(r.steps, r.loadError);
    return {
      id: r.pluginId ?? '',
      name: r.pluginName ?? path.basename(r.pluginPath, '.ts'),
      site: r.pluginSite ?? '',
      verdict,
      detail: summarise(r.steps, r.loadError),
      steps: r.steps.map(s => ({
        name: s.name,
        status: s.status,
        detail: s.detail,
      })),
    };
  });

  const rank = { PASS: 0, FAIL: 1, UNKNOWN: 2 };
  rows.sort(
    (a, b) => rank[a.verdict] - rank[b.verdict] || a.name.localeCompare(b.name),
  );

  const counts = {
    total: rows.length,
    pass: rows.filter(r => r.verdict === 'PASS').length,
    fail: rows.filter(r => r.verdict === 'FAIL').length,
    unknown: rows.filter(r => r.verdict === 'UNKNOWN').length,
  };
  const generatedAt =
    new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  await fs.mkdir(SITE_DIR, { recursive: true });

  const payload = {
    generatedAt,
    counts,
    lang,
    skipped: discovered.skipped,
    rows,
  };
  await fs.writeFile(
    path.join(SITE_DIR, 'source-health.json'),
    JSON.stringify(payload, null, 2) + '\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(SITE_DIR, 'health.svg'),
    renderSummaryBadge(counts),
    'utf8',
  );
  await fs.writeFile(
    path.join(SITE_DIR, 'index.html'),
    renderIndexHtml(generatedAt),
    'utf8',
  );

  // Machine-readable stdout for the workflow summary step.
  console.log(JSON.stringify({ counts, generatedAt }));

  // The committed README block. Generated here, in the same pass that writes the
  // live page, so the snapshot and the page come from one payload and cannot
  // disagree about the same run. The table is collapsed by default: it is 63
  // rows of text, and the live page above it is the readable primary view. The
  // summary line carries the run's own counts, so it cannot go stale.
  const md = [
    '<!-- SOURCE_HEALTH:START -->',
    '',
    '## 📡 Source health',
    '',
    '[![Source health](https://apauruseya7866er.github.io/plugins/health.svg)](https://apauruseya7866er.github.io/plugins/)',
    '',
    '**[Live table with per-source detail →](https://apauruseya7866er.github.io/plugins/)**',
    '',
    'Every shipped English plugin is exercised against its real site the way the',
    'app uses it — **popular → search → novel → chapter** — and all four must',
    'return real data. Refreshed daily by',
    '[`source-health.yml`](./.github/workflows/source-health.yml).',
    '',
    'The badge and the linked page above are live: both are regenerated on every',
    'run. The table below is the same data as a committed snapshot, kept for',
    'plain `git` mirrors, search, and run-over-run diffing. **If the two ever',
    'disagree, the live page is current.**',
    '',
    `<details>`,
    `<summary><strong>${counts.total} checked</strong> · ✅ ${counts.pass} passing · ❌ ${counts.fail} failing · ❔ ${counts.unknown} undetermined — expand for the snapshot</summary>`,
    '',
    '| Source | Site | Health | Detail |',
    '| --- | --- | :---: | --- |',
    ...rows.map(
      r =>
        `| **${cell(r.name)}** | ${cell(r.site)} | ${ICON[r.verdict]} ${r.verdict} | ${cell(r.detail)} |`,
    ),
    '',
    '</details>',
    '',
    '<!-- SOURCE_HEALTH:END -->',
  ].join('\n');

  await fs.writeFile(path.join(SITE_DIR, 'README-table.md'), md + '\n', 'utf8');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exitCode = 1;
});
