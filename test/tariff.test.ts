// GENERATED from the manifest. Do not edit.
import { expect, test } from "bun:test";
import { makeEnv, request } from "./harness";
import type { Tariff } from "../src/types";

test("tariff: empty, create, then list reflects it", async () => {
  const env = makeEnv();
  const empty = await request(env, "GET", "/api/tariffs");
  expect(empty.status).toBe(200);
  expect((await empty.json()) as Tariff[]).toEqual([]);

  const res = await request(env, "POST", "/api/tariffs", { name: "sample", rate_per_kwh: 1.5, band: "sample", created_at: "sample", updated_at: "sample" });
  expect(res.status).toBe(200);
  const created = (await res.json()) as Tariff;
  expect(created.name).toBe("sample");

  const list = await request(env, "GET", "/api/tariffs");
  expect(((await list.json()) as Tariff[]).length).toBe(1);

  const patched = await request(env, "PUT", `/api/tariffs/${created.id}`, { name: "patched" });
  expect(patched.status).toBe(200);
  const after = (await patched.json()) as Tariff;
  expect(after.name).toBe("patched");
  expect(after.rate_per_kwh).toBe(1.5);

  const del = await request(env, "DELETE", `/api/tariffs/${created.id}`);
  expect(del.status).toBe(200);
  const delMissing = await request(env, "DELETE", `/api/tariffs/${created.id}`);
  expect(delMissing.status).toBe(404);
});
