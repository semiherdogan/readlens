export type CleanWebErrorCode =
  | "INVALID_URL"
  | "PRIVATE_NETWORK"
  | "HTTP_STATUS"
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "REDIRECT_ERROR"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "RENDER_FAILED"
  | "BLOCKED"
  | "EXTRACTION_FAILED"
  | "ALTERNATE_SOURCE_FAILED";

export class CleanWebError extends Error {
  readonly code: CleanWebErrorCode;

  constructor(code: CleanWebErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CleanWebError";
    this.code = code;
  }
}

export function errorPayload(error: unknown): { code: string; message: string } {
  if (error instanceof CleanWebError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }
  return { code: "INTERNAL_ERROR", message: String(error) };
}
