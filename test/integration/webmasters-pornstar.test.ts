import { describe, expect, it } from 'vitest';
import pornhub from '../../src/index.js';

describe('Pornhub live integration — webmasters', () => {
  it('fetches structured metadata for a real video id', async () => {
    const hottest = await pornhub.videos.hottest({ page: 1 });
    const viewkey = hottest.videos[0]?.videoId;

    expect(viewkey).toBeDefined();

    const video = await pornhub.webmasters.videoById(viewkey);

    expect(video).not.toBeNull();
    expect(video?.video_id).toBe(viewkey);
    expect(video?.title.length).toBeGreaterThan(0);
    expect(video?.duration.length).toBeGreaterThan(0);
    expect(video?.views).toBeGreaterThan(0);
    expect(video?.url).toContain('/view_video.php?viewkey=');
    expect(video?.default_thumb.length).toBeGreaterThan(0);
    expect(Array.isArray(video?.thumbs)).toBe(true);
  });

  it('returns null for an unknown video id', async () => {
    const video = await pornhub.webmasters.videoById('00000000000000000000');

    expect(video).toBeNull();
  });
});

describe('Pornhub live integration — pornstar listings', () => {
  it('lists videos for a known actor name', async () => {
    const result = await pornhub.videos.pornstar({
      page: 1,
      name: 'Michael Fly',
    });

    expect(result.videos.length).toBeGreaterThan(0);
    expect(result.pagination.page).toBe(1);
    expect(result.videos[0].url).toContain('/view_video.php?viewkey=');
    expect(result.videos[0].videoId.length).toBeGreaterThan(0);
    expect(result.videos[0].title.length).toBeGreaterThan(0);
  });

  it('returns an empty listing for an unknown actor slug', async () => {
    const result = await pornhub.videos.pornstar({
      page: 1,
      name: 'lesbian big ass stepmom',
    });

    // Unknown slugs redirect to the generic /pornstars directory, which the
    // page guard rejects — callers get an empty listing instead of noise.
    expect(result.videos).toHaveLength(0);
    expect(result.hasNext()).toBe(false);
  });
});
