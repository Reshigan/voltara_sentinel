// GENERATED from the manifest. Do not edit.
import { json, readJson, tenantOf } from "../lib/http";
import type { Tariff, ListTariffsHandler, GetTariffHandler, CreateTariffHandler, UpdateTariffHandler, DeleteTariffHandler } from "../types";

const FIELDS: [string, "text" | "integer" | "real"][] = [["name", "text"], ["rate_per_kwh", "real"], ["band", "text"], ["created_at", "text"], ["updated_at", "text"]];
function validate(body: Partial<Tariff>): string | null {
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

export const listTariffs: ListTariffsHandler = async (req, env) => {
  const { results } = await env.DB.prepare("SELECT * FROM tariffs WHERE tenant = ?").bind(tenantOf(req)).all<Tariff>();
  return json(results);
};

export const getTariff: GetTariffHandler = async (req, env, params) => {
  const row = await env.DB.prepare("SELECT * FROM tariffs WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Tariff>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const createTariff: CreateTariffHandler = async (req, env) => {
  const body = await readJson<Partial<Tariff>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  const invalid = validate(body);
  if (invalid) return json({ error: invalid }, 400);
  const res = await env.DB.prepare("INSERT INTO tariffs (name, rate_per_kwh, band, created_at, updated_at, tenant) VALUES (?, ?, ?, ?, ?, ?)").bind(body.name ?? null, body.rate_per_kwh ?? null, body.band ?? null, body.created_at ?? null, body.updated_at ?? null, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM tariffs WHERE id = ?").bind(res.meta.last_row_id).first<Tariff>();
  return row ? json(row) : json({ error: "insert failed" }, 500);
};

export const updateTariff: UpdateTariffHandler = async (req, env, params) => {
  const body = await readJson<Partial<Tariff>>(req);
  if (!body) return json({ error: "invalid body" }, 400);
  await env.DB.prepare("UPDATE tariffs SET name = COALESCE(?, name), rate_per_kwh = COALESCE(?, rate_per_kwh), band = COALESCE(?, band), created_at = COALESCE(?, created_at), updated_at = COALESCE(?, updated_at) WHERE id = ? AND tenant = ?").bind(body.name ?? null, body.rate_per_kwh ?? null, body.band ?? null, body.created_at ?? null, body.updated_at ?? null, params.id, tenantOf(req)).run();
  const row = await env.DB.prepare("SELECT * FROM tariffs WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).first<Tariff>();
  return row ? json(row) : json({ error: "not found" }, 404);
};

export const deleteTariff: DeleteTariffHandler = async (req, env, params) => {
  const res = await env.DB.prepare("DELETE FROM tariffs WHERE id = ? AND tenant = ?").bind(params.id, tenantOf(req)).run();
  return res.meta.changes ? json({ ok: true }) : json({ error: "not found" }, 404);
};
