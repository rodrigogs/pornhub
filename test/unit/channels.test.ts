import { afterEach, describe, expect, it, vi } from 'vitest';

const requestGet = vi.fn();
const mockDelay = vi.fn().mockResolvedValue(undefined);
const mockResolveUrl = vi.fn((path: string | undefined) => {
  return path ? new URL(path, 'https://www.pornhub.com').toString() : '';
});

const channelListHtml = ({
  viewkey,
  title,
}: {
  viewkey: string;
  title: string;
}) => `
  <title>Brazzers's Channel - Pornhub.com</title>
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

// A 404 page — Pornhub returns "Page Not Found" for unknown channel slugs.
// The HTTP layer throws with a response.statusCode of 404 before any HTML
// parsing, so tests simulate that error shape directly.

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

describe('channel listing', () => {
  it('slugs the channel name and parses the channel page', async () => {
    mockRoutes({
      '/channels/brazzers': [
        channelListHtml({ viewkey: 'abc123def456', title: 'Brazzers scene' }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.channels({ name: 'Brazzers' });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('abc123def456');
    expect(result.videos[0].title).toBe('Brazzers scene');
  });

  it('normalizes accents/spacing when slugging', async () => {
    mockRoutes({
      '/channels/bang-bros': [
        channelListHtml({ viewkey: 'xyz789', title: 'Bang Bros scene' }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.channels({ name: 'Bang Bros' });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('xyz789');
  });

  it('returns an empty listing for unknown channel slugs (404 page)', async () => {
    const notFound = Object.assign(
      new Error('Request failed with status code 404'),
      { response: { statusCode: 404 } },
    );

    mockRoutes({
      '/channels/unknown-channel': [notFound, notFound],
    });

    const api = await importApi();
    const result = await api.videos.channels({ name: 'Unknown Channel' });

    expect(result.videos).toHaveLength(0);
    expect(result.hasNext()).toBe(false);
    expect(result.hasPrevious()).toBe(false);
    // The empty listing helpers re-invoke channels() and stay empty on 404.
    await expect(result.next()).resolves.toMatchObject({
      videos: [],
      pagination: { page: 1 },
    });
  });

  it('propagates non-404 errors', async () => {
    mockRoutes({
      '/channels/broken': [new Error('upstream down')],
    });

    const api = await importApi();
    await expect(api.videos.channels({ name: 'Broken' })).rejects.toThrow(
      'upstream down',
    );
  });

  it('navigates to the next page through the channel listing helpers', async () => {
    mockRoutes({
      '/channels/brazzers': [
        channelListHtml({ viewkey: 'abc123def456', title: 'Page 1 scene' }),
      ],
      '/channels/brazzers?page=2': [
        channelListHtml({ viewkey: 'def456ghi789', title: 'Page 2 scene' }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.channels({ name: 'Brazzers', page: 1 });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('abc123def456');

    const secondPage = await result.next();

    expect(secondPage.videos).toHaveLength(1);
    expect(secondPage.videos[0].videoId).toBe('def456ghi789');
  });

  it('handles a missing name gracefully (unknown slug, empty listing)', async () => {
    const notFound = Object.assign(
      new Error('Request failed with status code 404'),
      { response: { statusCode: 404 } },
    );

    mockRoutes({
      '/channels/unknown': [notFound, notFound],
    });

    const api = await importApi();
    const result = await api.videos.channels({ name: '' });
    const noName = await api.videos.channels({});

    expect(result.videos).toHaveLength(0);
    expect(noName.videos).toHaveLength(0);
    expect(noName.pagination.page).toBe(1);
  });

  it('rejects pages without a recognizable title', async () => {
    mockRoutes({
      '/channels/blank-page': ['<html><body></body></html>'],
    });

    const api = await importApi();
    const result = await api.videos.channels({ name: 'Blank Page' });

    expect(result.videos).toHaveLength(0);
    expect(result.hasNext()).toBe(false);
  });
});
