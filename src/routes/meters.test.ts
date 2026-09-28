import assert from "node:assert";
import test from "node:test";
import { buildDb } from "../db";
import { metersRouter } from "./meters";
import type { Env } from "../lib/http";

const makeEnv = (db: D1Database): Env => ({ DB: db } as Env);

const req = (method: string, url: string, body?: object): Request =>
  new Request(new URL(url, "http://localhost"), {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

async function setup(db: D1Database) {
  await db.batch([
    db.prepare("INSERT INTO site (id, name, region, capacity_kw) VALUES (?, ?, ?, ?)").bind("s1", "North Substation", "NORTH", 500),
    db.prepare("INSERT INTO site (id, name, region, capacity_kw) VALUES (?, ?, ?, ?)").bind("s2", "South Depot", "SOUTH", 350),
    db.prepare("INSERT INTO tariff (id, name, rate_per_kwh, band) VALUES (?, ?, ?, ?)").bind("t1", "Peak", 0.15, "PEAK"),
  ]);
}

test("meters list includes site and tariff names", async (t) => {
  const db = await buildDb();
  const env = makeEnv(db);
  await setup(db);
  await db.prepare("INSERT INTO meter (id, serial, site_id, kind, status, tariff_id) VALUES (?, ?, ?, ?, ?, ?)").bind("m1", "MTR001", "s1", "ELECTRIC", "ACTIVE", "t1").run();

  const response = await metersRouter.list(req("GET", "/api/meters"), env);
  assert.strictEqual(response.status, 200);
  const body = (await response.json()) as { meters: Array<{ id: string; serial: string; site_name: string; tariff_name: string }> };
  assert.strictEqual(body.meters.length, 1);
  assert.strictEqual(body.meters[0].id, "m1");
  assert.strictEqual(body.meters[0].serial, "MTR001");
  assert.strictEqual(body.meters[0].site_name, "North Substation");
  assert.strictEqual(body.meters[0].tariff_name, "Peak");
});

test("create meter validates serial format", async () => {
  const db = await buildDb();
  const env = makeEnv(db);
  await setup(db);

  const short = await metersRouter.create(req("POST", "/api/meters", { serial: "MTR00", site_id: "s1", kind: "ELECTRIC", status: "ACTIVE" }), env);
  assert.strictEqual(short.status, 400);

  const long = await metersRouter.create(req("POST", "/api/meters", { serial: "MTR" + "0".repeat(25), site_id: "s1", kind: "ELECTRIC", status: "ACTIVE" }), env);
  assert.strictEqual(long.status, 400);

  const ok = await metersRouter.create(req("POST", "/api/meters", { serial: "MTR001", site_id: "s1", kind: "ELECTRIC", status: "ACTIVE" }), env);
  assert.strictEqual(ok.status, 201);
});

test("create meter validates enum values", async () => {
  const db = await buildDb();
  const env = makeEnv(db);
  await setup(db);

  const badKind = await metersRouter.create(req("POST", "/api/meters", { serial: "MTR001", site_id: "s1", kind: "WIND", status: "ACTIVE" }), env);
  assert.strictEqual(badKind.status, 400);

  const badStatus = await metersRouter.create(req("POST", "/api/meters", { serial: "MTR002", site_id: "s1", kind: "ELECTRIC", status: "RUNNING" }), env);
  assert.strictEqual(badStatus.status, 400);
});

test("status change triggers audit log", async () => {
  const db = await buildDb();
  const env = makeEnv(db);
  await setup(db);
  await db.prepare("INSERT INTO meter (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?)").bind("m1", "MTR001", "s1", "ELECTRIC", "ACTIVE").run();

  const update = await metersRouter.update(req("PATCH", "/api/meters/m1", { status: "FAULT" }), env);
  assert.strictEqual(update.status, 200);

  const audits = await db.prepare("SELECT * FROM audit_log WHERE entity_type = 'meter' AND entity_id = 'm1' ORDER BY changed_at").all();
  assert.ok(audits.results);
  assert.strictEqual(audits.results.length, 1);
  const row = audits.results[0] as Record<string, string>;
  assert.strictEqual(row.field, "status");
  assert.strictEqual(row.old_value, "ACTIVE");
  assert.strictEqual(row.new_value, "FAULT");
});

test("delete removes meter", async () => {
  const db = await buildDb();
  const env = makeEnv(db);
  await setup(db);
  await db.prepare("INSERT INTO meter (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?)").bind("m1", "MTR001", "s1", "ELECTRIC", "ACTIVE").run();

  const del = await metersRouter.remove(req("DELETE", "/api/meters/m1"), env);
  assert.strictEqual(del.status, 204);

  const remaining = await db.prepare("SELECT COUNT(*) AS n FROM meter").first("n");
  assert.strictEqual(remaining, 0);
});

test("get single includes recent readings", async () => {
  const db = await buildDb();
  const env = makeEnv(db);
  await setup(db);
  await db.prepare("INSERT INTO meter (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?)").bind("m1", "MTR001", "s1", "ELECTRIC", "ACTIVE").run();
  await db.batch([
    db.prepare("INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at) VALUES (?, ?, ?, ?, ?)").bind("r1", "m1", 100, 40, "2025-01-01T10:00:00Z"),
    db.prepare("INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at) VALUES (?, ?, ?, ?, ?)").bind("r2", "m1", 110, 42, "2025-01-01T11:00:00Z"),
  ]);

  const response = await metersRouter.get(req("GET", "/api/meters/m1"), env);
  assert.strictEqual(response.status, 200);
  const body = (await response.json()) as { meter: { id: string }; readings: Array<{ id: string; kwh: number }> };
  assert.strictEqual(body.meter.id, "m1");
  assert.strictEqual(body.readings.length, 2);
  assert.strictEqual(body.readings[0].id, "r2");
  assert.strictEqual(body.readings[0].kwh, 110);
});
