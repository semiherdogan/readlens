export type RenderMode = "auto" | "always" | "never";
export type OutputFormat = "text" | "markdown";

export type ExtractionMethod =
  | "readability"
  | "article-element"
  | "main-element"
  | "role-main"
  | "text-density"
  | "body-text";

export type ExtractedContent = {
  title: string | null;
  author: string | null;
  siteName: string | null;
  description: string | null;
  content: string;
  language: string | null;
  publishedAt: string | null;
  extractionMethod: ExtractionMethod;
  confidence: number;
};

export type ReadPageInput = {
  url: string;
  format?: OutputFormat;
  render?: RenderMode;
  maxChars?: number;
};

export type ReadPageResult = ExtractedContent & {
  url: string;
  finalUrl: string;
  wordCount: number;
  characterCount: number;
  truncated: boolean;
};

export type ReadPage = (input: ReadPageInput) => Promise<ReadPageResult>;

export type FetchedPage = {
  finalUrl: string;
  html: string;
  status: number;
  renderer: "http" | "lightpanda";
};

export interface PageFetcher {
  fetch(url: URL): Promise<FetchedPage>;
}

export interface SiteAdapter extends PageFetcher {
  supports(url: URL): boolean;
}

export interface PageCache {
  get(key: string): Promise<ReadPageResult | undefined>;
  set(key: string, value: ReadPageResult, ttlMs: number): Promise<void>;
}
