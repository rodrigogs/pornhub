import base from './base.js';
import type {
  WebmastersCategoryListItem,
  WebmastersCategoryListResult,
  WebmastersDeletedVideo,
  WebmastersDeletedVideosResult,
  WebmastersPornstarDetail,
  WebmastersPornstarDetailListResult,
  WebmastersPornstarListResult,
  WebmastersSearchOptions,
  WebmastersTagListResult,
  WebmastersVideo,
  WebmastersVideoActiveResult,
  WebmastersVideoByIdResult,
  WebmastersVideoEmbedResult,
  WebmastersVideoSearchResult,
} from './types/webmasters.js';

export type {
  WebmastersCategory,
  WebmastersCategoryListItem,
  WebmastersCategoryListResult,
  WebmastersDeletedVideo,
  WebmastersDeletedVideosResult,
  WebmastersPornstar,
  WebmastersPornstarDetail,
  WebmastersPornstarDetailItem,
  WebmastersPornstarDetailListResult,
  WebmastersPornstarListItem,
  WebmastersPornstarListResult,
  WebmastersSearchOptions,
  WebmastersTag,
  WebmastersTagListResult,
  WebmastersThumb,
  WebmastersThumbSize,
  WebmastersVideo,
  WebmastersVideoActiveResult,
  WebmastersVideoByIdResult,
  WebmastersVideoEmbedResult,
  WebmastersVideoOrdering,
  WebmastersVideoPeriod,
  WebmastersVideoSearchResult,
} from './types/webmasters.js';

const request = base.createRequest();

const assertVideoId = (id: string): void => {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{4,80}$/.test(id)) {
    throw new Error('Invalid Pornhub video id');
  }
};

