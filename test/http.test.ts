import { describe, expect, it, vi } from "vitest";

import { createHttpFetcher } from "../src/fetchers/http.js";

describe("createHttpFetcher", () => {
  it("validates redirect targets before following them", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/article" }
        })
      )
      .mockResolvedValueOnce(
        new Response("<html><body><main>Article</main></body></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        })
      );
    const validateUrl = vi.fn(async (url: string) => new URL(url));
    const fetcher = createHttpFetcher({ fetch, validateUrl });

    const result = await fetcher.fetch(new URL("https://example.com/start"));

    expect(validateUrl).toHaveBeenCalledWith("https://example.com/article");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      new URL("https://example.com/start"),
      expect.objectContaining({ redirect: "manual" })
    );
    expect(result).toEqual({
      finalUrl: "https://example.com/article",
      html: "<html><body><main>Article</main></body></html>",
      status: 200,
      renderer: "http"
    });
  });

  it.each([
    [new Response("no", { status: 500 }), "HTTP request failed with status 500"],
    [
      new Response("{}", { headers: { "content-type": "application/json" } }),
      "Unsupported content type: application/json"
    ],
    [new Response(null), "Unsupported content type: unknown"]
  ])("rejects invalid HTTP responses", async (response, message) => {
    const fetcher = createHttpFetcher({
      fetch: vi.fn().mockResolvedValue(response),
      validateUrl: async (url) => new URL(url)
    });

    await expect(fetcher.fetch(new URL("https://example.com"))).rejects.toThrow(message);
  });

  it("rejects redirects without a location and redirect loops", async () => {
    const missingLocation = createHttpFetcher({
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 302 })),
      validateUrl: async (url) => new URL(url)
    });
    const redirectLoop = createHttpFetcher({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 302, headers: { location: "/again" } })
        ),
      validateUrl: async (url) => new URL(url),
      maxRedirects: 0
    });

    await expect(missingLocation.fetch(new URL("https://example.com"))).rejects.toThrow(
      "Redirect response has no location header"
    );
    await expect(redirectLoop.fetch(new URL("https://example.com"))).rejects.toThrow(
      "Too many redirects"
    );
  });

  it("enforces declared and streamed response size limits", async () => {
    const declared = createHttpFetcher({
      fetch: vi.fn().mockResolvedValue(
        new Response("large", {
          headers: { "content-type": "text/html", "content-length": "100" }
        })
      ),
      validateUrl: async (url) => new URL(url),
      maxBytes: 4
    });
    const streamed = createHttpFetcher({
      fetch: vi.fn().mockResolvedValue(
        new Response("large", { headers: { "content-type": "text/html" } })
      ),
      validateUrl: async (url) => new URL(url),
      maxBytes: 4
    });

    await expect(declared.fetch(new URL("https://example.com"))).rejects.toThrow(
      "Response exceeds 4 bytes"
    );
    await expect(streamed.fetch(new URL("https://example.com"))).rejects.toThrow(
      "Response exceeds 4 bytes"
    );
  });

  it("supports an empty HTML response body", async () => {
    const fetcher = createHttpFetcher({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(null, { headers: { "content-type": "text/html" } })
        ),
      validateUrl: async (url) => new URL(url)
    });

    await expect(fetcher.fetch(new URL("https://example.com"))).resolves.toMatchObject({
      html: ""
    });
  });

  it("uses safe production defaults", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("<html></html>", { headers: { "content-type": "text/html" } })
    );
    vi.stubGlobal("fetch", fetch);

    try {
      const result = await createHttpFetcher().fetch(new URL("https://1.1.1.1"));
      expect(result.status).toBe(200);
      expect(fetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("classifies timeout and generic fetch failures", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    const timeoutFetcher = createHttpFetcher({
      fetch: vi.fn().mockRejectedValue(timeout),
      validateUrl: async (url) => new URL(url),
      timeoutMs: 25
    });
    const failedFetcher = createHttpFetcher({
      fetch: vi.fn().mockRejectedValue("socket failed"),
      validateUrl: async (url) => new URL(url)
    });

    await expect(timeoutFetcher.fetch(new URL("https://example.com"))).rejects.toMatchObject({
      code: "FETCH_TIMEOUT",
      message: "Request timed out after 25 ms"
    });
    await expect(failedFetcher.fetch(new URL("https://example.com"))).rejects.toMatchObject({
      code: "FETCH_FAILED"
    });
  });
});
