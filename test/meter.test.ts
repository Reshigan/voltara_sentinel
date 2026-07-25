// GENERATED from the manifest. Do not edit.
import { expect, test } from "bun:test";
import { makeEnv, request } from "./harness";
import type { Meter } from "../src/types";

test("meter: empty, create, then list reflects it", async () => {
  const env = makeEnv();
  const empty = await request(env, "GET", "/api/meters");
  expect(empty.status).toBe(200);
  expect((await empty.json()) as Meter[]).toEqual([]);

  const res = await request(env, "POST", "/api/meters", { serial: "sample", site_id: 1, kind: "sample", status: "sample", tariff_id: 1, created_at: "sample", updated_at: "sample" });
  expect(res.status).toBe(200);
  const created = (await res.json()) as Meter;
  expect(created.serial).toBe("sample");

  const list = await request(env, "GET", "/api/meters");
  expect(((await list.json()) as Meter[]).length).toBe(1);

  const patched = await request(env, "PUT", `/api/meters/${created.id}`, { serial: "patched" });
  expect(patched.status).toBe(200);
  const after = (await patched.json()) as Meter;
  expect(after.serial).toBe("patched");
  expect(after.site_id).toBe(1);

  const del = await request(env, "DELETE", `/api/meters/${created.id}`);
  expect(del.status).toBe(200);
  const delMissing = await request(env, "DELETE", `/api/meters/${created.id}`);
  expect(delMissing.status).toBe(404);
});
