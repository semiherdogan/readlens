# Contributing to CleanWeb

Thanks for helping improve CleanWeb. Keep changes small, focused, and testable.

## Development setup

```sh
mise install
mise exec -- npm ci
mise exec -- npm test
mise exec -- npm run typecheck
mise exec -- npm run build
```

Lightpanda must be available on `PATH` for live rendered-page checks. Unit tests do not require network access or a running browser.

## Pull requests

- Explain the user-visible behavior being changed.
- Add a narrow fixture or test for extraction and bug fixes.
- Do not use live websites as the primary automated test source.
- Keep Core Reader logic independent from CLI and MCP transports.
- Run tests, typecheck, build, and coverage before requesting review.

Do not include credentials, private URLs, copyrighted article dumps, or personal data in fixtures.

