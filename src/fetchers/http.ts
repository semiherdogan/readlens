import { validatePublicUrl } from "../core/security.js";
import type { FetchedPage, PageFetcher } from "../core/types.js";

type FetchFunction = (input: URL, init: RequestInit) => Promise<Response>;

export type HttpFetcherOptions = {
  fetch?: FetchFunction;
  validateUrl?: (url: string) => Promise<URL>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  acceptedContentTypes?: string[];
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Response exceeds ${maxBytes} bytes`);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export function createHttpFetcher(options: HttpFetcherOptions = {}): PageFetcher {
  const fetchFunction = options.fetch ?? globalThis.fetch;
  const validateUrl = options.validateUrl ?? validatePublicUrl;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const acceptedContentTypes = options.acceptedContentTypes ?? [
    "text/html",
    "application/xhtml+xml"
  ];

  return {
    async fetch(inputUrl: URL): Promise<FetchedPage> {
      let url = await validateUrl(inputUrl.href);

      let redirectCount = 0;
      while (true) {
        const response = await fetchFunction(url, {
          headers: {
            accept: acceptedContentTypes.join(","),
            "user-agent": "CleanWeb/0.1"
          },
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs)
        });

        if (REDIRECT_STATUSES.has(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new Error("Redirect response has no location header");
          if (redirectCount === maxRedirects) throw new Error("Too many redirects");
          url = await validateUrl(new URL(location, url).href);
          redirectCount += 1;
          continue;
        }

        if (!response.ok) throw new Error(`HTTP request failed with status ${response.status}`);
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!acceptedContentTypes.some((type) => contentType.includes(type))) {
          throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
        }

        return {
          finalUrl: url.href,
          html: await readLimited(response, maxBytes),
          status: response.status,
          renderer: "http"
        };
      }
    }
  };
}
