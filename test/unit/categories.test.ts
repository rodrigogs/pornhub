import { afterEach, describe, expect, it, vi } from 'vitest';
import { __private__ } from '../../src/videos.js';

const requestGet = vi.fn();
const mockDelay = vi.fn().mockResolvedValue(undefined);
const mockResolveUrl = vi.fn((path: string | undefined) => {
  return path ? new URL(path, 'https://www.pornhub.com').toString() : '';
});

const categoryListHtml = ({
  viewkey,
  title,
}: {
  viewkey: string;
  title: string;
}) => `
  <title>Free Big Dick Porn Movies | Pornhub</title>
  <ul id="videoCategory" class="videos">
    <li class="pcVideoListItem" data-video-vkey="${viewkey}">
      <a class="linkVideoThumb" href="/view_video.php?viewkey=${viewkey}" title="${title}">
        <img data-mediumthumb="https://cdn.example.com/${viewkey}.jpg" />
        <var class="duration">1:02</var>
      </a>
      <div class="thumbnail-info-wrapper">
        <div class="videoUploaderBlock">
          <div class="usernameWrap"><a href="/users/tester">tester</a></div>
          <div class="videoDetailBlock">
            <span class="views"><var>1.2K</var> views</span>
          </div>
        </div>
        <div class="vidTitleWrapper">
          <span class="title">
            <a href="/view_video.php?viewkey=${viewkey}" title="${title}">${title}</a>
          </span>
        </div>
      </div>
    </li>
  </ul>
`;

const importApi = async () => {
  vi.resetModules();

  vi.doMock('../../src/base.js', () => {
    const createRequest = () => ({ get: requestGet });

    return {
      BASE_URL: 'https://www.pornhub.com',
      createRequest,
      delay: mockDelay,
      resolveUrl: mockResolveUrl,
      default: {
        BASE_URL: 'https://www.pornhub.com',
        createRequest,
        delay: mockDelay,
        resolveUrl: mockResolveUrl,
      },
    };
  });

  const { default: api } = await import('../../src/index.js');

  return api;
};

const mockRoutes = (routes: Record<string, Array<Error | string>>) => {
  const queue = new Map(Object.entries(routes));

  requestGet.mockImplementation(async (path: string) => {
    const replies = queue.get(path);

    if (!replies?.length) {
      throw new Error(`Unexpected request: ${path}`);
    }

    const reply = replies.shift() as Error | string;

    if (reply instanceof Error) {
      throw reply;
    }

    return {
      data: reply,
      statusCode: 200,
      url: path.startsWith('http') ? path : mockResolveUrl(path),
    };
  });
};

afterEach(() => {
  requestGet.mockReset();
  mockDelay.mockClear();
  mockResolveUrl.mockClear();
  vi.doUnmock('../../src/base.js');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('category listing', () => {
  it('parses the category page for a valid id', async () => {
    mockRoutes({
      '/video?c=7': [
        categoryListHtml({ viewkey: 'abc123def456', title: 'Big Dick scene' }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.category({ id: 7 });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('abc123def456');
    expect(result.videos[0].title).toBe('Big Dick scene');
  });

  it('navigates to the next page through the category listing helpers', async () => {
    mockRoutes({
      '/video?c=7': [
        categoryListHtml({ viewkey: 'abc123def456', title: 'Page 1 scene' }),
      ],
      '/video?c=7&page=2': [
        categoryListHtml({ viewkey: 'def456ghi789', title: 'Page 2 scene' }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.category({ id: 7, page: 1 });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('abc123def456');

    const secondPage = await result.next();

    expect(secondPage.videos).toHaveLength(1);
    expect(secondPage.videos[0].videoId).toBe('def456ghi789');
  });

  it('returns an empty listing for unknown category ids (404 page)', async () => {
    const notFound = Object.assign(
      new Error('Request failed with status code 404'),
      { response: { statusCode: 404 } },
    );

    mockRoutes({
      '/video?c=999999': [notFound, notFound],
    });

    const api = await importApi();
    const result = await api.videos.category({ id: 999999 });

    expect(result.videos).toHaveLength(0);
    expect(result.hasNext()).toBe(false);
    // The empty listing helpers re-invoke category() and stay empty on 404.
    await expect(result.next()).resolves.toMatchObject({
      videos: [],
      pagination: { page: 1 },
    });
  });

  it('propagates non-404 errors', async () => {
    mockRoutes({
      '/video?c=7': [new Error('upstream down')],
    });

    const api = await importApi();
    await expect(api.videos.category({ id: 7 })).rejects.toThrow(
      'upstream down',
    );
  });

  it('rejects invalid category ids', async () => {
    const api = await importApi();

    await expect(api.videos.category({ id: 0 })).rejects.toThrow(
      'Invalid category id: 0',
    );
    await expect(api.videos.category({ id: 1.5 })).rejects.toThrow(
      'Invalid category id: 1.5',
    );
    await expect(api.videos.category({})).rejects.toThrow(
      'Invalid category id: 0',
    );
  });

  it('validates the category id helper directly', () => {
    expect(() => __private__.assertCategoryId(1)).not.toThrow();
    expect(() => __private__.assertCategoryId(-1)).toThrow(
      'Invalid category id: -1',
    );
  });
});
