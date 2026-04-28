import { describe, expect, it } from 'vitest';
import pornhub from '../../src/index.js';

const loadPageWithPrevious = async () => {
  const candidates = [
    () => pornhub.videos.hottest({ page: 2 }),
    () => pornhub.videos.mostViewed({ page: 2 }),
    () => pornhub.videos.topRated({ page: 2 }),
    () => pornhub.videos.newest({ page: 2 }),
    () => pornhub.videos.search({ search: 'test', page: 2 }),
  ];

  for (const loadList of candidates) {
    const result = await loadList();

    if (result.videos.length > 0 && result.hasPrevious()) {
      return result;
    }
  }

  throw new Error('Could not find stable paginated listing on page 2');
};

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
    const secondPage = await loadPageWithPrevious();

    expect(secondPage.pagination.page).toBe(2);
    expect(secondPage.hasPrevious()).toBe(true);

    const firstPage = await secondPage.previous();

    expect(firstPage.pagination.page).toBe(1);

    const roundTrip = await firstPage.next();

    expect(roundTrip.pagination.page).toBe(2);
  });

  it('loads details and detailsMany', async () => {
    const hottest = await pornhub.videos.hottest({ page: 1 });
    const inputs = hottest.videos.slice(0, 1).map(({ url }) => ({ url }));
    const detail = await pornhub.videos.details(inputs[0]);

    expect(detail.url).toBe(inputs[0].url);
    expect(detail.videoId.length).toBeGreaterThan(0);
    expect(detail.title.length).toBeGreaterThan(0);
    expect(detail.durationSeconds).toBeGreaterThan(0);
    expect(detail.thumbnailUrls.length).toBeGreaterThan(0);
    expect(detail.files.high.length > 0 || detail.files.HLS.length > 0).toBe(
      true,
    );
    expect(Array.isArray(detail.tags)).toBe(true);
    expect(Array.isArray(detail.categories)).toBe(true);

    const batch = await pornhub.videos.detailsMany(inputs, {
      concurrency: 2,
      retries: 1,
      minDelayMs: 100,
    });

    expect(batch.items).toHaveLength(inputs.length);
    expect(batch.failures).toHaveLength(0);
    expect(batch.successes).toHaveLength(inputs.length);
    expect(batch.successes[0].url).toBe(inputs[0].url);
  });
});
