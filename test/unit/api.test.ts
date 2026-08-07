import { afterEach, describe, expect, it, vi } from 'vitest';
import actualApi from '../../src/index.js';
import actualPornhub from '../../src/pornhub.js';
import actualVideos from '../../src/videos.js';

type RouteReply = Error | string;

const requestGet = vi.fn();
const mockDelay = vi.fn().mockResolvedValue(undefined);
const mockResolveUrl = vi.fn((path: string | undefined) => {
  return path ? new URL(path, 'https://www.pornhub.com').toString() : '';
});

const listHtml = ({
  viewkey,
  title,
  pages = [1, 2],
}: {
  viewkey: string;
  title: string;
  pages?: number[];
}) => `
  <ul id="videoCategory" class="videos">
    <li class="pcVideoListItem" data-video-vkey="${viewkey}">
      <a class="linkVideoThumb" href="/view_video.php?viewkey=${viewkey}" title="${title}">
        <img data-mediumthumb="https://cdn.example.com/${viewkey}.jpg" />
        <var class="duration">1:02</var>
      </a>
      <div class="thumbnail-info-wrapper">
        <div class="videoUploaderBlock">
          <div class="usernameWrap">
            <a href="/users/tester">tester</a>
          </div>
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
  <ul class="pagination">
    ${pages
      .map(
        (page) =>
          `<li class="page_number"><a class="greyButton">${page}</a></li>`,
      )
      .join('')}
  </ul>
`;

const emptyListHtml = '<ul id="videoCategory"></ul>';

const detailHtml = ({ viewkey, title }: { viewkey: string; title: string }) => `
  <meta property="og:title" content="${title}" />
  <meta property="og:image" content="https://cdn.example.com/${viewkey}-og.jpg" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:description" content="${title} description" />
  <meta property="video:duration" content="65" />
  <div class="video-detailed-info">
    <div class="categoriesWrapper">
      <a class="item">Category 1</a>
    </div>
    <div class="tagsWrapper">
      <a class="item">Tag 1</a>
    </div>
  </div>
  <div class="ratingInfo">
    <div class="views"><span class="count">2.3K</span> Views</div>
  </div>
  <div class="votes-fav-wrap">
    <span class="votesUp">23</span>
    <span class="votesDown">2</span>
  </div>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": "${title} via JSON-LD",
      "description": "${title} description via JSON-LD",
      "contentUrl": "https://cdn.example.com/${viewkey}.mp4",
      "uploadDate": "2026-03-27",
      "thumbnailUrl": [
        "https://cdn.example.com/${viewkey}-1.jpg",
        "https://cdn.example.com/${viewkey}-2.jpg"
      ]
    }
  </script>
  <script>
    var flashvars_123 = {
      "video_duration": "65",
      "image_url": "https://cdn.example.com/${viewkey}-flash.jpg",
      "mediaDefinitions": [
        {"format": "mp4", "height": 480, "width": 854, "videoUrl": "https://cdn.example.com/${viewkey}-480.mp4"},
        {"format": "mp4", "height": 720, "width": 1280, "videoUrl": "https://cdn.example.com/${viewkey}-720.mp4"},
        {"format": "hls", "height": 720, "width": 1280, "defaultQuality": true, "videoUrl": "https://cdn.example.com/${viewkey}.m3u8"}
      ],
      "thumbs": {
        "spritePatterns": [
          "https://cdn.example.com/${viewkey}-slide-1.jpg",
          "https://cdn.example.com/${viewkey}-slide-2.jpg"
        ]
      }
    };
  </script>
  <script>'video_date_published' : '20260327'</script>
`;

