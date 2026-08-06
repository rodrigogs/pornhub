import { gotScraping } from 'got-scraping';
import type {
  RequestOptions,
  RequestResponse,
  RetryableError,
} from './types/base.js';

export const BASE_URL = 'https://www.pornhub.com';

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9',
  cookie:
    'age_verified=1; accessAgeDisclaimerPH=1; accessPH=1; platform=pc; cookiesBanner=closed',
  referer: `${BASE_URL}/`,
};

const REQUEST_TIMEOUT = 20_000;
const REQUEST_ATTEMPTS = 3;
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ETIMEDOUT',
]);

export const resolveUrl = (path: string | undefined): string => {
  if (!path) {
    return '';
  }

  return new URL(path, BASE_URL).toString();
};

export const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export const shouldRetry = (error: unknown): error is RetryableError => {
  if (!(error instanceof Error)) {
    return false;
  }

  const retryable = error as RetryableError;

  return (
    retryable.name === 'TimeoutError' ||
    (retryable.code !== undefined && RETRYABLE_ERROR_CODES.has(retryable.code))
  );
};

const RETRY_BASE_DELAY_MS = 750;

/**
 * Exponential backoff with full jitter (AWS recommended): the delay for a
 * given attempt is a uniform random value in [0, base * 2^(attempt-1)).
 * Jitter avoids thundering-herd retry storms against rate limiters.
 */
export const computeRetryDelay = (
  attempt: number,
  random: () => number = Math.random,
): number => {
  const base = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.round(base * random());
};

export const createRequest = (options: RequestOptions = {}) => ({
  async get(path: string): Promise<RequestResponse> {
    const transport = options.transport ?? gotScraping;
    const sleep = options.sleep ?? delay;
    let attempt = 1;

    while (true) {
      try {
        const response = await transport({
          url: resolveUrl(path),
          headers: {
            ...DEFAULT_HEADERS,
            ...options.headers,
          },
          http2: false,
          responseType: 'text',
          throwHttpErrors: true,
          retry: {
            limit: 0,
          },
          timeout: {
            request: REQUEST_TIMEOUT,
          },
        });

        return {
          data:
            typeof response.body === 'string'
              ? response.body
              : String(response.body),
          statusCode: response.statusCode,
          url: response.url,
        };
      } catch (error) {
        if (!shouldRetry(error) || attempt === REQUEST_ATTEMPTS) {
          throw error;
        }

        await sleep(computeRetryDelay(attempt, options.random));
        attempt += 1;
      }
    }
  },
});

export default {
  BASE_URL,
  computeRetryDelay,
  createRequest,
  delay,
  resolveUrl,
};
