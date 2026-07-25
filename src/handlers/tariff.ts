import type { Context } from 'hono';
import type { DB } from '../lib/db';
import { json } from '../lib/http';
import { isUuid, isPositiveNumber, isEnum } from '../lib/validation';

const PAGE_SIZE = 50;
const BANDS = ['OFF_PEAK', 'SHOULDER', 'PEAK'] as const;

export function listTariffs(c: Context, db: DB): Response {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit') ?? PAGE_SIZE), PAGE_SIZE);

  let rows: unknown[];
  if (cursor && isUuid(cursor)) {
    rows = db.prepare('SELECT * FROM tariff WHERE id > ? ORDER BY id LIMIT ?').all(cursor, limit);
  } else {
    rows = db.prepare('SELECT * FROM tariff ORDER BY id LIMIT ?').all(limit);
  }

  const next = rows.length === limit ? (rows[rows.length - 1] as { id: string }).id : null;
  return json({ items: rows, next });
}

export function getTariff(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const row = db.prepare('SELECT * FROM tariff WHERE id = ?').get(id);
  return row ? json(row) : json({ error: 'not found' }, 404);
}

export function createTariff(c: Context, db: DB): Response {
  let body: Record<string, unknown>;
  try { body = c.req.json() as Record<string, unknown>; }
  catch { return json({ error: 'invalid body' }, 400); }

  if (typeof body.name !== 'string' || body.name.trim().length === 0) return json({ error: 'name is required' }, 400);
  if (!isPositiveNumber(body.rate_per_kwh)) return json({ error: 'rate_per_kwh must be a positive number' }, 400);
  if (!isEnum(BANDS)(body.band)) return json({ error: 'band must be one of OFF_PEAK, SHOULDER, PEAK' }, 400);

  const id = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO tariff (id, name, rate_per_kwh, band) VALUES (?, ?, ?, ?)').run(id, body.name, body.rate_per_kwh, body.band);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM tariff WHERE id = ?').get(id);
  return json(row, 201);
}

export function updateTariff(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);

  let body: Record<string, unknown>;
  try { body = c.req.json() as Record<string, unknown>; }
  catch { return json({ error: 'invalid body' }, 400); }

  const existing = db.prepare('SELECT * FROM tariff WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return json({ error: 'not found' }, 404);

  const name = body.name ?? existing.name;
  const rate_per_kwh = body.rate_per_kwh ?? existing.rate_per_kwh;
  const band = body.band ?? existing.band;

  if (typeof name !== 'string' || name.trim().length === 0) return json({ error: 'name is required' }, 400);
  if (!isPositiveNumber(rate_per_kwh)) return json({ error: 'rate_per_kwh must be a positive number' }, 400);
  if (!isEnum(BANDS)(band)) return json({ error: 'band must be one of OFF_PEAK, SHOULDER, PEAK' }, 400);

  try {
    db.prepare("UPDATE tariff SET name = ?, rate_per_kwh = ?, band = ?, updated_at = datetime('now') WHERE id = ?").run(name, rate_per_kwh, band, id);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM tariff WHERE id = ?').get(id);
  return json(row);
}

export function deleteTariff(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const result = db.prepare('DELETE FROM tariff WHERE id = ?').run(id);
  return result.changes > 0 ? json({ success: true }) : json({ error: 'not found' }, 404);
}
