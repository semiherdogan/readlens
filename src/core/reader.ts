import { extractContent } from "../extractors/extract.js";
import { validatePublicUrl } from "./security.js";
import { ReadLensError } from "./errors.js";
import type {
  ExtractedContent,
  FetchedPage,
  PageFetcher,
  PageCache,
  ReadPageInput,
  ReadPageResult,
  RenderMode,
  SiteAdapter
} from "./types.js";

export type ReaderDependencies = {
  httpFetcher: PageFetcher;
  renderer?: PageFetcher;
  siteAdapters?: SiteAdapter[];
  /** @deprecated use siteAdapters */
  alternateFetchers?: SiteAdapter[];
  cache?: PageCache;
  cacheTtlMs?: number;
  validateUrl?: (url: string) => Promise<URL>;
};

const DEFAULT_MAX_CHARS = 100_000;
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

function siteAdapters(dependencies: ReaderDependencies): SiteAdapter[] {
  return dependencies.siteAdapters ?? dependencies.alternateFetchers ?? [];
}

function supportedAdapter(url: URL, dependencies: ReaderDependencies): SiteAdapter | undefined {
  return siteAdapters(dependencies).find((adapter) => adapter.supports(url));
}

async function fetchWithSiteAdapter(
  url: URL,
  dependencies: ReaderDependencies
): Promise<FetchedPage | undefined> {
  return supportedAdapter(url, dependencies)?.fetch(url);
}

type AutoFetchResult = { page: FetchedPage; usedSiteAdapter: boolean };

async function fetchAuto(url: URL, dependencies: ReaderDependencies): Promise<AutoFetchResult> {
  try {
    return { page: await dependencies.httpFetcher.fetch(url), usedSiteAdapter: false };
  } catch (httpError) {
    try {
      const adaptedPage = await fetchWithSiteAdapter(url, dependencies);
      if (adaptedPage) return { page: adaptedPage, usedSiteAdapter: true };
    } catch (error) {
      if (!dependencies.renderer) {
        throw new ReadLensError(
          "ALTERNATE_SOURCE_FAILED",
          "Alternate content source failed",
          { cause: error }
        );
      }
    }
    if (dependencies.renderer) {
      return { page: await dependencies.renderer.fetch(url), usedSiteAdapter: false };
    }
    throw httpError;
  }
}

function isBlockedContent(title: string | null, content: string): boolean {
  const normalizedTitle = title?.toLowerCase() ?? "";
  const normalizedContent = content.toLowerCase();
  return (
    normalizedTitle.includes("you have been blocked") ||
    normalizedTitle === "access denied" ||
    normalizedTitle === "just a moment..." ||
    normalizedContent.includes("cloudflare ray id")
  );
}

function assertUsefulContent(title: string | null, content: string): void {
  if (isBlockedContent(title, content)) {
    throw new ReadLensError("BLOCKED", "The site returned a bot-block page");
  }
  if (!content.trim()) {
    throw new ReadLensError("EXTRACTION_FAILED", "No readable content was extracted");
  }
}

function shouldTrySiteAdapter(page: FetchedPage, extracted: ExtractedContent): boolean {
  return page.renderer !== "lightpanda" &&
    (isBlockedContent(extracted.title, extracted.content) || shouldRender(extracted.content));
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
    let usedSiteAdapter = false;
    if (render === "always") {
      if (!dependencies.renderer) throw new Error("Lightpanda renderer is not available");
      page = await dependencies.renderer.fetch(url);
    } else if (render === "auto") {
      ({ page, usedSiteAdapter } = await fetchAuto(url, dependencies));
    } else {
      page = await dependencies.httpFetcher.fetch(url);
    }

    await validateUrl(page.finalUrl);
    let extracted = extractContent(page.html, page.finalUrl, input.format ?? "text");

    if (render === "auto" && !usedSiteAdapter && shouldTrySiteAdapter(page, extracted)) {
      try {
        const adaptedPage = await fetchWithSiteAdapter(url, dependencies);
        if (adaptedPage) {
          page = adaptedPage;
          usedSiteAdapter = true;
          await validateUrl(page.finalUrl);
          extracted = extractContent(page.html, page.finalUrl, input.format ?? "text");
        }
      } catch {
        // Renderer fallback or the final extraction assertion will report the page state.
      }
    }

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
