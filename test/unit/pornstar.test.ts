import { afterEach, describe, expect, it, vi } from 'vitest';

const requestGet = vi.fn();
const mockDelay = vi.fn().mockResolvedValue(undefined);
const mockResolveUrl = vi.fn((path: string | undefined) => {
  return path ? new URL(path, 'https://www.pornhub.com').toString() : '';
});

const pornstarListHtml = ({
  viewkey,
  title,
}: {
  viewkey: string;
  title: string;
}) => `
  <title>Michael Fly Porn Videos | Pornhub.com</title>
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

// Pornhub redirects unknown /pornstar/<slug> to the generic /pornstars
// directory — the page guard must reject it (empty listing, not garbage).
const genericDirectoryHtml = `
  <title>Top Pornstars and Models In Full-Length Free Sex Videos | Pornhub.com</title>
  <ul id="videoCategory" class="videos">
    <li class="pcVideoListItem" data-video-vkey="irrelevant123">
      <a class="linkVideoThumb" href="/view_video.php?viewkey=irrelevant123" title="Unrelated video">
        <img data-mediumthumb="https://cdn.example.com/irrelevant123.jpg" />
      </a>
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

const mockRoutes = (routes: Record<string, string[]>) => {
  const queue = new Map(Object.entries(routes));

  requestGet.mockImplementation(async (path: string) => {
    const replies = queue.get(path);

    if (!replies?.length) {
      throw new Error(`Unexpected request: ${path}`);
    }

    const reply = replies.shift() as string;

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

describe('pornstar listing', () => {
  it('slugs the actor name and parses the pornstar page', async () => {
    mockRoutes({
      '/pornstar/michael-fly': [
        pornstarListHtml({
          viewkey: 'abc123def456',
          title: 'Michael Fly scene',
        }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.pornstar({ name: 'Michael Fly' });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('abc123def456');
    expect(result.videos[0].title).toBe('Michael Fly scene');
  });

  it('normalizes accents/spacing when slugging', async () => {
    mockRoutes({
      '/pornstar/abigaile-johnson': [
        pornstarListHtml({ viewkey: 'xyz789', title: 'Scene' }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.pornstar({ name: 'Abigaile Johnson' });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('xyz789');
  });

  it('returns an empty listing for unknown slugs (redirected to generic directory)', async () => {
    // The guard sees the generic directory title and must yield NO videos —
    // callers (the addon) fall back to a generic search instead.
    mockRoutes({
      '/pornstar/lesbian': [
        genericDirectoryHtml,
        genericDirectoryHtml,
        genericDirectoryHtml,
        genericDirectoryHtml,
        genericDirectoryHtml,
      ],
    });

    const api = await importApi();
    const result = await api.videos.pornstar({ name: 'lesbian' });

    expect(result.videos).toHaveLength(0);
    expect(result.hasNext()).toBe(false);
    expect(result.hasPrevious()).toBe(false);
    await expect(result.refresh()).resolves.toMatchObject({
      videos: [],
      pagination: { page: 1 },
    });
    await expect(result.next()).resolves.toMatchObject({
      videos: [],
      pagination: { page: 1 },
    });
    await expect(result.previous()).resolves.toMatchObject({
      videos: [],
      pagination: { page: 1 },
    });
  });

  it('navigates to the next page through the pornstar listing helpers', async () => {
    mockRoutes({
      '/pornstar/michael-fly': [
        pornstarListHtml({ viewkey: 'abc123def456', title: 'Page 1 scene' }),
      ],
      '/pornstar/michael-fly?page=2': [
        pornstarListHtml({ viewkey: 'def456ghi789', title: 'Page 2 scene' }),
      ],
    });

    const api = await importApi();
    const result = await api.videos.pornstar({ name: 'Michael Fly', page: 1 });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe('abc123def456');

    // next() re-invokes pornstar() recursively for page 2.
    const secondPage = await result.next();

    expect(secondPage.videos).toHaveLength(1);
    expect(secondPage.videos[0].videoId).toBe('def456ghi789');
  });

  it('handles a missing name gracefully (unknown slug, empty listing)', async () => {
    mockRoutes({
      '/pornstar/unknown': [
        genericDirectoryHtml,
        genericDirectoryHtml,
      ],
    });

    const api = await importApi();
    const result = await api.videos.pornstar({ name: '' });
    const noName = await api.videos.pornstar({});

    expect(result.videos).toHaveLength(0);
    expect(noName.videos).toHaveLength(0);
    expect(noName.pagination.page).toBe(1);
  });

  it('rejects pages without a recognizable title', async () => {
    mockRoutes({
      '/pornstar/blank-page': ['<html><body></body></html>'],
    });

    const api = await importApi();
    const result = await api.videos.pornstar({ name: 'Blank Page' });

    expect(result.videos).toHaveLength(0);
    expect(result.hasNext()).toBe(false);
  });
});
