import { createReader } from "./core/reader.js";
import { validatePublicUrl } from "./core/security.js";
import type { ReadPage } from "./core/types.js";
import { createHttpFetcher } from "./fetchers/http.js";
import { createLightpandaFetcher } from "./fetchers/lightpanda.js";
import { createMediumFeedFetcher } from "./fetchers/medium-feed.js";
import { createFilePageCache } from "./cache/file-cache.js";
import { homedir } from "node:os";
import { join } from "node:path";

export type AppOptions = {
  allowPrivateNetwork: boolean;
  lightpandaExecutable: string | undefined;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheDirectory?: string;
};

export function createDefaultReader(options: AppOptions): ReadPage {
  const validateUrl = (url: string) =>
    validatePublicUrl(url, { allowPrivateNetwork: options.allowPrivateNetwork });
  const lightpandaOptions = {
    blockPrivateNetworks: !options.allowPrivateNetwork,
    ...(options.lightpandaExecutable ? { executable: options.lightpandaExecutable } : {})
  };

  const httpFetcher = createHttpFetcher({ validateUrl });
  const mediumFeedFetcher = createMediumFeedFetcher(
    createHttpFetcher({
      validateUrl,
      acceptedContentTypes: ["text/xml", "application/xml", "application/rss+xml"]
    })
  );
  const cacheDirectory =
    options.cacheDirectory ??
    join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "cleanweb");

  return createReader({
    httpFetcher,
    renderer: createLightpandaFetcher(lightpandaOptions),
    alternateFetchers: [mediumFeedFetcher],
    ...(options.cacheEnabled
      ? {
          cache: createFilePageCache({ directory: cacheDirectory }),
          cacheTtlMs: options.cacheTtlMs
        }
      : {}),
    validateUrl
  });
}
