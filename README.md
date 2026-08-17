# CleanWeb

CleanWeb is a local web content gateway for AI agents. It fetches a URL, extracts the readable main content, removes common page chrome, and returns a small structured result instead of a raw DOM.

> A local web reader for AI agents that returns content, not webpages.

## Status

CleanWeb is an early v0.1 implementation. It currently provides:

- HTTP-first reading with an automatic Lightpanda fallback
- Official author-feed fallback for Medium pages that reject direct requests
- Mozilla Readability extraction
- `article`, `main`, text-density, and body-text fallbacks
- Text output with metadata and truncation
- Markdown output for headings, lists, links, quotes, and code
- Local file cache with a one-hour default TTL
- A local CLI
- A stdio MCP server with one `read_page` tool
- Private-network blocking by default

## Requirements

- Node.js 22 or newer
- [Lightpanda](https://lightpanda.io/) available on `PATH` for JavaScript-rendered pages

CleanWeb can run without Lightpanda when `--render never` is used.
Telemetry is disabled for Lightpanda processes started by CleanWeb.

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
cleanweb read https://example.com/app --lightpanda /custom/path/lightpanda
cleanweb mcp --lightpanda /custom/path/lightpanda
```

## Install for development

```sh
npm ci
npm run build
```

Run the built CLI directly:

```sh
node dist/cli/index.js read https://example.com
```

Or expose the package binary locally:

```sh
npm link
cleanweb read https://example.com
```

## CLI

Read a page as plain text:

```sh
cleanweb read https://example.com/article
```

Return the complete structured result:

```sh
cleanweb read https://example.com/article --json
```

Preserve semantic structure as Markdown:

```sh
cleanweb read https://example.com/article --format markdown
```

Control JavaScript rendering:

```sh
cleanweb read https://example.com/app --render auto
cleanweb read https://example.com/app --render always
cleanweb read https://example.com/article --render never
```

Limit returned content and show diagnostics:

```sh
cleanweb read https://example.com/article --max-chars 10000 --debug
```

Disable cache or change its TTL in seconds:

```sh
cleanweb read https://example.com/article --no-cache
cleanweb read https://example.com/article --cache-ttl 900
```

Cache files are stored under `$XDG_CACHE_HOME/cleanweb` or `~/.cache/cleanweb`.

`auto` is the default. It tries a normal HTTP request first, then invokes Lightpanda when the extracted content is too small.

## MCP server

Start the local stdio server:

```sh
cleanweb mcp
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "cleanweb": {
      "command": "cleanweb",
      "args": ["mcp"]
    }
  }
}
```

The server exposes one tool:

```text
read_page(url, format = "text", render = "auto", maxChars = 30000)
```

Its result includes the final URL, title, author, site name, description, content, language, publication date, counts, extraction method, confidence heuristic, and truncation state.

Tool failures return stable codes such as `HTTP_STATUS`, `BLOCKED`, `FETCH_TIMEOUT`, and `EXTRACTION_FAILED`.

## Security

CleanWeb accepts only HTTP and HTTPS URLs. It rejects localhost, private IPv4 ranges, loopback addresses, link-local addresses, and private IPv6 ranges by default. Redirect targets are validated before HTTP redirects are followed. Lightpanda is invoked with its private-network blocking option.

Local network access requires explicit opt-in:

```sh
cleanweb read http://127.0.0.1:8080 --allow-private
cleanweb mcp --allow-private
```

Treat `--allow-private` as a security-sensitive option, especially when an agent chooses URLs.

## Development

```sh
npm test
npm run typecheck
npm run build
npm run coverage
```

Coverage thresholds are set to 100% for statements, branches, functions, and lines.

## v0.1 boundaries

The first version intentionally does not include crawling, search, batch reading, embeddings, cloud hosting, authentication, a GUI, multiple browser engines, or cursor-based continuation.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [SECURITY.md](SECURITY.md) for private vulnerability reporting guidance. Release changes are recorded in [CHANGELOG.md](CHANGELOG.md).
