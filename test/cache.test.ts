import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createFilePageCache } from "../src/cache/file-cache.js";
import type { ReadPageResult } from "../src/core/types.js";

const result: ReadPageResult = {
  url: "https://example.com/",
  finalUrl: "https://example.com/",
  title: "Example",
  author: null,
  siteName: null,
  description: null,
  content: "Content",
  language: "en",
  publishedAt: null,
  wordCount: 1,
  characterCount: 7,
  extractionMethod: "readability",
  confidence: 0.9,
  truncated: false
};

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("createFilePageCache", () => {
  it("stores values until their TTL expires", async () => {
    const directory = await mkdtemp(join(tmpdir(), "readlens-cache-"));
    directories.push(directory);
    let now = 1000;
    const cache = createFilePageCache({ directory, now: () => now });

    await cache.set("key", result, 100);
    await expect(cache.get("key")).resolves.toEqual(result);

    now = 1100;
    await expect(cache.get("key")).resolves.toBeUndefined();
    await expect(cache.get("missing")).resolves.toBeUndefined();
  });

  it("ignores and removes invalid cache records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "readlens-cache-"));
    directories.push(directory);
    const cache = createFilePageCache({ directory });
    await cache.set("key", result, 1000);
    const files = await import("node:fs/promises").then(({ readdir }) => readdir(directory));
    await writeFile(join(directory, files[0]!), "not-json");

    await expect(cache.get("key")).resolves.toBeUndefined();
  });
});
