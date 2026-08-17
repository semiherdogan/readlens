#!/usr/bin/env node

import { createDefaultReader } from "../app.js";
import { startMcpStdio } from "../mcp/stdio.js";
import { runCli } from "./run.js";

const exitCode = await runCli(process.argv.slice(2), {
  createReader: createDefaultReader,
  startMcp: startMcpStdio,
  writeOut: (value) => process.stdout.write(value),
  writeError: (value) => process.stderr.write(value)
});

process.exitCode = exitCode;
