import { describe, expect, it, vi } from "vitest";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup }));

import { validatePublicUrl } from "../src/core/security.js";
import { PageNectarError } from "../src/core/errors.js";

describe("validatePublicUrl", () => {
  it("accepts public HTTP and HTTPS URLs", async () => {
    await expect(
      validatePublicUrl("https://example.com/article", {
        resolve: async () => ["93.184.216.34"]
      })
    ).resolves.toEqual(new URL("https://example.com/article"));
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/file",
    "http://localhost",
    "http://127.0.0.1",
    "http://0.0.0.0",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://169.254.1.1",
    "http://224.0.0.1",
    "http://[fc00::1]",
    "http://[fd00::1]",
    "http://[::1]"
  ])("rejects unsafe URL %s", async (url) => {
    await expect(validatePublicUrl(url)).rejects.toBeInstanceOf(PageNectarError);
  });

  it("uses DNS resolution and rejects hostnames with any private address", async () => {
    lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    await expect(validatePublicUrl("https://public.example")).resolves.toEqual(
      new URL("https://public.example")
    );

    const resolve = vi.fn().mockResolvedValue(["93.184.216.34", "10.0.0.1"]);
    await expect(
      validatePublicUrl("https://mixed.example", { resolve })
    ).rejects.toMatchObject({ code: "PRIVATE_NETWORK" });
    await expect(
      validatePublicUrl("https://empty.example", { resolve: async () => [] })
    ).rejects.toMatchObject({ code: "PRIVATE_NETWORK" });
  });

  it("allows private addresses only when explicitly enabled", async () => {
    await expect(
      validatePublicUrl("http://127.0.0.1", { allowPrivateNetwork: true })
    ).resolves.toEqual(new URL("http://127.0.0.1"));
  });

  it.each(["not a url", "http://[::ffff:127.0.0.1]", "http://[fe80::1]"])(
    "rejects malformed or private address %s",
    async (url) => {
      await expect(validatePublicUrl(url)).rejects.toBeInstanceOf(PageNectarError);
    }
  );

  it("accepts a public IPv6 literal", async () => {
    await expect(validatePublicUrl("https://[2606:4700:4700::1111]")).resolves.toEqual(
      new URL("https://[2606:4700:4700::1111]")
    );
  });

  it.each(["http://172.15.0.1", "http://172.32.0.1", "http://192.167.1.1"])(
    "accepts public IPv4 boundary %s",
    async (url) => {
      await expect(validatePublicUrl(url)).resolves.toEqual(new URL(url));
    }
  );

  it("rejects invalid and dotted IPv4-mapped resolver results", async () => {
    await expect(
      validatePublicUrl("https://invalid-address.example", {
        resolve: async () => ["not-an-ip"]
      })
    ).rejects.toMatchObject({ code: "PRIVATE_NETWORK" });
    await expect(
      validatePublicUrl("https://mapped.example", {
        resolve: async () => ["::ffff:127.0.0.1"]
      })
    ).rejects.toMatchObject({ code: "PRIVATE_NETWORK" });
  });

  it("distinguishes invalid URLs from private network URLs", async () => {
    await expect(validatePublicUrl("not a url")).rejects.toMatchObject({
      code: "INVALID_URL"
    });
    await expect(validatePublicUrl("http://127.0.0.1")).rejects.toMatchObject({
      code: "PRIVATE_NETWORK"
    });
  });
});
