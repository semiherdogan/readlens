import { describe, expect, it, vi } from "vitest";

import { runCli } from "../src/cli/run.js";
import type { ReadPageResult } from "../src/core/types.js";

const result: ReadPageResult = {
  url: "https://example.com/",
  finalUrl: "https://example.com/",
  title: "Example",
  author: null,
  siteName: null,
  description: null,
  content: "Clean content",
  language: "en",
  publishedAt: null,
  wordCount: 2,
  characterCount: 13,
  extractionMethod: "readability",
  confidence: 0.9,
  truncated: false
};

describe("runCli", () => {
  it("prints a structured JSON result for read --json", async () => {
    let stdout = "";
    let stderr = "";
    const readPage = vi.fn().mockResolvedValue(result);
    const createReader = vi.fn(() => readPage);

    const exitCode = await runCli(["read", "https://example.com", "--json"], {
      createReader,
      startMcp: vi.fn(),
      writeOut: (value) => {
        stdout += value;
      },
      writeError: (value) => {
        stderr += value;
      }
    });

    expect(exitCode).toBe(0);
    expect(createReader).toHaveBeenCalledWith({
      allowPrivateNetwork: false,
      lightpandaExecutable: undefined,
      cacheEnabled: true,
      cacheTtlMs: 3_600_000
    });
    expect(readPage).toHaveBeenCalledWith({
      url: "https://example.com",
      format: "text",
      render: "auto",
      maxChars: 30_000
    });
    expect(JSON.parse(stdout)).toEqual(result);
    expect(stderr).toBe("");
  });

  it("prints text output and debug diagnostics", async () => {
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      ["read", "https://example.com", "--debug", "--render", "never", "--max-chars", "20"],
      {
        createReader: () => vi.fn().mockResolvedValue(result),
        startMcp: vi.fn(),
        writeOut: (value) => {
          stdout += value;
        },
        writeError: (value) => {
          stderr += value;
        }
      }
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe("Clean content\n");
    expect(stderr).toContain("extraction=readability");
  });

  it.each([[[]], [["help"]], [["--help"]], [["-h"]]])("prints help for %j", async (args) => {
    let stdout = "";
    const exitCode = await runCli(args, {
      createReader: vi.fn(),
      startMcp: vi.fn(),
      writeOut: (value) => {
        stdout += value;
      },
      writeError: vi.fn()
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("pagenectar read");
  });

  it("starts the MCP server", async () => {
    const readPage = vi.fn();
    const startMcp = vi.fn();
    const createReader = vi.fn(() => readPage);
    const exitCode = await runCli(
      ["mcp", "--allow-private", "--lightpanda", "/bin/lp", "--no-cache", "--cache-ttl", "900"],
      {
      createReader,
      startMcp,
      writeOut: vi.fn(),
      writeError: vi.fn()
      }
    );

    expect(exitCode).toBe(0);
    expect(createReader).toHaveBeenCalledWith({
      allowPrivateNetwork: true,
      lightpandaExecutable: "/bin/lp",
      cacheEnabled: false,
      cacheTtlMs: 900_000
    });
    expect(startMcp).toHaveBeenCalledWith(readPage);
  });

  it("passes Markdown format to the reader", async () => {
    const readPage = vi.fn().mockResolvedValue(result);

    const exitCode = await runCli(
      ["read", "https://example.com", "--format", "markdown"],
      {
        createReader: () => readPage,
        startMcp: vi.fn(),
        writeOut: vi.fn(),
        writeError: vi.fn()
      }
    );

    expect(exitCode).toBe(0);
    expect(readPage).toHaveBeenCalledWith(expect.objectContaining({ format: "markdown" }));
  });

  it.each([
    [["unknown"], "Unknown command: unknown"],
    [["read"], "read requires exactly one URL"],
    [["read", "one", "two"], "read requires exactly one URL"],
    [["read", "https://example.com", "--format", "html"], "format must be text or markdown"],
    [["read", "https://example.com", "--render", "sometimes"], "Invalid render mode"],
    [["read", "https://example.com", "--max-chars", "0"], "max-chars must be"],
    [["read", "https://example.com", "--max-chars", "1.5"], "max-chars must be"],
    [["read", "https://example.com", "--max-chars", "1000001"], "max-chars must be"],
    [["read", "https://example.com", "--cache-ttl", "0"], "cache-ttl must be"],
    [["read", "https://example.com", "--cache-ttl", "1.5"], "cache-ttl must be"],
    [["read", "https://example.com", "--cache-ttl", "604801"], "cache-ttl must be"],
    [["read", "https://example.com", "--unknown"], "Unknown option"],
    [["mcp", "extra"], "mcp does not accept positional arguments"]
  ])("reports invalid arguments for %j", async (args, expected) => {
    let stderr = "";
    const exitCode = await runCli(args, {
      createReader: () => vi.fn().mockResolvedValue(result),
      startMcp: vi.fn(),
      writeOut: vi.fn(),
      writeError: (value) => {
        stderr += value;
      }
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain(expected);
  });

  it("formats non-Error failures", async () => {
    let stderr = "";
    const exitCode = await runCli(["read", "https://example.com"], {
      createReader: () => vi.fn().mockRejectedValue("network failed"),
      startMcp: vi.fn(),
      writeOut: vi.fn(),
      writeError: (value) => {
        stderr += value;
      }
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("network failed");
  });
});
