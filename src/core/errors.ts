export type ReadLensErrorCode =
  | "INVALID_URL"
  | "PRIVATE_NETWORK"
  | "HTTP_STATUS"
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "REDIRECT_ERROR"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "LIGHTPANDA_NOT_FOUND"
  | "RENDER_FAILED"
  | "BLOCKED"
  | "EXTRACTION_FAILED"
  | "ALTERNATE_SOURCE_FAILED";

export class ReadLensError extends Error {
  readonly code: ReadLensErrorCode;

  constructor(code: ReadLensErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReadLensError";
    this.code = code;
  }
}


export function errorPayload(error: unknown): { code: string; message: string } {
  if (error instanceof ReadLensError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }
  return { code: "INTERNAL_ERROR", message: String(error) };
}
