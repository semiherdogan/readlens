import { createReader } from "./core/reader.js";
import { validatePublicUrl } from "./core/security.js";
import type { ReadPage } from "./core/types.js";
import { createHttpFetcher } from "./fetchers/http.js";
import { createLightpandaFetcher } from "./fetchers/lightpanda.js";

export type AppOptions = {
  allowPrivateNetwork: boolean;
  lightpandaExecutable: string | undefined;
};

export function createDefaultReader(options: AppOptions): ReadPage {
  const validateUrl = (url: string) =>
    validatePublicUrl(url, { allowPrivateNetwork: options.allowPrivateNetwork });
  const lightpandaOptions = {
    blockPrivateNetworks: !options.allowPrivateNetwork,
    ...(options.lightpandaExecutable ? { executable: options.lightpandaExecutable } : {})
  };

  return createReader({
    httpFetcher: createHttpFetcher({ validateUrl }),
    renderer: createLightpandaFetcher(lightpandaOptions),
    validateUrl
  });
}
