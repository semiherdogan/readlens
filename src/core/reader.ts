import { extractContent } from "../extractors/extract.js";
import { validatePublicUrl } from "./security.js";
import type {
  FetchedPage,
  PageFetcher,
  ReadPageInput,
  ReadPageResult,
  RenderMode
} from "./types.js";

export type ReaderDependencies = {
  httpFetcher: PageFetcher;
  renderer?: PageFetcher;
  validateUrl?: (url: string) => Promise<URL>;
};

const DEFAULT_MAX_CHARS = 30_000;

function countWords(content: string): number {
  return content ? content.split(/\s+/u).length : 0;
}

function shouldRender(content: string): boolean {
  return content.length < 200;
}

export function createReader(dependencies: ReaderDependencies) {
  const validateUrl = dependencies.validateUrl ?? validatePublicUrl;

  return async function readPage(input: ReadPageInput): Promise<ReadPageResult> {
    const render: RenderMode = input.render ?? "auto";
    const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
    const url = await validateUrl(input.url);

    let page: FetchedPage;
    if (render === "always") {
      if (!dependencies.renderer) throw new Error("Lightpanda renderer is not available");
      page = await dependencies.renderer.fetch(url);
    } else {
      page = await dependencies.httpFetcher.fetch(url);
    }

    await validateUrl(page.finalUrl);
    let extracted = extractContent(page.html, page.finalUrl);

    if (render === "auto" && shouldRender(extracted.content) && dependencies.renderer) {
      page = await dependencies.renderer.fetch(url);
      await validateUrl(page.finalUrl);
      extracted = extractContent(page.html, page.finalUrl);
    }

    const truncated = extracted.content.length > maxChars;
    const content = truncated ? extracted.content.slice(0, maxChars).trimEnd() : extracted.content;

    return {
      ...extracted,
      url: url.href,
      finalUrl: page.finalUrl,
      content,
      wordCount: countWords(content),
      characterCount: content.length,
      truncated
    };
  };
}
