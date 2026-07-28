import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { health } from "./health";
import { json } from "../lib/http";

type TestEnv = { DB: D1Database; ASSETS: { fetch: (request: Request) => Promise<Response> } };

function makeEnv(): TestEnv {
  return {
    DB: {} as unknown as D1Database,
    ASSETS: { fetch: async () => new Response("not found", { status: 404 }) },
  };
}

function assertJsonBody(response: Response): Promise<Record<string, unknown>> {
  assert.strictEqual(response.status, 200);
  assert.ok(response.headers.get("content-type")?.includes("application/json"));
  return response.json();
}

describe("GET /api/health", () => {
  it("returns 200 with status ok, db connected, and numeric uptime", async () => {
    const request = new Request("http://localhost/api/health");
    const env = makeEnv();
    const response = await health(request, env);
    const body = await assertJsonBody(response);

    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.db, "connected");
    assert.ok(typeof body.uptime === "number" && body.uptime >= 0);
  });
});
