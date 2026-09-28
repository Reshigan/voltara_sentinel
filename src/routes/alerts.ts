import { json } from "../lib/http";
import { type AlertsListHandler, type AlertDetailHandler, type AlertUpdateHandler } from "../contract";
import { z } from "zod";
import { randomUUID } from "crypto";
import { insertAuditLog } from "../audit";

const AlertStatus = z.enum(["OPEN", "ACKNOWLEDGED", "CLOSED"]);
const Severity = z.enum(["INFO", "WARNING", "CRITICAL"]);

const AlertRow = z.object({
  id: z.string(),
  meter_id: z.string(),
  severity: Severity,
  message: z.string(),
  opened_at: z.string(),
  status: AlertStatus,
  acknowledged_at: z.string().nullable(),
  closed_at: z.string().nullable(),
});

const ListQuery = z.object({
  cursor: z.string().optional(),
  status: AlertStatus.optional(),
  meter_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const UpdateBody = z.object({
  status: z.enum(["ACKNOWLEDGED", "CLOSED"]),
});

export const listAlerts: AlertsListHandler = async (req, env) => {
  const url = new URL(req.url);
  const parsed = ListQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "invalid query parameters", details: parsed.error.format() }, 400);
  }

  const { cursor, status, meter_id, limit } = parsed.data;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (meter_id) {
    conditions.push("meter_id = ?");
    params.push(meter_id);
  }
  if (cursor) {
    conditions.push("id > ?");
    params.push(cursor);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const stmt = env.DB.prepare(`SELECT * FROM alert ${where} ORDER BY id ASC LIMIT ?`).bind(...params, limit + 1);
  const { results } = await stmt.all();

  const rows = (results ?? []).map((r) => AlertRow.parse(r));
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return json({ items, nextCursor, hasMore });
};

export const getAlert: AlertDetailHandler = async (_req, env, params) => {
  const id = params?.id;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return json({ error: "invalid id" }, 400);
  }

  const { results } = await env.DB.prepare("SELECT * FROM alert WHERE id = ?").bind(id).all();
  const row = results?.[0];
  if (!row) return json({ error: "not found" }, 404);

  return json(AlertRow.parse(row));
};

export const updateAlert: AlertUpdateHandler = async (req, env, params) => {
  const id = params?.id;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return json({ error: "invalid id" }, 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = UpdateBody.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid body", details: parsed.error.format() }, 400);
  }

  const { status: newStatus } = parsed.data;
  const now = new Date().toISOString();

  const existing = await env.DB.prepare("SELECT * FROM alert WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "not found" }, 404);

  const oldStatus = String(existing.status);
  if (oldStatus === newStatus) {
    return json({ error: `alert is already ${newStatus.toLowerCase()}` }, 409);
  }
  if (oldStatus === "CLOSED") {
    return json({ error: "closed alerts cannot be updated" }, 409);
  }

  const updates: string[] = ["status = ?"];
  const values: unknown[] = [newStatus];

  if (newStatus === "ACKNOWLEDGED") {
    updates.push("acknowledged_at = ?");
    values.push(now);
  } else if (newStatus === "CLOSED") {
    updates.push("closed_at = ?");
    values.push(now);
  }

  values.push(id);

  await env.DB.prepare(`UPDATE alert SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  await insertAuditLog(env.DB, {
    id: randomUUID(),
    entity_type: "alert",
    entity_id: id,
    field: "status",
    old_value: oldStatus,
    new_value: newStatus,
    changed_at: now,
  });

  const updated = await env.DB.prepare("SELECT * FROM alert WHERE id = ?").bind(id).first();
  return json(AlertRow.parse(updated));
};
