// GENERATED from the manifest. Do not edit.
import { json, readJson, tenantOf } from "../lib/http";
import type { Meter, ListMetersHandler, GetMeterHandler, CreateMeterHandler, UpdateMeterHandler, DeleteMeterHandler } from "../types";

const FIELDS: [string, "text" | "integer" | "real"][] = [["serial", "text"], ["site_id", "integer"], ["kind", "text"], ["status", "text"], ["tariff_id", "integer"], ["created_at", "text"], ["updated_at", "text"]];
function validate(body: Partial<Meter>): string | null {
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

export const listMeters: ListMetersHandler = async (req, env) => {
  const { results } = await env.DB.prepare("SELECT * FROM meters WHERE tenant = ?").bind(tenantOf(req)).all<Meter>();
  return json(results);
};

export const getMeter: GetMeterHandler = async (req, env, params) => {
  const row = await env.DB.prepare("SELECT * FROM meters WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Meter>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const createMeter: CreateMeterHandler = async (req, env) => {
  const body = await readJson<Partial<Meter>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  const invalid = validate(body);
  if (invalid) return json({ error: invalid }, 400);
  const res = await env.DB.prepare("INSERT INTO meters (serial, site_id, kind, status, tariff_id, created_at, updated_at, tenant) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(body.serial ?? null, body.site_id ?? null, body.kind ?? null, body.status ?? null, body.tariff_id ?? null, body.created_at ?? null, body.updated_at ?? null, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM meters WHERE id = ?").bind(res.meta.last_row_id).first<Meter>();
  return row ? json(row) : json({ error: "insert failed" }, 500);
};

export const updateMeter: UpdateMeterHandler = async (req, env, params) => {
  const body = await readJson<Partial<Meter>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  await env.DB.prepare("UPDATE meters SET serial = COALESCE(?, serial), site_id = COALESCE(?, site_id), kind = COALESCE(?, kind), status = COALESCE(?, status), tariff_id = COALESCE(?, tariff_id), created_at = COALESCE(?, created_at), updated_at = COALESCE(?, updated_at) WHERE id = ? AND tenant = ?").bind(body.serial ?? null, body.site_id ?? null, body.kind ?? null, body.status ?? null, body.tariff_id ?? null, body.created_at ?? null, body.updated_at ?? null, params.id, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM meters WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Meter>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const deleteMeter: DeleteMeterHandler = async (req, env, params) => {
  const res = await env.DB.prepare("DELETE FROM meters WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).run();
  return res.meta.changes ? json({ ok: true }) : json({ error: "not found" }, 404);
};
