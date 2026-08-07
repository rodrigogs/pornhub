import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const videoPayload = {
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

describe('webmasters.videoById', () => {
  it('parses a video_by_id response', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({ video: videoPayload }),
    ]);
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
    const { webmasters } = await importWebmasters([
      JSON.stringify({ code: '2001' }),
    ]);
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

describe('webmasters.search', () => {
  const searchPayload = {
    videos: [videoPayload],
  };

  it('parses search results', async () => {
    const { webmasters, requestGet } = await importWebmasters([
      JSON.stringify(searchPayload),
    ]);

    const result = await webmasters.search('latina');

    expect(result).toHaveLength(1);
    expect(result[0].video_id).toBe('6a636dfc70d39');
    expect(requestGet).toHaveBeenCalledWith('/webmasters/search?search=latina');
  });

  it('builds the query with all filter options', async () => {
    const { webmasters, requestGet } = await importWebmasters([
      JSON.stringify(searchPayload),
    ]);

    await webmasters.search('latina', {
      page: 2,
      tags: ['anal', 'solo'],
      category: ['teen'],
      stars: ['Riley Reid'],
      ordering: 'newest',
      period: 'weekly',
      thumbsize: 'medium',
    });

    const [path] = requestGet.mock.calls[0];

    expect(path).toContain('/webmasters/search?search=latina');
    expect(path).toContain('page=2');
    expect(path).toContain('tags%5B%5D=anal%2Csolo');
    expect(path).toContain('category=teen');
    expect(path).toContain('stars%5B%5D=Riley+Reid');
    expect(path).toContain('ordering=newest');
    expect(path).toContain('period=weekly');
    expect(path).toContain('thumbsize=medium');
  });

  it('returns an empty array for a non-JSON response', async () => {
    const { webmasters } = await importWebmasters(['<html>challenge</html>']);
    const result = await webmasters.search('latina');
    expect(result).toEqual([]);
  });

  it('returns an empty array for a missing videos key', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({ code: '2001' }),
    ]);
    const result = await webmasters.search('latina');
    expect(result).toEqual([]);
  });

  it('normalizes whitespace in the keyword', async () => {
    const { webmasters, requestGet } = await importWebmasters([
      JSON.stringify(searchPayload),
    ]);

    await webmasters.search('  latina   milf  ');

    expect(requestGet).toHaveBeenCalledWith(
      '/webmasters/search?search=latina+milf',
    );
  });

  it('rejects empty search keywords', async () => {
    const { webmasters } = await importWebmasters([]);
    await expect(webmasters.search('   ')).rejects.toThrow(
      'Invalid search keyword',
    );
  });

  it('rejects invalid page numbers', async () => {
    const { webmasters } = await importWebmasters([]);
    await expect(webmasters.search('latina', { page: 0 })).rejects.toThrow(
      'Invalid page: 0',
    );
  });
});

describe('webmasters.isVideoActive', () => {
  it('returns true when the video is active', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({
        active: { video_id: '6a636dfc70d39', is_active: '1' },
      }),
    ]);

    await expect(webmasters.isVideoActive('6a636dfc70d39')).resolves.toBe(true);
  });

  it('returns false when the video is inactive', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({
        active: { video_id: '6a636dfc70d39', is_active: '0' },
      }),
    ]);

    await expect(webmasters.isVideoActive('6a636dfc70d39')).resolves.toBe(
      false,
    );
  });

  it('returns false for an error response', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({ code: '2002', message: 'No video with this ID.' }),
    ]);

    await expect(webmasters.isVideoActive('6a636dfc70d39')).resolves.toBe(
      false,
    );
  });

  it('accepts a full watch-page URL and extracts the viewkey', async () => {
    const { webmasters, requestGet } = await importWebmasters([
      JSON.stringify({
        active: { video_id: '6a636dfc70d39', is_active: '1' },
      }),
    ]);

    await webmasters.isVideoActive(
      'https://www.pornhub.com/view_video.php?viewkey=6a636dfc70d39',
    );

    expect(requestGet).toHaveBeenCalledWith(
      '/webmasters/is_video_active?id=6a636dfc70d39',
    );
  });
});

describe('webmasters.videoEmbedCode', () => {
  it('returns the unescaped embed code', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({
        embed: {
          code: '&lt;iframe src=&quot;https://www.pornhub.com/embed/xyz&quot;&gt;&lt;/iframe&gt;',
        },
      }),
    ]);

    await expect(webmasters.videoEmbedCode('6a636dfc70d39')).resolves.toBe(
      '<iframe src="https://www.pornhub.com/embed/xyz"></iframe>',
    );
  });

  it('returns null for an error response', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({ code: '2002', message: 'No video with this ID.' }),
    ]);

    await expect(
      webmasters.videoEmbedCode('6a636dfc70d39'),
    ).resolves.toBeNull();
  });

  it('returns null for a non-JSON response', async () => {
    const { webmasters } = await importWebmasters(['<html>challenge</html>']);
    await expect(
      webmasters.videoEmbedCode('6a636dfc70d39'),
    ).resolves.toBeNull();
  });
});

