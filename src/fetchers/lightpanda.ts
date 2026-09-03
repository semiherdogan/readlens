import { execFile } from "node:child_process";

import type { FetchedPage, PageFetcher } from "../core/types.js";
import { ReadLensError } from "../core/errors.js";

type RunOptions = {
  encoding: "utf8";
  env: NodeJS.ProcessEnv;
  maxBuffer: number;
  timeout: number;
};

type CommandRunner = (
  executable: string,
  args: string[],
  options: RunOptions
) => Promise<{ stdout: string }>;

const defaultRun: CommandRunner = (executable, args, options) =>
  new Promise((resolve, reject) => {
    execFile(executable, args, options, (error, stdout) => {
      if (error) reject(error);
      else resolve({ stdout });
    });
  });

export type LightpandaFetcherOptions = {
  executable?: string;
  run?: CommandRunner;
  timeoutMs?: number;
  blockPrivateNetworks?: boolean;
};

type LightpandaOutput = {
  url: string;
  http_status: number;
  content: string;
};

function isExecutableMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parseOutput(stdout: string): LightpandaOutput {
  if (!stdout.trim()) {
    throw new ReadLensError("RENDER_FAILED", "Lightpanda returned an empty document");
  }

  let output: unknown;
  try {
    output = JSON.parse(stdout);
  } catch {
    throw new ReadLensError("RENDER_FAILED", "Lightpanda returned invalid JSON");
  }

  if (
    typeof output !== "object" ||
    output === null ||
    !("url" in output) ||
    !("http_status" in output) ||
    !("content" in output) ||
    typeof output.url !== "string" ||
    typeof output.http_status !== "number" ||
    typeof output.content !== "string"
  ) {
    throw new ReadLensError("RENDER_FAILED", "Lightpanda returned an invalid result");
  }

  return output as LightpandaOutput;
}

export function createLightpandaFetcher(options: LightpandaFetcherOptions = {}): PageFetcher {
  const executable = options.executable ?? "lightpanda";
  const run = options.run ?? defaultRun;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const blockPrivateNetworks = options.blockPrivateNetworks ?? true;

  return {
    async fetch(url: URL): Promise<FetchedPage> {
      const args = [
        "fetch",
        url.href,
        "--dump",
        "html",
        "--json",
        "--strip-mode",
        "js,css,invisible",
        "--disable-subframes",
        "--disable-workers",
        "--wait-until",
        "networkalmostidle",
        "--wait-ms",
        "10000",
        "--terminate-ms",
        "15000",
        "--http-timeout",
        "10000",
        "--http-max-response-size",
        "2000000",
        "--log-level",
        "error"
      ];
      if (blockPrivateNetworks) args.push("--block-private-networks");

      let stdout: string;
      try {
        ({ stdout } = await run(executable, args, {
          encoding: "utf8",
          env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: "true" },
          maxBuffer: 3_000_000,
          timeout: timeoutMs
        }));
      } catch (error) {
        if (isExecutableMissing(error)) {
          const location = executable === "lightpanda" ? "on PATH" : `at ${executable}`;
          throw new ReadLensError(
            "LIGHTPANDA_NOT_FOUND",
            `Lightpanda was not found ${location}. Install it from https://lightpanda.io/docs/quickstart, provide its executable with --lightpanda <path>, or use --render never.`,
            { cause: error }
          );
        }
        throw new ReadLensError("RENDER_FAILED", "Lightpanda execution failed", {
          cause: error
        });
      }
      const output = parseOutput(stdout);

      return {
        finalUrl: output.url,
        html: output.content,
        status: output.http_status,
        renderer: "lightpanda"
      };
    }
  };
}
