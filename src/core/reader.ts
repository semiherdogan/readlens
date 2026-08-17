import { extractContent } from "../extractors/extract.js";
import { validatePublicUrl } from "./security.js";
import { PageNectarError } from "./errors.js";
import type {
  AlternatePageFetcher,
  FetchedPage,
  PageFetcher,
  PageCache,
  ReadPageInput,
  ReadPageResult,
  RenderMode
} from "./types.js";

export type ReaderDependencies = {
  httpFetcher: PageFetcher;
  renderer?: PageFetcher;
  alternateFetchers?: AlternatePageFetcher[];
  cache?: PageCache;
  cacheTtlMs?: number;
  validateUrl?: (url: string) => Promise<URL>;
};

const DEFAULT_MAX_CHARS = 30_000;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

function cacheKey(url: URL, input: ReadPageInput, render: RenderMode, maxChars: number): string {
  return JSON.stringify({
    url: url.href,
    format: input.format ?? "text",
    render,
    maxChars
  });
}

function countWords(content: string): number {
  return content.split(/\s+/u).length;
}

function shouldRender(content: string): boolean {
  return content.length < 200;
}

async function fetchAuto(url: URL, dependencies: ReaderDependencies): Promise<FetchedPage> {
  try {
    return await dependencies.httpFetcher.fetch(url);
  } catch (httpError) {
    const alternate = dependencies.alternateFetchers?.find((fetcher) => fetcher.supports(url));
    if (alternate) {
      try {
        return await alternate.fetch(url);
      } catch (error) {
        if (!dependencies.renderer) {
          throw new PageNectarError(
            "ALTERNATE_SOURCE_FAILED",
            "Alternate content source failed",
            { cause: error }
          );
        }
      }
    }
    if (dependencies.renderer) return dependencies.renderer.fetch(url);
    throw httpError;
  }
}

function assertUsefulContent(title: string | null, content: string): void {
  const normalizedTitle = title?.toLowerCase() ?? "";
  const normalizedContent = content.toLowerCase();
  const blocked =
    normalizedTitle.includes("you have been blocked") ||
    normalizedTitle === "access denied" ||
    normalizedTitle === "just a moment..." ||
    normalizedContent.includes("cloudflare ray id");
  if (blocked) throw new PageNectarError("BLOCKED", "The site returned a bot-block page");
  if (!content.trim()) {
    throw new PageNectarError("EXTRACTION_FAILED", "No readable content was extracted");
  }
}

export function createReader(dependencies: ReaderDependencies) {
  const validateUrl = dependencies.validateUrl ?? validatePublicUrl;

  return async function readPage(input: ReadPageInput): Promise<ReadPageResult> {
    const render: RenderMode = input.render ?? "auto";
    const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
    const url = await validateUrl(input.url);
    const key = cacheKey(url, input, render, maxChars);

    if (dependencies.cache) {
      try {
        const cached = await dependencies.cache.get(key);
        if (cached) return cached;
      } catch {
        // Reading a page must not depend on cache availability.
      }
    }

    let page: FetchedPage;
    if (render === "always") {
      if (!dependencies.renderer) throw new Error("Lightpanda renderer is not available");
      page = await dependencies.renderer.fetch(url);
    } else if (render === "auto") {
      page = await fetchAuto(url, dependencies);
    } else {
      page = await dependencies.httpFetcher.fetch(url);
    }

    await validateUrl(page.finalUrl);
    let extracted = extractContent(page.html, page.finalUrl, input.format ?? "text");

    if (
      render === "auto" &&
      page.renderer !== "lightpanda" &&
      shouldRender(extracted.content) &&
      dependencies.renderer
    ) {
      page = await dependencies.renderer.fetch(url);
      await validateUrl(page.finalUrl);
      extracted = extractContent(page.html, page.finalUrl, input.format ?? "text");
    }

    assertUsefulContent(extracted.title, extracted.content);

    const truncated = extracted.content.length > maxChars;
    const content = truncated ? extracted.content.slice(0, maxChars).trimEnd() : extracted.content;

    const result: ReadPageResult = {
      ...extracted,
      url: url.href,
      finalUrl: page.finalUrl,
      content,
      wordCount: countWords(content),
      characterCount: content.length,
      truncated
    };
    if (dependencies.cache) {
      try {
        await dependencies.cache.set(
          key,
          result,
          dependencies.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
        );
      } catch {
        // Reading a page must not depend on cache availability.
      }
    }
    return result;
  };
}
