import { serveStdio } from "@modelcontextprotocol/server/stdio";

import type { ReadPage } from "../core/types.js";
import { createPageNectarMcpServer } from "./server.js";

export function startMcpStdio(readPage: ReadPage): void {
  serveStdio(() => createPageNectarMcpServer(readPage), {
    onerror: (error) => {
      console.error(error.message);
    }
  });
}
