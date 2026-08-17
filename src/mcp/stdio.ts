import { serveStdio } from "@modelcontextprotocol/server/stdio";

import type { ReadPage } from "../core/types.js";
import { createCleanWebMcpServer } from "./server.js";

export function startMcpStdio(readPage: ReadPage): void {
  serveStdio(() => createCleanWebMcpServer(readPage), {
    onerror: (error) => {
      console.error(error.message);
    }
  });
}
