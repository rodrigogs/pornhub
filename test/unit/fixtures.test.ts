import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { __private__ } from '../../src/videos.js';

/**
 * These fixtures are real pages captured from pornhub.com. They pin the
 * current HTML structure so a site layout change breaks these tests instead
 * of production code. Refresh with scripts/refresh-fixtures.sh.
 */
const readFixture = (name: string): string =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

const unusedLoader = async (): Promise<never> => {
  throw new Error('unused');
};

describe('real HTML fixtures', () => {
  it('parses the hottest listing fixture', () => {
    const html = readFixture('listing-hottest.html');
    const result = __private__.buildListResult(1, html, unusedLoader);

    expect(result.videos.length).toBeGreaterThan(0);
    expect(result.videos[0]).toMatchObject({
      url: expect.stringContaining('/view_video.php?viewkey='),
      videoId: expect.any(String),
      title: expect.any(String),
      thumbnailUrl: expect.stringContaining('http'),
    });
    expect(result.pagination.pages.length).toBeGreaterThan(0);
  });

  it('parses the pornstar listing fixture and passes the page guard', () => {
    const html = readFixture('listing-pornstar.html');
    const $ = load(html);
    const result = __private__.buildListResult(1, html, unusedLoader);

    expect(__private__.isPornstarPage($)).toBe(true);
    expect(result.videos.length).toBeGreaterThan(0);
    expect(result.videos[0].profile.name.length).toBeGreaterThan(0);
  });

  it('parses the channel listing fixture and passes the page guard', () => {
    const html = readFixture('listing-channel.html');
    const $ = load(html);
    const result = __private__.buildListResult(1, html, unusedLoader);

    expect(__private__.isChannelPage($)).toBe(true);
    expect(result.videos.length).toBeGreaterThan(0);
  });

  it('parses the category listing fixture', () => {
    const html = readFixture('listing-category.html');
    const result = __private__.buildListResult(1, html, unusedLoader);

    expect(result.videos.length).toBeGreaterThan(0);
    expect(result.pagination.pages.length).toBeGreaterThan(0);
  });

  it('parses the video detail fixture', () => {
    const html = readFixture('video-detail.html');
    const $ = load(html);
    const jsonLd = __private__.parseJsonLdVideoObject($);
    const flashvars = __private__.extractFlashvars(html);

    expect(jsonLd).not.toEqual({});
    expect(flashvars.video_duration).toBeDefined();
    expect(__private__.parseWatchCount($, html, jsonLd)).toBeGreaterThan(0);

    const viewkey = '6a6871a4294ab';
    expect(
      __private__.parseVideoId(
        `https://www.pornhub.com/view_video.php?viewkey=${viewkey}`,
      ),
    ).toBe(viewkey);
  });
});
