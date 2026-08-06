# pornhub

[![CI](https://github.com/rodrigogs/pornhub/actions/workflows/node.js.yml/badge.svg)](https://github.com/rodrigogs/pornhub/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/rodrigogs/pornhub/graph/badge.svg)](https://codecov.io/gh/rodrigogs/pornhub)
[![CodeQL](https://github.com/rodrigogs/pornhub/actions/workflows/codeql.yml/badge.svg)](https://github.com/rodrigogs/pornhub/actions/workflows/codeql.yml)

A [Node.js](https://nodejs.org) library for the [pornhub.com](https://www.pornhub.com) API.

Requires Node.js 20+.

## Installation

```bash
npm install pornhub
```

## Usage

```javascript
import pornhub from 'pornhub';
```

```javascript
const pornhub = require('pornhub');

(async () => {
  const recommended = await pornhub.videos.recommended({ page: 1 });
  console.log(recommended.videos);
  console.log(recommended.pagination.page);
  console.log(recommended.pagination.pages);
  console.log(recommended.hasNext());
  console.log(recommended.hasPrevious());

  const hottest = await pornhub.videos.hottest({ page: 1 });
  const mostViewed = await pornhub.videos.mostViewed({ page: 1 });
  const topRated = await pornhub.videos.topRated({ page: 1 });
  const newest = await pornhub.videos.newest({ page: 1 });

  const search = await pornhub.videos.search({
    page: 1,
    search: 'latina',
    ordering: 'mv',
  });

  const detail = await pornhub.videos.details(search.videos[0]);
  console.log(detail);

  const batch = await pornhub.videos.detailsMany(
    search.videos.slice(0, 2).map(({ url }) => ({ url })),
    {
      concurrency: 2,
      retries: 1,
      minDelayMs: 250,
    },
  );

  console.log(batch.successes);
  console.log(batch.failures);

  const webmasterVideo = await pornhub.webmasters.videoById('6a636dfc70d39');
  console.log(webmasterVideo);

  const byActor = await pornhub.videos.pornstar({
    name: 'Abigaile Johnson',
    page: 1,
  });
  console.log(byActor.videos);
})();
```

## API

### List methods

All list methods return:

```javascript
{
  videos: [
    {
      url: 'https://www.pornhub.com/view_video.php?viewkey=...',
      videoId: '...',
      title: '...',
      duration: '14:33',
      durationSeconds: 873,
      thumbnailUrl: 'https://...',
      profile: {
        name: '...',
        url: 'https://www.pornhub.com/model/...'
      },
      watchCount: 960000
    }
  ],
  pagination: {
    page: 1,
    pages: [1, 2, 3]
  },
  refresh: async () => {},
  hasNext: () => true,
  next: async () => {},
  hasPrevious: () => false,
  previous: async () => {}
}
```

Available methods:

- `videos.recommended({ page })`
- `videos.hottest({ page })`
- `videos.mostViewed({ page })`
- `videos.topRated({ page })`
- `videos.newest({ page })`
- `videos.search({ page, search, k, ordering, o })`
- `videos.pornstar({ page, name })`

`search()` accepts `search` or `k` as query aliases, and `ordering` or `o` for Pornhub ordering codes such as `mr`, `mv`, `tr`, `ht`, and `cm`.

### `videos.pornstar({ page, name })`

Lists only the videos of a specific actor. The name is slugified and loaded from the dedicated `/pornstar/<slug>` page, which avoids the noisy results that a title-based `/video/search` match returns for actor names.

```javascript
const byActor = await pornhub.videos.pornstar({
  page: 1,
  name: 'Abigaile Johnson',
});

console.log(byActor.videos);
```

Returns the same `VideoListResult` shape as the other list methods. When the slug does not exist (Pornhub redirects unknown names to the generic `/pornstars` directory), the result is an empty `videos: []` listing instead of unrelated videos.

### `videos.details({ url })`

Returns:

```javascript
{
  title: '...',
  url: 'https://www.pornhub.com/view_video.php?viewkey=...',
  videoId: '...',
  duration: '7:37',
  durationSeconds: 457,
  thumbnailUrls: ['https://...'],
  watchCount: 214000,
  voteCount: 640,
  ratingPercent: 97.81,
  videoType: 'text/html',
  videoWidth: '1920',
  videoHeight: '1080',
  uploadDate: '2026-03-27',
  description: '...',
  contentUrl: 'https://...',
  tags: ['...'],
  categories: ['...'],
  pornstars: ['...'],
  profile: {
    name: '...',
    url: 'https://www.pornhub.com/model/...'
  },
  files: {
    low: 'https://...',
    high: 'https://...',
    HLS: 'https://...',
    thumb: 'https://...',
    thumb69: 'https://...',
    thumbSlide: 'https://...',
    thumbSlideBig: 'https://...'
  }
}
```

### `videos.detailsMany(inputs, options)`

Batch detail crawling with ordered results.

Options:

- `concurrency`
- `retries`
- `retryDelayMs`
- `minDelayMs`

Returns:

```javascript
{
  items: [
    { input: { url: '...' }, ok: true, value: { /* details */ } },
    { input: { url: '...' }, ok: false, error: new Error('...') }
  ],
  successes: [{ /* details */ }],
  failures: [{ input: { url: '...' }, ok: false, error: new Error('...') }]
}
```

### `webmasters.videoById(id)`

Fetches structured metadata for a single video from the Pornhub webmasters API (`https://www.pornhub.com/webmasters/`). Unlike the watch page scrape, this endpoint returns JSON directly and is more tolerant of request bursts, making it a resilient fallback when page scraping fails (throttle, age-gate, temporary 404s).

```javascript
const video = await pornhub.webmasters.videoById('6a636dfc70d39');
console.log(video);
```

Returns `null` when the id is invalid or the endpoint returns no video data:

```javascript
{
  duration: '14:33',
  views: 960000,
  video_id: '6a636dfc70d39',
  rating: 97.81,
  ratings: 640,
  title: '...',
  url: 'https://www.pornhub.com/view_video.php?viewkey=6a636dfc70d39',
  default_thumb: 'https://...',
  thumb: 'https://...',
  publish_date: '2026-03-27',
  thumbs: [{ size: 'small', width: '160', height: '90', src: 'https://...' }],
  tags: [{ tag_name: '...' }],
  pornstars: [{ pornstar_name: '...', pornstar_link: 'https://...' }],
  categories: [{ category: '...' }],
  segment: '...',
  description: '...'
}
```

## Development

```bash
npm run build
npm run lint
npm run format
npm run test:unit
npm run test:integration
npm test
```
