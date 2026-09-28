import { z } from "zod";
import { json } from "../lib/http";
import type { Env, Handler, RouteMap } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const siteCreateSchema = z.object({
  name: z.string().min(1).max(120),
  region: z.string().min(1).max(120),
  capacity_kw: z.number().nonnegative(),
});

const siteUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  region: z.string().min(1).max(120).optional(),
  capacity_kw: z.number().nonnegative().optional(),
});

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function notFound(id: string): Response {
  return json({ error: "site not found", id }, 404);
}

function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export const listSites: Handler = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
  const cursor = url.searchParams.get("cursor") || undefined;

  let where = "";
  const params: (string | number)[] = [limit + 1];
  if (cursor) {
    if (!isUuid(cursor)) {
      return errorResponse("invalid cursor");
    }
    where = "WHERE id > ?";
    params.unshift(cursor);
  }

  const stmt = env.DB.prepare(`
    SELECT id, name, region, capacity_kw, created_at, updated_at
    FROM site
    ${where}
    ORDER BY id
    LIMIT ?
  `);
  const result = await stmt.bind(...params).all<{ id: string; name: string; region: string; capacity_kw: number; created_at: string; updated_at: string }>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return json({
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
};

export const getSite: Handler = async (request: Request, env: Env, params: Record<string, string>) => {
  const id = params.id;
  if (!id || !isUuid(id)) {
    return errorResponse("invalid site id");
  }

  const site = await env.DB.prepare("SELECT id, name, region, capacity_kw, created_at, updated_at FROM site WHERE id = ?").bind(id).first<{ id: string; name: string; region: string; capacity_kw: number; created_at: string; updated_at: string }>();
  if (!site) return notFound(id);

  const agg = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM meter WHERE site_id = ?) AS meter_count,
      IFNULL((SELECT SUM(r.kwh)
        FROM reading r
        JOIN meter m ON r.meter_id = m.id
        WHERE m.site_id = ?), 0) AS total_kwh,
      IFNULL((SELECT SUM(r.demand_kw)
        FROM reading r
        JOIN meter m ON r.meter_id = m.id
        WHERE m.site_id = ?), 0) AS total_demand_kw,
      (SELECT COUNT(*) FROM alert a JOIN meter m ON a.meter_id = m.id WHERE m.site_id = ? AND a.status = 'OPEN') AS open_alerts
  `).bind(id, id, id, id).first<{ meter_count: number; total_kwh: number; total_demand_kw: number; open_alerts: number }>();

  return json({ ...site, ...agg });
};

export const createSite: Handler = async (request: Request, env: Env) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid JSON");
  }

  const parsed = siteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "));
  }

  const { name, region, capacity_kw } = parsed.data;
  const id = uuid();
  const ts = now();

  try {
    await env.DB.prepare(`
      INSERT INTO site (id, name, region, capacity_kw, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, name, region, capacity_kw, ts, ts).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      return errorResponse("site name already exists", 409);
    }
    throw err;
  }

  return json({ id, name, region, capacity_kw, created_at: ts, updated_at: ts }, 201);
};

export const updateSite: Handler = async (request: Request, env: Env, params: Record<string, string>) => {
  const id = params.id;
  if (!id || !isUuid(id)) {
    return errorResponse("invalid site id");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid JSON");
  }

  const parsed = siteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "));
  }

  const updates = parsed.data;
  const fields = Object.keys(updates);
  if (fields.length === 0) {
    return errorResponse("no fields to update");
  }

  const existing = await env.DB.prepare("SELECT id FROM site WHERE id = ?").bind(id).first<{ id: string }>();
  if (!existing) return notFound(id);

  const setClause = fields.map(f => `${f} = ?`).join(", ") + ", updated_at = ?";
  const values = fields.map(f => (updates as Record<string, string | number>)[f]).concat(now(), id);

  try {
    await env.DB.prepare(`UPDATE site SET ${setClause} WHERE id = ?`).bind(...values).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      return errorResponse("site name already exists", 409);
    }
    throw err;
  }

  const site = await env.DB.prepare("SELECT id, name, region, capacity_kw, created_at, updated_at FROM site WHERE id = ?").bind(id).first<{ id: string; name: string; region: string; capacity_kw: number; created_at: string; updated_at: string }>();
  return json(site);
};

export const deleteSite: Handler = async (request: Request, env: Env, params: Record<string, string>) => {
  const id = params.id;
  if (!id || !isUuid(id)) {
    return errorResponse("invalid site id");
  }

  const existing = await env.DB.prepare("SELECT id FROM site WHERE id = ?").bind(id).first<{ id: string }>();
  if (!existing) return notFound(id);

  await env.DB.prepare("DELETE FROM site WHERE id = ?").bind(id).run();
  return json({ deleted: true, id });
};

const routes: RouteMap = {
  "GET /api/sites": listSites,
  "GET /api/sites/:id": getSite,
  "POST /api/sites": createSite,
  "PUT /api/sites/:id": updateSite,
  "DELETE /api/sites/:id": deleteSite,
};

export default routes;
