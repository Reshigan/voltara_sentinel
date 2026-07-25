// GENERATED from the manifest. Do not edit.
import { expect, test } from "bun:test";
import { makeEnv, request } from "./harness";
import type { Reading } from "../src/types";

test("reading: empty, create, then list reflects it", async () => {
  const env = makeEnv();
  const empty = await request(env, "GET", "/api/readings");
  expect(empty.status).toBe(200);
  expect((await empty.json()) as Reading[]).toEqual([]);

  const res = await request(env, "POST", "/api/readings", { meter_id: 1, kwh: 1.5, demand_kw: 1.5, taken_at: "sample", created_at: "sample" });
  expect(res.status).toBe(200);
  const created = (await res.json()) as Reading;
  expect(created.taken_at).toBe("sample");

  const list = await request(env, "GET", "/api/readings");
  expect(((await list.json()) as Reading[]).length).toBe(1);

  const del = await request(env, "DELETE", `/api/readings/${created.id}`);
  expect(del.status).toBe(200);
  const delMissing = await request(env, "DELETE", `/api/readings/${created.id}`);
  expect(delMissing.status).toBe(404);
});
