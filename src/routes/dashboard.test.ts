import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { Env } from "../lib/http";
import * as dashboard from "./dashboard";
import { seedTestData, createTestDb } from "../db.test";
import { randomUUID } from "node:crypto";

describe("dashboard routes", () => {
  let db: ReturnType<typeof createTestDb>;
  let env: Env;

  before(() => {
    db = createTestDb();
    env = { DB: db } as unknown as Env;
  });

  after(() => {
    db.close();
  });

  it("returns zeros and empty cards for an empty database", async () => {
    const res = await dashboard.getDashboard.handler(
      new Request("http://localhost/api/dashboard"),
      env,
      {}
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, {
      totalSites: 0,
      activeMeters: 0,
      todayKwh: 0,
      openAlerts: 0,
      siteCards: [],
    });
  });

  it("returns correct KPI counts and derived site cards", async () => {
    seedTestData(db);
    const res = await dashboard.getDashboard.handler(
      new Request("http://localhost/api/dashboard"),
      env,
      {}
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.totalSites, 3);
    assert.strictEqual(body.activeMeters, 3);
    assert.strictEqual(body.openAlerts, 1);
    assert.strictEqual(typeof body.todayKwh, "number");
    assert.ok(Array.isArray(body.siteCards));
    assert.strictEqual(body.siteCards.length, 3);
    const north = body.siteCards.find((c: { name: string }) => c.name === "North Substation");
    assert.ok(north);
    assert.strictEqual(north.activeMeters, 2);
    assert.strictEqual(north.status, "FAULT");
  });

  it("updates site card status when a meter status changes", async () => {
    seedTestData(db);
    const before = await (await dashboard.getDashboard.handler(new Request("http://localhost/api/dashboard"), env, {})).json();
    const north = before.siteCards.find((c: { name: string }) => c.name === "North Substation");
    assert.strictEqual(north.status, "FAULT");

    const siteId = db.prepare("SELECT id FROM site WHERE name = ?").pluck().get("North Substation") as string;
    const meterId = db.prepare("SELECT id FROM meter WHERE site_id = ? AND status = ? LIMIT 1").pluck().get(siteId, "FAULT") as string;

    db.prepare("UPDATE meter SET status = ? WHERE id = ?").run("ACTIVE", meterId);

    const after = await (await dashboard.getDashboard.handler(new Request("http://localhost/api/dashboard"), env, {})).json();
    const northAfter = after.siteCards.find((c: { name: string }) => c.name === "North Substation");
    assert.strictEqual(northAfter.status, "OK");
  });

  it("reflects a new reading immediately in today kWh and site totals", async () => {
    seedTestData(db);
    const before = await (await dashboard.getDashboard.handler(new Request("http://localhost/api/dashboard"), env, {})).json();
    const beforeKwh = before.todayKwh;
    const siteId = db.prepare("SELECT id FROM site WHERE name = ?").pluck().get("North Substation") as string;
    const meterId = db.prepare("SELECT id FROM meter WHERE site_id = ? LIMIT 1").pluck().get(siteId) as string;

    db.prepare("INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at, created_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))")
      .run(randomUUID(), meterId, 999.5, 50, new Date().toISOString());

    const after = await (await dashboard.getDashboard.handler(new Request("http://localhost/api/dashboard"), env, {})).json();
    assert.ok(after.todayKwh >= beforeKwh + 999.5 - 0.01);
    const northAfter = after.siteCards.find((c: { name: string }) => c.name === "North Substation");
    assert.ok(northAfter.totalKwh >= 999.5 - 0.01);
  });

  it("returns dashboard in under 500ms with 1m seeded readings", async () => {
    const siteId = db.prepare("INSERT INTO site (id, name, region, capacity_kw) VALUES (?, ?, ?, ?) RETURNING id")
      .get(randomUUID(), "Perf Site", "WEST", 1000) as { id: string };
    for (let i = 0; i < 20; i++) {
      const meterId = db.prepare("INSERT INTO meter (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?) RETURNING id")
        .get(randomUUID(), `MTR${String(i).padStart(6, "0")}`, siteId.id, "ELECTRIC", "ACTIVE") as { id: string };
      const insert = db.prepare("INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))");
      for (let r = 0; r < 50000; r++) {
        insert.run(randomUUID(), meterId, 10 + (r % 100), 5 + (r % 20), new Date(Date.now() - r * 1000).toISOString());
      }
    }
    const start = performance.now();
    const res = await dashboard.getDashboard.handler(new Request("http://localhost/api/dashboard"), env, {});
    const duration = performance.now() - start;
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.siteCards.length, 1);
    assert.ok(duration < 500, `dashboard took ${duration}ms`);
  });
});
