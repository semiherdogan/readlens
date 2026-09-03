import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { ReadPage } from "../core/types.js";
import { errorPayload } from "../core/errors.js";

const inputSchema = z.object({
  url: z.url().describe("Public HTTP or HTTPS page URL"),
  format: z.enum(["text", "markdown"]).default("text"),
  render: z.enum(["auto", "always", "never"]).default("auto"),
  maxChars: z.int().min(1).max(1_000_000).default(30_000)
});

const nullableString = z.string().nullable();
const outputSchema = z.object({
  url: z.string(),
  finalUrl: z.string(),
  title: nullableString,
  author: nullableString,
  siteName: nullableString,
  description: nullableString,
  content: z.string(),
  language: nullableString,
  publishedAt: nullableString,
  wordCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  extractionMethod: z.enum([
    "readability",
    "article-element",
    "main-element",
    "role-main",
    "text-density",
    "body-text"
  ]),
  confidence: z.number().min(0).max(1),
  truncated: z.boolean()
});

export function createReadLensMcpServer(readPage: ReadPage): McpServer {
  const server = new McpServer({ name: "readlens", version: "0.1.0" });


  server.registerTool(
    "read_page",
    {
      title: "Read page",
      description: "Return the readable main content of a public web page.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (input) => {
      try {
        const result = await readPage(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result
        };
      } catch (error) {
        const payload = { error: errorPayload(error) };
        return {
          content: [{ type: "text", text: JSON.stringify(payload) }],
          isError: true
        };
      }
    }
  );

  return server;
}

