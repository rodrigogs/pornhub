import { type Cheerio, type CheerioAPI, load } from 'cheerio';
import type { Element } from 'domhandler';
import base from './base.js';
import type {
  DetailsInput,
  DetailsManyOptions,
  PornhubVideoOrdering,
  SearchOptions,
  VideoDetailsBatchFailure,
  VideoDetailsBatchItem,
  VideoDetailsBatchResult,
  VideoDetailsResult,
  VideoFiles,
  VideoListResult,
  VideoSummary,
} from './types/videos.js';

export type {
  DetailsInput,
  DetailsManyOptions,
  Pagination,
  PornhubVideoOrdering,
  SearchOptions,
  VideoDetailsBatchFailure,
  VideoDetailsBatchItem,
  VideoDetailsBatchResult,
  VideoDetailsBatchSuccess,
  VideoDetailsResult,
  VideoFiles,
  VideoListResult,
  VideoProfile,
  VideoSummary,
} from './types/videos.js';

const request = base.createRequest();
const ALLOWED_VIDEO_HOST = /(?:^|\.)pornhub\.(?:com|org)$/i;

type JsonRecord = Record<string, unknown>;

type MediaDefinition = {
  width?: number;
  height?: number;
  format?: string;
  quality?: string | number | Array<unknown>;
  videoUrl?: string;
  defaultQuality?: boolean;
  remote?: boolean;
};

type Flashvars = JsonRecord & {
  image_url?: string;
  link_url?: string;
  mediaDefinitions?: MediaDefinition[];
  thumbs?: {
    spritePatterns?: string[];
  };
  thumb_url?: string;
  thumb_url169?: string;
  video_duration?: number | string;
  video_title?: string;
};

const normalizeText = (value: string | null | undefined): string => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const decodeEscapedValue = (value: string): string => {
  return value
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u0026|&amp;/gi, '&')
    .replace(/\\"/g, '"')
    .trim();
};

const uniqueStrings = (values: Array<string | undefined | null>): string[] => {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean)),
  );
};

