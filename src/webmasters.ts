import base from './base.js';
import type {
  WebmastersVideo,
  WebmastersVideoByIdResult,
} from './types/webmasters.js';

export type {
  WebmastersCategory,
  WebmastersPornstar,
  WebmastersTag,
  WebmastersThumb,
  WebmastersVideo,
  WebmastersVideoByIdResult,
} from './types/webmasters.js';

const request = base.createRequest();

const assertVideoId = (id: string): void => {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{4,80}$/.test(id)) {
    throw new Error('Invalid Pornhub video id');
  }
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

  try {
    const parsed = JSON.parse(response.data) as WebmastersVideoByIdResult;
    if (parsed?.video?.video_id) {
      return parsed.video;
    }
  } catch {
    // Non-JSON response (challenge page, etc.) — treat as no data.
  }

  return null;
};

export default {
  videoById,
};
