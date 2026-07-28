import { json } from "../lib/http";
import type { TariffsListHandler, TariffsGetHandler, TariffsCreateHandler, TariffsUpdateHandler, TariffsDeleteHandler } from "../contract";
import { validateTariff } from "../validation";
import { NotFoundError, ValidationError } from "../errors";

const PAGE_SIZE = 50;

export const listTariffs: TariffsListHandler = async (req, env) => {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") || "";
  const rows = await env.DB.prepare(
    "SELECT * FROM tariff WHERE (?1 = '' OR id > ?1) ORDER BY id LIMIT ?2"
  )
    .bind(cursor, PAGE_SIZE + 1)
    .all();
  const items = rows.results.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    rate_per_kwh: Number(r.rate_per_kwh),
    band: String(r.band),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
  const nextCursor = items.length > PAGE_SIZE ? items[PAGE_SIZE - 1].id : null;
  if (items.length > PAGE_SIZE) items.pop();
  return json({ items, nextCursor });
};

export const getTariff: TariffsGetHandler = async (_req, env, params) => {
  const row = await env.DB.prepare("SELECT * FROM tariff WHERE id = ?").bind(params.id).first();
  if (!row) throw new NotFoundError("tariff not found");
  return json({
    id: String(row.id),
    name: String(row.name),
    rate_per_kwh: Number(row.rate_per_kwh),
    band: String(row.band),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  });
};

export const createTariff: TariffsCreateHandler = async (req, env) => {
  const body = await req.json();
  const input = validateTariff(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO tariff (id, name, rate_per_kwh, band, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, input.name, input.rate_per_kwh, input.band, now, now)
    .run();
  return json({
    id,
    name: input.name,
    rate_per_kwh: input.rate_per_kwh,
    band: input.band,
    created_at: now,
    updated_at: now,
  }, 201);
};

export const updateTariff: TariffsUpdateHandler = async (req, env, params) => {
  const existing = await env.DB.prepare("SELECT * FROM tariff WHERE id = ?").bind(params.id).first();
  if (!existing) throw new NotFoundError("tariff not found");
  const body = await req.json();
  const input = validateTariff(body, true);
  const name = input.name ?? existing.name;
  const rate = input.rate_per_kwh ?? existing.rate_per_kwh;
  const band = input.band ?? existing.band;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE tariff SET name = ?, rate_per_kwh = ?, band = ?, updated_at = ? WHERE id = ?"
  )
    .bind(name, rate, band, now, params.id)
    .run();
  return json({
    id: params.id,
    name,
    rate_per_kwh: Number(rate),
    band,
    created_at: String(existing.created_at),
    updated_at: now,
  });
};

export const deleteTariff: TariffsDeleteHandler = async (_req, env, params) => {
  const existing = await env.DB.prepare("SELECT * FROM tariff WHERE id = ?").bind(params.id).first();
  if (!existing) throw new NotFoundError("tariff not found");
  await env.DB.prepare("UPDATE meter SET tariff_id = NULL WHERE tariff_id = ?").bind(params.id).run();
  await env.DB.prepare("DELETE FROM tariff WHERE id = ?").bind(params.id).run();
  return json({ deleted: true });
};
