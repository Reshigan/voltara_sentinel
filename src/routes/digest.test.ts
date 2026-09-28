import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildDb, seedData, withContext } from "../test-helpers";
import type { Env } from "../lib/http";
import { getDigest } from "./digest";

test("digest returns 24h summary with correct totals", withContext(async (env: Env) => {
  const db = env.DB;
  await buildDb(db);
  await seedData(db);

  const res = await getDigest({} as Request, env);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(typeof body.total_kwh, "number");
  assert.equal(typeof body.peak_demand_kw, "number");
  assert.equal(typeof body.new_alerts, "number");
  assert.equal(typeof body.acknowledged_alerts, "number");
  assert.ok(Array.isArray(body.top_sites));
  assert.ok(Array.isArray(body.critical_sites));

  assert.ok(body.total_kwh > 0);
  assert.ok(body.peak_demand_kw > 0);
  assert.equal(body.top_sites.length, 3);
  for (const s of body.top_sites) {
    assert.equal(typeof s.name, "string");
    assert.equal(typeof s.kwh, "number");
    assert.ok(s.kwh >= 0);
  }
}));

test("digest top_sites is limited to 3", withContext(async (env: Env) => {
  const db = env.DB;
  await buildDb(db);
  await db.prepare("INSERT INTO sites (id, name, region, capacity_kw) VALUES (?, ?, ?, ?)")
    .bind("site-4", "West Station", "WEST", 100).run();
  await db.prepare("INSERT INTO sites (id, name, region, capacity_kw) VALUES (?, ?, ?, ?)")
    .bind("site-5", "Central Hub", "CENTRAL", 200).run();

  const meterIds = ["m-4", "m-5", "m-6", "m-7", "m-8"];
  const sites = ["site-4", "site-5", "site-4", "site-5", "site-4"];
  for (let i = 0; i < meterIds.length; i++) {
    await db.prepare("INSERT INTO meters (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?)")
      .bind(meterIds[i], `SERIAL${i + 4}`, sites[i], "ELECTRIC", "ACTIVE").run();
    await db.prepare("INSERT INTO readings (id, meter_id, kwh, demand_kw, taken_at) VALUES (?, ?, ?, ?, ?)")
      .bind(`r-${i + 4}`, meterIds[i], (i + 1) * 100, 10, new Date().toISOString()).run();
  }

  const res = await getDigest({} as Request, env);
  const body = await res.json();
  assert.equal(body.top_sites.length, 3);
}));

test("digest critical_sites includes only sites with open CRITICAL alerts", withContext(async (env: Env) => {
  const db = env.DB;
  await buildDb(db);
  await seedData(db);

  const criticalAlertId = "alert-critical";
  await db.prepare("INSERT INTO meters (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?)")
    .bind("m-critical", "CRIT123", (await db.prepare("SELECT id FROM sites LIMIT 1").first()).id, "ELECTRIC", "ACTIVE").run();
  await db.prepare("INSERT INTO alerts (id, meter_id, severity, message, opened_at, status) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(criticalAlertId, "m-critical", "CRITICAL", "Critical fault", new Date().toISOString(), "OPEN").run();

  const res = await getDigest({} as Request, env);
  const body = await res.json();

  const criticalSite = body.critical_sites.find((s: { name: string; alert_count: number }) => s.alert_count > 0);
  assert.ok(criticalSite, "expected at least one site with critical open alerts");
  assert.ok(body.critical_sites.every((s: { alert_count: number }) => s.alert_count > 0));
}));

test("digest handles empty data gracefully", withContext(async (env: Env) => {
  const db = env.DB;
  await buildDb(db);

  const res = await getDigest({} as Request, env);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.total_kwh, 0);
  assert.equal(body.peak_demand_kw, 0);
  assert.equal(body.new_alerts, 0);
  assert.equal(body.acknowledged_alerts, 0);
  assert.deepEqual(body.top_sites, []);
  assert.deepEqual(body.critical_sites, []);
}));
