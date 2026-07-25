// GENERATED from the manifest. Do not edit.
import { expect, test } from "bun:test";
import { makeEnv, request } from "./harness";
import type { Alert } from "../src/types";

test("alert: empty, create, then list reflects it", async () => {
  const env = makeEnv();
  const empty = await request(env, "GET", "/api/alerts");
  expect(empty.status).toBe(200);
  expect((await empty.json()) as Alert[]).toEqual([]);

  const res = await request(env, "POST", "/api/alerts", { meter_id: 1, severity: "sample", message: "sample", opened_at: "sample", status: "sample", acknowledged_at: "sample", closed_at: "sample" });
  expect(res.status).toBe(200);
  const created = (await res.json()) as Alert;
  expect(created.severity).toBe("sample");

  const list = await request(env, "GET", "/api/alerts");
  expect(((await list.json()) as Alert[]).length).toBe(1);

  const patched = await request(env, "PUT", `/api/alerts/${created.id}`, { severity: "patched" });
  expect(patched.status).toBe(200);
  const after = (await patched.json()) as Alert;
  expect(after.severity).toBe("patched");
  expect(after.meter_id).toBe(1);
});
