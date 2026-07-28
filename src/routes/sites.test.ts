import { test } from "node:test";
import assert from "node:assert/strict";
import { Env } from "../lib/http";
import { seedDatabase, createRequest, uuidPattern, isoPattern } from "../test/helpers";
import app from "../index";

const bindings = seedDatabase();
const env = { DB: bindings.DB, ASSETS: bindings.ASSETS } as Env;

async function fetchJson(req: Request) {
  const res = await app.fetch(req, env);
  const body = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : await res.text();
  return { res, body };
}

test("GET /api/sites returns paginated list with cursor", async () => {
  const { res, body } = await fetchJson(createRequest("GET", "/api/sites"));
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.sites));
  assert.ok(body.sites.length >= 3);
  assert.equal(typeof body.next_cursor, "string");
  for (const site of body.sites) {
    assert.match(site.id, uuidPattern);
    assert.ok(typeof site.name === "string" && site.name.length > 0);
    assert.ok(typeof site.region === "string");
    assert.ok(site.capacity_kw >= 0);
    assert.match(site.created_at, isoPattern);
    assert.match(site.updated_at, isoPattern);
  }
});

test("GET /api/sites?limit=2 returns exactly two rows and a cursor", async () => {
  const { res, body } = await fetchJson(createRequest("GET", "/api/sites?limit=2"));
  assert.equal(res.status, 200);
  assert.equal(body.sites.length, 2);
  assert.ok(body.next_cursor);
  const page2 = await fetchJson(createRequest("GET", `/api/sites?limit=2&cursor=${body.next_cursor}`));
  assert.equal(page2.res.status, 200);
  assert.ok(page2.body.sites.length >= 1);
  assert.notDeepEqual(body.sites[0].id, page2.body.sites[0].id);
});

test("POST /api/sites creates a site with valid data", async () => {
  const payload = { name: "West Annex", region: "WEST", capacity_kw: 250 };
  const { res, body } = await fetchJson(
    createRequest("POST", "/api/sites", payload),
  );
  assert.equal(res.status, 201);
  assert.match(body.id, uuidPattern);
  assert.equal(body.name, payload.name);
  assert.equal(body.region, payload.region);
  assert.equal(body.capacity_kw, payload.capacity_kw);
  assert.match(body.created_at, isoPattern);
  assert.match(body.updated_at, isoPattern);
});

test("POST /api/sites rejects missing required fields", async () => {
  const { res, body } = await fetchJson(
    createRequest("POST", "/api/sites", { name: "Incomplete" }),
  );
  assert.equal(res.status, 400);
  assert.ok(typeof body.error === "string");
});

test("POST /api/sites rejects negative capacity", async () => {
  const payload = { name: "Bad Capacity", region: "EAST", capacity_kw: -10 };
  const { res, body } = await fetchJson(
    createRequest("POST", "/api/sites", payload),
  );
  assert.equal(res.status, 400);
  assert.ok(body.error.toLowerCase().includes("capacity") || body.error.toLowerCase().includes("invalid"));
});

test("POST /api/sites returns 409 on duplicate name", async () => {
  const payload = { name: "North Substation", region: "NORTH", capacity_kw: 100 };
  const { res, body } = await fetchJson(
    createRequest("POST", "/api/sites", payload),
  );
  assert.equal(res.status, 409);
  assert.ok(typeof body.error === "string");
  assert.ok(body.error.toLowerCase().includes("name") || body.error.toLowerCase().includes("duplicate") || body.error.toLowerCase().includes("exists"));
});

test("GET /api/sites/:id returns single site with meter count and kWh", async () => {
  const { body: listBody } = await fetchJson(createRequest("GET", "/api/sites"));
  const site = listBody.sites.find((s: { name: string }) => s.name === "North Substation");
  assert.ok(site);
  const { res, body } = await fetchJson(
    createRequest("GET", `/api/sites/${site.id}`),
  );
  assert.equal(res.status, 200);
  assert.equal(body.id, site.id);
  assert.equal(body.name, "North Substation");
  assert.ok(typeof body.meter_count === "number");
  assert.ok(typeof body.total_kwh === "number" || body.total_kwh === null);
  assert.ok(body.meter_count >= 2);
});

test("GET /api/sites/:id returns 404 for unknown id", async () => {
  const { res, body } = await fetchJson(
    createRequest("GET", "/api/sites/00000000-0000-0000-0000-000000000000"),
  );
  assert.equal(res.status, 404);
  assert.ok(typeof body.error === "string");
});

test("PATCH /api/sites/:id updates site fields", async () => {
  const { body: listBody } = await fetchJson(createRequest("GET", "/api/sites"));
  const site = listBody.sites.find((s: { name: string }) => s.name === "South Depot");
  assert.ok(site);
  const payload = { region: "SOUTH-WEST", capacity_kw: 999 };
  const { res, body } = await fetchJson(
    createRequest("PATCH", `/api/sites/${site.id}`, payload),
  );
  assert.equal(res.status, 200);
  assert.equal(body.id, site.id);
  assert.equal(body.region, payload.region);
  assert.equal(body.capacity_kw, payload.capacity_kw);
  assert.ok(body.updated_at >= site.updated_at);
});

test("PATCH /api/sites/:id returns 409 on duplicate name", async () => {
  const { body: listBody } = await fetchJson(createRequest("GET", "/api/sites"));
  const site = listBody.sites.find((s: { name: string }) => s.name === "East Industrial");
  assert.ok(site);
  const { res, body } = await fetchJson(
    createRequest("PATCH", `/api/sites/${site.id}`, { name: "North Substation" }),
  );
  assert.equal(res.status, 409);
  assert.ok(typeof body.error === "string");
});

test("DELETE /api/sites/:id removes site and cascades meters/readings/alerts", async () => {
  const payload = { name: "Cascade Test", region: "TEST", capacity_kw: 50 };
  const create = await fetchJson(createRequest("POST", "/api/sites", payload));
  assert.equal(create.res.status, 201);
  const siteId = create.body.id;

  const meterRes = await fetchJson(
    createRequest("POST", "/api/meters", {
      serial: "CAS001",
      site_id: siteId,
      kind: "ELECTRIC",
      status: "ACTIVE",
    }),
  );
  assert.equal(meterRes.res.status, 201);
  const meterId = meterRes.body.id;

  const readingRes = await fetchJson(
    createRequest("POST", "/api/readings", {
      meter_id: meterId,
      kwh: 10,
      demand_kw: 5,
      taken_at: new Date().toISOString(),
    }),
  );
  assert.equal(readingRes.res.status, 201);

  const del = await fetchJson(createRequest("DELETE", `/api/sites/${siteId}`));
  assert.equal(del.res.status, 204);
  assert.equal(del.body, "");

  const get = await fetchJson(createRequest("GET", `/api/sites/${siteId}`));
  assert.equal(get.res.status, 404);

  const getMeter = await fetchJson(createRequest("GET", `/api/meters/${meterId}`));
  assert.equal(getMeter.res.status, 404);
});

test("DELETE /api/sites/:id returns 404 for unknown id", async () => {
  const { res, body } = await fetchJson(
    createRequest("DELETE", "/api/sites/00000000-0000-0000-0000-000000000000"),
  );
  assert.equal(res.status, 404);
  assert.ok(typeof body.error === "string");
});
