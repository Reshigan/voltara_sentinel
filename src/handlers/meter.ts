import type { Context } from 'hono';
import type { DB } from '../lib/db';
import { json, readJson } from '../lib/http';
import { isUuid, isMeterSerial, isEnum, isOptional } from '../lib/validation';

const PAGE_SIZE = 50;
const KINDS = ['ELECTRIC', 'GAS', 'WATER', 'SOLAR'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'FAULT'] as const;

export function listMeters(c: Context, db: DB): Response {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit') ?? PAGE_SIZE), PAGE_SIZE);

  let rows: unknown[];
  if (cursor && isUuid(cursor)) {
    rows = db.prepare('SELECT * FROM meter WHERE id > ? ORDER BY id LIMIT ?').all(cursor, limit);
  } else {
    rows = db.prepare('SELECT * FROM meter ORDER BY id LIMIT ?').all(limit);
  }

  const next = rows.length === limit ? (rows[rows.length - 1] as { id: string }).id : null;
  return json({ items: rows, next });
}

export function getMeter(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const row = db.prepare('SELECT * FROM meter WHERE id = ?').get(id);
  return row ? json(row) : json({ error: 'not found' }, 404);
}

export function createMeter(c: Context, db: DB): Response {
  const body = readJsonSync(c);
  if (!body) return json({ error: 'invalid body' }, 400);

  if (!isMeterSerial(body.serial)) return json({ error: 'serial must be 6-20 alphanumeric characters' }, 400);
  if (!isUuid(body.site_id)) return json({ error: 'site_id must be a valid UUID' }, 400);
  if (!isEnum(KINDS)(body.kind)) return json({ error: 'kind must be one of ELECTRIC, GAS, WATER, SOLAR' }, 400);
  if (!isEnum(STATUSES)(body.status)) return json({ error: 'status must be one of ACTIVE, INACTIVE, FAULT' }, 400);
  if (!isOptional(body.tariff_id) && !isUuid(body.tariff_id)) return json({ error: 'tariff_id must be a valid UUID or null' }, 400);

  const site = db.prepare('SELECT 1 FROM site WHERE id = ?').get(body.site_id);
  if (!site) return json({ error: 'site not found' }, 400);

  if (body.tariff_id) {
    const tariff = db.prepare('SELECT 1 FROM tariff WHERE id = ?').get(body.tariff_id);
    if (!tariff) return json({ error: 'tariff not found' }, 400);
  }

  const id = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO meter (id, serial, site_id, kind, status, tariff_id) VALUES (?, ?, ?, ?, ?, ?)').run(id, body.serial, body.site_id, body.kind, body.status, body.tariff_id ?? null);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM meter WHERE id = ?').get(id);
  return json(row, 201);
}

export function updateMeter(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);

  const body = readJsonSync(c);
  if (!body) return json({ error: 'invalid body' }, 400);

  const existing = db.prepare('SELECT * FROM meter WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return json({ error: 'not found' }, 404);

  const serial = body.serial ?? existing.serial;
  const site_id = body.site_id ?? existing.site_id;
  const kind = body.kind ?? existing.kind;
  const status = body.status ?? existing.status;
  const tariff_id = body.tariff_id !== undefined ? body.tariff_id : existing.tariff_id;

  if (!isMeterSerial(serial)) return json({ error: 'serial must be 6-20 alphanumeric characters' }, 400);
  if (!isUuid(site_id)) return json({ error: 'site_id must be a valid UUID' }, 400);
  if (!isEnum(KINDS)(kind)) return json({ error: 'kind must be one of ELECTRIC, GAS, WATER, SOLAR' }, 400);
  if (!isEnum(STATUSES)(status)) return json({ error: 'status must be one of ACTIVE, INACTIVE, FAULT' }, 400);
  if (!isOptional(tariff_id) && !isUuid(tariff_id)) return json({ error: 'tariff_id must be a valid UUID or null' }, 400);

  try {
    db.transaction(() => {
      if (existing.status !== status) {
        db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, field, old_value, new_value) VALUES (?, 'meter', ?, 'status', ?, ?)").run(crypto.randomUUID(), id, String(existing.status), String(status));
      }
      db.prepare("UPDATE meter SET serial = ?, site_id = ?, kind = ?, status = ?, tariff_id = ?, updated_at = datetime('now') WHERE id = ?").run(serial, site_id, kind, status, tariff_id ?? null, id);
    })();
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM meter WHERE id = ?').get(id);
  return json(row);
}

export function deleteMeter(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const result = db.prepare('DELETE FROM meter WHERE id = ?').run(id);
  return result.changes > 0 ? json({ success: true }) : json({ error: 'not found' }, 404);
}

function readJsonSync(c: Context): Record<string, unknown> | null {
  try {
    return c.req.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}