describe('webmasters.deletedVideos', () => {
  const deletedPayload = {
    videos: [
      { vkey: 'ph5d205e434de05', deleted_on: '2019-07-06 09:51:33' },
      { vkey: 'ph5d0501cb3281f', deleted_on: '2019-07-06 09:51:20' },
    ],
  };

  it('parses the deleted videos list', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify(deletedPayload),
    ]);

    const result = await webmasters.deletedVideos(2);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      vkey: 'ph5d205e434de05',
      deleted_on: '2019-07-06 09:51:33',
    });
  });

  it('defaults to page 1', async () => {
    const { webmasters, requestGet } = await importWebmasters([
      JSON.stringify(deletedPayload),
    ]);

    await webmasters.deletedVideos();

    expect(requestGet).toHaveBeenCalledWith(
      '/webmasters/deleted_videos?page=1',
    );
  });

  it('returns an empty array for a non-JSON response', async () => {
    const { webmasters } = await importWebmasters(['<html>challenge</html>']);
    const result = await webmasters.deletedVideos();
    expect(result).toEqual([]);
  });

  it('rejects invalid pages', async () => {
    const { webmasters } = await importWebmasters([]);
    await expect(webmasters.deletedVideos(0)).rejects.toThrow(
      'Invalid page: 0',
    );
  });
});

describe('webmasters.tags', () => {
  const tagsPayload = {
    tagsCount: 3,
    tags: ['solo', 'squirting', 'stockings'],
  };

  it('parses the tag list', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify(tagsPayload),
    ]);

    const result = await webmasters.tags('s');

    expect(result).toEqual(['solo', 'squirting', 'stockings']);
  });

  it('defaults to the letter a and lowercases it', async () => {
    const { webmasters, requestGet } = await importWebmasters([
      JSON.stringify(tagsPayload),
    ]);

    await webmasters.tags();

    expect(requestGet).toHaveBeenCalledWith('/webmasters/tags?list=a');

    await webmasters.tags('Z');

    expect(requestGet).toHaveBeenCalledWith('/webmasters/tags?list=z');
  });

  it('returns an empty array for a missing tags key', async () => {
    const { webmasters } = await importWebmasters([JSON.stringify({})]);
    const result = await webmasters.tags('a');
    expect(result).toEqual([]);
  });

  it('rejects multi-character letters', async () => {
    const { webmasters } = await importWebmasters([]);
    await expect(webmasters.tags('ab')).rejects.toThrow('Invalid tag letter');
  });
});

describe('webmasters.categories', () => {
  const categoriesPayload = {
    categories: [
      { id: '10', category: 'orgy' },
      { id: '1', category: 'asian' },
    ],
  };

  it('parses and sorts the category list', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify(categoriesPayload),
    ]);

    const result = await webmasters.categories();

    expect(result).toEqual([
      { id: '1', category: 'asian' },
      { id: '10', category: 'orgy' },
    ]);
  });

  it('returns an empty array for a non-JSON response', async () => {
    const { webmasters } = await importWebmasters(['<html>challenge</html>']);
    const result = await webmasters.categories();
    expect(result).toEqual([]);
  });
});

describe('webmasters.pornstars', () => {
  const pornstarsPayload = {
    stars: [
      { star: { star_name: 'Aali Kali' } },
      { star: { star_name: '4play' } },
    ],
  };

  it('parses the pornstar name list', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify(pornstarsPayload),
    ]);

    const result = await webmasters.pornstars();

    expect(result).toEqual(['Aali Kali', '4play']);
  });

  it('filters out empty star entries', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({ stars: [{ star: {} }, null] }),
    ]);

    const result = await webmasters.pornstars();

    expect(result).toEqual([]);
  });

  it('returns an empty array for a missing stars key', async () => {
    const { webmasters } = await importWebmasters([JSON.stringify({})]);
    const result = await webmasters.pornstars();
    expect(result).toEqual([]);
  });
});

describe('webmasters.pornstarsDetailed', () => {
  const detailedPayload = {
    stars: [
      {
        star: {
          star_name: '2 Pretty 4 Porn',
          star_thumb: 'https://pix.phncdn.com/thumb.jpg',
          star_url: 'https://www.pornhub.com/pornstar/videos_overview',
          gender: 'female',
          videos_count_all: '71',
        },
      },
    ],
  };

  it('parses the detailed pornstar list', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify(detailedPayload),
    ]);

    const result = await webmasters.pornstarsDetailed();

    expect(result).toHaveLength(1);
    expect(result[0].star_name).toBe('2 Pretty 4 Porn');
    expect(result[0].gender).toBe('female');
    expect(result[0].videos_count_all).toBe('71');
  });

  it('returns an empty array for a non-JSON response', async () => {
    const { webmasters } = await importWebmasters(['<html>challenge</html>']);
    const result = await webmasters.pornstarsDetailed();
    expect(result).toEqual([]);
  });

  it('filters out missing star records', async () => {
    const { webmasters } = await importWebmasters([
      JSON.stringify({ stars: [null, { star: undefined }] }),
    ]);

    const result = await webmasters.pornstarsDetailed();

    expect(result).toEqual([]);
  });
});
