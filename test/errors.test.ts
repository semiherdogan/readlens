import { describe, expect, it } from "vitest";

import { ReadLensError, errorPayload } from "../src/core/errors.js";

describe("errorPayload", () => {
  it("preserves public ReadLens error codes", () => {
    expect(errorPayload(new ReadLensError("BLOCKED", "Blocked"))).toEqual({
      code: "BLOCKED",
      message: "Blocked"
    });
  });

  it("normalizes Error and non-Error failures", () => {
    expect(errorPayload(new Error("Failure"))).toEqual({
      code: "INTERNAL_ERROR",
      message: "Failure"
    });
    expect(errorPayload("Failure")).toEqual({
      code: "INTERNAL_ERROR",
      message: "Failure"
    });
  });
});
