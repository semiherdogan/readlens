import { serveStdio } from "@modelcontextprotocol/server/stdio";

import type { ReadPage } from "../core/types.js";
import { createReadLensMcpServer } from "./server.js";

export function startMcpStdio(readPage: ReadPage): void {
  serveStdio(() => createReadLensMcpServer(readPage), {
    onerror: (error) => {
      console.error(error.message);
    }
  });
}
