# pornhub

[![CI](https://github.com/rodrigogs/pornhub/actions/workflows/node.js.yml/badge.svg)](https://github.com/rodrigogs/pornhub/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/rodrigogs/pornhub/graph/badge.svg)](https://codecov.io/gh/rodrigogs/pornhub)
[![CodeQL](https://github.com/rodrigogs/pornhub/actions/workflows/codeql.yml/badge.svg)](https://github.com/rodrigogs/pornhub/actions/workflows/codeql.yml)

A [Node.js](https://nodejs.org) library for the [pornhub.com](https://www.pornhub.com) API.

Requires Node.js 20+.

## Installation

```bash
npm install @rodrigogs/pornhub
```

## Usage

```javascript
import pornhub from '@rodrigogs/pornhub';
```

```javascript
const pornhub = require('@rodrigogs/pornhub');

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

`search()` accepts `search` or `k` as query aliases, and `ordering` or `o` for Pornhub ordering codes such as `mr`, `mv`, `tr`, `ht`, and `cm`.

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

## Development

```bash
npm run build
npm run lint
npm run format
npm run test:unit
npm run test:integration
npm test
```
