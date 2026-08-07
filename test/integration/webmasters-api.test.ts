import { describe, expect, it } from 'vitest';
import pornhub from '../../src/index.js';

/**
 * Webmasters API endpoints are served as JSON from /webmasters/* and are
 * blocked (challenge page) for datacenter IPs — GitHub Actions runners are
 * a common case. A single lightweight probe gates the whole suite: when the
 * API is unreachable from the current IP the describe is skipped with a
 * diagnostic; locally the real endpoints are exercised.
 */
const probe = await (async () => {
  try {
    const categories = await pornhub.webmasters.categories();
    return categories.length > 0;
  } catch {
    return false;
  }
})();

if (!probe) {
  console.warn(
    '[integration] webmasters API blocked from this IP — skipping live assertions',
  );
}

describe.skipIf(!probe)('Pornhub live integration — webmasters API', () => {
  it('searches videos by keyword', async () => {
    const results = await pornhub.webmasters.search('latina');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].video_id.length).toBeGreaterThan(0);
    expect(results[0].title.length).toBeGreaterThan(0);
  });

  it('searches with filters (category + ordering)', async () => {
    const results = await pornhub.webmasters.search('milf', {
      page: 1,
      category: ['milf'],
      ordering: 'mostviewed',
      period: 'alltime',
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toContain('/view_video.php?viewkey=');
  });

  it('reports a real video as active', async () => {
    const hottest = await pornhub.videos.hottest({ page: 1 });
    const viewkey = hottest.videos[0]?.videoId;

    expect(viewkey).toBeDefined();

    await expect(pornhub.webmasters.isVideoActive(viewkey)).resolves.toBe(true);
  });

  it('reports an unknown video as inactive', async () => {
    await expect(
      pornhub.webmasters.isVideoActive('00000000000000000000'),
    ).resolves.toBe(false);
  });

  it('fetches an embed code for a real video', async () => {
    const hottest = await pornhub.videos.hottest({ page: 1 });
    const viewkey = hottest.videos[0]?.videoId;

    expect(viewkey).toBeDefined();

    const code = await pornhub.webmasters.videoEmbedCode(viewkey);

    expect(code).not.toBeNull();
    expect(code).toContain('iframe');
    expect(code).toContain('pornhub.com');
  });

  it('lists recently deleted videos', async () => {
    const deleted = await pornhub.webmasters.deletedVideos(1);

    expect(Array.isArray(deleted)).toBe(true);
    // The endpoint may legitimately return an empty page.
    for (const item of deleted) {
      expect(item.vkey.length).toBeGreaterThan(0);
      expect(item.deleted_on.length).toBeGreaterThan(0);
    }
  });

  it('lists tags for a letter', async () => {
    const tags = await pornhub.webmasters.tags('s');

    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0].length).toBeGreaterThan(0);
  });

  it('lists categories sorted by id', async () => {
    const categories = await pornhub.webmasters.categories();

    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].category.length).toBeGreaterThan(0);
    expect(categories[0].id).toBeDefined();
  });

  it('lists pornstar names', async () => {
    const pornstars = await pornhub.webmasters.pornstars();

    expect(pornstars.length).toBeGreaterThan(0);
    expect(pornstars[0].length).toBeGreaterThan(0);
  });

  it('lists detailed pornstar records', async () => {
    const detailed = await pornhub.webmasters.pornstarsDetailed();

    expect(detailed.length).toBeGreaterThan(0);
    expect(detailed[0].star_name.length).toBeGreaterThan(0);
    expect(detailed[0].gender.length).toBeGreaterThan(0);
    expect(detailed[0].videos_count_all.length).toBeGreaterThan(0);
  });
});
