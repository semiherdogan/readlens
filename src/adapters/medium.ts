import { JSDOM } from "jsdom";

import type { FetchedPage, PageFetcher, SiteAdapter } from "../core/types.js";

function mediumHandle(url: URL): string | null {
  if (url.hostname.endsWith(".medium.com")) {
    const handle = url.hostname.slice(0, -".medium.com".length);
    return handle && !handle.includes(".") ? handle : null;
  }

  if (url.hostname === "medium.com") {
    const firstSegment = url.pathname.split("/").filter(Boolean)[0];
    return firstSegment?.startsWith("@") ? firstSegment.slice(1) : null;
  }

  return null;
}

function sameArticle(left: string, right: URL): boolean {
  try {
    return new URL(left).pathname.replace(/\/$/u, "") === right.pathname.replace(/\/$/u, "");
  } catch {
    return false;
  }
}

function createArticleHtml(item: Element, url: URL): string {
  const title = item.getElementsByTagName("title")[0]?.textContent?.trim() ?? "";
  const author = item.getElementsByTagName("dc:creator")[0]?.textContent?.trim() ?? "";
  const publishedAt = item.getElementsByTagName("pubDate")[0]?.textContent?.trim() ?? "";
  const content = item.getElementsByTagName("content:encoded")[0]?.textContent ?? "";
  if (!content.trim()) throw new Error("Medium feed item has no content");

  const dom = new JSDOM(
    "<!doctype html><html lang=\"en\"><head></head><body><article></article></body></html>",
    { url: url.href }
  );
  const { document } = dom.window;
  document.title = title;
  document.querySelector("article")!.innerHTML = content;

  const metadata: Array<[string, string, string]> = [
    ["name", "author", author],
    ["property", "article:published_time", publishedAt]
  ];
  for (const [attribute, name, value] of metadata) {
    if (!value) continue;
    const meta = document.createElement("meta");
    meta.setAttribute(attribute, name);
    meta.content = value;
    document.head.append(meta);
  }

  return dom.serialize();
}

export function createMediumAdapter(feedFetcher: PageFetcher): SiteAdapter {
  return {
    supports(url): boolean {
      return mediumHandle(url) !== null;
    },

    async fetch(url): Promise<FetchedPage> {
      const handle = mediumHandle(url);
      if (!handle) throw new Error("Unsupported Medium URL");

      const feed = await feedFetcher.fetch(new URL(`https://medium.com/feed/@${handle}`));
      const document = new JSDOM(feed.html, { contentType: "text/xml" }).window.document;
      const item = [...document.getElementsByTagName("item")].find((candidate) => {
        const link = candidate.getElementsByTagName("link")[0]?.textContent?.trim();
        return link ? sameArticle(link, url) : false;
      });
      if (!item) throw new Error("Article was not found in the Medium feed");

      return {
        finalUrl: url.href,
        html: createArticleHtml(item, url),
        status: 200,
        renderer: "http"
      };
    }
  };
}
