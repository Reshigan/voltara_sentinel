import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppError, BadRequestError, NotFoundError, ValidationError, errorToResponse } from "./errors";

describe("errors", () => {
  it("subclasses carry correct status codes", () => {
    assert.equal(new BadRequestError("bad").status, 400);
    assert.equal(new ValidationError("invalid").status, 422);
    assert.equal(new NotFoundError("missing").status, 404);
    assert.equal(new AppError("teapot", 418).status, 418);
  });

  it("errorToResponse returns proper JSON with status", async () => {
    const cases: [AppError, number, string][] = [
      [new BadRequestError("missing id"), 400, "missing id"],
      [new NotFoundError("site 404"), 404, "site 404"],
      [new ValidationError("too long"), 422, "too long"],
      [new AppError("payment required", 402), 402, "payment required"],
    ];

    for (const [err, expectedStatus, expectedMessage] of cases) {
      const res = errorToResponse(err);
      assert.equal(res.status, expectedStatus);
      assert.equal(res.headers.get("content-type"), "application/json");
      const body = await res.json();
      assert.equal(body.error, expectedMessage);
    }
  });

  it("unknown errors become 500", async () => {
    const res = errorToResponse(new Error("something broke"));
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error, "Internal server error");
  });

  it("non-Error values become 500", async () => {
    const res = errorToResponse("plain string failure");
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error, "Internal server error");
  });
});
