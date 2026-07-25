// GENERATED from the manifest. Do not edit.
import { expect, test } from "bun:test";
import { makeEnv, request } from "./harness";
import type { Site } from "../src/types";

test("site: empty, create, then list reflects it", async () => {
  const env = makeEnv();
  const empty = await request(env, "GET", "/api/sites");
  expect(empty.status).toBe(200);
  expect((await empty.json()) as Site[]).toEqual([]);

  const res = await request(env, "POST", "/api/sites", { name: "sample", region: "sample", capacity_kw: 1.5, created_at: "sample", updated_at: "sample" });
  expect(res.status).toBe(200);
  const created = (await res.json()) as Site;
  expect(created.name).toBe("sample");

  const list = await request(env, "GET", "/api/sites");
  expect(((await list.json()) as Site[]).length).toBe(1);

  const patched = await request(env, "PUT", `/api/sites/${created.id}`, { name: "patched" });
  expect(patched.status).toBe(200);
  const after = (await patched.json()) as Site;
  expect(after.name).toBe("patched");
  expect(after.region).toBe("sample");

  const del = await request(env, "DELETE", `/api/sites/${created.id}`);
  expect(del.status).toBe(200);
  const delMissing = await request(env, "DELETE", `/api/sites/${created.id}`);
  expect(delMissing.status).toBe(404);
});
