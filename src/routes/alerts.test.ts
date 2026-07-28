import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../lib/test";
import { routes } from "../routes";
import { matchRoute, json } from "../lib/http";
import type { Alert } from "../contract";

async function seed() {
  const site = await env.DB.prepare(
    "INSERT INTO site (id, name, region, capacity_kw) VALUES (?, ?, ?, ?) RETURNING id"
  )
    .bind("site-1", "Test Site", "NORTH", 100)
    .first<{ id: string }>();
  const meter = await env.DB.prepare(
    "INSERT INTO meter (id, serial, site_id, kind, status) VALUES (?, ?, ?, ?, ?) RETURNING id"
  )
    .bind("meter-1", "MTR001", site?.id, "ELECTRIC", "ACTIVE")
    .first<{ id: string }>();
  return { siteId: site?.id, meterId: meter?.id };
}

async function call(method: string, path: string, body?: object): Promise<Response> {
  const url = new URL("http://localhost" + path);
  const request = new Request(url.toString(), {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const hit = matchRoute(routes, method, url.pathname);
  if (!hit) throw new Error("No route matched: " + method + " " + path);
  return hit.route.handler(request, env, hit.params);
}

test("alerts: list returns empty initially", async () => {
  const res = await call("GET", "/api/alerts");
  assert.equal(res.status, 200);
  const data = (await res.json()) as { items: Alert[]; nextCursor?: string };
  assert.deepEqual(data.items, []);
});

test("alerts: list filters by status", async () => {
  const { meterId } = await seed();
  await env.DB.prepare(
    "INSERT INTO alert (id, meter_id, severity, message, opened_at, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind("alert-1", meterId, "WARNING", "msg", "2025-01-01T00:00:00Z", "OPEN").run();
  await env.DB.prepare(
    "INSERT INTO alert (id, meter_id, severity, message, opened_at, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind("alert-2", meterId, "INFO", "msg2", "2025-01-01T00:00:00Z", "ACKNOWLEDGED").run();

  const openRes = await call("GET", "/api/alerts?status=OPEN");
  const openData = (await openRes.json()) as { items: Alert[] };
  assert.equal(openData.items.length, 1);
  assert.equal(openData.items[0].id, "alert-1");

  const ackRes = await call("GET", "/api/alerts?status=ACKNOWLEDGED");
  const ackData = (await ackRes.json()) as { items: Alert[] };
  assert.equal(ackData.items.length, 1);
  assert.equal(ackData.items[0].id, "alert-2");
});

test("alerts: acknowledge sets acknowledged_at, status, audit log", async () => {
  const { meterId } = await seed();
  await env.DB.prepare(
    "INSERT INTO alert (id, meter_id, severity, message, opened_at, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind("alert-ack", meterId, "WARNING", "msg", "2025-01-01T00:00:00Z", "OPEN").run();

  const res = await call("POST", "/api/alerts/alert-ack/acknowledge");
  assert.equal(res.status, 200);
  const updated = (await res.json()) as Alert;
  assert.equal(updated.status, "ACKNOWLEDGED");
  assert.ok(updated.acknowledged_at);
  assert.equal(updated.closed_at, null);

  const audit = await env.DB.prepare(
    "SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? AND field = ?"
  ).bind("alert", "alert-ack", "status").first<{ old_value: string; new_value: string }>();
  assert.ok(audit);
  assert.equal(audit.old_value, "OPEN");
  assert.equal(audit.new_value, "ACKNOWLEDGED");
});

test("alerts: close sets closed_at and audit log", async () => {
  const { meterId } = await seed();
  await env.DB.prepare(
    "INSERT INTO alert (id, meter_id, severity, message, opened_at, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind("alert-close", meterId, "INFO", "msg", "2025-01-01T00:00:00Z", "OPEN").run();

  const res = await call("POST", "/api/alerts/alert-close/close");
  assert.equal(res.status, 200);
  const updated = (await res.json()) as Alert;
  assert.equal(updated.status, "CLOSED");
  assert.ok(updated.closed_at);

  const audit = await env.DB.prepare(
    "SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? AND field = ?"
  ).bind("alert", "alert-close", "status").first<{ old_value: string; new_value: string }>();
  assert.ok(audit);
  assert.equal(audit.old_value, "OPEN");
  assert.equal(audit.new_value, "CLOSED");
});

test("alerts: cannot create alerts manually via POST /api/alerts", async () => {
  const hit = matchRoute(routes, "POST", "/api/alerts");
  assert.equal(hit, null);
});
