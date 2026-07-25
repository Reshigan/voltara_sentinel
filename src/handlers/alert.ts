// GENERATED from the manifest. Do not edit.
import { json, readJson, tenantOf } from "../lib/http";
import type { Alert, Row, ListAlertsHandler, GetAlertHandler, CreateAlertHandler, UpdateAlertHandler, AcknowledgeAlertHandler } from "../types";

const FIELDS: [string, "text" | "integer" | "real"][] = [["meter_id", "integer"], ["severity", "text"], ["message", "text"], ["opened_at", "text"], ["status", "text"], ["acknowledged_at", "text"], ["closed_at", "text"]];
function validate(body: Partial<Alert>): string | null {
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

export const listAlerts: ListAlertsHandler = async (req, env) => {
  const { results } = await env.DB.prepare("SELECT * FROM alerts WHERE tenant = ?").bind(tenantOf(req)).all<Alert>();
  return json(results);
};

export const getAlert: GetAlertHandler = async (req, env, params) => {
  const row = await env.DB.prepare("SELECT * FROM alerts WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Alert>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const createAlert: CreateAlertHandler = async (req, env) => {
  const body = await readJson<Partial<Alert>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  const invalid = validate(body);
  if (invalid) return json({ error: invalid }, 400);
  const res = await env.DB.prepare("INSERT INTO alerts (meter_id, severity, message, opened_at, status, acknowledged_at, closed_at, tenant) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(body.meter_id ?? null, body.severity ?? null, body.message ?? null, body.opened_at ?? null, body.status ?? null, body.acknowledged_at ?? null, body.closed_at ?? null, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM alerts WHERE id = ?").bind(res.meta.last_row_id).first<Alert>();
  return row ? json(row) : json({ error: "insert failed" }, 500);
};

export const updateAlert: UpdateAlertHandler = async (req, env, params) => {
  const body = await readJson<Partial<Alert>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  await env.DB.prepare("UPDATE alerts SET meter_id = COALESCE(?, meter_id), severity = COALESCE(?, severity), message = COALESCE(?, message), opened_at = COALESCE(?, opened_at), status = COALESCE(?, status), acknowledged_at = COALESCE(?, acknowledged_at), closed_at = COALESCE(?, closed_at) WHERE id = ? AND tenant = ?").bind(body.meter_id ?? null, body.severity ?? null, body.message ?? null, body.opened_at ?? null, body.status ?? null, body.acknowledged_at ?? null, body.closed_at ?? null, params.id, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM alerts WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Alert>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const acknowledgeAlert: AcknowledgeAlertHandler = async (_req, env, params) => {
  void params;
  const { results } = await env.DB.prepare("UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_at = datetime('now') WHERE id = ? RETURNING *").bind(params.id).all<Row>();
  return json(results);
};
