# Installation

## Requirements

- Node.js 22 or newer
- Lightpanda on `PATH` for JavaScript-rendered pages

PageNectar can run without Lightpanda when `--render never` is used. Telemetry is disabled for Lightpanda processes started by PageNectar.

## Run with npx

Run PageNectar without a permanent installation:

```sh
npx -y pagenectar@latest read https://example.com
```

For reproducible installations, replace `latest` with an exact version such as `0.1.0`.

## Install globally

```sh
npm install --global pagenectar@latest
pagenectar read https://example.com
```

## Install Lightpanda

Install Lightpanda with Homebrew:

```sh
brew install lightpanda-io/browser/lightpanda
```

For other platforms and installation methods, see the [official Lightpanda installation guide](https://lightpanda.io/docs/quickstart).

Verify the installation:

```sh
lightpanda version
```

If Lightpanda is installed outside `PATH`, provide the executable explicitly:

```sh
pagenectar read https://example.com/app --lightpanda /custom/path/lightpanda
pagenectar mcp --lightpanda /custom/path/lightpanda
```

## Development setup

```sh
npm ci
npm run build
node dist/cli/index.js read https://example.com
```

To expose the package binary locally:

```sh
npm link
pagenectar read https://example.com
```

Return to the [README](../README.md).
