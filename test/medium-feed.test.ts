import { describe, expect, it, vi } from "vitest";

import { createMediumFeedFetcher } from "../src/fetchers/medium-feed.js";

describe("createMediumFeedFetcher", () => {
  it("returns the matching article from a Medium author feed", async () => {
    const feedFetcher = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://medium.com/feed/@writer",
        status: 200,
        renderer: "http" as const,
        html: `<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item>
          <title><![CDATA[Article title]]></title>
          <link>https://writer.medium.com/article-id?source=rss</link>
          <dc:creator><![CDATA[Writer]]></dc:creator>
          <pubDate>Mon, 17 Aug 2026 10:00:00 GMT</pubDate>
          <content:encoded><![CDATA[<h1>Article title</h1><p>Full article content.</p>]]></content:encoded>
        </item></channel></rss>`
      })
    };
    const fetcher = createMediumFeedFetcher(feedFetcher);
    const url = new URL("https://writer.medium.com/article-id");

    expect(fetcher.supports(url)).toBe(true);
    const result = await fetcher.fetch(url);

    expect(feedFetcher.fetch).toHaveBeenCalledWith(new URL("https://medium.com/feed/@writer"));
    expect(result.html).toContain("Full article content.");
    expect(result.html).toContain("article:published_time");
  });

  it("supports Medium author URL variants only", () => {
    const fetcher = createMediumFeedFetcher({ fetch: vi.fn() });

    expect(fetcher.supports(new URL("https://writer.medium.com/post"))).toBe(true);
    expect(fetcher.supports(new URL("https://medium.com/@writer/post"))).toBe(true);
    expect(fetcher.supports(new URL("https://foo.bar.medium.com/post"))).toBe(false);
    expect(fetcher.supports(new URL("https://medium.com/publication/post"))).toBe(false);
    expect(fetcher.supports(new URL("https://example.com/post"))).toBe(false);
  });

  it("rejects unsupported URLs and missing feed articles", async () => {
    const feedFetcher = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://medium.com/feed/@writer",
        status: 200,
        renderer: "http" as const,
        html: "<rss><channel><item><title>No link</title></item><item><link>not a URL</link></item></channel></rss>"
      })
    };
    const fetcher = createMediumFeedFetcher(feedFetcher);

    await expect(fetcher.fetch(new URL("https://example.com/post"))).rejects.toThrow(
      "Unsupported Medium URL"
    );
    await expect(fetcher.fetch(new URL("https://writer.medium.com/missing"))).rejects.toThrow(
      "Article was not found in the Medium feed"
    );
  });

  it("rejects feed items without content", async () => {
    const feedFetcher = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://medium.com/feed/@writer",
        status: 200,
        renderer: "http" as const,
        html: "<rss><channel><item><link>https://writer.medium.com/post</link></item></channel></rss>"
      })
    };
    const fetcher = createMediumFeedFetcher(feedFetcher);

    await expect(fetcher.fetch(new URL("https://writer.medium.com/post"))).rejects.toThrow(
      "Medium feed item has no content"
    );
  });

  it("creates an article when optional feed metadata is absent", async () => {
    const feedFetcher = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://medium.com/feed/@writer",
        status: 200,
        renderer: "http" as const,
        html: `<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>
          <link>https://medium.com/@writer/post</link>
          <content:encoded><![CDATA[<p>Content</p>]]></content:encoded>
        </item></channel></rss>`
      })
    };
    const fetcher = createMediumFeedFetcher(feedFetcher);

    const result = await fetcher.fetch(new URL("https://medium.com/@writer/post"));

    expect(result.html).toContain("<article><p>Content</p></article>");
    expect(result.html).not.toContain("article:published_time");
  });
});
