import { afterEach, describe, expect, it, vi } from 'vitest';
import base, {
  BASE_URL,
  configureRequest,
  createRequest,
  delay,
  resetSharedThrottle,
  resolveUrl,
  shouldRetry,
} from '../../src/base.js';

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.restoreAllMocks();
  resetSharedThrottle();
});

describe('base helpers', () => {
  it('exposes the base url and resolves relative paths', () => {
    expect(BASE_URL).toBe('https://www.pornhub.com');
    expect(resolveUrl()).toBe('');
    expect(resolveUrl('/video')).toBe('https://www.pornhub.com/video');
    expect(resolveUrl('https://www.pornhub.org/video')).toBe(
      'https://www.pornhub.org/video',
    );
    expect(base).toMatchObject({
      BASE_URL,
      createRequest,
      delay,
      resolveUrl,
    });
  });

  it('waits for the requested delay', async () => {
    vi.useFakeTimers();

    const pending = delay(50);
    let settled = false;
    pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(49);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it('detects retryable errors', () => {
    expect(shouldRetry('timeout')).toBe(false);
    expect(shouldRetry(new Error('boom'))).toBe(false);
    expect(
      shouldRetry(
        Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
      ),
    ).toBe(true);
    expect(
      shouldRetry(Object.assign(new Error('reset'), { code: 'ECONNRESET' })),
    ).toBe(true);
    expect(
      shouldRetry(Object.assign(new Error('bad gateway'), { code: 'EOTHER' })),
    ).toBe(false);
  });

  it('builds request options and coerces non-string bodies', async () => {
    const transport = vi.fn().mockResolvedValue({
      body: { ok: true },
      statusCode: 201,
      url: 'https://www.pornhub.com/video',
    });
    const request = createRequest({
      transport,
      headers: {
        'x-test': '1',
      },
    });

    await expect(request.get('/video')).resolves.toEqual({
      data: '[object Object]',
      statusCode: 201,
      url: 'https://www.pornhub.com/video',
    });

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://www.pornhub.com/video',
        http2: false,
        responseType: 'text',
        throwHttpErrors: true,
        retry: {
          limit: 0,
        },
        timeout: {
          request: 20_000,
        },
        headers: expect.objectContaining({
          'x-test': '1',
          referer: 'https://www.pornhub.com/',
        }),
      }),
    );
  });

  it('retries retryable transport errors and then succeeds', async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
      )
      .mockResolvedValueOnce({
        body: 'ok',
        statusCode: 200,
        url: 'https://www.pornhub.com/video',
      });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = createRequest({ transport, sleep, random: () => 1 });

    await expect(request.get('/video')).resolves.toEqual({
      data: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(750);
  });

  it('does not retry non-retryable errors', async () => {
    const error = new Error('boom');
    const transport = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = createRequest({ transport, sleep });

    await expect(request.get('/video')).rejects.toThrow('boom');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops retrying after the final attempt', async () => {
    const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const transport = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = createRequest({ transport, sleep, random: () => 1 });

    await expect(request.get('/video')).rejects.toThrow('timeout');
    expect(transport).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 750);
    expect(sleep).toHaveBeenNthCalledWith(2, 1500);
  });

  it('applies full jitter to the exponential backoff', async () => {
    const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const transport = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = createRequest({ transport, sleep, random: () => 0.5 });

    await expect(request.get('/video')).rejects.toThrow('timeout');
    expect(sleep).toHaveBeenNthCalledWith(1, 375);
    expect(sleep).toHaveBeenNthCalledWith(2, 750);
  });

  it('uses the default got-scraping transport when none is provided', async () => {
    const gotScraping = vi.fn().mockResolvedValue({
      body: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });

    vi.doMock('got-scraping', () => ({ gotScraping }));

    const { createRequest: createDefaultRequest } = await import(
      '../../src/base.js'
    );

    await expect(createDefaultRequest().get('/video')).resolves.toEqual({
      data: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });
    expect(gotScraping).toHaveBeenCalledTimes(1);
  });

  it('passes the proxy url to the transport', async () => {
    const transport = vi.fn().mockResolvedValue({
      body: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });
    const request = createRequest({
      transport,
      proxyUrl: 'http://proxy.local:8080',
    });

    await request.get('/video');

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        proxyUrl: 'http://proxy.local:8080',
      }),
    );
  });

  it('throttles request starts with a shared minimum interval', async () => {
    const transport = vi.fn().mockResolvedValue({
      body: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    let now = 1_000;
    const request = createRequest({
      transport,
      sleep,
      now: () => now,
      minRequestIntervalMs: 500,
    });

    await request.get('/video'); // first request: no wait
    expect(sleep).not.toHaveBeenCalled();

    now += 300; // 300ms later — must wait 200ms
    await request.get('/video');
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenLastCalledWith(200);

    now += 700; // 700ms later — no wait needed
    await request.get('/video');
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('shares the throttle across request instances', async () => {
    const transport = vi.fn().mockResolvedValue({
      body: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    let now = 5_000;

    const first = createRequest({
      transport,
      sleep,
      now: () => now,
      minRequestIntervalMs: 1000,
    });
    const second = createRequest({ transport, sleep, now: () => now });

    await first.get('/video'); // t=5000
    now += 200;
    await second.get('/video'); // t=5200 — must wait 800ms (shared state)

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenLastCalledWith(800);
  });

  it('takes the largest requested interval across instances', async () => {
    const transport = vi.fn().mockResolvedValue({
      body: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    let now = 10_000;

    createRequest({
      transport,
      sleep,
      now: () => now,
      minRequestIntervalMs: 400,
    });
    createRequest({
      transport,
      sleep,
      now: () => now,
      minRequestIntervalMs: 900,
    });

    const third = createRequest({ transport, sleep, now: () => now });

    await third.get('/video'); // first request: no wait
    now += 500; // within 900ms window
    await third.get('/video');

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenLastCalledWith(400);
  });

  it('applies the shared config from configureRequest to plain clients', async () => {
    const transport = vi.fn().mockResolvedValue({
      body: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    let now = 20_000;

    configureRequest({ minRequestIntervalMs: 700 });

    const request = createRequest({ transport, sleep, now: () => now });

    await request.get('/video'); // first request: no wait
    now += 300; // within 700ms window
    await request.get('/video');

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenLastCalledWith(400);
  });

  it('routes plain clients through the shared proxy url', async () => {
    const transport = vi.fn().mockResolvedValue({
      body: 'ok',
      statusCode: 200,
      url: 'https://www.pornhub.com/video',
    });

    configureRequest({ proxyUrl: 'http://shared-proxy:3128' });

    const request = createRequest({ transport });

    await request.get('/video');

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ proxyUrl: 'http://shared-proxy:3128' }),
    );
  });
});
