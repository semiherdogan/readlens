import { describe, expect, it } from "vitest";

import { extractContent } from "../src/extractors/extract.js";

describe("extractContent", () => {
  it("returns readable article text without page chrome", () => {
    const html = `<!doctype html>
      <html lang="en">
        <head>
          <title>Ignored browser title</title>
          <meta name="author" content="Ada Lovelace">
          <meta name="description" content="A useful description">
          <meta property="og:site_name" content="Example Journal">
        </head>
        <body>
          <nav>Home Products Subscribe</nav>
          <article>
            <h1>How Clean Readers Work</h1>
            <p>Useful content starts here and contains enough detail for a reader.</p>
            <p>A second paragraph makes the extraction representative and reliable.</p>
          </article>
          <footer>Copyright and legal links</footer>
        </body>
      </html>`;

    const result = extractContent(html, "https://example.com/article");

    expect(result).toMatchObject({
      title: "How Clean Readers Work",
      author: "Ada Lovelace",
      siteName: "Example Journal",
      description: "A useful description",
      language: "en",
      extractionMethod: "readability"
    });
    expect(result.content).toContain("Useful content starts here");
    expect(result.content).not.toContain("Home Products Subscribe");
    expect(result.content).not.toContain("Copyright and legal links");
  });

  it.each([
    ["<article>Short article</article>", "article-element"],
    ["<main>Short main content</main>", "main-element"],
    ["<div role='main'>Short role content</div>", "role-main"]
  ])("uses structural fallback for %s", (body, method) => {
    const result = extractContent(`<html><body>${body}</body></html>`, "https://example.com");

    expect(result.extractionMethod).toBe(method);
    expect(result.content).toContain("Short");
    expect(result.confidence).toBeLessThan(0.8);
  });

  it("uses text density and body text fallbacks", () => {
    const denseText = "dense ".repeat(16).trim();
    const dense = extractContent(
      `<html><body><div>${denseText}<a href="/x">link</a></div></body></html>`,
      "https://example.com"
    );
    const body = extractContent("<html><body><p>Tiny text</p></body></html>", "https://example.com");

    expect(dense.extractionMethod).toBe("text-density");
    expect(dense.content).toContain(denseText);
    expect(body).toMatchObject({
      content: "Tiny text",
      extractionMethod: "body-text",
      confidence: 0.25
    });
  });

  it("extracts published dates from metadata and time elements", () => {
    const metadata = extractContent(
      `<html><head><meta property="article:published_time" content="2026-08-10"></head>
       <body><article>${"published content ".repeat(20)}</article></body></html>`,
      "https://example.com"
    );
    const time = extractContent(
      `<html><body><time datetime="2026-08-11"></time><article>${"content ".repeat(20)}</article></body></html>`,
      "https://example.com"
    );

    expect(metadata.publishedAt).toBe("2026-08-10");
    expect(time.publishedAt).toBe("2026-08-11");
    expect(
      extractContent(
        `<html><body><article>${"long readable content ".repeat(40)}</article></body></html>`,
        "https://example.com"
      ).confidence
    ).toBeCloseTo(0.95);
  });
});
