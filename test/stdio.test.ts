import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serveStdio: vi.fn(),
  createServer: vi.fn().mockReturnValue({ server: true })
}));

vi.mock("@modelcontextprotocol/server/stdio", () => ({ serveStdio: mocks.serveStdio }));
vi.mock("../src/mcp/server.js", () => ({
  createPageNectarMcpServer: mocks.createServer
}));

import { startMcpStdio } from "../src/mcp/stdio.js";

describe("startMcpStdio", () => {
  it("serves a PageNectar server factory and reports transport errors to stderr", () => {
    const readPage = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    startMcpStdio(readPage);

    const [factory, options] = mocks.serveStdio.mock.calls[0]!;
    expect(factory()).toEqual({ server: true });
    expect(mocks.createServer).toHaveBeenCalledWith(readPage);
    options.onerror(new Error("transport failed"));
    expect(error).toHaveBeenCalledWith("transport failed");
    error.mockRestore();
  });
});
