import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { buildDb, type Env } from "../db";
import { seedTariffs, seedSites, seedMeters } from "../../test/fixtures";
import app from "../index";

async function req(path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init), { DB: buildDb() } as unknown as Env);
}

describe("tariffs CRUD", () => {
  let env: Env;

  beforeEach(() => {
    env = { DB: buildDb() } as unknown as Env;
  });

  it("lists tariffs", async () => {
    seedTariffs(env.DB);
    const res = await app.fetch(new Request("http://localhost/api/tariffs"), env);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body) || Array.isArray(body.items) || Array.isArray(body.rows));
  });

  it("rejects tariff with non-positive rate", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/tariffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bad Rate", rate_per_kwh: 0, band: "PEAK" }),
      }),
      env
    );
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error || body.message || "", /rate|positive/i);
  });

  it("rejects tariff with invalid band", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/tariffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bad Band", rate_per_kwh: 0.1, band: "NIGHT" }),
      }),
      env
    );
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error || body.message || "", /band|enum/i);
  });

  it("creates and retrieves a tariff", async () => {
    const create = await app.fetch(
      new Request("http://localhost/api/tariffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Peak Plus", rate_per_kwh: 0.22, band: "PEAK" }),
      }),
      env
    );
    assert.strictEqual(create.status, 201);
    const tariff = await create.json();
    assert.strictEqual(tariff.name, "Peak Plus");
    assert.strictEqual(tariff.rate_per_kwh, 0.22);
    assert.strictEqual(tariff.band, "PEAK");

    const get = await app.fetch(new Request(`http://localhost/api/tariffs/${tariff.id}`), env);
    assert.strictEqual(get.status, 200);
    const got = await get.json();
    assert.strictEqual(got.id, tariff.id);
  });

  it("updates a tariff", async () => {
    seedTariffs(env.DB);
    const [tariff] = env.DB.prepare("SELECT id FROM tariff").all() as { id: string }[];
    const res = await app.fetch(
      new Request(`http://localhost/api/tariffs/${tariff.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated Tariff", rate_per_kwh: 0.99, band: "SHOULDER" }),
      }),
      env
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.name, "Updated Tariff");
    assert.strictEqual(body.rate_per_kwh, 0.99);
    assert.strictEqual(body.band, "SHOULDER");
  });

  it("deleting a tariff sets referencing meter tariff_id to NULL", async () => {
    seedSites(env.DB);
    const tariffId = seedTariffs(env.DB)[0];
    const meterId = seedMeters(env.DB, { siteId: seedSites(env.DB)[0], tariffId })[0];

    const before = env.DB.prepare("SELECT tariff_id FROM meter WHERE id = ?").get(meterId) as { tariff_id: string | null };
    assert.strictEqual(before.tariff_id, tariffId);

    const res = await app.fetch(
      new Request(`http://localhost/api/tariffs/${tariffId}`, { method: "DELETE" }),
      env
    );
    assert.strictEqual(res.status, 200);

    const after = env.DB.prepare("SELECT tariff_id FROM meter WHERE id = ?").get(meterId) as { tariff_id: string | null };
    assert.strictEqual(after.tariff_id, null);
  });

  it("returns 409 on duplicate tariff name", async () => {
    const res1 = await app.fetch(
      new Request("http://localhost/api/tariffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Duplicate", rate_per_kwh: 0.1, band: "OFF_PEAK" }),
      }),
      env
    );
    assert.strictEqual(res1.status, 201);

    const res2 = await app.fetch(
      new Request("http://localhost/api/tariffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Duplicate", rate_per_kwh: 0.2, band: "PEAK" }),
      }),
      env
    );
    assert.strictEqual(res2.status, 409);
    const body = await res2.json();
    assert.match(body.error || body.message || "", /duplicate|exists|name/i);
  });
});