import { describe, expect, it } from 'vitest';
import pornhub from '../../src/index.js';

describe('Pornhub live integration', () => {
  it('loads real list pages', async () => {
    const listMethods = [
      () => pornhub.videos.recommended({ page: 1 }),
      () => pornhub.videos.hottest({ page: 1 }),
      () => pornhub.videos.mostViewed({ page: 1 }),
      () => pornhub.videos.topRated({ page: 1 }),
      () => pornhub.videos.newest({ page: 1 }),
      () => pornhub.videos.search({ search: 'test', page: 1 }),
    ];

    for (const loadList of listMethods) {
      const result = await loadList();

      expect(result.videos.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pages.length).toBeGreaterThan(0);
      expect(result.videos[0].url).toContain('/view_video.php?viewkey=');
      expect(result.videos[0].videoId.length).toBeGreaterThan(0);
      expect(result.videos[0].title.length).toBeGreaterThan(0);
      expect(result.videos[0].thumbnailUrl.length).toBeGreaterThan(0);
    }
  });

  it('navigates list pagination helpers', async () => {
    const recommended = await pornhub.videos.recommended({ page: 1 });

    expect(recommended.hasPrevious()).toBe(false);
    expect(recommended.hasNext()).toBe(true);

    const nextPage = await recommended.next();

    expect(nextPage.pagination.page).toBe(2);
    expect(nextPage.hasPrevious()).toBe(true);

    const previousPage = await nextPage.previous();

    expect(previousPage.pagination.page).toBe(1);
  });

  it('loads details and detailsMany', async () => {
    const hottest = await pornhub.videos.hottest({ page: 1 });
    const inputs = hottest.videos.slice(0, 2).map(({ url }) => ({ url }));
    const detail = await pornhub.videos.details(inputs[0]);

    expect(detail.url).toBe(inputs[0].url);
    expect(detail.videoId.length).toBeGreaterThan(0);
    expect(detail.title.length).toBeGreaterThan(0);
    expect(detail.durationSeconds).toBeGreaterThan(0);
    expect(detail.thumbnailUrls.length).toBeGreaterThan(0);
    expect(
      detail.files.high.length > 0 || detail.files.HLS.length > 0,
    ).toBe(true);
    expect(detail.tags.length).toBeGreaterThan(0);
    expect(detail.categories.length).toBeGreaterThan(0);

    const batch = await pornhub.videos.detailsMany(inputs, {
      concurrency: 2,
      retries: 1,
      minDelayMs: 100,
    });

    expect(batch.items).toHaveLength(inputs.length);
    expect(batch.failures).toHaveLength(0);
    expect(batch.successes).toHaveLength(inputs.length);
    expect(batch.successes[0].url).toBe(inputs[0].url);
    expect(batch.successes[1].url).toBe(inputs[1].url);
  });
});
