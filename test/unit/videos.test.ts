import { load } from 'cheerio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __private__ } from '../../src/videos.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const getFirstListItem = ($: ReturnType<typeof load>) => {
  const element = $('li').get(0);

  if (!element) {
    throw new Error('Expected list item');
  }

  return element;
};

describe('videos helpers', () => {
  it('parses number suffixes', () => {
    expect(__private__.parseNumberWithSuffix('543K')).toBe(543_000);
    expect(__private__.parseNumberWithSuffix('3.9M views')).toBe(3_900_000);
    expect(__private__.parseNumberWithSuffix('161M')).toBe(161_000_000);
  });

  it('parses duration strings', () => {
    expect(__private__.parseDurationSeconds('15:25')).toBe(925);
    expect(__private__.parseDurationSeconds('1:02:03')).toBe(3723);
    expect(__private__.parseDurationSeconds('PT1H')).toBe(3600);
    expect(__private__.parseDurationSeconds('457')).toBe(457);
    expect(__private__.formatDuration(457)).toBe('7:37');
    expect(__private__.formatDuration(3723)).toBe('1:02:03');
  });

  it('extracts viewkey from Pornhub URLs', () => {
    expect(
      __private__.parseVideoId(
        'https://www.pornhub.com/view_video.php?viewkey=69c5f390c985f',
      ),
    ).toBe('69c5f390c985f');
    expect(__private__.parseVideoId('/view_video.php?viewkey=abc123')).toBe(
      'abc123',
    );
  });

  it('extracts flashvars and file variants', () => {
    const html = `
      <script type="text/javascript">
        var flashvars_123 = {
          "image_url":"https:\\/\\/cdn.example.com\\/thumb.jpg",
          "video_duration":457,
          "mediaDefinitions":[
            {"format":"hls","quality":"240","height":240,"width":426,"videoUrl":"https:\\/\\/cdn.example.com\\/240.m3u8"},
            {"format":"hls","quality":"720","height":720,"width":1280,"defaultQuality":true,"videoUrl":"https:\\/\\/cdn.example.com\\/720.m3u8"},
            {"format":"mp4","quality":"240","height":240,"width":426,"videoUrl":"https:\\/\\/cdn.example.com\\/240.mp4"},
            {"format":"mp4","quality":"1080","height":1080,"width":1920,"videoUrl":"https:\\/\\/cdn.example.com\\/1080.mp4"}
          ],
          "thumbs":{"spritePatterns":["https:\\/\\/cdn.example.com\\/sprite-1.jpg","https:\\/\\/cdn.example.com\\/sprite-2.jpg"]}
        };
      </script>
    `;

    const flashvars = __private__.extractFlashvars(html);
    const files = __private__.extractFiles(
      flashvars,
      'https://cdn.example.com/fallback.jpg',
    );

    expect(flashvars.video_duration).toBe(457);
    expect(files.low).toBe('https://cdn.example.com/240.mp4');
    expect(files.high).toBe('https://cdn.example.com/1080.mp4');
    expect(files.HLS).toBe('https://cdn.example.com/720.m3u8');
    expect(files.thumb).toBe('https://cdn.example.com/thumb.jpg');
    expect(files.thumbSlide).toBe('https://cdn.example.com/sprite-1.jpg');
    expect(files.thumbSlideBig).toBe('https://cdn.example.com/sprite-2.jpg');
  });

  it('parses list cards and pagination', () => {
    const html = `
      <ul id="videoCategory" class="nf-videos videos search-video-thumbs">
        <li class="pcVideoListItem js-pop videoblock videoBox withKebabMenu"
            data-video-vkey="699ba7b597858">
          <div class="wrap flexibleHeight">
            <a href="/view_video.php?viewkey=699ba7b597858"
               title="Sample title"
               class="linkVideoThumb">
              <img data-mediumthumb="https://cdn.example.com/thumb.jpg" />
              <div class="marker-overlays"><var class="duration">15:25</var></div>
            </a>
            <div class="thumbnail-info-wrapper">
              <div class="videoUploaderBlock">
                <div class="usernameWrap">
                  <a href="/model/summer_steph">Summer_steph</a>
                </div>
                <div class="videoDetailBlock">
                  <span class="views"><var>543K</var> views</span>
                </div>
              </div>
              <div class="vidTitleWrapper">
                <span class="title">
                  <a href="/view_video.php?viewkey=699ba7b597858" title="Sample title">
                    Sample title
                  </a>
                </span>
              </div>
            </div>
          </div>
        </li>
      </ul>
      <ul class="pagination">
        <li class="page_number"><a class="greyButton" href="/video?o=ht">1</a></li>
        <li class="page_number"><a class="greyButton" href="/video?o=ht&page=3">3</a></li>
      </ul>
    `;

    const result = __private__.buildListResult(2, html, async () => {
      throw new Error('unused');
    });

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]).toEqual({
      url: 'https://www.pornhub.com/view_video.php?viewkey=699ba7b597858',
      videoId: '699ba7b597858',
      title: 'Sample title',
      duration: '15:25',
      durationSeconds: 925,
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      profile: {
        name: 'Summer_steph',
        url: 'https://www.pornhub.com/model/summer_steph',
      },
      watchCount: 543_000,
    });
    expect(result.pagination).toEqual({
      page: 2,
      pages: [1, 2, 3],
    });
    expect(result.hasNext()).toBe(true);
    expect(result.hasPrevious()).toBe(true);
  });

  it('parses detail metadata fragments', () => {
    const html = `
      <div class="video-detailed-info">
        <div class="categoriesWrapper">
          <a class="item" href="/video?c=7">Big Dick</a>
          <a class="item" href="/categories/pornstar">Pornstar</a>
        </div>
        <div class="tagsWrapper">
          <a class="item" href="/video/search?search=test"><span>test</span></a>
          <a class="item" href="/video/search?search=test1"><span>test1</span></a>
        </div>
      </div>
      <div class="ratingInfo">
        <div class="views"><span class="count">214K</span> Views</div>
      </div>
      <div class="votes-fav-wrap">
        <span class="votesUp" data-rating="626">626</span>
        <span class="votesDown">14</span>
      </div>
      <script>
        'video_date_published' : '20260327'
      </script>
    `;

    const $ = load(html);

    expect(__private__.parseUploadDate(html)).toBe('2026-03-27');
    expect(__private__.parseTaxonomy($, '.categoriesWrapper a.item')).toEqual([
      'Big Dick',
      'Pornstar',
    ]);
    expect(__private__.parseTaxonomy($, '.tagsWrapper a.item')).toEqual([
      'test',
      'test1',
    ]);
    expect(__private__.parseWatchCount($, html, {})).toBe(214_000);
    expect(__private__.parseRating($, html)).toEqual({
      voteCount: 640,
      ratingPercent: 97.81,
    });
  });

  it('validates page numbers and video urls', () => {
    expect(() => __private__.assertPage(0)).toThrow('Invalid page: 0');
    expect(() => __private__.assertPage(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      `Invalid page: ${Number.MAX_SAFE_INTEGER + 1}`,
    );
    expect(() => __private__.assertVideoUrl('')).toThrow('Invalid url');
    expect(() => __private__.assertVideoUrl('not a url')).toThrow(
      'Invalid url',
    );
    expect(() =>
      __private__.assertVideoUrl(
        'http://www.pornhub.com/view_video.php?viewkey=abc123',
      ),
    ).toThrow('Invalid url');
    expect(() =>
      __private__.assertVideoUrl(
        'https://example.com/view_video.php?viewkey=abc123',
      ),
    ).toThrow('Invalid url');
    expect(() =>
      __private__.assertVideoUrl(
        'https://www.pornhub.org/view_video.php?viewkey=abc123',
      ),
    ).not.toThrow();
  });

  it('covers numeric, duration, id, and date fallbacks', () => {
    expect(__private__.normalizeText(null)).toBe('');
    expect(__private__.parseNumberWithSuffix('no views')).toBe(0);
    expect(__private__.parseNumberWithSuffix('1.5B')).toBe(1_500_000_000);
    expect(__private__.parseDurationSeconds(65)).toBe(65);
    expect(__private__.parseDurationSeconds('')).toBe(0);
    expect(__private__.parseDurationSeconds('PT1H2M3S')).toBe(3723);
    expect(__private__.parseDurationSeconds('not-a-duration')).toBe(0);
    expect(__private__.formatDuration(0)).toBe('');
    expect(
      __private__.parseVideoId('https://%zz/view_video.php?viewkey=fallback'),
    ).toBe('fallback');
    expect(__private__.parseUploadDate('<div>missing</div>')).toBe('');
  });

  it('parses JSON-LD variants and listing scopes', () => {
    const jsonLdHtml = `
      <script type="application/ld+json">{ invalid }</script>
      <script type="application/ld+json">
        [
          {"@type":"BreadcrumbList"},
          {
            "mainEntity": {
              "@type": ["Thing", "VideoObject"],
              "name": "Nested video"
            }
          }
        ]
      </script>
    `;

    expect(__private__.parseJsonLdVideoObject(load(jsonLdHtml))).toMatchObject({
      name: 'Nested video',
    });
    expect(
      __private__.parseJsonLdVideoObject(
        load('<script type="application/ld+json">[{"@type":"Thing"}]</script>'),
      ),
    ).toEqual({});
    expect(
      __private__.parseJsonLdVideoObject(
        load('<script type="application/ld+json">{"@type":"Thing"}</script>'),
      ),
    ).toEqual({});
    expect(
      __private__.parsePages(
        load(`
          <ul class="pagination">
            <li class="page_number"><a>1</a></li>
            <li class="page_number"><span>oops</span></li>
          </ul>
        `),
      ),
    ).toEqual([1]);

    const $scoped = load(
      '<ul class="videos row-5-thumbs"><li class="pcVideoListItem"></li></ul>',
    );
    expect(
      __private__.pickListingScope($scoped).find('li.pcVideoListItem'),
    ).toHaveLength(1);

    const $root = load('<div class="fallback-root"></div>');
    expect(
      __private__.pickListingScope($root).find('.fallback-root'),
    ).toHaveLength(1);
  });

  it('parses individual video cards with fallbacks', () => {
    const $missing = load(
      '<li class="pcVideoListItem"><div class="title">Missing</div></li>',
    );

    expect(
      __private__.parseVideo($missing, getFirstListItem($missing)),
    ).toBeNull();

    const $video = load(`
      <li class="pcVideoListItem">
        <div class="usernameBadgesWrapper">
          <a href="/channels/tester">Tester</a>
        </div>
        <span class="title">Fallback title</span>
        <div class="vidTitleWrapper">
          <a href="/view_video.php?viewkey=fallback-id">Fallback title</a>
        </div>
        <img data-src="https://cdn.example.com/fallback-thumb.jpg" />
        <div class="views">2K views</div>
      </li>
    `);

    expect(__private__.parseVideo($video, getFirstListItem($video))).toEqual({
      url: 'https://www.pornhub.com/view_video.php?viewkey=fallback-id',
      videoId: 'fallback-id',
      title: 'Fallback title',
      duration: '',
      durationSeconds: 0,
      thumbnailUrl: 'https://cdn.example.com/fallback-thumb.jpg',
      profile: {
        name: 'Tester',
        url: 'https://www.pornhub.com/channels/tester',
      },
      watchCount: 2000,
    });

    const $srcOnly = load(`
      <li class="pcVideoListItem" data-video-vkey="src-thumb">
        <a class="linkVideoThumb" href="/view_video.php?viewkey=src-thumb" title="Src thumb">
          <img src="https://cdn.example.com/src-thumb.jpg" />
        </a>
      </li>
    `);
    const $noImage = load(`
      <li class="pcVideoListItem" data-video-vkey="no-thumb">
        <a class="linkVideoThumb" href="/view_video.php?viewkey=no-thumb" title="No thumb"></a>
      </li>
    `);

    expect(
      __private__.parseVideo($srcOnly, getFirstListItem($srcOnly)),
    ).toMatchObject({
      videoId: 'src-thumb',
      thumbnailUrl: 'https://cdn.example.com/src-thumb.jpg',
    });
    expect(
      __private__.parseVideo($noImage, getFirstListItem($noImage)),
    ).toMatchObject({
      videoId: 'no-thumb',
      thumbnailUrl: '',
    });
  });

  it('handles flashvars, media variants, ratings, and watch-count fallbacks', () => {
    expect(__private__.extractFlashvars('<html></html>')).toEqual({});
    expect(
      __private__.extractFlashvars(
        '<script>var flashvars_1 = { broken };</script>',
      ),
    ).toEqual({});
    expect(
      __private__.parseMediaDefinitions({
        mediaDefinitions: [null, { quality: 720 }, 'bad'] as never,
      }),
    ).toEqual([{ quality: 720 }]);
    expect(
      __private__.parseMediaDefinitions({ mediaDefinitions: 'bad' as never }),
    ).toEqual([]);

    const files = __private__.extractFiles(
      {
        image_url: 'https://cdn.example.com/image.jpg',
        thumb_url: 'https://cdn.example.com/thumb.jpg',
        thumb_url169: 'https://cdn.example.com/thumb-169.jpg',
        thumbs: {
          spritePatterns: ['https://cdn.example.com/slide.jpg'],
        },
        mediaDefinitions: [
          {
            format: 'mp4',
            width: 426,
            videoUrl: 'https://cdn.example.com/low.mp4',
          },
          {
            format: 'mp4',
            quality: 720,
            videoUrl: 'https://cdn.example.com/high.mp4',
          },
          {
            format: 'hls',
            quality: '1080p',
            defaultQuality: true,
            videoUrl: 'https://cdn.example.com/stream.m3u8',
          },
          {
            format: 'hls',
            quality: 'auto',
            videoUrl: 'https://cdn.example.com/stream-auto.m3u8',
          },
        ],
      },
      'https://cdn.example.com/fallback.jpg',
    );
    const fallbackFiles = __private__.extractFiles(
      { mediaDefinitions: [] },
      'https://cdn.example.com/fallback.jpg',
    );
    const zeroQualityFiles = __private__.extractFiles(
      {
        mediaDefinitions: [
          { format: 'mp4', videoUrl: 'https://cdn.example.com/unknown.mp4' },
          {
            format: 'mp4',
            quality: '720p',
            videoUrl: 'https://cdn.example.com/known.mp4',
          },
        ],
      },
      'https://cdn.example.com/fallback.jpg',
    );
    const emptyVotes = load('<div class="votes-fav-wrap"></div>');
    const directViews = load(
      '<div class="ratingInfo"><div class="views"><span class="count">3K</span> Views</div></div>',
    );
    const regexViews = load('<div class="views"></div>');

    expect(files).toEqual({
      low: 'https://cdn.example.com/low.mp4',
      high: 'https://cdn.example.com/high.mp4',
      HLS: 'https://cdn.example.com/stream.m3u8',
      thumb: 'https://cdn.example.com/image.jpg',
      thumb69: 'https://cdn.example.com/thumb-169.jpg',
      thumbSlide: 'https://cdn.example.com/slide.jpg',
      thumbSlideBig: 'https://cdn.example.com/slide.jpg',
    });
    expect(fallbackFiles).toEqual({
      low: '',
      high: '',
      HLS: '',
      thumb: 'https://cdn.example.com/fallback.jpg',
      thumb69: 'https://cdn.example.com/fallback.jpg',
      thumbSlide: '',
      thumbSlideBig: '',
    });
    expect(zeroQualityFiles).toEqual({
      low: 'https://cdn.example.com/unknown.mp4',
      high: 'https://cdn.example.com/known.mp4',
      HLS: '',
      thumb: 'https://cdn.example.com/fallback.jpg',
      thumb69: 'https://cdn.example.com/fallback.jpg',
      thumbSlide: '',
      thumbSlideBig: '',
    });
    expect(__private__.parseRating(emptyVotes, 'Rated 87.5%')).toEqual({
      voteCount: 0,
      ratingPercent: 87.5,
    });
    expect(
      __private__.parseWatchCount(load('<div></div>'), '', {
        interactionStatistic: {
          userInteractionCount: 1234,
        },
      }),
    ).toBe(1234);
    expect(
      __private__.parseWatchCount(load('<div></div>'), '', {
        interactionStatistic: {
          userInteractionCount: '2.5K',
        },
      }),
    ).toBe(2500);
    expect(
      __private__.parseWatchCount(directViews, '', {
        interactionStatistic: ['skip', { userInteractionCount: 'zero' }],
      }),
    ).toBe(3000);
    expect(
      __private__.parseWatchCount(directViews, '', {
        interactionStatistic: {
          userInteractionCount: null,
        },
      }),
    ).toBe(3000);
    expect(__private__.parseWatchCount(directViews, '', {})).toBe(3000);
    expect(
      __private__.parseWatchCount(
        regexViews,
        '<div class="views"><span class="count">9K</span> Views</div>',
        {},
      ),
    ).toBe(9000);
  });

  it('normalizes batch options and start gates', async () => {
    expect(__private__.normalizeDetailsManyOptions()).toEqual({
      concurrency: 4,
      retries: 0,
      retryDelayMs: 0,
      minDelayMs: 0,
    });
    expect(() =>
      __private__.normalizeDetailsManyOptions({ concurrency: 0 }),
    ).toThrow('Invalid concurrency: 0');
    expect(() =>
      __private__.normalizeDetailsManyOptions({ retries: -1 }),
    ).toThrow('Invalid retries: -1');
    expect(() =>
      __private__.normalizeDetailsManyOptions({ retryDelayMs: -1 }),
    ).toThrow('Invalid retryDelayMs: -1');
    expect(() =>
      __private__.normalizeDetailsManyOptions({ minDelayMs: -1 }),
    ).toThrow('Invalid minDelayMs: -1');

    await expect(__private__.createStartGate(0)()).resolves.toBeUndefined();

    vi.useFakeTimers();
    const now = vi.spyOn(Date, 'now');
    now
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(102)
      .mockReturnValueOnce(105);

    const gate = __private__.createStartGate(5);
    await gate();

    let released = false;
    const pending = gate().then(() => {
      released = true;
    });

    await vi.advanceTimersByTimeAsync(2);
    expect(released).toBe(false);

    await vi.advanceTimersByTimeAsync(3);
    await pending;
    expect(released).toBe(true);
  });
});