const importApi = async () => {
  vi.resetModules();

  vi.doMock('../../src/base.js', () => {
    const createRequest = () => ({
      get: requestGet,
    });

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

const mockRoutes = (routes: Record<string, RouteReply[]>) => {
  const queue = new Map(Object.entries(routes));

  requestGet.mockImplementation(async (path: string) => {
    const replies = queue.get(path);

    if (!replies?.length) {
      throw new Error(`Unexpected request: ${path}`);
    }

    const reply = replies.shift();

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

describe('public api', () => {
  it('re-exports videos through the package entry point', () => {
    expect(actualApi).toBe(actualPornhub);
    expect(actualApi.videos).toBe(actualVideos);
  });

  it('loads list endpoints and pagination helpers through the public api', async () => {
    mockRoutes({
      '/recommended': [
        listHtml({ viewkey: 'recommended-1', title: 'Recommended 1' }),
        listHtml({ viewkey: 'recommended-1', title: 'Recommended 1' }),
      ],
      '/recommended?page=2': [
        listHtml({
          viewkey: 'recommended-2',
          title: 'Recommended 2',
          pages: [1, 2],
        }),
      ],
      '/video?o=ht': [emptyListHtml],
      '/video?o=ht&page=1': [
        listHtml({ viewkey: 'hottest-1', title: 'Hottest 1' }),
        listHtml({ viewkey: 'hottest-1', title: 'Hottest 1' }),
      ],
      '/video?o=mv&page=2': [
        listHtml({ viewkey: 'most-viewed-2', title: 'Most Viewed 2' }),
      ],
      '/video?o=mv': [
        listHtml({ viewkey: 'most-viewed-1', title: 'Most Viewed 1' }),
      ],
      '/video?o=tr': [
        listHtml({ viewkey: 'top-rated-1', title: 'Top Rated 1' }),
        listHtml({ viewkey: 'top-rated-1', title: 'Top Rated 1' }),
      ],
      '/video?o=cm': [
        listHtml({ viewkey: 'newest-1', title: 'Newest 1' }),
        listHtml({ viewkey: 'newest-1', title: 'Newest 1' }),
      ],
      '/video/search?search=query&o=tr&page=2': [
        listHtml({ viewkey: 'search-2', title: 'Search 2' }),
        listHtml({ viewkey: 'search-2', title: 'Search 2' }),
      ],
    });

    const api = await importApi();
    const recommended = await api.videos.recommended();
    const refreshed = await recommended.refresh();
    const recommendedPage2 = await recommended.next();
    const hottest = await api.videos.hottest();
    const hottestRefreshed = await hottest.refresh();
    const mostViewed = await api.videos.mostViewed({ page: 2 });
    const mostViewedPage1 = await mostViewed.previous();
    const topRated = await api.videos.topRated();
    const topRatedRefreshed = await topRated.refresh();
    const newest = await api.videos.newest();
    const newestRefreshed = await newest.refresh();
    const search = await api.videos.search({
      k: '  query  ',
      o: 'tr',
      page: 2,
    });
    const searchRefreshed = await search.refresh();

    expect(recommended.videos[0].videoId).toBe('recommended-1');
    expect(refreshed.videos[0].title).toBe('Recommended 1');
    expect(recommendedPage2.pagination.page).toBe(2);
    expect(hottest.videos[0].title).toBe('Hottest 1');
    expect(hottestRefreshed.videos[0].title).toBe('Hottest 1');
    expect(mostViewed.pagination.page).toBe(2);
    expect(mostViewedPage1.pagination.page).toBe(1);
    expect(topRated.videos[0].title).toBe('Top Rated 1');
    expect(topRatedRefreshed.videos[0].title).toBe('Top Rated 1');
    expect(newest.videos[0].title).toBe('Newest 1');
    expect(newestRefreshed.videos[0].title).toBe('Newest 1');
    expect(search.videos[0].videoId).toBe('search-2');
    expect(searchRefreshed.videos[0].videoId).toBe('search-2');
    expect(requestGet).toHaveBeenCalledWith('/video?o=ht');
    expect(requestGet).toHaveBeenCalledWith('/video?o=ht&page=1');
    expect(requestGet).toHaveBeenCalledWith('/video?o=mv&page=2');
    expect(requestGet).toHaveBeenCalledWith('/video?o=mv');
    expect(requestGet).toHaveBeenCalledWith(
      '/video/search?search=query&o=tr&page=2',
    );
  });

  it('surfaces public listing failures and empty results', async () => {
    mockRoutes({
      '/recommended': [new Error('offline')],
      '/video/search?o=mr': [emptyListHtml],
    });

    const api = await importApi();

    await expect(api.videos.recommended()).rejects.toThrow('offline');
    await expect(api.videos.search()).rejects.toThrow('Failed to load page 1');
  });

  it('coerces non-error failures from list and batch loaders', async () => {
    const badUrl = 'https://www.pornhub.com/view_video.php?viewkey=string-fail';

    requestGet.mockImplementation(async (path: string) => {
      if (path === '/video?o=tr' || path === '/video?o=tr&page=1') {
        throw 'offline';
      }

      if (path === badUrl) {
        throw 'string failure';
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    const api = await importApi();

    await expect(api.videos.topRated()).rejects.toThrow('offline');

    const batch = await api.videos.detailsMany([{ url: badUrl }]);

    expect(batch.failures).toHaveLength(1);
    expect(batch.failures[0].error).toBeInstanceOf(Error);
    expect(batch.failures[0].error.message).toBe('string failure');
  });

  it('loads details and batches mixed detail results', async () => {
    const goodUrl = 'https://www.pornhub.com/view_video.php?viewkey=good';
    const flakyUrl = 'https://www.pornhub.com/view_video.php?viewkey=flaky';
    const badUrl = 'https://www.pornhub.com/view_video.php?viewkey=bad';

    mockRoutes({
      [goodUrl]: [detailHtml({ viewkey: 'good', title: 'Good Title' })],
      [flakyUrl]: [
        new Error('temporary failure'),
        detailHtml({ viewkey: 'flaky', title: 'Flaky Title' }),
      ],
      [badUrl]: [
        new Error('permanent failure'),
        new Error('permanent failure'),
      ],
    });

    const dateNow = vi.spyOn(Date, 'now');
    dateNow
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(106)
      .mockReturnValue(106);

    const api = await importApi();
    const detail = await api.videos.details({ url: goodUrl });
    const emptyBatch = await api.videos.detailsMany([]);
    const batch = await api.videos.detailsMany(
      [{ url: flakyUrl }, { url: badUrl }],
      {
        concurrency: 2,
        retries: 1,
        retryDelayMs: 7,
        minDelayMs: 5,
      },
    );

    expect(detail).toMatchObject({
      title: 'Good Title',
      url: goodUrl,
      videoId: 'good',
      duration: '1:05',
      durationSeconds: 65,
      watchCount: 2300,
      voteCount: 25,
      ratingPercent: 92,
      videoType: 'video/mp4',
      videoWidth: '1280',
      videoHeight: '720',
      uploadDate: '2026-03-27',
      description: 'Good Title description via JSON-LD',
      contentUrl: 'https://cdn.example.com/good.mp4',
      tags: ['Tag 1'],
      categories: ['Category 1'],
      files: expect.objectContaining({
        high: 'https://cdn.example.com/good-720.mp4',
        HLS: 'https://cdn.example.com/good.m3u8',
      }),
    });
    expect(detail.thumbnailUrls).toEqual(
      expect.arrayContaining([
        'https://cdn.example.com/good-og.jpg',
        'https://cdn.example.com/good-flash.jpg',
        'https://cdn.example.com/good-slide-1.jpg',
        'https://cdn.example.com/good-slide-2.jpg',
      ]),
    );
    expect(emptyBatch).toEqual({
      items: [],
      successes: [],
      failures: [],
    });
    expect(batch.items).toHaveLength(2);
    expect(batch.successes).toHaveLength(1);
    expect(batch.successes[0].videoId).toBe('flaky');
    expect(batch.failures).toHaveLength(1);
    expect(batch.failures[0].input).toEqual({ url: badUrl });
    expect(batch.failures[0].error.message).toBe('permanent failure');
    expect(mockDelay.mock.calls.map(([value]) => value)).toEqual(
      expect.arrayContaining([5, 7]),
    );
  });

  it('falls back across sparse detail metadata', async () => {
    const sparseUrl = 'https://www.pornhub.com/view_video.php?viewkey=sparse';

    mockRoutes({
      [sparseUrl]: [
        `
          <meta property="og:type" content="video.other" />
          <meta property="og:description" content="Meta description" />
          <div class="video-detailed-info">
            <div class="categoriesWrapper"><a class="item">Category 2</a></div>
            <div class="tagsWrapper"><a class="item">Tag 2</a></div>
          </div>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "duration": "PT2M",
              "uploadDate": "2026-04-01",
              "thumbnailUrl": "https://cdn.example.com/sparse-jsonld.jpg"
            }
          </script>
          <script>
            var flashvars_99 = {
              "video_title": "Flash Title",
              "thumb_url": "https://cdn.example.com/sparse-thumb.jpg",
              "mediaDefinitions": [
                {"format": "hls", "videoUrl": "https://cdn.example.com/sparse.m3u8"}
              ]
            };
          </script>
        `,
      ],
    });

    const api = await importApi();
    const detail = await api.videos.details({ url: sparseUrl });

    expect(detail).toMatchObject({
      title: 'Flash Title',
      duration: '2:00',
      durationSeconds: 120,
      videoType: 'video.other',
      videoWidth: '',
      videoHeight: '',
      uploadDate: '2026-04-01',
      description: 'Meta description',
      contentUrl: 'https://cdn.example.com/sparse.m3u8',
      tags: ['Tag 2'],
      categories: ['Category 2'],
    });
    expect(detail.thumbnailUrls).toEqual(
      expect.arrayContaining([
        'https://cdn.example.com/sparse-thumb.jpg',
        'https://cdn.example.com/sparse-jsonld.jpg',
      ]),
    );
  });

  it('uses late detail fallbacks when earlier metadata is absent', async () => {
    const jsonLdTitleUrl =
      'https://www.pornhub.com/view_video.php?viewkey=jsonld-title';
    const blankTitleUrl =
      'https://www.pornhub.com/view_video.php?viewkey=blank-title';

    mockRoutes({
      [jsonLdTitleUrl]: [
        `
          <div class="video-detailed-info"></div>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "name": "JSON-LD Title",
              "duration": 120
            }
          </script>
          <script>
            var flashvars_77 = {
              "mediaDefinitions": [
                {"format": "mp4", "videoUrl": "https://cdn.example.com/jsonld-unknown.mp4"},
                {"format": "mp4", "quality": "720p", "videoUrl": "https://cdn.example.com/jsonld-known.mp4"}
              ]
            };
          </script>
        `,
      ],
      [blankTitleUrl]: [
        `
          <div class="video-detailed-info"></div>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "name": 123
            }
          </script>
          <script>
            var flashvars_78 = {
              "mediaDefinitions": [
                {"format": "mp4", "videoUrl": "https://cdn.example.com/blank-unknown.mp4"},
                {"format": "mp4", "quality": "720p", "videoUrl": "https://cdn.example.com/blank-known.mp4"}
              ]
            };
          </script>
        `,
      ],
    });

    const api = await importApi();
    const jsonLdDetail = await api.videos.details({ url: jsonLdTitleUrl });
    const blankDetail = await api.videos.details({ url: blankTitleUrl });

    expect(jsonLdDetail).toMatchObject({
      title: 'JSON-LD Title',
      duration: '',
      durationSeconds: 0,
      contentUrl: 'https://cdn.example.com/jsonld-known.mp4',
      uploadDate: '',
    });
    expect(jsonLdDetail.thumbnailUrls).toEqual([]);
    expect(blankDetail.title).toBe('');
    expect(blankDetail.durationSeconds).toBe(0);
    expect(blankDetail.uploadDate).toBe('');
    expect(blankDetail.thumbnailUrls).toEqual([]);
  });

  it('exposes configure() on the public api', async () => {
    const configureRequest = vi.fn();
    const createRequest = () => ({ get: requestGet });

    vi.doMock('../../src/base.js', () => ({
      BASE_URL: 'https://www.pornhub.com',
      configureRequest,
      createRequest,
      delay: mockDelay,
      resolveUrl: mockResolveUrl,
      default: {
        BASE_URL: 'https://www.pornhub.com',
        configureRequest,
        createRequest,
        delay: mockDelay,
        resolveUrl: mockResolveUrl,
      },
    }));

    const { default: api } = await import('../../src/index.js');

    api.configure({ minRequestIntervalMs: 250, proxyUrl: 'http://p:8080' });

    expect(configureRequest).toHaveBeenCalledWith({
      minRequestIntervalMs: 250,
      proxyUrl: 'http://p:8080',
    });

    api.configure({ minRequestIntervalMs: 0 });

    expect(configureRequest).toHaveBeenCalledWith({
      minRequestIntervalMs: 0,
      proxyUrl: undefined,
    });

    api.configure({});

    expect(configureRequest).toHaveBeenCalledWith({
      minRequestIntervalMs: 0,
      proxyUrl: undefined,
    });
  });
});
