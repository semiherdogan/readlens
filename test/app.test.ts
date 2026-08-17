import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createReader: vi.fn(),
  createHttpFetcher: vi.fn(),
  createLightpandaFetcher: vi.fn(),
  createMediumFeedFetcher: vi.fn(),
  createFilePageCache: vi.fn()
}));

vi.mock("../src/core/reader.js", () => ({ createReader: mocks.createReader }));
vi.mock("../src/fetchers/http.js", () => ({ createHttpFetcher: mocks.createHttpFetcher }));
vi.mock("../src/fetchers/lightpanda.js", () => ({
  createLightpandaFetcher: mocks.createLightpandaFetcher
}));
vi.mock("../src/fetchers/medium-feed.js", () => ({
  createMediumFeedFetcher: mocks.createMediumFeedFetcher
}));
vi.mock("../src/cache/file-cache.js", () => ({
  createFilePageCache: mocks.createFilePageCache
}));

import { createDefaultReader } from "../src/app.js";

describe("createDefaultReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createHttpFetcher.mockReturnValue({ fetch: vi.fn() });
    mocks.createLightpandaFetcher.mockReturnValue({ fetch: vi.fn() });
    mocks.createMediumFeedFetcher.mockReturnValue({ supports: vi.fn(), fetch: vi.fn() });
    mocks.createFilePageCache.mockReturnValue({ get: vi.fn(), set: vi.fn() });
    mocks.createReader.mockReturnValue(vi.fn());
  });

  it("wires fetchers, private-network policy, and file cache", async () => {
    const readPage = createDefaultReader({
      allowPrivateNetwork: false,
      lightpandaExecutable: "/bin/lightpanda",
      cacheEnabled: true,
      cacheTtlMs: 5000,
      cacheDirectory: "/tmp/cleanweb-cache"
    });

    expect(readPage).toBe(mocks.createReader.mock.results[0]!.value);
    expect(mocks.createLightpandaFetcher).toHaveBeenCalledWith({
      blockPrivateNetworks: true,
      executable: "/bin/lightpanda"
    });
    expect(mocks.createFilePageCache).toHaveBeenCalledWith({
      directory: "/tmp/cleanweb-cache"
    });
    const dependencies = mocks.createReader.mock.calls[0]![0];
    expect(dependencies.cacheTtlMs).toBe(5000);
    await expect(dependencies.validateUrl("http://127.0.0.1")).rejects.toMatchObject({
      code: "PRIVATE_NETWORK"
    });
  });

  it("supports disabled cache, private URLs, and default cache locations", async () => {
    vi.stubEnv("XDG_CACHE_HOME", "/tmp/xdg-cache");
    createDefaultReader({
      allowPrivateNetwork: true,
      lightpandaExecutable: undefined,
      cacheEnabled: false,
      cacheTtlMs: 1000
    });
    let dependencies = mocks.createReader.mock.calls[0]![0];
    await expect(dependencies.validateUrl("http://127.0.0.1")).resolves.toEqual(
      new URL("http://127.0.0.1")
    );
    expect(mocks.createLightpandaFetcher).toHaveBeenCalledWith({
      blockPrivateNetworks: false
    });
    expect(mocks.createFilePageCache).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
    createDefaultReader({
      allowPrivateNetwork: true,
      lightpandaExecutable: undefined,
      cacheEnabled: true,
      cacheTtlMs: 1000
    });
    dependencies = mocks.createReader.mock.calls[1]![0];
    expect(dependencies.cache).toBeDefined();
    expect(mocks.createFilePageCache).toHaveBeenLastCalledWith({
      directory: expect.stringContaining("/.cache/cleanweb")
    });
  });
});
