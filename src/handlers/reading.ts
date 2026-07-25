// GENERATED from the manifest. Do not edit.
import { json, readJson, tenantOf } from "../lib/http";
import type { Reading, Row, ListReadingsHandler, GetReadingHandler, CreateReadingHandler, DeleteReadingHandler, GetDigestHandler, ImportReadingsHandler } from "../types";

const FIELDS: [string, "text" | "integer" | "real"][] = [["meter_id", "integer"], ["kwh", "real"], ["demand_kw", "real"], ["taken_at", "text"], ["created_at", "text"]];
function validate(body: Partial<Reading>): string | null {
  const b = body as Record<string, unknown>;
  for (const [name, type] of FIELDS) {
    const v = b[name];
    if (v === undefined || v === null || v === "") return name + " is required";
    if (type === "text" && typeof v !== "string") return name + " must be text";
    if (type !== "text" && typeof v !== "number") return name + " must be a number";
    if (type === "integer" && !Number.isInteger(v)) return name + " must be a whole number";
  }
  return null;
}

export const listReadings: ListReadingsHandler = async (req, env) => {
  const { results } = await env.DB.prepare("SELECT * FROM readings WHERE tenant = ?").bind(tenantOf(req)).all<Reading>();
  return json(results);
};

export const getReading: GetReadingHandler = async (req, env, params) => {
  const row = await env.DB.prepare("SELECT * FROM readings WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Reading>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const createReading: CreateReadingHandler = async (req, env) => {
  const body = await readJson<Partial<Reading>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  const invalid = validate(body);
  if (invalid) return json({ error: invalid }, 400);
  const res = await env.DB.prepare("INSERT INTO readings (meter_id, kwh, demand_kw, taken_at, created_at, tenant) VALUES (?, ?, ?, ?, ?, ?)").bind(body.meter_id ?? null, body.kwh ?? null, body.demand_kw ?? null, body.taken_at ?? null, body.created_at ?? null, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM readings WHERE id = ?").bind(res.meta.last_row_id).first<Reading>();
  return row ? json(row) : json({ error: "insert failed" }, 500);
};

export const deleteReading: DeleteReadingHandler = async (req, env, params) => {
  const res = await env.DB.prepare("DELETE FROM readings WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).run();
  return res.meta.changes ? json({ ok: true }) : json({ error: "not found" }, 404);
};

export const getDigest: GetDigestHandler = async (_req, env, params) => {
  void params;
  const { results } = await env.DB.prepare("SELECT (SELECT COALESCE(SUM(kwh), 0) FROM readings WHERE taken_at >= datetime('now', '-24 hours')) AS total_kwh, (SELECT COALESCE(MAX(demand_kw), 0) FROM readings WHERE taken_at >= datetime('now', '-24 hours')) AS peak_demand_kw, (SELECT COUNT(*) FROM alerts WHERE opened_at >= datetime('now', '-24 hours')) AS new_alerts, (SELECT COUNT(*) FROM alerts WHERE acknowledged_at >= datetime('now', '-24 hours')) AS acknowledged_alerts, (SELECT s.name FROM sites s JOIN meters m ON m.site_id = s.id JOIN readings r ON r.meter_id = m.id WHERE r.taken_at >= datetime('now', '-24 hours') GROUP BY s.id ORDER BY SUM(r.kwh) DESC LIMIT 3) AS top_sites, (SELECT s.name FROM sites s JOIN meters m ON m.site_id = s.id JOIN alerts a ON a.meter_id = m.id WHERE a.status = 'OPEN' AND a.severity = 'CRITICAL' GROUP BY s.id) AS critical_sites").all<Row>();
  return json(results);
};

export const importReadings: ImportReadingsHandler = async (_req, env, params) => {
  void params;
  const { results } = await env.DB.prepare("INSERT INTO readings (meter_id, kwh, demand_kw, taken_at, created_at) SELECT m.id, ?, ?, ?, datetime('now') FROM meters m WHERE m.serial = ?").all<Row>();
  return json(results);
};