const assertPage = (page: number): void => {
  if (!Number.isInteger(page) || page < 1 || page > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid page: ${page}`);
  }
};

const assertTagLetter = (letter: string): void => {
  if (typeof letter !== 'string' || !/^[a-z]$/i.test(letter)) {
    throw new Error('Invalid tag letter');
  }
};

/** Extract a bare viewkey from either a full Pornhub URL or a raw id. */
const parseVideoId = (value: string): string => {
  try {
    const url = new URL(value, base.BASE_URL);
    const viewkey = url.searchParams.get('viewkey');

    if (viewkey) {
      return viewkey;
    }
  } catch {
    // Not a URL — fall through to treating the input as a raw id.
  }

  return value.trim();
};

const parseJson = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const joinQueryValue = (values?: string[]): string | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }

  return values.join(',');
};

const normalizeSearchTerm = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const buildSearchPath = (
  search: string,
  options: WebmastersSearchOptions,
): string => {
  const query = new URLSearchParams({ search });

  if (options.page !== undefined) {
    query.set('page', String(options.page));
  }

  const tags = joinQueryValue(options.tags);
  const stars = joinQueryValue(options.stars);
  const category = joinQueryValue(options.category);

  if (tags) {
    query.set('tags[]', tags);
  }

  if (stars) {
    query.set('stars[]', stars);
  }

  if (category) {
    query.set('category', category);
  }

  if (options.ordering !== undefined) {
    query.set('ordering', options.ordering);
  }

  if (options.period !== undefined) {
    query.set('period', options.period);
  }

  if (options.thumbsize !== undefined) {
    query.set('thumbsize', options.thumbsize);
  }

  const built = query.toString();

  return `/webmasters/search?${built}`;
};

/**
 * Fetch structured metadata for a single video from the Pornhub webmasters
 * API (https://www.pornhub.com/webmasters/). Unlike the watch page scrape,
 * this endpoint returns JSON directly and is far more tolerant of request
 * bursts, which makes it a resilient fallback when page scraping fails
 * (throttle, age-gate, temporary 404s).
 *
 * @param id Pornhub viewkey (e.g. "6a636dfc70d39")
 */
const videoById = async (id: string): Promise<WebmastersVideo | null> => {
  assertVideoId(id);
  const response = await request.get(
    `/webmasters/video_by_id?id=${encodeURIComponent(id)}`,
  );

  const parsed = parseJson(response.data) as WebmastersVideoByIdResult | null;

  if (parsed?.video?.video_id) {
    return parsed.video;
  }

  return null;
};

/**
 * Search videos through the webmasters API. Accepts the same query surface
 * as the site search page (tags, categories, pornstars, ordering, period)
 * but returns structured JSON instead of scraped HTML.
 *
 * @param search Free-text search keyword
 * @param options Optional filters: page, tags, category, stars, ordering,
 *   period, thumbsize
 */
const search = async (
  searchTerm: string,
  options: WebmastersSearchOptions = {},
): Promise<WebmastersVideo[]> => {
  const normalized = normalizeSearchTerm(searchTerm);

  if (!normalized) {
    throw new Error('Invalid search keyword');
  }

  if (options.page !== undefined) {
    assertPage(options.page);
  }

  const response = await request.get(buildSearchPath(normalized, options));
  const parsed = parseJson(response.data) as WebmastersVideoSearchResult | null;

  return Array.isArray(parsed?.videos) ? parsed.videos : [];
};

/**
 * Check whether a video still exists on Pornhub. Deleted or unknown videos
 * report `false`.
 *
 * @param idOrUrl Pornhub viewkey or full watch-page URL
 */
const isVideoActive = async (idOrUrl: string): Promise<boolean> => {
  const id = parseVideoId(idOrUrl);
  assertVideoId(id);

  const response = await request.get(
    `/webmasters/is_video_active?id=${encodeURIComponent(id)}`,
  );
  const parsed = parseJson(response.data) as WebmastersVideoActiveResult | null;

  if (parsed && 'active' in parsed) {
    return parsed.active.is_active === '1';
  }

  return false;
};

/**
 * Get the embed HTML code for a video, unescaped.
 *
 * @param idOrUrl Pornhub viewkey or full watch-page URL
 */
const videoEmbedCode = async (idOrUrl: string): Promise<string | null> => {
  const id = parseVideoId(idOrUrl);
  assertVideoId(id);

  const response = await request.get(
    `/webmasters/video_embed_code?id=${encodeURIComponent(id)}`,
  );
  const parsed = parseJson(response.data) as WebmastersVideoEmbedResult | null;

  if (parsed && 'embed' in parsed) {
    return parsed.embed.code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }

  return null;
};

/**
 * List recently deleted videos, most recent first.
 *
 * @param page Page number (default 1)
 */
const deletedVideos = async (page = 1): Promise<WebmastersDeletedVideo[]> => {
  assertPage(page);

  const response = await request.get(`/webmasters/deleted_videos?page=${page}`);
  const parsed = parseJson(
    response.data,
  ) as WebmastersDeletedVideosResult | null;

  return Array.isArray(parsed?.videos) ? parsed.videos : [];
};

/**
 * List tag names starting with a given letter.
 *
 * @param letter Single letter a-z (default 'a')
 */
const tags = async (letter = 'a'): Promise<string[]> => {
  assertTagLetter(letter);

  const response = await request.get(
    `/webmasters/tags?list=${encodeURIComponent(letter.toLowerCase())}`,
  );
  const parsed = parseJson(response.data) as WebmastersTagListResult | null;

  return Array.isArray(parsed?.tags) ? parsed.tags : [];
};

/**
 * List all video categories.
 */
const categories = async (): Promise<WebmastersCategoryListItem[]> => {
  const response = await request.get('/webmasters/categories');
  const parsed = parseJson(
    response.data,
  ) as WebmastersCategoryListResult | null;

  if (!Array.isArray(parsed?.categories)) {
    return [];
  }

  return parsed.categories.sort((a, b) => Number(a.id) - Number(b.id));
};

/**
 * List all pornstar names.
 */
const pornstars = async (): Promise<string[]> => {
  const response = await request.get('/webmasters/stars');
  const parsed = parseJson(
    response.data,
  ) as WebmastersPornstarListResult | null;

  return Array.isArray(parsed?.stars)
    ? parsed.stars.map((item) => item?.star?.star_name).filter(Boolean)
    : [];
};

/**
 * List detailed pornstar records (name, thumb, url, gender, video count).
 * This endpoint is very heavy (20K+ records) — cache the result locally.
 */
const pornstarsDetailed = async (): Promise<WebmastersPornstarDetail[]> => {
  const response = await request.get('/webmasters/stars_detailed');
  const parsed = parseJson(
    response.data,
  ) as WebmastersPornstarDetailListResult | null;

  return Array.isArray(parsed?.stars)
    ? parsed.stars.map((item) => item?.star).filter(Boolean)
    : [];
};

export default {
  categories,
  deletedVideos,
  isVideoActive,
  pornstars,
  pornstarsDetailed,
  search,
  tags,
  videoById,
  videoEmbedCode,
};
