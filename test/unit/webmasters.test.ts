import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const webmastersPayload = {
  video: {
    duration: '15:30',
    views: 445641,
    video_id: '6a636dfc70d39',
    rating: 86.8,
    ratings: 1731,
    title: 'BRAZZERS scene',
    url: 'https://www.pornhub.com/view_video.php?viewkey=6a636dfc70d39',
    default_thumb: 'https://pix.phncdn.com/thumb.jpg',
    thumb: 'https://pix.phncdn.com/thumb.jpg',
    publish_date: '2026-07-28 07:30:12',
    thumbs: [],
    tags: [{ tag_name: 'tokyo leigh' }],
    pornstars: [{ pornstar_name: 'Christian Clay' }],
    categories: [{ category: 'asian' }],
    segment: 'Straight',
    description: '',
  },
};

const importWebmasters = async (replies: Array<Error | string>) => {
  vi.resetModules();
  const requestGet = vi.fn();

  requestGet.mockImplementation(async (path: string) => {
    const reply = replies.shift();
    if (reply instanceof Error) {
      throw reply;
    }
    return { data: reply ?? '', statusCode: 200, url: path };
  });

  vi.doMock('../../src/base.js', () => {
    const createRequest = () => ({ get: requestGet });

    return {
      BASE_URL: 'https://www.pornhub.com',
      createRequest,
      delay: vi.fn().mockResolvedValue(undefined),
      resolveUrl: (path: string | undefined) =>
        path ? new URL(path, 'https://www.pornhub.com').toString() : '',
      default: {
        BASE_URL: 'https://www.pornhub.com',
        createRequest,
        delay: vi.fn().mockResolvedValue(undefined),
        resolveUrl: (path: string | undefined) =>
          path ? new URL(path, 'https://www.pornhub.com').toString() : '',
      },
    };
  });

  const { default: webmasters } = await import('../../src/webmasters.js');
  return { webmasters, requestGet };
};

describe('webmasters', () => {
  it('parses a video_by_id response', async () => {
    const { webmasters } = await importWebmasters([JSON.stringify(webmastersPayload)]);
    const result = await webmasters.videoById('6a636dfc70d39');

    expect(result?.title).toBe('BRAZZERS scene');
    expect(result?.pornstars).toEqual([{ pornstar_name: 'Christian Clay' }]);
    expect(result?.categories).toEqual([{ category: 'asian' }]);
    expect(result?.tags).toEqual([{ tag_name: 'tokyo leigh' }]);
    expect(result?.publish_date).toBe('2026-07-28 07:30:12');
  });

  it('returns null for a non-JSON response', async () => {
    const { webmasters } = await importWebmasters(['<html>challenge</html>']);
    const result = await webmasters.videoById('6a636dfc70d39');
    expect(result).toBeNull();
  });

  it('returns null for a response without a video object', async () => {
    const { webmasters } = await importWebmasters([JSON.stringify({ code: '2001' })]);
    const result = await webmasters.videoById('6a636dfc70d39');
    expect(result).toBeNull();
  });

  it('propagates request errors', async () => {
    const { webmasters } = await importWebmasters([new Error('upstream down')]);
    await expect(webmasters.videoById('6a636dfc70d39')).rejects.toThrow(
      'upstream down',
    );
  });

  it('rejects invalid video ids', async () => {
    const { webmasters } = await importWebmasters([]);
    await expect(webmasters.videoById('')).rejects.toThrow(
      'Invalid Pornhub video id',
    );
    await expect(webmasters.videoById('bad id!')).rejects.toThrow(
      'Invalid Pornhub video id',
    );
  });
});
