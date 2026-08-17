import { describe, expect, it } from "vitest";

import { CleanWebError, errorPayload } from "../src/core/errors.js";

describe("errorPayload", () => {
  it("preserves public CleanWeb error codes", () => {
    expect(errorPayload(new CleanWebError("BLOCKED", "Blocked"))).toEqual({
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
