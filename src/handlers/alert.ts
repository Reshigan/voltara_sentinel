import type { Context } from 'hono';
import type { DB } from '../lib/db';
import { json } from '../lib/http';
import { isUuid, isEnum, isIso8601 } from '../lib/validation';

const PAGE_SIZE = 50;
const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;
const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'CLOSED'] as const;

export function listAlerts(c: Context, db: DB): Response {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit') ?? PAGE_SIZE), PAGE_SIZE);

  let rows: unknown[];
  if (cursor && isUuid(cursor)) {
    rows = db.prepare('SELECT * FROM alert WHERE id > ? ORDER BY id LIMIT ?').all(cursor, limit);
  } else {
    rows = db.prepare('SELECT * FROM alert ORDER BY id LIMIT ?').all(limit);
  }

  const next = rows.length === limit ? (rows[rows.length - 1] as { id: string }).id : null;
  return json({ items: rows, next });
}

export function getAlert(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const row = db.prepare('SELECT * FROM alert WHERE id = ?').get(id);
  return row ? json(row) : json({ error: 'not found' }, 404);
}

export function createAlert(c: Context, db: DB): Response {
  let body: Record<string, unknown>;
  try { body = c.req.json() as Record<string, unknown>; }
  catch { return json({ error: 'invalid body' }, 400); }

  if (!isUuid(body.meter_id)) return json({ error: 'meter_id must be a valid UUID' }, 400);
  if (!isEnum(SEVERITIES)(body.severity)) return json({ error: 'severity must be one of INFO, WARNING, CRITICAL' }, 400);
  if (typeof body.message !== 'string' || body.message.trim().length === 0) return json({ error: 'message is required' }, 400);
  if (!isIso8601(body.opened_at)) return json({ error: 'opened_at must be a valid ISO 8601 timestamp' }, 400);
  if (!isEnum(ALERT_STATUSES)(body.status)) return json({ error: 'status must be one of OPEN, ACKNOWLEDGED, CLOSED' }, 400);

  const meter = db.prepare('SELECT 1 FROM meter WHERE id = ?').get(body.meter_id);
  if (!meter) return json({ error: 'meter not found' }, 400);

  const id = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO alert (id, meter_id, severity, message, opened_at, status) VALUES (?, ?, ?, ?, ?, ?)').run(id, body.meter_id, body.severity, body.message, body.opened_at, body.status);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM alert WHERE id = ?').get(id);
  return json(row, 201);
}

export function updateAlert(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);

  let body: Record<string, unknown>;
  try { body = c.req.json() as Record<string, unknown>; }
  catch { return json({ error: 'invalid body' }, 400); }

  const existing = db.prepare('SELECT * FROM alert WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return json({ error: 'not found' }, 404);

  const status = body.status ?? existing.status;
  if (!isEnum(ALERT_STATUSES)(status)) return json({ error: 'status must be one of OPEN, ACKNOWLEDGED, CLOSED' }, 400);

  try {
    db.transaction(() => {
      if (existing.status !== status) {
        db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, field, old_value, new_value) VALUES (?, 'alert', ?, 'status', ?, ?)").run(crypto.randomUUID(), id, String(existing.status), String(status));
      }
      db.prepare("UPDATE alert SET status = ? WHERE id = ?").run(status, id);
    })();
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM alert WHERE id = ?').get(id);
  return json(row);
}

export function acknowledgeAlert(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);

  const existing = db.prepare('SELECT * FROM alert WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return json({ error: 'not found' }, 404);

  try {
    db.transaction(() => {
      db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, field, old_value, new_value) VALUES (?, 'alert', ?, 'status', ?, 'ACKNOWLEDGED')").run(crypto.randomUUID(), id, String(existing.status));
      db.prepare("UPDATE alert SET status = 'ACKNOWLEDGED', acknowledged_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    })();
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  const row = db.prepare('SELECT * FROM alert WHERE id = ?').get(id);
  return json(row);
}

export function deleteAlert(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const result = db.prepare('DELETE FROM alert WHERE id = ?').run(id);
  return result.changes > 0 ? json({ success: true }) : json({ error: 'not found' }, 404);
}
