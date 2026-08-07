export type TransportResponse = {
  body: unknown;
  statusCode?: number;
  url: string;
};

export type TransportOptions = {
  url: string;
  headers: Record<string, string>;
  http2: boolean;
  responseType: 'text';
  throwHttpErrors: true;
  retry: { limit: 0 };
  timeout: { request: number };
  proxyUrl?: string;
};

export type Transport = (
  options: TransportOptions,
) => Promise<TransportResponse>;

export type RequestOptions = {
  headers?: Record<string, string>;
  sleep?: (milliseconds: number) => Promise<void>;
  transport?: Transport;
  random?: () => number;
  now?: () => number;
  /** Route requests through an HTTP(S) proxy (e.g. to avoid datacenter-IP blocks). */
  proxyUrl?: string;
  /**
   * Minimum spacing between request starts, shared across every createRequest
   * instance in the process (module-level throttle). Use to stay polite
   * against rate limiters. Default 0 (disabled).
   */
  minRequestIntervalMs?: number;
};

export type RequestResponse = {
  data: string;
  statusCode?: number;
  url: string;
};

export type RetryableError = Error & {
  code?: string;
  name?: string;
};
