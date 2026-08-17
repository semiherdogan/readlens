# CleanWeb

CleanWeb is a local web content gateway for AI agents. It fetches a URL, extracts the readable main content, removes common page chrome, and returns a small structured result instead of a raw DOM.

> A local web reader for AI agents that returns content, not webpages.

## Status

CleanWeb is an early v0.1 implementation. It currently provides:

- HTTP-first reading with an automatic Lightpanda fallback
- Mozilla Readability extraction
- `article`, `main`, text-density, and body-text fallbacks
- Text output with metadata and truncation
- A local CLI
- A stdio MCP server with one `read_page` tool
- Private-network blocking by default

## Requirements

- Node.js 22 or newer
- [mise](https://mise.jdx.dev/) for the repository development workflow
- [Lightpanda](https://lightpanda.io/) available on `PATH` for JavaScript-rendered pages

The `mise.toml` file pins the development runtime. CleanWeb can still run without Lightpanda when `--render never` is used.

## Install for development

```sh
mise install
mise exec -- npm install
mise exec -- npm run build
```

Run the built CLI directly:

```sh
mise exec -- node dist/cli/index.js read https://example.com
```

Or expose the package binary locally:

```sh
mise exec -- npm link
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
mise exec -- npm test
mise exec -- npm run typecheck
mise exec -- npm run build
mise exec -- npm run coverage
```

The current coverage threshold is intentionally strict. Coverage work can continue after the product behavior is validated against representative real pages.

## v0.1 boundaries

The first version intentionally does not include crawling, search, batch reading, embeddings, cloud hosting, authentication, a GUI, or multiple browser engines. Markdown output, caching, and cursor-based continuation are candidates for later releases.

