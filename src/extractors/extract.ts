import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type { ExtractedContent, ExtractionMethod, OutputFormat } from "../core/types.js";

const NOISE_SELECTORS = [
  "nav",
  "footer",
  "aside",
  "dialog",
  "form",
  "button",
  "[role='navigation']",
  "[role='dialog']",
  "[aria-modal='true']",
  "[class*='cookie']",
  "[class*='newsletter']",
  "[class*='advert']",
  "[class~='ad']",
  "[class^='ad-']",
  "[class*=' ad-']",
  "[class$='-ad']",
  "[class*='-ad ']",
  "[class~='adv']",
  "[class^='adv-']",
  "[class*=' adv-']",
  "[class$='-adv']",
  "[class*='-adv ']",
  "[data-ad-slot]",
  "[data-ad-unit]",
  "[class*='social-share']",
  "[id*='cookie']",
  "[id*='newsletter']",
  "[id*='advert']"
].join(",");

function cleanText(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function structuredText(root: DocumentFragment | Element | null): string {
  if (!root) return "";
  const clone = root.cloneNode(true) as DocumentFragment | Element;
  clone.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  clone
    .querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,dt,dd,td,th")
    .forEach((element) => element.append("\n\n"));
  return cleanText(clone.textContent!);
}

function markdownChildren(element: Element, baseUrl: string): string {
  return [...element.childNodes].map((node) => markdownNode(node, baseUrl)).join("");
}

function markdownNode(node: Node, baseUrl: string): string {
  if (node.nodeType === node.TEXT_NODE) return node.textContent!.replace(/\s+/gu, " ");
  if (node.nodeType !== node.ELEMENT_NODE) return "";

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const children = markdownChildren(element, baseUrl);

  if (/^h[1-6]$/u.test(tag)) {
    return `${"#".repeat(Number(tag[1]))} ${children.trim()}\n\n`;
  }
  if (tag === "p") return `${children.trim()}\n\n`;
  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return `**${children.trim()}**`;
  if (tag === "em" || tag === "i") return `*${children.trim()}*`;
  if (tag === "code" && element.parentElement?.tagName.toLowerCase() !== "pre") {
    return `\`${element.textContent!}\``;
  }
  if (tag === "pre") return `\`\`\`\n${element.textContent!.trimEnd()}\n\`\`\`\n\n`;
  if (tag === "blockquote") {
    return `${children
      .trim()
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")}\n\n`;
  }
  if (tag === "a") {
    const href = element.getAttribute("href");
    if (!href) return children;
    return `[${children.trim()}](${new URL(href, baseUrl).href})`;
  }
  if (tag === "img") {
    const source = element.getAttribute("src");
    if (!source) return "";
    return `![${element.getAttribute("alt") ?? ""}](${new URL(source, baseUrl).href})`;
  }
  if (tag === "figure") return `${children.trim()}\n\n`;
  if (tag === "figcaption") return `_${children.trim()}_\n\n`;
  if (tag === "li") return `- ${children.trim()}\n`;
  if (tag === "ol") {
    const items = [...element.children]
      .map((item, index) => `${index + 1}. ${markdownChildren(item, baseUrl).trim()}\n`)
      .join("");
    return `${items.trimEnd()}\n\n`;
  }
  if (tag === "ul") return `${children.trimEnd()}\n\n`;
  return children;
}

function htmlToMarkdown(html: string, url: string): string {
  const document = new JSDOM(`<body>${html}</body>`, { url }).window.document;
  return markdownChildren(document.body, url)
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function metadata(document: Document, name: string): string | null {
  return (
    document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || null
  );
}

function propertyMetadata(document: Document, property: string): string | null {
  return (
    document
      .querySelector(`meta[property="${property}"]`)
      ?.getAttribute("content")
      ?.trim() || null
  );
}

function elementDepth(element: Element): number {
  let depth = 0;
  let parent = element.parentElement;
  while (parent) {
    depth += 1;
    parent = parent.parentElement;
  }
  return depth;
}

function fallbackContent(document: Document): {
  content: string;
  html: string;
  method: ExtractionMethod;
} {
  const selectors: Array<[string, ExtractionMethod]> = [
    ["article", "article-element"],
    ["main", "main-element"],
    ["[role='main']", "role-main"]
  ];

  for (const [selector, method] of selectors) {
    const content = structuredText(document.querySelector(selector));
    const element = document.querySelector(selector);
    if (content && element) return { content, html: element.outerHTML, method };
  }

  const candidates = [...document.body.querySelectorAll("div, section")]
    .map((element) => ({
      content: structuredText(element),
      html: element.outerHTML,
      linkText: cleanText(
        [...element.querySelectorAll("a")].map((link) => link.textContent).join(" ")
      ),
      depth: elementDepth(element)
    }))
    .filter(({ content }) => content.length >= 80)
    .sort((left, right) => {
      const leftScore = left.content.length - left.linkText.length * 2;
      const rightScore = right.content.length - right.linkText.length * 2;
      const scoreDifference = rightScore - leftScore;
      const similarScores = Math.abs(scoreDifference) < Math.max(leftScore, rightScore) * 0.1;
      return similarScores ? right.depth - left.depth : scoreDifference;
    });

  const dense = candidates[0]?.content;
  if (dense) {
    return { content: dense, html: candidates[0]!.html, method: "text-density" };
  }
  return {
    content: structuredText(document.body),
    html: document.body.innerHTML,
    method: "body-text"
  };
}

function shouldPreferFallback(readableText: string, fallbackText: string): boolean {
  return (
    readableText.length >= 120 &&
    fallbackText.length > readableText.length + 500 &&
    fallbackText.startsWith(readableText.slice(0, 120))
  );
}

function confidence(method: ExtractionMethod, contentLength: number): number {
  const methodScore: Record<ExtractionMethod, number> = {
    readability: 0.9,
    "article-element": 0.82,
    "main-element": 0.76,
    "role-main": 0.74,
    "text-density": 0.62,
    "body-text": 0.4
  };
  const lengthAdjustment = contentLength >= 500 ? 0.05 : contentLength >= 100 ? 0 : -0.15;
  return Math.max(0, Math.min(1, methodScore[method] + lengthAdjustment));
}

export function extractContent(
  html: string,
  url: string,
  format: OutputFormat = "text"
): ExtractedContent {
  const dom = new JSDOM(html, { url });
  const { document } = dom.window;
  document.querySelectorAll(NOISE_SELECTORS).forEach((element) => element.remove());

  const article = new Readability(document.cloneNode(true) as Document).parse();
  const candidateText = article?.content
    ? structuredText(JSDOM.fragment(article.content))
    : "";
  const readableText = candidateText.length >= 120 ? candidateText : "";
  const fallback = fallbackContent(document);
  const useFallback = !readableText || shouldPreferFallback(readableText, fallback.content);
  const sourceHtml = useFallback ? fallback.html : article!.content!;
  const content =
    format === "markdown"
      ? htmlToMarkdown(sourceHtml, url)
      : useFallback ? fallback.content : readableText;
  const extractionMethod: ExtractionMethod = useFallback ? fallback.method : "readability";
  const publishedAt =
    propertyMetadata(document, "article:published_time") ||
    document.querySelector("time[datetime]")?.getAttribute("datetime")?.trim() ||
    null;

  return {
    title: document.querySelector("h1")?.textContent?.trim() || article?.title?.trim() || null,
    author: article?.byline?.trim() || metadata(document, "author"),
    siteName: article?.siteName?.trim() || propertyMetadata(document, "og:site_name"),
    description: article?.excerpt?.trim() || metadata(document, "description"),
    content,
    language: document.documentElement.lang.trim() || null,
    publishedAt,
    extractionMethod,
    confidence: confidence(extractionMethod, content.length)
  };
}