const assertPage = (page: number): void => {
  if (!Number.isInteger(page) || page < 1 || page > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid page: ${page}`);
  }
};

const assertVideoUrl = (url: string): void => {
  if (!url) {
    throw new Error('Invalid url');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid url');
  }

  if (
    parsed.protocol !== 'https:' ||
    !ALLOWED_VIDEO_HOST.test(parsed.hostname)
  ) {
    throw new Error('Invalid url');
  }
};

const parseNumberWithSuffix = (value: string): number => {
  const match = normalizeText(value)
    .replace(/,/g, '')
    .match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);

  if (!match) {
    return 0;
  }

  const amount = Number.parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();
  const multiplier =
    suffix === 'K'
      ? 1_000
      : suffix === 'M'
        ? 1_000_000
        : suffix === 'B'
          ? 1_000_000_000
          : 1;

  return Math.round(amount * multiplier);
};

const parseDurationSeconds = (value: string | number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = normalizeText(String(value));

  if (!normalized) {
    return 0;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized)) {
    const parts = normalized
      .split(':')
      .map((part) => Number.parseInt(part, 10));

    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const isoMatch = normalized.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);

  if (!isoMatch) {
    return 0;
  }

  const hours = Number.parseInt(isoMatch[1] || '0', 10);
  const minutes = Number.parseInt(isoMatch[2] || '0', 10);
  const seconds = Number.parseInt(isoMatch[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
};

const formatDuration = (durationSeconds: number): string => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return '';
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const parseVideoId = (value: string): string => {
  try {
    const url = new URL(value, base.BASE_URL);
    return normalizeText(url.searchParams.get('viewkey'));
  } catch {
    const match = value.match(/viewkey=([^&]+)/i);
    return normalizeText(match?.[1]);
  }
};

const uniqueSortedPages = (pages: number[], currentPage: number): number[] => {
  return Array.from(new Set([...pages, currentPage])).sort(
    (left, right) => left - right,
  );
};

const readMeta = ($: CheerioAPI, property: string): string => {
  return normalizeText($(`meta[property="${property}"]`).attr('content'));
};

const findVideoObject = (input: unknown): JsonRecord | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      const found = findVideoObject(value);

      if (found) {
        return found;
      }
    }

    return null;
  }

  const item = input as JsonRecord;
  const type = item['@type'];

  if (
    type === 'VideoObject' ||
    (Array.isArray(type) && type.includes('VideoObject'))
  ) {
    return item;
  }

  return (
    findVideoObject(item['@graph']) ||
    findVideoObject(item.mainEntity) ||
    findVideoObject(item.itemListElement) ||
    null
  );
};

const parseJsonLdVideoObject = ($: CheerioAPI): JsonRecord => {
  const scripts = $('script[type="application/ld+json"]')
    .map((_, element) => normalizeText($(element).text()))
    .get()
    .filter(Boolean);

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script) as unknown;
      const found = findVideoObject(parsed);

      if (found) {
        return found;
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return {};
};

const parsePages = ($: CheerioAPI): number[] => {
  return $(
    'li.page_number a, li.page_number span, .pagination a, .pagination span',
  )
    .map((_, element) => Number.parseInt(normalizeText($(element).text()), 10))
    .get()
    .filter((value): value is number => Number.isFinite(value));
};

const pickListingScope = ($: CheerioAPI) => {
  const selectors = [
    '#videoCategory',
    'ul.nf-videos.search-video-thumbs',
    'ul.nf-videos.videos',
    'ul.videos.search-video-thumbs',
    'ul.videos.row-5-thumbs',
  ];

  for (const selector of selectors) {
    const scope = $(selector).first();

    if (scope.find('li.pcVideoListItem').length > 0) {
      return scope;
    }
  }

  return $.root();
};

const parseThumbnailUrl = ($video: Cheerio<Element>): string => {
  const image = $video.find('img').first();
  const candidate =
    image.attr('data-mediumthumb') ||
    image.attr('data-thumb_url') ||
    image.attr('data-image') ||
    image.attr('data-src') ||
    image.attr('src') ||
    '';

  return candidate ? base.resolveUrl(candidate) : '';
};

const parseVideo = ($: CheerioAPI, element: Element): VideoSummary | null => {
  const $video = $(element);
  const link = $video
    .find(
      'a.linkVideoThumb[href*="view_video.php?viewkey="], .title a[href*="view_video.php?viewkey="], .vidTitleWrapper a[href*="view_video.php?viewkey="]',
    )
    .first();
  const path = link.attr('href');

  if (!path) {
    return null;
  }

  const profileLink = $video
    .find(
      '.usernameBadgesWrapper a[href], .usernameWrap a[href], .videoUploaderBlock a[href]',
    )
    .first();
  const title =
    normalizeText(link.attr('title')) ||
    normalizeText($video.find('.title').first().text());
  const duration =
    normalizeText($video.find('var.duration, .duration').first().text()) || '';
  const viewText =
    normalizeText($video.find('.views var').first().text()) ||
    normalizeText($video.find('.views').first().text());

  return {
    url: base.resolveUrl(path),
    videoId:
      normalizeText($video.attr('data-video-vkey')) ||
      parseVideoId(base.resolveUrl(path)),
    title,
    duration,
    durationSeconds: parseDurationSeconds(duration),
    thumbnailUrl: parseThumbnailUrl($video),
    profile: {
      name: normalizeText(profileLink.text()),
      url: base.resolveUrl(profileLink.attr('href')),
    },
    watchCount: parseNumberWithSuffix(viewText),
  };
};

const buildListResult = (
  page: number,
  html: string,
  loadPage: (targetPage: number) => Promise<VideoListResult>,
): VideoListResult => {
  const $ = load(html);
  const scope = pickListingScope($);
  const videos = scope
    .find('li.pcVideoListItem')
    .map((_, element) => parseVideo($, element))
    .get()
    .filter((video): video is VideoSummary => Boolean(video));
  const pages = uniqueSortedPages(parsePages($), page);
  const minPage = Math.min(...pages);
  const maxPage = Math.max(...pages);

  return {
    videos,
    pagination: {
      page,
      pages,
    },
    refresh: () => loadPage(page),
    hasNext: () => page < maxPage,
    next: () => loadPage(page + 1),
    hasPrevious: () => page > minPage && page > 1,
    previous: () => loadPage(page - 1),
  };
};

const loadListingPage = async (
  page: number,
  candidates: string[],
  loadPage: (targetPage: number) => Promise<VideoListResult>,
): Promise<VideoListResult> => {
  let lastError: Error | undefined;

  for (const candidate of Array.from(new Set(candidates))) {
    try {
      const response = await request.get(candidate);
      const result = buildListResult(page, response.data, loadPage);

      if (result.videos.length > 0) {
        return result;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Failed to load page ${page}`);
};

