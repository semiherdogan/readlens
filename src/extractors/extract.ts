import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type { ExtractedContent, ExtractionMethod } from "../core/types.js";

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
  "[class*='social-share']",
  "[id*='cookie']",
  "[id*='newsletter']",
  "[id*='advert']"
].join(",");

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
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
  return cleanText(clone.textContent);
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

function fallbackContent(document: Document): {
  content: string;
  method: ExtractionMethod;
} {
  const selectors: Array<[string, ExtractionMethod]> = [
    ["article", "article-element"],
    ["main", "main-element"],
    ["[role='main']", "role-main"]
  ];

  for (const [selector, method] of selectors) {
    const content = structuredText(document.querySelector(selector));
    if (content) return { content, method };
  }

  const candidates = [...document.body.querySelectorAll("div, section")]
    .map((element) => ({
      content: structuredText(element),
      linkText: cleanText(
        [...element.querySelectorAll("a")].map((link) => link.textContent).join(" ")
      )
    }))
    .filter(({ content }) => content.length >= 80)
    .sort((left, right) => {
      const leftScore = left.content.length - left.linkText.length * 2;
      const rightScore = right.content.length - right.linkText.length * 2;
      return rightScore - leftScore;
    });

  const dense = candidates[0]?.content;
  if (dense) return { content: dense, method: "text-density" };
  return { content: structuredText(document.body), method: "body-text" };
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

export function extractContent(html: string, url: string): ExtractedContent {
  const dom = new JSDOM(html, { url });
  const { document } = dom.window;
  document.querySelectorAll(NOISE_SELECTORS).forEach((element) => element.remove());

  const article = new Readability(document.cloneNode(true) as Document).parse();
  const candidateText = article?.content
    ? structuredText(JSDOM.fragment(article.content))
    : "";
  const readableText = candidateText.length >= 120 ? candidateText : "";
  const fallback = readableText ? null : fallbackContent(document);
  const content = readableText || fallback?.content || "";
  const extractionMethod: ExtractionMethod = fallback?.method ?? "readability";
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
