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

  it("does not render short content in never mode", async () => {
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

    const result = await readPage({ url: "https://example.com", render: "never" });

    expect(renderer.fetch).not.toHaveBeenCalled();
    expect(result.wordCount).toBe(0);
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
});
