import { describe, expect, it, vi } from "vitest";

import { createReader } from "../src/core/reader.js";

const articleHtml = `<!doctype html><html lang="en"><body><article>
  <h1>A focused article</h1>
  <p>This is the first useful paragraph with enough information to extract.</p>
  <p>This is the second useful paragraph with more relevant page content.</p>
</article></body></html>`;

describe("createReader", () => {
  it("reads a page through HTTP and returns the public result contract", async () => {
    const httpFetcher = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://example.com/final",
        html: articleHtml,
        status: 200,
        renderer: "http" as const
      })
    };
    const validateUrl = vi.fn(async (url: string) => new URL(url));
    const readPage = createReader({ httpFetcher, validateUrl });

    const result = await readPage({ url: "https://example.com/start" });

    expect(httpFetcher.fetch).toHaveBeenCalledWith(new URL("https://example.com/start"));
    expect(validateUrl).toHaveBeenCalledWith("https://example.com/final");
    expect(result).toMatchObject({
      url: "https://example.com/start",
      finalUrl: "https://example.com/final",
      title: "A focused article",
      extractionMethod: "readability",
      truncated: false
    });
    expect(result.wordCount).toBeGreaterThan(10);
    expect(result.characterCount).toBe(result.content.length);
  });

  it("falls back to Lightpanda in auto mode and truncates the result", async () => {
    const httpFetcher = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://example.com/app",
        html: "<html><body>Loading</body></html>",
        status: 200,
        renderer: "http" as const
      })
    };
    const renderer = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://example.com/app",
        html: articleHtml,
        status: 200,
        renderer: "lightpanda" as const
      })
    };
    const readPage = createReader({
      httpFetcher,
      renderer,
      validateUrl: async (url) => new URL(url)
    });

    const result = await readPage({
      url: "https://example.com/app",
      maxChars: 40
    });

    expect(renderer.fetch).toHaveBeenCalledOnce();
    expect(result.content).toHaveLength(40);
    expect(result.characterCount).toBe(40);
    expect(result.truncated).toBe(true);
  });

  it("uses Lightpanda directly in always mode", async () => {
    const httpFetcher = { fetch: vi.fn() };
    const renderer = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://example.com/app",
        html: articleHtml,
        status: 200,
        renderer: "lightpanda" as const
      })
    };
    const readPage = createReader({
      httpFetcher,
      renderer,
      validateUrl: async (url) => new URL(url)
    });

    await readPage({ url: "https://example.com/app", render: "always" });

    expect(httpFetcher.fetch).not.toHaveBeenCalled();
    expect(renderer.fetch).toHaveBeenCalledOnce();
  });

  it("fails clearly when always mode has no renderer", async () => {
    const readPage = createReader({
      httpFetcher: { fetch: vi.fn() },
      validateUrl: async (url) => new URL(url)
    });

    await expect(
      readPage({ url: "https://example.com", render: "always" })
    ).rejects.toThrow("Lightpanda renderer is not available");
  });

  it("does not render empty content in never mode and reports extraction failure", async () => {
    const renderer = { fetch: vi.fn() };
    const readPage = createReader({
      httpFetcher: {
        fetch: vi.fn().mockResolvedValue({
          finalUrl: "https://example.com/",
          html: "<html><body></body></html>",
          status: 200,
          renderer: "http" as const
        })
      },
      renderer,
      validateUrl: async (url) => new URL(url)
    });

    await expect(
      readPage({ url: "https://example.com", render: "never" })
    ).rejects.toMatchObject({ code: "EXTRACTION_FAILED" });
    expect(renderer.fetch).not.toHaveBeenCalled();
  });

  it("rejects bot-block pages as content", async () => {
    const readPage = createReader({
      httpFetcher: {
        fetch: vi.fn().mockResolvedValue({
          finalUrl: "https://example.com/",
          html: "<html><head><title>Sorry, you have been blocked</title></head><body><main>Cloudflare Ray ID</main></body></html>",
          status: 200,
          renderer: "http" as const
        })
      },
      validateUrl: async (url) => new URL(url)
    });

    await expect(readPage({ url: "https://example.com", render: "never" })).rejects.toMatchObject({
      code: "BLOCKED"
    });
  });

  it("uses the production URL validator by default", async () => {
    const readPage = createReader({
      httpFetcher: {
        fetch: vi.fn().mockResolvedValue({
          finalUrl: "https://1.1.1.1/",
          html: articleHtml,
          status: 200,
          renderer: "http" as const
        })
      }
    });

    await expect(readPage({ url: "https://1.1.1.1" })).resolves.toMatchObject({
      finalUrl: "https://1.1.1.1/"
    });
  });

  it("uses a supported alternate fetcher after an HTTP error in auto mode", async () => {
    const alternate = {
      supports: vi.fn().mockReturnValue(true),
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://writer.medium.com/article",
        html: articleHtml,
        status: 200,
        renderer: "http" as const
      })
    };
    const readPage = createReader({
      httpFetcher: { fetch: vi.fn().mockRejectedValue(new Error("HTTP 403")) },
      alternateFetchers: [alternate],
      validateUrl: async (url) => new URL(url)
    });

    const result = await readPage({ url: "https://writer.medium.com/article" });

    expect(alternate.fetch).toHaveBeenCalledOnce();
    expect(result.title).toBe("A focused article");
  });

  it("returns a cached result before fetching", async () => {
    const cached = {
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: "Cached",
      author: null,
      siteName: null,
      description: null,
      content: "Cached content",
      language: "en",
      publishedAt: null,
      wordCount: 2,
      characterCount: 14,
      extractionMethod: "readability" as const,
      confidence: 0.9,
      truncated: false
    };
    const httpFetcher = { fetch: vi.fn() };
    const cache = {
      get: vi.fn().mockResolvedValue(cached),
      set: vi.fn()
    };
    const readPage = createReader({
      httpFetcher,
      cache,
      validateUrl: async (url) => new URL(url)
    });

    await expect(readPage({ url: "https://example.com" })).resolves.toEqual(cached);
    expect(httpFetcher.fetch).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("writes successful results to cache with the configured TTL", async () => {
    const cache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const readPage = createReader({
      httpFetcher: {
        fetch: vi.fn().mockResolvedValue({
          finalUrl: "https://example.com/",
          html: articleHtml,
          status: 200,
          renderer: "http" as const
        })
      },
      cache,
      cacheTtlMs: 5000,
      validateUrl: async (url) => new URL(url)
    });

    const result = await readPage({ url: "https://example.com" });

    expect(cache.set).toHaveBeenCalledWith(expect.any(String), result, 5000);
  });

  it("uses the default cache TTL and ignores cache failures", async () => {
    const cache = {
      get: vi.fn().mockRejectedValue(new Error("cache unavailable")),
      set: vi.fn().mockRejectedValue(new Error("cache unavailable"))
    };
    const readPage = createReader({
      httpFetcher: {
        fetch: vi.fn().mockResolvedValue({
          finalUrl: "https://example.com/",
          html: articleHtml,
          status: 200,
          renderer: "http" as const
        })
      },
      cache,
      validateUrl: async (url) => new URL(url)
    });

    await expect(readPage({ url: "https://example.com" })).resolves.toMatchObject({
      title: "A focused article"
    });
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 3_600_000);
  });

  it("falls back to the renderer when HTTP fails and no alternate supports the URL", async () => {
    const renderer = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://example.com/",
        html: "<html><body><main>Rendered response</main></body></html>",
        status: 200,
        renderer: "lightpanda" as const
      })
    };
    const readPage = createReader({
      httpFetcher: { fetch: vi.fn().mockRejectedValue(new Error("HTTP failed")) },
      renderer,
      alternateFetchers: [{ supports: () => false, fetch: vi.fn() }],
      validateUrl: async (url) => new URL(url)
    });

    await expect(readPage({ url: "https://example.com" })).resolves.toMatchObject({
      content: "Rendered response"
    });
    expect(renderer.fetch).toHaveBeenCalledOnce();
  });

  it("preserves the HTTP error when no fallback is available", async () => {
    const failure = new Error("HTTP failed");
    const readPage = createReader({
      httpFetcher: { fetch: vi.fn().mockRejectedValue(failure) },
      validateUrl: async (url) => new URL(url)
    });

    await expect(readPage({ url: "https://example.com" })).rejects.toBe(failure);
  });

  it("reports alternate source failure when no renderer is available", async () => {
    const readPage = createReader({
      httpFetcher: { fetch: vi.fn().mockRejectedValue(new Error("HTTP failed")) },
      alternateFetchers: [
        {
          supports: () => true,
          fetch: vi.fn().mockRejectedValue(new Error("Feed failed"))
        }
      ],
      validateUrl: async (url) => new URL(url)
    });

    await expect(readPage({ url: "https://writer.medium.com/post" })).rejects.toMatchObject({
      code: "ALTERNATE_SOURCE_FAILED"
    });
  });

  it("uses the renderer when an alternate source also fails", async () => {
    const renderer = {
      fetch: vi.fn().mockResolvedValue({
        finalUrl: "https://writer.medium.com/post",
        html: articleHtml,
        status: 200,
        renderer: "lightpanda" as const
      })
    };
    const readPage = createReader({
      httpFetcher: { fetch: vi.fn().mockRejectedValue(new Error("HTTP failed")) },
      alternateFetchers: [
        {
          supports: () => true,
          fetch: vi.fn().mockRejectedValue(new Error("Feed failed"))
        }
      ],
      renderer,
      validateUrl: async (url) => new URL(url)
    });

    await expect(readPage({ url: "https://writer.medium.com/post" })).resolves.toMatchObject({
      title: "A focused article"
    });
  });

  it.each([
    ["Access denied", "Content"],
    ["Just a moment...", "Content"],
    ["Normal title", "Cloudflare Ray ID: test"]
  ])("recognizes common bot-block signature %s", async (title, content) => {
    const readPage = createReader({
      httpFetcher: {
        fetch: vi.fn().mockResolvedValue({
          finalUrl: "https://example.com/",
          html: `<html><head><title>${title}</title></head><body><main>${content}</main></body></html>`,
          status: 200,
          renderer: "http" as const
        })
      },
      validateUrl: async (url) => new URL(url)
    });

    await expect(
      readPage({ url: "https://example.com", render: "never" })
    ).rejects.toMatchObject({ code: "BLOCKED" });
  });
});
