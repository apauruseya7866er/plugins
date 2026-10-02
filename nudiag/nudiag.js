// TEMPORARY diagnostic plugin. Reports what the app's novel fetch path actually
// receives from novelupdates.com, as list rows, because the plugin is the only
// thing that runs inside that path.
//
// Deleted once the real plugin is written.

const cheerio = require('cheerio');
const { fetchApi } = require('@libs/fetch');

const SITE = 'https://www.novelupdates.com/';

const TARGETS = [
  ['rank', SITE + 'series-ranking/?rank=popmonth&pg=1'],
  ['find', SITE + 'series-finder/?sf=1&sort=sdate&order=desc&pg=1'],
  ['srch', SITE + 'series-finder/?sf=1&sh=heaven&sort=srank&order=asc&pg=1'],
];

// Classes worth knowing about, to pick selectors from evidence rather than memory.
const PROBES = [
  'search_main_box_nu',
  'search_title',
  'search_body',
  'search_genres',
  'nu_search_result',
  'series-ranking',
  'rank_name',
  'list_box',
  'content_box',
  'novel_box',
];

function row(label, value) {
  return { name: label + '=' + String(value), path: '/', cover: '' };
}

async function probe(tag, url, rows) {
  let res;
  let text = '';
  try {
    res = await fetchApi(url);
    text = await res.text();
  } catch (e) {
    rows.push(row(tag + '.THROW', (e && e.message ? e.message : e).slice(0, 40)));
    return;
  }
  rows.push(row(tag + '.status', res.status));
  rows.push(row(tag + '.len', text.length));
  rows.push(row(tag + '.chal', /just a moment|cf-mitigated|challenge-platform|enable javascript and cookies/i.test(text)));
  const $ = cheerio.load(text);
  rows.push(row(tag + '.title', ($('title').text() || '').slice(0, 40)));
  for (const p of PROBES) {
    const n = $('.' + p).length;
    if (n) rows.push(row(tag + '.' + p, n));
  }
  // First few anchors that look like series links.
  const links = [];
  $('a[href*="/series/"]').each((i, el) => {
    if (links.length < 3) {
      const href = $(el).attr('href') || '';
      links.push(href.slice(0, 28));
    }
  });
  if (links.length) rows.push(row(tag + '.serlink', links.join('|')));
  // A window of raw body around the first /series/ link, for class context.
  const at = text.indexOf('/series/');
  if (at > 0) {
    rows.push(row(tag + '.ctx', text.slice(Math.max(0, at - 160), at + 40).replace(/\s+/g, ' ').slice(0, 40)));
  }
}

const plugin = {
  id: 'nudiag',
  name: 'NU Diagnostic',
  version: '0.0.1',
  site: SITE,
  filters: {},

  async popularNovels(page) {
    const rows = [];
    for (const [tag, url] of TARGETS) {
      await probe(tag, url, rows);
    }
    return rows;
  },

  async searchNovels(term) {
    return this.popularNovels(1);
  },

  async parseNovel() {
    return { name: 'diag', chapters: [] };
  },

  async parseChapter() {
    return '<p>diag</p>';
  },
};

module.exports.default = plugin;