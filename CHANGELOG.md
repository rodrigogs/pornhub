# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `videos.category({ id, page })` — category video listings by numeric id, with 404 handling that surfaces an empty listing for unknown ids.
- `pornhub.configure({ minRequestIntervalMs, proxyUrl })` — process-wide crawl ergonomics: a shared minimum interval between request starts (rate limiting, shared across all clients) and optional HTTP(S) proxy routing.
- Real-HTML fixtures (`test/fixtures/`) pinning the current site layout, with parser tests that fail when Pornhub changes its HTML structure. Regenerate with `scripts/refresh-fixtures.sh`.
- npm version/downloads/license badges in the README.

## [0.5.0] - 2026-08-07

### Added

- `videos.channels({ name, page })` — studio/channel video listings from the dedicated `/channels/<slug>` page, with 404 handling that surfaces an empty listing for unknown slugs.

## [0.4.0] - 2026-08-07

### Added

- Full Pornhub webmasters API coverage:
  - `webmasters.search(search, options)` — JSON search with tags/category/stars/ordering/period/thumbsize filters
  - `webmasters.isVideoActive(idOrUrl)` — existence check (accepts viewkey or full URL)
  - `webmasters.videoEmbedCode(idOrUrl)` — unescaped embed iframe code
  - `webmasters.deletedVideos(page)` — recently deleted video list
  - `webmasters.tags(letter)` — tag names by first letter
  - `webmasters.categories()` — category list sorted by id
  - `webmasters.pornstars()` — pornstar name list
  - `webmasters.pornstarsDetailed()` — detailed pornstar records (heavy, 20K+)
- Unit coverage for every new endpoint (100% statements/branches/functions/lines).
- Live integration coverage for every new endpoint against pornhub.com.

### Changed

- `webmasters.videoById` now tolerates malformed JSON gracefully.

## [0.3.0] - 2026-08-06

### Added

- `videos.pornstar({ name, page })` — actor video listings from the dedicated `/pornstar/<slug>` page, with a page guard that rejects redirects to the generic `/pornstars` directory (unknown slugs return an empty listing instead of unrelated videos).
- Live integration coverage for `webmasters.videoById()` and `videos.pornstar()` against pornhub.com.
- Dependabot configuration for npm and GitHub Actions ecosystems.
- This changelog and a contributor guide (`CONTRIBUTING.md`).

### Changed

- Retry backoff is now exponential with full jitter instead of linear.
- Biome upgraded to 2.5.7; npm audit clean (0 vulnerabilities).

## [0.2.2] - 2026-08-06

### Added

- `videos.pornstar({ name, page })` — actor video listings from the dedicated `/pornstar/<slug>` page, with a page guard that rejects redirects to the generic `/pornstars` directory (unknown slugs return an empty listing instead of unrelated videos).

### Changed

- Merged the standalone `test-results` CI job into `coverage` (both ran unit tests and uploaded to Codecov), cutting the workflow from 4 to 3 jobs and reducing exposure to runner scarcity.

## [0.2.1] - 2026-08-06

### Changed

- Merged the standalone `test-results` CI job into `coverage` (both ran unit tests and uploaded to Codecov), cutting the workflow from 4 to 3 jobs and reducing exposure to runner scarcity.

## [0.2.0] - 2026-08-06

### Added

- `webmasters.videoById(id)` — structured metadata from the Pornhub webmasters API (JSON endpoint, tolerant of request bursts).
- `pornstars` and `profile` fields in `videos.details()` results.

### Changed

- Dev tooling upgraded: Biome 2.5.6, TypeScript 7, Vitest 4.1.10, Node types 26.
- Biome config migrated to the `preset` field (replacing the deprecated `recommended`).
- Automated release workflow: tag push → validate → `npm publish --provenance` → GitHub Release with conventional notes.

### Fixed

- CI lint failures caused by Biome formatting drift.

## [0.1.0] - 2026-04-28

### Added

- First public release.
- Typed video listing APIs: `recommended`, `hottest`, `mostViewed`, `topRated`, `newest`, and `search`, with pagination helpers (`next`, `previous`, `refresh`).
- `videos.details()` and ordered `videos.detailsMany()` batch fetching with concurrency, retry, and rate limiting controls.
- Full unit coverage and hardened CI.

[Unreleased]: https://github.com/rodrigogs/pornhub/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/rodrigogs/pornhub/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rodrigogs/pornhub/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/rodrigogs/pornhub/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/rodrigogs/pornhub/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/rodrigogs/pornhub/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rodrigogs/pornhub/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rodrigogs/pornhub/releases/tag/v0.1.0