const buildPagedPath = (
  pathname: string,
  page: number,
  params: Record<string, string | undefined> = {},
): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  if (page > 1) {
    query.set('page', String(page));
  }

  const builtQuery = query.toString();

  return builtQuery ? `${pathname}?${builtQuery}` : pathname;
};

const createOrderedListLoader = (
  ordering: PornhubVideoOrdering,
  reload: (page: number) => Promise<VideoListResult>,
  page: number,
): Promise<VideoListResult> => {
  return loadListingPage(
    page,
    [
      buildPagedPath('/video', page, { o: ordering }),
      page === 1 ? `/video?o=${ordering}&page=1` : '',
    ],
    reload,
  );
};

const recommended = async ({
  page = 1,
}: {
  page?: number;
} = {}): Promise<VideoListResult> => {
  assertPage(page);

  return loadListingPage(
    page,
    [buildPagedPath('/recommended', page)],
    (targetPage) => recommended({ page: targetPage }),
  );
};

const hottest = async ({
  page = 1,
}: {
  page?: number;
} = {}): Promise<VideoListResult> => {
  assertPage(page);

  return createOrderedListLoader(
    'ht',
    (targetPage) => hottest({ page: targetPage }),
    page,
  );
};

const mostViewed = async ({
  page = 1,
}: {
  page?: number;
} = {}): Promise<VideoListResult> => {
  assertPage(page);

  return createOrderedListLoader(
    'mv',
    (targetPage) => mostViewed({ page: targetPage }),
    page,
  );
};

const topRated = async ({
  page = 1,
}: {
  page?: number;
} = {}): Promise<VideoListResult> => {
  assertPage(page);

  return createOrderedListLoader(
    'tr',
    (targetPage) => topRated({ page: targetPage }),
    page,
  );
};

const newest = async ({
  page = 1,
}: {
  page?: number;
} = {}): Promise<VideoListResult> => {
  assertPage(page);

  return createOrderedListLoader(
    'cm',
    (targetPage) => newest({ page: targetPage }),
    page,
  );
};

const search = async ({
  page = 1,
  search: searchTerm,
  k,
  ordering = 'mr',
  o,
}: SearchOptions = {}): Promise<VideoListResult> => {
  assertPage(page);

  const query = normalizeText(searchTerm ?? k ?? '');
  const order = o ?? ordering;

  return loadListingPage(
    page,
    [
      buildPagedPath('/video/search', page, {
        search: query,
        o: order,
      }),
    ],
    (targetPage) =>
      search({
        page: targetPage,
        search: query,
        ordering: order,
      }),
  );
};

