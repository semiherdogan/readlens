import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { extractContent } from "../src/extractors/extract.js";

describe("extractContent", () => {
  it("removes structurally identified ad containers without filtering article words", () => {
    const html = readFileSync(new URL("./fixtures/bigpara-ad.html", import.meta.url), "utf8");

    const result = extractContent(html, "https://example.com/news");

    expect(result.content).not.toContain("REKLAM");
    expect(result.content).toContain("Reklamcılık sektörü");
  });

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
      `<html><body><div><div>${denseText}<a href="/x">link</a></div></div></body></html>`,
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

  it("preserves semantic article structures in Markdown format", () => {
    const html = `<html><body><article>
      <h1>Guide</h1>
      <p>Read the <a href="/docs"><strong>documentation</strong></a>.</p>
      <p><b>Bold</b> and <i>italic</i><br><a>plain link</a>
      <img><img src="/image.png"></p>
      <figure><img src="/figure.png" alt="Diagram"><figcaption>A diagram</figcaption></figure>
      <h2>Steps</h2><ul><li>Install</li><li>Run <code>cleanweb</code></li></ul>
      <ol><li>First</li></ol>
      <blockquote>Keep content focused.</blockquote>
      <pre><code>cleanweb read URL</code></pre>
      <!-- ignored -->
      ${"Supporting content. ".repeat(10)}
    </article></body></html>`;

    const result = extractContent(html, "https://example.com/guide", "markdown");

    expect(result.content).toContain("# Guide");
    expect(result.content).toContain("[**documentation**](https://example.com/docs)");
    expect(result.content).toContain("## Steps");
    expect(result.content).toContain("- Run `cleanweb`");
    expect(result.content).toContain("1. First");
    expect(result.content).toContain("**Bold** and *italic*");
    expect(result.content).toContain("plain link");
    expect(result.content).toContain("![](https://example.com/image.png)");
    expect(result.content).toContain(
      "![Diagram](https://example.com/figure.png)_A diagram_"
    );
    expect(result.content).toContain("> Keep content focused.");
    expect(result.content).toContain("```\ncleanweb read URL\n```");
  });

  it("ignores images without a source in Markdown fallback content", () => {
    const result = extractContent(
      "<html><body><main><img><p>Short content</p></main></body></html>",
      "https://example.com",
      "markdown"
    );

    expect(result.content).toBe("Short content");
  });
});
