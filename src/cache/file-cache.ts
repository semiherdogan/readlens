import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { PageCache, ReadPageResult } from "../core/types.js";

type CacheRecord = {
  version: 1;
  expiresAt: number;
  value: ReadPageResult;
};

export type FilePageCacheOptions = {
  directory: string;
  now?: () => number;
};

function isReadPageResult(value: unknown): value is ReadPageResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "characterCount" in value &&
    typeof value.characterCount === "number"
  );
}

function isCacheRecord(value: unknown): value is CacheRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "expiresAt" in value &&
    typeof value.expiresAt === "number" &&
    "value" in value &&
    isReadPageResult(value.value)
  );
}

function filename(directory: string, key: string): string {
  const hash = createHash("sha256").update(key).digest("hex");
  return join(directory, `${hash}.json`);
}

async function removeInvalidFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Cache cleanup is best effort.
  }
}

export function createFilePageCache(options: FilePageCacheOptions): PageCache {
  const now = options.now ?? Date.now;

  return {
    async get(key): Promise<ReadPageResult | undefined> {
      const path = filename(options.directory, key);
      let raw: string;
      try {
        raw = await readFile(path, "utf8");
      } catch {
        return undefined;
      }

      let record: unknown;
      try {
        record = JSON.parse(raw);
      } catch {
        await removeInvalidFile(path);
        return undefined;
      }
      if (!isCacheRecord(record) || record.expiresAt <= now()) {
        await removeInvalidFile(path);
        return undefined;
      }
      return record.value;
    },

    async set(key, value, ttlMs): Promise<void> {
      await mkdir(options.directory, { recursive: true });
      const path = filename(options.directory, key);
      const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      const record: CacheRecord = {
        version: 1,
        expiresAt: now() + ttlMs,
        value
      };
      await writeFile(temporaryPath, JSON.stringify(record), { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, path);
    }
  };
}
