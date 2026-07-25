// GENERATED from the manifest. Do not edit.
import { json, readJson, tenantOf } from "../lib/http";
import type { Site, Row, ListSitesHandler, GetSiteHandler, CreateSiteHandler, UpdateSiteHandler, DeleteSiteHandler, GetDashboardKpisHandler, GetDashboardSitesHandler, GetHealthHandler } from "../types";

const FIELDS: [string, "text" | "integer" | "real"][] = [["name", "text"], ["region", "text"], ["capacity_kw", "real"], ["created_at", "text"], ["updated_at", "text"]];
function validate(body: Partial<Site>): string | null {
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

export const listSites: ListSitesHandler = async (req, env) => {
  const { results } = await env.DB.prepare("SELECT * FROM sites WHERE tenant = ?").bind(tenantOf(req)).all<Site>();
  return json(results);
};

export const getSite: GetSiteHandler = async (req, env, params) => {
  const row = await env.DB.prepare("SELECT * FROM sites WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Site>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const createSite: CreateSiteHandler = async (req, env) => {
  const body = await readJson<Partial<Site>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  const invalid = validate(body);
  if (invalid) return json({ error: invalid }, 400);
  const res = await env.DB.prepare("INSERT INTO sites (name, region, capacity_kw, created_at, updated_at, tenant) VALUES (?, ?, ?, ?, ?, ?)").bind(body.name ?? null, body.region ?? null, body.capacity_kw ?? null, body.created_at ?? null, body.updated_at ?? null, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM sites WHERE id = ?").bind(res.meta.last_row_id).first<Site>();
  return row ? json(row) : json({ error: "insert failed" }, 500);
};

export const updateSite: UpdateSiteHandler = async (req, env, params) => {
  const body = await readJson<Partial<Site>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  await env.DB.prepare("UPDATE sites SET name = COALESCE(?, name), region = COALESCE(?, region), capacity_kw = COALESCE(?, capacity_kw), created_at = COALESCE(?, created_at), updated_at = COALESCE(?, updated_at) WHERE id = ? AND tenant = ?").bind(body.name ?? null, body.region ?? null, body.capacity_kw ?? null, body.created_at ?? null, body.updated_at ?? null, params.id, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM sites WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Site>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const deleteSite: DeleteSiteHandler = async (req, env, params) => {
  const res = await env.DB.prepare("DELETE FROM sites WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).run();
  return res.meta.changes ? json({ ok: true }) : json({ error: "not found" }, 404);
};

export const getDashboardKpis: GetDashboardKpisHandler = async (_req, env, params) => {
  void params;
  const { results } = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM sites) AS total_sites, (SELECT COUNT(*) FROM meters WHERE status = 'ACTIVE') AS active_meters, (SELECT COALESCE(SUM(kwh), 0) FROM readings WHERE date(taken_at) = date('now')) AS daily_kwh, (SELECT COUNT(*) FROM alerts WHERE status = 'OPEN') AS open_alerts").all<Row>();
  return json(results);
};

export const getDashboardSites: GetDashboardSitesHandler = async (_req, env, params) => {
  void params;
  const { results } = await env.DB.prepare("SELECT s.id, s.name, s.region, s.capacity_kw, (SELECT COUNT(*) FROM meters m WHERE m.site_id = s.id AND m.status = 'ACTIVE') AS active_meters, (SELECT COALESCE(SUM(r.kwh), 0) FROM readings r JOIN meters m ON r.meter_id = m.id WHERE m.site_id = s.id) AS total_kwh, (SELECT COUNT(*) FROM alerts a JOIN meters m ON a.meter_id = m.id WHERE m.site_id = s.id AND a.status = 'OPEN') AS open_alerts, CASE WHEN (SELECT COUNT(*) FROM alerts a JOIN meters m ON a.meter_id = m.id WHERE m.site_id = s.id AND a.status = 'OPEN' AND a.severity = 'CRITICAL') > 0 THEN 'red' WHEN (SELECT COUNT(*) FROM alerts a JOIN meters m ON a.meter_id = m.id WHERE m.site_id = s.id AND a.status = 'OPEN') > 0 THEN 'amber' ELSE 'green' END AS status FROM sites s ORDER BY s.name").all<Row>();
  return json(results);
};

export const getHealth: GetHealthHandler = async (_req, env, params) => {
  void params;
  const { results } = await env.DB.prepare("SELECT 1").all<Row>();
  return json(results);
};