const parseUploadDate = (html: string): string => {
  const match = html.match(
    /['"]video_date_published['"]\s*:\s*['"](\d{8})['"]/i,
  );

  if (!match) {
    return '';
  }

  return `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`;
};

const extractFlashvars = (html: string): Flashvars => {
  const match = html.match(/var\s+flashvars_\d+\s*=\s*(\{[\s\S]*?\});/i);

  if (!match) {
    return {};
  }

  try {
    return JSON.parse(match[1]) as Flashvars;
  } catch {
    return {};
  }
};

const normalizeMediaUrl = (value: unknown): string => {
  return typeof value === 'string' ? decodeEscapedValue(value) : '';
};

const parseMediaDefinitions = (flashvars: Flashvars): MediaDefinition[] => {
  return Array.isArray(flashvars.mediaDefinitions)
    ? flashvars.mediaDefinitions.filter(
        (item): item is MediaDefinition =>
          Boolean(item) && typeof item === 'object',
      )
    : [];
};

const parseMediaQuality = (definition: MediaDefinition): number => {
  if (
    typeof definition.height === 'number' &&
    Number.isFinite(definition.height)
  ) {
    return definition.height;
  }

  if (
    typeof definition.width === 'number' &&
    Number.isFinite(definition.width)
  ) {
    return definition.width;
  }

  if (
    typeof definition.quality === 'number' &&
    Number.isFinite(definition.quality)
  ) {
    return definition.quality;
  }

  if (typeof definition.quality === 'string') {
    const match = definition.quality.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 0;
  }

  return 0;
};

const extractFiles = (
  flashvars: Flashvars,
  fallbackImage: string,
): VideoFiles => {
  const definitions = parseMediaDefinitions(flashvars)
    .map((definition) => ({
      ...definition,
      videoUrl: normalizeMediaUrl(definition.videoUrl),
    }))
    .filter((definition) => definition.videoUrl);
  const mp4 = definitions
    .filter((definition) => definition.format === 'mp4')
    .sort((left, right) => parseMediaQuality(left) - parseMediaQuality(right));
  const hls = definitions
    .filter((definition) => definition.format === 'hls')
    .sort((left, right) => parseMediaQuality(left) - parseMediaQuality(right));
  const bestHls =
    hls.find((definition) => definition.defaultQuality) || hls.at(-1);
  const thumbs = Array.isArray(flashvars.thumbs?.spritePatterns)
    ? flashvars.thumbs?.spritePatterns.map((value) => decodeEscapedValue(value))
    : [];

  return {
    low: mp4[0]?.videoUrl || '',
    high: mp4.at(-1)?.videoUrl || mp4[0]?.videoUrl || '',
    HLS: bestHls?.videoUrl || '',
    thumb: normalizeMediaUrl(flashvars.image_url) || fallbackImage,
    thumb69:
      normalizeMediaUrl(flashvars.thumb_url169) ||
      normalizeMediaUrl(flashvars.thumb_url) ||
      normalizeMediaUrl(flashvars.image_url) ||
      fallbackImage,
    thumbSlide: thumbs[0] || '',
    thumbSlideBig: thumbs.at(-1) || thumbs[0] || '',
  };
};

const parseTaxonomy = ($: CheerioAPI, selector: string): string[] => {
  return uniqueStrings(
    $(selector)
      .map((_, element) => normalizeText($(element).text()))
      .get(),
  );
};

const parseRating = (
  $: CheerioAPI,
  html: string,
): { voteCount: number; ratingPercent: number } => {
  const up = parseNumberWithSuffix(normalizeText($('.votesUp').first().text()));
  const down = parseNumberWithSuffix(
    normalizeText($('.votesDown').first().text()),
  );
  const voteCount = up + down;

  if (voteCount > 0) {
    return {
      voteCount,
      ratingPercent: Number.parseFloat(((up / voteCount) * 100).toFixed(2)),
    };
  }

  const percentMatch = html.match(/(\d+(?:\.\d+)?)%/);

  return {
    voteCount: up,
    ratingPercent: percentMatch ? Number.parseFloat(percentMatch[1]) : 0,
  };
};

const parseWatchCount = (
  $: CheerioAPI,
  html: string,
  jsonLd: JsonRecord,
): number => {
  const interactionStatistic = jsonLd.interactionStatistic;
  const values = Array.isArray(interactionStatistic)
    ? interactionStatistic
    : interactionStatistic
      ? [interactionStatistic]
      : [];

  for (const value of values) {
    if (value && typeof value === 'object') {
      const count = (value as JsonRecord).userInteractionCount;

      if (typeof count === 'number' && Number.isFinite(count)) {
        return count;
      }

      if (typeof count === 'string') {
        const parsed = parseNumberWithSuffix(count);

        if (parsed > 0) {
          return parsed;
        }
      }
    }
  }

  const direct =
    normalizeText($('.ratingInfo .views .count').first().text()) ||
    normalizeText($('.views .count').first().text()) ||
    normalizeText($('.views var').first().text());

  if (direct) {
    return parseNumberWithSuffix(direct);
  }

  const match = html.match(
    /<div class="views"><span class="count">([^<]+)<\/span>\s*Views/i,
  );
  return parseNumberWithSuffix(match?.[1] ?? '');
};

const delay = (milliseconds: number): Promise<void> => base.delay(milliseconds);

const normalizeDetailsManyOptions = (
  options: DetailsManyOptions = {},
): Required<DetailsManyOptions> => {
  const {
    concurrency = 4,
    retries = 0,
    retryDelayMs = 0,
    minDelayMs = 0,
  } = options;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Invalid concurrency: ${concurrency}`);
  }

  if (!Number.isInteger(retries) || retries < 0) {
    throw new Error(`Invalid retries: ${retries}`);
  }

  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new Error(`Invalid retryDelayMs: ${retryDelayMs}`);
  }

  if (!Number.isFinite(minDelayMs) || minDelayMs < 0) {
    throw new Error(`Invalid minDelayMs: ${minDelayMs}`);
  }

  return {
    concurrency,
    retries,
    retryDelayMs,
    minDelayMs,
  };
};

const createStartGate = (minDelayMs: number): (() => Promise<void>) => {
  if (minDelayMs <= 0) {
    return async () => {};
  }

  let lastStart = 0;
  let queue = Promise.resolve();

  return async () => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    const wait = Math.max(0, lastStart + minDelayMs - Date.now());
    if (wait > 0) {
      await delay(wait);
    }

    lastStart = Date.now();
    release();
  };
};

const retryDetails = async (
  input: DetailsInput,
  retries: number,
  retryDelayMs: number,
): Promise<VideoDetailsResult> => {
  let attempt = 0;

  while (true) {
    try {
      return await details(input);
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }

      attempt += 1;
      await delay(retryDelayMs);
    }
  }
};

const details = async ({ url }: DetailsInput): Promise<VideoDetailsResult> => {
  assertVideoUrl(url);

  const response = await request.get(url);
  const html = response.data;
  const $ = load(html);
  const jsonLd = parseJsonLdVideoObject($);
  const flashvars = extractFlashvars(html);
  const fallbackImage = readMeta($, 'og:image');
  const files = extractFiles(flashvars, fallbackImage);
  const durationSeconds =
    parseDurationSeconds(flashvars.video_duration ?? '') ||
    parseDurationSeconds(readMeta($, 'video:duration')) ||
    parseDurationSeconds(
      typeof jsonLd.duration === 'string' ? jsonLd.duration : '',
    );
  const rating = parseRating($, html);
  const mediaDefinitions = parseMediaDefinitions(flashvars);
  const mediaByQuality = mediaDefinitions.sort(
    (left, right) => parseMediaQuality(left) - parseMediaQuality(right),
  );
  const biggestMedia = mediaByQuality.at(-1);
  const contentUrl =
    (typeof jsonLd.contentUrl === 'string' &&
      normalizeText(jsonLd.contentUrl)) ||
    files.high ||
    files.HLS;

  return {
    title:
      readMeta($, 'og:title') ||
      normalizeText(flashvars.video_title) ||
      (typeof jsonLd.name === 'string' ? normalizeText(jsonLd.name) : ''),
    url,
    videoId: parseVideoId(url),
    duration: formatDuration(durationSeconds),
    durationSeconds,
    thumbnailUrls: uniqueStrings([
      fallbackImage,
      files.thumb,
      files.thumb69,
      files.thumbSlide,
      files.thumbSlideBig,
      ...(Array.isArray(flashvars.thumbs?.spritePatterns)
        ? flashvars.thumbs.spritePatterns.map((value) =>
            decodeEscapedValue(value),
          )
        : []),
      ...(Array.isArray(jsonLd.thumbnailUrl)
        ? jsonLd.thumbnailUrl.filter(
            (value): value is string => typeof value === 'string',
          )
        : typeof jsonLd.thumbnailUrl === 'string'
          ? [jsonLd.thumbnailUrl]
          : []),
    ]),
    watchCount: parseWatchCount($, html, jsonLd),
    voteCount: rating.voteCount,
    ratingPercent: rating.ratingPercent,
    videoType: readMeta($, 'og:video:type') || readMeta($, 'og:type'),
    videoWidth:
      typeof biggestMedia?.width === 'number' ? String(biggestMedia.width) : '',
    videoHeight:
      typeof biggestMedia?.height === 'number'
        ? String(biggestMedia.height)
        : '',
    uploadDate:
      parseUploadDate(html) ||
      (typeof jsonLd.uploadDate === 'string'
        ? normalizeText(jsonLd.uploadDate)
        : ''),
    description:
      (typeof jsonLd.description === 'string' &&
        normalizeText(jsonLd.description)) ||
      readMeta($, 'og:description'),
    contentUrl,
    tags: parseTaxonomy($, '.video-detailed-info .tagsWrapper a.item'),
    categories: parseTaxonomy(
      $,
      '.video-detailed-info .categoriesWrapper a.item',
    ),
    files,
  };
};

const detailsMany = async (
  inputs: DetailsInput[],
  options: DetailsManyOptions = {},
): Promise<VideoDetailsBatchResult> => {
  const normalizedInputs = inputs.map(({ url }) => ({ url }));

  if (normalizedInputs.length === 0) {
    return {
      items: [],
      successes: [],
      failures: [],
    };
  }

  const { concurrency, retries, retryDelayMs, minDelayMs } =
    normalizeDetailsManyOptions(options);
  const startGate = createStartGate(minDelayMs);
  const items = new Array<VideoDetailsBatchItem>(normalizedInputs.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < normalizedInputs.length) {
      const index = cursor;
      cursor += 1;

      const input = normalizedInputs[index];
      await startGate();

      try {
        const value = await retryDetails(input, retries, retryDelayMs);
        items[index] = {
          input,
          ok: true,
          value,
        };
      } catch (error) {
        items[index] = {
          input,
          ok: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, normalizedInputs.length) },
      async () => worker(),
    ),
  );

  const failures = items.filter(
    (item): item is VideoDetailsBatchFailure => item.ok === false,
  );

  return {
    items,
    successes: items.flatMap((item) => (item.ok ? [item.value] : [])),
    failures,
  };
};

const videos = {
  details,
  detailsMany,
  hottest,
  mostViewed,
  newest,
  recommended,
  search,
  topRated,
};

/** @internal */
export const __private__ = {
  assertPage,
  assertVideoUrl,
  buildListResult,
  createStartGate,
  decodeEscapedValue,
  extractFiles,
  extractFlashvars,
  formatDuration,
  normalizeDetailsManyOptions,
  normalizeText,
  parseDurationSeconds,
  parseJsonLdVideoObject,
  parseMediaDefinitions,
  parseNumberWithSuffix,
  parsePages,
  parseRating,
  parseTaxonomy,
  parseUploadDate,
  parseVideo,
  parseVideoId,
  parseWatchCount,
  pickListingScope,
  uniqueSortedPages,
};

export default videos;
