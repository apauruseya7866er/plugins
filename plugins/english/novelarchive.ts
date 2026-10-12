import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

type NovelarchiveNovel = {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  genres: string;
  total_chapters: string;
  release_status: string;
  chapter_names?: string[];
  rating: number;
};

type NovelarchiveChapter = {
  number: number;
  name: string;
  content: string;
};

class Novelarchive implements Plugin.PluginBase {
  id = 'novelarchive';
  name = 'NovelArchive';
  icon = 'src/en/novelarchive/icon.png';
  site = 'https://novelarchive.cc';
  version = '1.0.0';

  filters = {
    sort: {
      label: 'Sort By',
      type: FilterTypes.Picker,
      value: 'recent',
      options: [
        { label: 'Recently Updated', value: 'recent' },
        { label: 'Popular', value: 'popular' },
        { label: 'Top Rated', value: 'top_rated' },
        { label: 'Most Chapters', value: 'most_chapters' },
      ],
    },
    status: {
      label: 'Status',
      type: FilterTypes.Picker,
      value: 'all',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Ongoing', value: 'ongoing' },
        { label: 'Completed', value: 'completed' },
        { label: 'Hiatus', value: 'hiatus' },
      ],
    },
  } satisfies Filters;

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetchApi(this.site + url);
    return res.json();
  }

  private mapNovel(novel: NovelarchiveNovel): Plugin.NovelItem {
    return {
      name: novel.title,
      path: novel.id,
      cover: novel.cover_url
        ? new URL(novel.cover_url, this.site).href
        : defaultCover,
    };
  }

  async popularNovels(
    page: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: '24',
    });

    if (showLatestNovels) {
      params.set('sort', 'recent');
    } else if (filters?.sort?.value) {
      params.set('sort', filters.sort.value);
    }

    if (filters?.status?.value && filters.status.value !== 'all') {
      params.set('status', filters.status.value);
    }

    const data = await this.fetchJson<{ novels: NovelarchiveNovel[] }>(
      `/api/novels?${params.toString()}`,
    );

    return data.novels.map(novel => this.mapNovel(novel));
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const data = await this.fetchJson<{ novel: NovelarchiveNovel }>(
      `/api/novels/${novelPath}`,
    );
    const novel = data.novel;

    const chapterNames = novel.chapter_names || [];
    const totalChapters = parseInt(novel.total_chapters) || chapterNames.length;

    const chapters: Plugin.ChapterItem[] = [];
    for (let i = 0; i < totalChapters; i++) {
      chapters.push({
        name: chapterNames[i] || `Chapter ${i + 1}`,
        path: `${novelPath}/chapters/${i + 1}`,
        chapterNumber: i + 1,
      });
    }

    return {
      path: novelPath,
      name: novel.title,
      author: novel.author,
      cover: novel.cover_url
        ? new URL(novel.cover_url, this.site).href
        : defaultCover,
      genres: novel.genres,
      summary: novel.description,
      status:
        novel.release_status === 'completed'
          ? NovelStatus.Completed
          : NovelStatus.Ongoing,
      rating: novel.rating,
      chapters,
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const data = await this.fetchJson<{ chapter: NovelarchiveChapter }>(
      `/api/novels/${chapterPath}`,
    );
    const { content } = data.chapter;

    return content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    if (!searchTerm.trim()) return [];

    const params = new URLSearchParams({
      search: searchTerm,
      page: String(pageNo),
      per_page: '24',
    });

    const data = await this.fetchJson<{ novels: NovelarchiveNovel[] }>(
      `/api/novels?${params.toString()}`,
    );

    return data.novels.map(novel => this.mapNovel(novel));
  }

  resolveUrl = (path: string) => `${this.site}/api/novels/${path}`;
}

export default new Novelarchive();
