# Contributing to pornhub

Thanks for helping out! This project is a small, focused Node.js library for
the Pornhub API, so we keep the contribution bar low but the quality bar high.

## Requirements

- Node.js 20+ (matches `engines` in `package.json`)
- npm

## Getting started

```bash
npm ci          # install exact dependencies from the lockfile
npm run build   # type-check and emit ESM + CJS + types into dist/
```

## Development loop

```bash
npm run lint          # Biome check (formatting + linting)
npm run format        # auto-fix formatting with Biome
npm run test:unit     # fast unit tests (no network)
npm run test:integration  # live tests against pornhub.com
npm test              # both projects
npm run coverage      # unit tests with 100% coverage gate
```

Always run `npm run lint` and `npm test` before pushing. The CI enforces
them across Node 20, 22, and 24.

## Project layout

```
src/
  base.ts          # HTTP layer: got-scraping, retries, URL helpers
  videos.ts        # listing + detail scraping (cheerio), list pagination
  webmasters.ts    # webmasters API JSON endpoints
  pornhub.ts       # public object assembly
  index.ts         # entry point (default export + types)
  types/           # shared TypeScript types
test/
  unit/            # offline tests, 100% coverage required
  integration/     # live tests against pornhub.com (serial, retried)
```

## Testing conventions

- **Unit tests** must keep 100% coverage (`npm run coverage`). Helpers are
  exported via `__private__` for direct testing — prefer testing those over
  mocking the whole module.
- **Integration tests** hit the real site; they run serially with retries.
  Add one when you touch a new endpoint or page shape. Prefer assertions
  that tolerate content churn (length checks over exact values).
- Pornhub HTML changes without notice — if a test starts failing on selectors,
  inspect the current page before assuming a regression in your change.

## Style

- Biome handles formatting; single quotes, semicolons, 2-space indent.
- Conventional commit messages: `feat:`, `fix:`, `docs:`, `test:`,
  `chore(deps):`, `ci:`, `refactor:`.
- Keep the public API typed and exported from `src/index.ts`.

## Releases

Releases are automated via `.github/workflows/release.yml` — pushing a `v*`
tag runs validation, publishes to npm (`npm publish --provenance`), and
creates a GitHub Release with notes generated from the commit log.

To cut a release:

```bash
npm version minor -m "chore(release): v%s"   # or patch/major
git push origin main --follow-tags
```

Update `CHANGELOG.md` (Unreleased → new version) before tagging.

## Questions

Open an issue for questions, bug reports, or feature ideas before writing
code — the API surface is small and deliberately curated.
