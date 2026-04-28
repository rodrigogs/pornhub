import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { __private__ } from '../../src/videos.js';

describe('videos helpers', () => {
  it('parses number suffixes', () => {
    expect(__private__.parseNumberWithSuffix('543K')).toBe(543_000);
    expect(__private__.parseNumberWithSuffix('3.9M views')).toBe(3_900_000);
    expect(__private__.parseNumberWithSuffix('161M')).toBe(161_000_000);
  });

  it('parses duration strings', () => {
    expect(__private__.parseDurationSeconds('15:25')).toBe(925);
    expect(__private__.parseDurationSeconds('1:02:03')).toBe(3723);
    expect(__private__.parseDurationSeconds('457')).toBe(457);
    expect(__private__.formatDuration(457)).toBe('7:37');
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
});
