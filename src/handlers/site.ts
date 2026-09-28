import type { Context } from 'hono';
import type { DB } from '../lib/db';
import { json, readJson } from '../lib/http';
import { isUuid } from '../lib/validation';

const PAGE_SIZE = 50;

export function listSites(c: Context, db: DB): Response {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit') ?? PAGE_SIZE), PAGE_SIZE);

  let rows: unknown[];
  if (cursor && isUuid(cursor)) {
    rows = db.prepare('SELECT * FROM site WHERE id > ? ORDER BY id LIMIT ?').all(cursor, limit);
  } else {
    rows = db.prepare('SELECT * FROM site ORDER BY id LIMIT ?').all(limit);
  }

  const next = rows.length === limit ? (rows[rows.length - 1] as { id: string }).id : null;
  return json({ items: rows, next });
}

export function getSite(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const row = db.prepare('SELECT * FROM site WHERE id = ?').get(id);
  return row ? json(row) : json({ error: 'not found' }, 404);
}

export function createSite(c: Context, db: DB): Response {
  const body = readJsonSync(c);
  if (!body) return json({ error: 'invalid body' }, 400);

  if (typeof body.name !== 'string' || body.name.trim().length === 0) return json({ error: 'name is required' }, 400);
  if (typeof body.region !== 'string' || body.region.trim().length === 0) return json({ error: 'region is required' }, 400);
  if (typeof body.capacity_kw !== 'number' || body.capacity_kw < 0) return json({ error: 'capacity_kw must be a non-negative number' }, 400);

  const id = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO site (id, name, region, capacity_kw) VALUES (?, ?, ?, ?)').run(id, body.name, body.region, body.capacity_kw);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM site WHERE id = ?').get(id);
  return json(row, 201);
}

export function updateSite(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);

  const body = readJsonSync(c);
  if (!body) return json({ error: 'invalid body' }, 400);

  const existing = db.prepare('SELECT * FROM site WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return json({ error: 'not found' }, 404);

  const name = body.name ?? existing.name;
  const region = body.region ?? existing.region;
  const capacity_kw = body.capacity_kw ?? existing.capacity_kw;

  if (typeof name !== 'string' || name.trim().length === 0) return json({ error: 'name is required' }, 400);
  if (typeof region !== 'string' || region.trim().length === 0) return json({ error: 'region is required' }, 400);
  if (typeof capacity_kw !== 'number' || capacity_kw < 0) return json({ error: 'capacity_kw must be a non-negative number' }, 400);

  try {
    db.prepare("UPDATE site SET name = ?, region = ?, capacity_kw = ?, updated_at = datetime('now') WHERE id = ?").run(name, region, capacity_kw, id);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM site WHERE id = ?').get(id);
  return json(row);
}

export function deleteSite(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const result = db.prepare('DELETE FROM site WHERE id = ?').run(id);
  return result.changes > 0 ? json({ success: true }) : json({ error: 'not found' }, 404);
}

export function getDashboardKpis(_c: Context, db: DB): Response {
  void _c;
  const startOfDay = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';

  const kpis = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM site) as total_sites,
      (SELECT COUNT(*) FROM meter WHERE status = 'ACTIVE') as active_meters,
      (SELECT COALESCE(SUM(kwh), 0) FROM reading WHERE taken_at >= ?) as daily_kwh,
      (SELECT COUNT(*) FROM alert WHERE status = 'OPEN') as open_alerts
  `).get(startOfDay) as { total_sites: number; active_meters: number; daily_kwh: number; open_alerts: number } | undefined;

  return json({
    total_sites: kpis?.total_sites ?? 0,
    active_meters: kpis?.active_meters ?? 0,
    daily_kwh: kpis?.daily_kwh ?? 0,
    open_alerts: kpis?.open_alerts ?? 0
  });
}

export function getDashboardSites(_c: Context, db: DB): Response {
  void _c;
  const sites = db.prepare(`
    SELECT
      s.id, s.name, s.region, s.capacity_kw,
      COUNT(DISTINCT m.id) as meter_count,
      COALESCE(SUM(r.kwh), 0) as total_kwh,
      SUM(CASE WHEN m.status = 'FAULT' THEN 1 ELSE 0 END) as fault_meters,
      SUM(CASE WHEN a.status = 'OPEN' THEN 1 ELSE 0 END) as open_alerts
    FROM site s
    LEFT JOIN meter m ON m.site_id = s.id
    LEFT JOIN reading r ON r.meter_id = m.id
    LEFT JOIN alert a ON a.meter_id = m.id
    GROUP BY s.id, s.name, s.region, s.capacity_kw
    ORDER BY s.name
  `).all() as Array<{
    id: string;
    name: string;
    region: string;
    capacity_kw: number;
    meter_count: number;
    total_kwh: number;
    fault_meters: number;
    open_alerts: number;
  }>;

  const result = sites.map(s => ({
    ...s,
    status: s.fault_meters > 0 || s.open_alerts > 0 ? 'amber' : 'green',
    status_label: s.fault_meters > 0 || s.open_alerts > 0 ? 'Attention' : 'Healthy'
  }));

  return json(result);
}

function readJsonSync(c: Context): Record<string, unknown> | null {
  try {
    return c.req.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}
