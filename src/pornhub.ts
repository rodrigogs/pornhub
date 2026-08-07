import { configureRequest } from './base.js';
import videos from './videos.js';
import webmasters from './webmasters.js';

export type PornhubConfig = {
  /** Minimum spacing between request starts, shared process-wide. */
  minRequestIntervalMs?: number;
  /** Route requests through an HTTP(S) proxy. */
  proxyUrl?: string;
};

const pornhub = {
  videos,
  webmasters,

  /**
   * Configure process-wide request behavior: a shared minimum interval
   * between request starts (politeness/rate limiting) and/or an HTTP(S)
   * proxy. Applies to every request the library makes from this process.
   */
  configure(config: PornhubConfig): void {
    configureRequest({
      minRequestIntervalMs: config.minRequestIntervalMs ?? 0,
      proxyUrl: config.proxyUrl,
    });
  },
};

export default pornhub;
