import { CheerioAPI, load as parseHTML } from 'cheerio';
import { fetchApi, fetchText } from '@libs/fetch';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';
import { defaultCover } from '@libs/defaultCover';

type Fragment = {
  success?: boolean;
  chapter?: { chapter_name?: string; content_html?: string };
};

/**
 * NovelPing (novelping.com)
 *
 * Server-rendered, so browsing, search and the novel page are parsed from HTML.
 * Chapter text is the exception: the reader page ships no prose at all (only
 * navigation) and pulls the body from
 * `/ajax/chapter-fragment?novel_id=&chapter_id=&track=0`, which answers JSON.
 * That endpoint needs neither a CSRF token nor a chapter key, so a chapter
 * costs exactly one request.
 *
 * The novel page carries schema.org microdata (itemprop name/author/genre/
 * description/image), which is preferred over the surrounding layout classes:
 * those are cosmetic utility classes that change without notice, whereas the
 * microdata is the page declaring its own content.
 */
class NovelPing implements Plugin.PluginBase {
  id = 'novelping';
  name = 'NovelPing';
  version = '1.0.0';
  icon = 'src/en/novelping/icon.png';
  site = 'https://novelping.com';

  filters = {
    sort: {
      value: 'popular',
      label: 'Sort by',
      options: [
        { label: 'Most Popular', value: 'popular' },
        { label: 'Hot', value: 'hot' },
        { label: 'Latest Release', value: 'updates' },
        { label: 'Completed', value: 'complete' },
      ],
      type: FilterTypes.Picker,
    },
  } as Filters;

  /**
   * Cards sit in different wrappers on every page (home grid, sort pages, search
   * results, sidebar), so this keys off the link itself and de-duplicates rather
   * than trusting any one container class.
   */
  private parseCards($: CheerioAPI): Plugin.NovelItem[] {
    const seen = new Set<string>();
    const novels: Plugin.NovelItem[] = [];

    $('a[href*="/book/"]').each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr('href') || '';
      // Chapter links also contain /book/<slug>/chapter-...; skip those.
      if (href.includes('/chapter-')) return;

      const match = href.match(/\/book\/([a-z0-9-]+)/);
      if (!match) return;
      const slug = match[1];
      if (seen.has(slug)) return;

      const name =
        anchor.attr('title') ||
        anchor.find('h3').first().text().trim() ||
        anchor.text().trim();
      if (!name) return;

      seen.add(slug);
      const cover =
        anchor.find('img').first().attr('src') ||
        `https://images.novelping.com/novel/${slug}.jpg`;

      novels.push({ name, path: `/book/${slug}`, cover });
    });

    return novels;
  }

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const sort = showLatestNovels
      ? 'updates'
      : filters?.sort.value || 'popular';
    const url =
      pageNo > 1
        ? `${this.site}/sort/${sort}?page=${pageNo}`
        : `${this.site}/sort/${sort}`;

    return this.parseCards(parseHTML(await fetchText(url)));
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const query = encodeURIComponent(searchTerm);
    const url =
      pageNo > 1
        ? `${this.site}/search?keyword=${query}&page=${pageNo}`
        : `${this.site}/search?keyword=${query}`;

    return this.parseCards(parseHTML(await fetchText(url)));
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const slug = novelPath.replace(/^\/book\//, '').replace(/\/$/, '');
    const $ = parseHTML(await fetchText(`${this.site}/book/${slug}`));

    const name =
      $('meta[property="og:title"]').attr('content')?.split('|')[0].trim() ||
      $('[itemprop="name"]').first().text().trim();

    const author = $('[itemprop="author"] [itemprop="name"]')
      .attr('content')
      ?.trim();

    const genres: string[] = [];
    $('[itemprop="genre"]').each((_, el) => {
      const genre = ($(el).attr('content') || '')
        .split('/')
        .pop()
        ?.replace(/-/g, ' ')
        .trim();
      if (genre) genres.push(genre);
    });

    const cover =
      $('meta[property="og:image"]').attr('content') ||
      `https://images.novelping.com/novel/${slug}.jpg`;

    const summary = $('#novel-description-content')
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    // The page states its status in prose rather than in a marked-up field, so
    // it is matched against the body text. "Completed" is checked first because
    // a completed listing also carries the word in surrounding chrome.
    const pageText = $('body').text();
    const status = /\bcompleted\b/i.test(pageText)
      ? NovelStatus.Completed
      : /\bongoing\b/i.test(pageText)
        ? NovelStatus.Ongoing
        : NovelStatus.Unknown;

    const chapters: Plugin.ChapterItem[] = [];
    $('li[data-chapter-item]').each((_, el) => {
      const anchor = $(el).find('a[href*="/chapter-"]').first();
      const href = anchor.attr('href');
      if (!href) return;

      const chapterId = href.split('/').pop() || '';
      if (!chapterId) return;

      const chapterName =
        anchor.find('.chapter-title').first().text().trim() ||
        anchor.attr('title')?.trim() ||
        chapterId;

      const numberMatch = chapterId.match(/chapter-(\d+)/);
      chapters.push({
        name: chapterName,
        chapterNumber: numberMatch
          ? Number(numberMatch[1])
          : chapters.length + 1,
        // The novel slug is kept in the path because the fragment endpoint needs
        // it as a separate `novel_id`, and the chapter slug alone does not
        // carry it.
        path: `/${slug}/${chapterId}`,
      });
    });

    return {
      path: novelPath,
      name,
      author,
      cover: cover || defaultCover,
      genres: genres.join(', '),
      status,
      summary,
      chapters,
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    // Path shape is `/<novelSlug>/<chapterSlug>`; the endpoint wants those as two
    // separate parameters, so the single slug is not enough to identify a chapter.
    const raw = chapterPath.replace(/^\//, '');
    const split = raw.indexOf('/');
    const novelId = split >= 0 ? raw.slice(0, split) : '';
    const chapterId = split >= 0 ? raw.slice(split + 1) : raw;

    const url =
      `${this.site}/ajax/chapter-fragment` +
      `?novel_id=${encodeURIComponent(novelId)}` +
      `&chapter_id=${encodeURIComponent(chapterId)}&track=0`;

    const response = await fetchApi(url);
    if (!response.ok) throw new Error(`NovelPing: ${response.status}`);
    const data = (await response.json()) as Fragment;
    const content = data.chapter?.content_html;
    if (!content) throw new Error(`NovelPing: no content for ${chapterId}`);

    // The fragment has no content wrapper: after the injected ad slot the body
    // is a flat run of <p> siblings, so there is nothing to select. Drop the ad
    // slot and any script/style, then keep the paragraphs that remain.
    const $ = parseHTML(content);
    $('.js-ad-slot, script, style').remove();

    const paragraphs = $('p')
      .toArray()
      .map(el => $.html(el))
      .filter(html => html.replace(/<[^>]+>/g, '').trim().length > 0);

    return paragraphs.join('') || $.root().text().trim();
  }
}

export default new NovelPing();
