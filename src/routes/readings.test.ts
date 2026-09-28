import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { DB, Env, ReadingInput } from "../lib/types";
import { applyMigrations } from "../db";
import { buildApp } from "../index";

// Build a throwaway in-memory DB and minimal Env per test.
function makeEnv(): Env {
  const db = new Database(":memory:") as DB;
  db.defaultSafeIntegers(true);
  applyMigrations(db);
  return { DB: db } as unknown as Env;
}

describe("readings routes", () => {
  let env: Env;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    env = makeEnv();
    app = buildApp(env);

    // Seed a site and a meter for readings to reference.
    const siteId = crypto.randomUUID();
    const meterId = crypto.randomUUID();
    env.DB.prepare(
      "INSERT INTO site (id, name, region, capacity_kw) VALUES (?, ?, ?, ?)"
    ).run(siteId, "Test Site", "TEST", 1000);
    env.DB.prepare(
      "INSERT INTO meter (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?)"
    ).run(meterId, "MTR001", siteId, "ELECTRIC", "ACTIVE");
  });

  afterEach(() => {
    env.DB.close();
  });

  it("creates a single reading and triggers anomaly detection", async () => {
    const meterId = env.DB.prepare("SELECT id FROM meter WHERE serial = ?").pluck().get("MTR001") as string;

    // Insert two normal readings to establish a baseline.
    for (const kwh of [100, 102]) {
      await app.request("/api/readings", {
        method: "POST",
        body: JSON.stringify({ meter_id: meterId, kwh, demand_kw: 10, taken_at: "2025-01-16T10:00:00Z" }),
      });
    }

    // Third reading is a clear anomaly: ~50 sigma above the baseline.
    const res = await app.request("/api/readings", {
      method: "POST",
      body: JSON.stringify({ meter_id: meterId, kwh: 500, demand_kw: 50, taken_at: "2025-01-16T11:00:00Z" }),
    });
    assert.equal(res.status, 201);
    const created = (await res.json()) as { id: string };
    assert.ok(created.id);

    const alerts = env.DB.prepare(
      "SELECT * FROM alert WHERE meter_id = ? AND severity = 'WARNING' AND message LIKE 'Consumption anomaly%'"
    ).all(meterId) as Array<Record<string, unknown>>;
    assert.equal(alerts.length, 1);
    assert.match(String(alerts[0].message), /500/);
  });

  it("imports a CSV file and inserts readings in batches", async () => {
    const meterId = env.DB.prepare("SELECT id FROM meter WHERE serial = ?").pluck().get("MTR001") as string;

    const rows: string[] = ["meter_id,kwh,demand_kw,taken_at"];
    for (let i = 0; i < 1000; i++) {
      rows.push(`${meterId},${10 + i},5,2025-01-16T${String(i % 24).padStart(2, "0")}:00:00Z`);
    }
    const csv = new Blob([rows.join("\n")], { type: "text/csv" });
    const form = new FormData();
    form.append("file", csv, "readings.csv");

    const res = await app.request("/api/readings/import", {
      method: "POST",
      body: form,
    });
    assert.equal(res.status, 200);
    const result = (await res.json()) as { imported: number; errors: Array<Record<string, unknown>> };
    assert.equal(result.imported, 1000);
    assert.equal(result.errors.length, 0);

    const count = env.DB.prepare("SELECT COUNT(*) FROM reading").pluck().get() as number;
    assert.equal(count, 1000);
  });

  it("import returns error rows for invalid data without aborting valid rows", async () => {
    const meterId = env.DB.prepare("SELECT id FROM meter WHERE serial = ?").pluck().get("MTR001") as string;

    const rows: string[] = ["meter_id,kwh,demand_kw,taken_at"];
    rows.push(`${meterId},10,5,2025-01-16T10:00:00Z`); // valid
    rows.push(`${meterId},-5,5,2025-01-16T10:00:00Z`); // invalid kwh
    rows.push(`not-a-uuid,10,5,2025-01-16T10:00:00Z`); // invalid meter_id
    rows.push(`${meterId},10,5,not-a-date`); // invalid date

    const csv = new Blob([rows.join("\n")], { type: "text/csv" });
    const form = new FormData();
    form.append("file", csv, "bad.csv");

    const res = await app.request("/api/readings/import", {
      method: "POST",
      body: form,
    });
    assert.equal(res.status, 200);
    const result = (await res.json()) as { imported: number; errors: Array<{ row: number; message: string }> };
    assert.equal(result.imported, 1);
    assert.equal(result.errors.length, 3);

    const errorRows = result.errors.map((e) => e.row).sort((a, b) => a - b);
    assert.deepEqual(errorRows, [2, 3, 4]);

    const count = env.DB.prepare("SELECT COUNT(*) FROM reading").pluck().get() as number;
    assert.equal(count, 1);
  });

  it("list filters by meter_id and date range", async () => {
    const meterId = env.DB.prepare("SELECT id FROM meter WHERE serial = ?").pluck().get("MTR001") as string;
    const otherMeterId = crypto.randomUUID();
    env.DB.prepare(
      "INSERT INTO meter (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?)"
    ).run(otherMeterId, "MTR002", env.DB.prepare("SELECT id FROM site").pluck().get(), "ELECTRIC", "ACTIVE");

    const base: ReadingInput = { meter_id: meterId, kwh: 10, demand_kw: 5, taken_at: "2025-01-16T10:00:00Z" };
    await app.request("/api/readings", { method: "POST", body: JSON.stringify(base) });
    await app.request("/api/readings", {
      method: "POST",
      body: JSON.stringify({ ...base, taken_at: "2025-01-17T10:00:00Z" }),
    });
    await app.request("/api/readings", {
      method: "POST",
      body: JSON.stringify({ ...base, meter_id: otherMeterId }),
    });

    const byMeter = await app.request(`/api/readings?meter_id=${meterId}`).then((r) => r.json() as { items: Array<{ meter_id: string }> });
    assert.equal(byMeter.items.length, 2);
    assert.ok(byMeter.items.every((r) => r.meter_id === meterId));

    const byDate = await app.request(`/api/readings?meter_id=${meterId}&from=2025-01-16T00:00:00Z&to=2025-01-16T23:59:59Z`).then((r) => r.json() as { items: Array<{ taken_at: string }> });
    assert.equal(byDate.items.length, 1);
    assert.equal(byDate.items[0].taken_at, "2025-01-16T10:00:00Z");
  });

  it("pagination works with cursor-based default page size", async () => {
    const meterId = env.DB.prepare("SELECT id FROM meter WHERE serial = ?").pluck().get("MTR001") as string;

    for (let i = 0; i < 75; i++) {
      await app.request("/api/readings", {
        method: "POST",
        body: JSON.stringify({ meter_id: meterId, kwh: i + 1, demand_kw: 5, taken_at: `2025-01-16T${String(i % 24).padStart(2, "0")}:00:00Z` }),
      });
    }

    const first = await app.request("/api/readings?limit=50").then((r) => r.json() as { items: Array<{ id: string }>; next_cursor?: string });
    assert.equal(first.items.length, 50);
    assert.ok(first.next_cursor);

    const second = await app.request(`/api/readings?limit=50&cursor=${first.next_cursor}`).then((r) => r.json() as { items: Array<{ id: string }>; next_cursor?: string });
    assert.equal(second.items.length, 25);
    assert.equal(second.next_cursor, undefined);

    // Cursors must be monotonically after the first page.
    const firstIds = new Set(first.items.map((x) => x.id));
    const secondIds = new Set(second.items.map((x) => x.id));
    assert.equal(firstIds.intersection(secondIds).size, 0);
  });
});
