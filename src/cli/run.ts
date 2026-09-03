import { parseArgs } from "node:util";

import type { AppOptions } from "../app.js";
import type { ReadPage, RenderMode } from "../core/types.js";
import { errorPayload } from "../core/errors.js";

type CliDependencies = {
  createReader: (options: AppOptions) => ReadPage;
  startMcp: (readPage: ReadPage) => void | Promise<void>;
  writeOut: (value: string) => void;
  writeError: (value: string) => void;
};

const USAGE = `Usage:
  readlens read <url> [--json] [--format text|markdown] [--render auto|always|never] [--lightpanda <path>] [--max-chars 100000]
  readlens mcp [--lightpanda <path>] [--allow-private] [--no-cache] [--cache-ttl 3600]
`;

function messageFrom(error: unknown): string {
  const payload = errorPayload(error);
  return `[${payload.code}] ${payload.message}`;
}

function parseRender(value: string | undefined): RenderMode {
  if (!value) return "auto";
  if (value === "auto" || value === "always" || value === "never") return value;
  throw new Error(`Invalid render mode: ${value}`);
}

function parseMaxChars(value: string | undefined): number {
  if (!value) return 100_000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000_000) {
    throw new Error("max-chars must be an integer between 1 and 1000000");
  }
  return parsed;
}

function parseCacheTtl(value: string | undefined): number {
  if (!value) return 3600;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 604_800) {
    throw new Error("cache-ttl must be an integer between 1 and 604800 seconds");
  }
  return parsed;
}

export async function runCli(args: string[], dependencies: CliDependencies): Promise<number> {
  try {
    const command = args[0];
    if (!command || command === "help" || command === "--help" || command === "-h") {
      dependencies.writeOut(USAGE);
      return 0;
    }

    if (command !== "read" && command !== "mcp") {
      throw new Error(`Unknown command: ${command}`);
    }

    const { values, positionals } = parseArgs({
      args: args.slice(1),
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: "boolean", default: false },
        debug: { type: "boolean", default: false },
        format: { type: "string" },
        render: { type: "string" },
        "max-chars": { type: "string" },
        "allow-private": { type: "boolean", default: false },
        lightpanda: { type: "string" },
        "no-cache": { type: "boolean", default: false },
        "cache-ttl": { type: "string" }
      }
    });

    const readPage = dependencies.createReader({
      allowPrivateNetwork: values["allow-private"],
      lightpandaExecutable: values.lightpanda,
      cacheEnabled: !values["no-cache"],
      cacheTtlMs: parseCacheTtl(values["cache-ttl"]) * 1000
    });

    if (command === "mcp") {
      if (positionals.length > 0) throw new Error("mcp does not accept positional arguments");
      await dependencies.startMcp(readPage);
      return 0;
    }

    const [url, ...extraPositionals] = positionals;
    if (!url || extraPositionals.length > 0) throw new Error("read requires exactly one URL");
    if (values.format && values.format !== "text" && values.format !== "markdown") {
      throw new Error("format must be text or markdown");
    }

    const result = await readPage({
      url,
      format: values.format === "markdown" ? "markdown" : "text",
      render: parseRender(values.render),
      maxChars: parseMaxChars(values["max-chars"])
    });

    if (values.debug) {
      dependencies.writeError(
        `renderer=${values.render} extraction=${result.extractionMethod} confidence=${result.confidence.toFixed(2)} chars=${result.characterCount} truncated=${String(result.truncated)}\n`
      );
    }
    dependencies.writeOut(values.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.content}\n`);
    return 0;
  } catch (error) {
    dependencies.writeError(`Error: ${messageFrom(error)}\n`);
    return 1;
  }
}
