# Changelog

All notable changes to ReadLens will be documented in this file.

## Unreleased

## 0.1.0 - 2026-08-17

### Added

- File cache with configurable TTL
- Markdown output
- Typed CLI and MCP errors
- Medium author-feed fallback
- GitHub Actions verification workflow
- OIDC-based npm release workflow
- HTTP-first Core Reader with Lightpanda fallback
- Mozilla Readability and structural extraction fallbacks
- Plain-text CLI output and JSON diagnostics
- Local stdio MCP server with one `read_page` tool
- Private-network and redirect validation

### Changed

- Ad containers are removed using structural class and data-attribute signals
- Bot-block pages are rejected instead of returned as readable content
