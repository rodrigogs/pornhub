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

  const byChannel = await pornhub.videos.channels({
    name: 'Brazzers',
    page: 1,
  });
  console.log(byChannel.videos);
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
- `videos.channels({ page, name })`

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

### `videos.channels({ page, name })`

Lists only the videos of a specific channel/studio (e.g. Brazzers). The name is slugified and loaded from the dedicated `/channels/<slug>` page.

```javascript
const byChannel = await pornhub.videos.channels({
  page: 1,
  name: 'Brazzers',
});

console.log(byChannel.videos);
```

Returns the same `VideoListResult` shape as the other list methods. Unknown channel slugs return a 404 from Pornhub, which the library surfaces as an empty `videos: []` listing.

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

### `webmasters.search(search, options)`

Searches videos through the webmasters API and returns structured JSON results (same shape as `videoById`, but an array). Accepts the same filters as the site search page:

```javascript
const results = await pornhub.webmasters.search('latina', {
  page: 2,
  tags: ['anal', 'solo'],
  category: ['teen'],
  stars: ['Riley Reid'],
  ordering: 'newest',   // featured | newest | mostviewed | rating
  period: 'weekly',     // weekly | monthly | alltime
  thumbsize: 'medium',  // small | medium | large | small_hd | medium_hd | large_hd
});
```

Returns an array of `WebmastersVideo` (empty array when no results or the API is unreachable).

### `webmasters.isVideoActive(idOrUrl)`

Checks whether a video still exists. Accepts a raw viewkey or a full watch-page URL. Returns `true`/`false` (deleted and unknown videos report `false`).

```javascript
const active = await pornhub.webmasters.isVideoActive('6a636dfc70d39');
const activeFromUrl = await pornhub.webmasters.isVideoActive(
  'https://www.pornhub.com/view_video.php?viewkey=6a636dfc70d39',
);
```

### `webmasters.videoEmbedCode(idOrUrl)`

Returns the unescaped HTML embed code (`<iframe ...>`) for a video, or `null` when the video does not exist.

```javascript
const code = await pornhub.webmasters.videoEmbedCode('6a636dfc70d39');
```

### `webmasters.deletedVideos(page)`

Lists recently deleted videos (most recent first), each `{ vkey, deleted_on }`.

```javascript
const deleted = await pornhub.webmasters.deletedVideos(1);
```

### `webmasters.tags(letter)`

Lists tag names starting with the given letter (`a`–`z`, default `'a'`). This endpoint is heavy — cache the result locally.

```javascript
const tags = await pornhub.webmasters.tags('s');
```

### `webmasters.categories()`

Lists all video categories sorted by id, each `{ id, category }`.

```javascript
const categories = await pornhub.webmasters.categories();
```

### `webmasters.pornstars()`

Lists all pornstar names.

```javascript
const pornstars = await pornhub.webmasters.pornstars();
```

### `webmasters.pornstarsDetailed()`

Lists detailed pornstar records (`star_name`, `star_thumb`, `star_url`, `gender`, `videos_count_all`). This endpoint is very heavy (20K+ records) — cache the result locally.

```javascript
const pornstars = await pornhub.webmasters.pornstarsDetailed();
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
