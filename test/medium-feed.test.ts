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
});
