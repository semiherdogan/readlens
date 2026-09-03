import { describe, expect, it, vi } from "vitest";

import { createLightpandaFetcher } from "../src/fetchers/lightpanda.js";

describe("createLightpandaFetcher", () => {
  it("renders HTML with private network blocking enabled", async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        url: "https://example.com/final",
        http_status: 200,
        content: "<html><main>Rendered</main></html>"
      })
    });
    const fetcher = createLightpandaFetcher({ run, executable: "/bin/lightpanda" });

    const result = await fetcher.fetch(new URL("https://example.com/app"));

    expect(run).toHaveBeenCalledWith(
      "/bin/lightpanda",
      expect.arrayContaining([
        "fetch",
        "https://example.com/app",
        "--dump",
        "html",
        "--json",
        "--block-private-networks"
      ]),
      expect.objectContaining({
        env: expect.objectContaining({ LIGHTPANDA_DISABLE_TELEMETRY: "true" }),
        timeout: 20_000
      })
    );
    expect(result).toEqual({
      finalUrl: "https://example.com/final",
      html: "<html><main>Rendered</main></html>",
      status: 200,
      renderer: "lightpanda"
    });
  });

  it("can disable private network blocking for explicit local use", async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        url: "http://127.0.0.1/",
        http_status: 200,
        content: "<html></html>"
      })
    });
    const fetcher = createLightpandaFetcher({ run, blockPrivateNetworks: false });

    await fetcher.fetch(new URL("http://127.0.0.1"));

    expect(run.mock.calls[0]?.[1]).not.toContain("--block-private-networks");
  });

  it("rejects an empty rendered document", async () => {
    const fetcher = createLightpandaFetcher({
      run: vi.fn().mockResolvedValue({ stdout: "  " })
    });

    await expect(fetcher.fetch(new URL("https://example.com"))).rejects.toThrow(
      "Lightpanda returned an empty document"
    );
  });

  it("rejects invalid output from the production process boundary", async () => {
    const fetcher = createLightpandaFetcher({
      executable: "/bin/echo",
      blockPrivateNetworks: false,
      timeoutMs: 1_000
    });

    await expect(fetcher.fetch(new URL("https://example.com"))).rejects.toThrow(
      "Lightpanda returned invalid JSON"
    );
  });

  it("rejects structurally invalid JSON output", async () => {
    const fetcher = createLightpandaFetcher({
      run: vi.fn().mockResolvedValue({ stdout: "{}" })
    });

    await expect(fetcher.fetch(new URL("https://example.com"))).rejects.toThrow(
      "Lightpanda returned an invalid result"
    );
  });

  it("explains how to install a missing Lightpanda executable", async () => {
    const fetcher = createLightpandaFetcher({ executable: "/readlens/missing" });

    await expect(fetcher.fetch(new URL("https://example.com"))).rejects.toMatchObject({
      code: "LIGHTPANDA_NOT_FOUND",
      message: expect.stringMatching(
        /not found at \/readlens\/missing.*--lightpanda <path>.*--render never/u
      )
    });
  });

  it("reports when Lightpanda is missing from PATH", async () => {
    const missingError = Object.assign(new Error("spawn lightpanda ENOENT"), { code: "ENOENT" });
    const fetcher = createLightpandaFetcher({
      run: vi.fn().mockRejectedValue(missingError)
    });

    await expect(fetcher.fetch(new URL("https://example.com"))).rejects.toMatchObject({
      code: "LIGHTPANDA_NOT_FOUND",
      message: expect.stringContaining("Lightpanda was not found on PATH")
    });
  });

  it("reports other process execution failures", async () => {
    const fetcher = createLightpandaFetcher({
      run: vi.fn().mockRejectedValue(new Error("process crashed"))
    });

    await expect(fetcher.fetch(new URL("https://example.com"))).rejects.toMatchObject({
      code: "RENDER_FAILED",
      message: "Lightpanda execution failed"
    });
  });
});
