import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import { createReadLensMcpServer } from "../src/mcp/server.js";
import type { ReadPageResult } from "../src/core/types.js";
import { ReadLensError } from "../src/core/errors.js";

const pageResult: ReadPageResult = {
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

describe("createReadLensMcpServer", () => {
  it("exposes only read_page and returns structured content", async () => {
    const readPage = vi.fn().mockResolvedValue(pageResult);
    const server = createReadLensMcpServer(readPage);
    const client = new Client({ name: "readlens-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map(({ name }) => name)).toEqual(["read_page"]);

      const result = await client.callTool({
        name: "read_page",
        arguments: { url: "https://example.com" }
      });
      expect(readPage).toHaveBeenCalledWith({
        url: "https://example.com",
        format: "text",
        render: "auto",
        maxChars: 100_000
      });
      expect(result.structuredContent).toEqual(pageResult);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns typed tool errors", async () => {
    const server = createReadLensMcpServer(
      vi.fn().mockRejectedValue(new ReadLensError("BLOCKED", "Blocked page"))
    );
    const client = new Client({ name: "readlens-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const response = await client.callTool({
        name: "read_page",
        arguments: { url: "https://example.com" }
      });
      expect(response.isError).toBe(true);
      expect(JSON.parse(response.content[0]!.type === "text" ? response.content[0]!.text : "")).toEqual({
        error: { code: "BLOCKED", message: "Blocked page" }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
