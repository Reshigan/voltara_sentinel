import type { Context } from 'hono';
import type { DB } from '../lib/db';
import { json } from '../lib/http';
import { isUuid, isNonNegativeNumber, isIso8601 } from '../lib/validation';

const PAGE_SIZE = 50;

export function listReadings(c: Context, db: DB): Response {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit') ?? PAGE_SIZE), PAGE_SIZE);

  let rows: unknown[];
  if (cursor && isUuid(cursor)) {
    rows = db.prepare('SELECT * FROM reading WHERE id > ? ORDER BY id LIMIT ?').all(cursor, limit);
  } else {
    rows = db.prepare('SELECT * FROM reading ORDER BY id LIMIT ?').all(limit);
  }

  const next = rows.length === limit ? (rows[rows.length - 1] as { id: string }).id : null;
  return json({ items: rows, next });
}

export function getReading(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const row = db.prepare('SELECT * FROM reading WHERE id = ?').get(id);
  return row ? json(row) : json({ error: 'not found' }, 404);
}

export function createReading(c: Context, db: DB): Response {
  let body: Record<string, unknown>;
  try {
    body = c.req.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  if (!isUuid(body.meter_id)) return json({ error: 'meter_id must be a valid UUID' }, 400);
  if (!isNonNegativeNumber(body.kwh)) return json({ error: 'kwh must be a non-negative number' }, 400);
  if (!isNonNegativeNumber(body.demand_kw)) return json({ error: 'demand_kw must be a non-negative number' }, 400);
  if (!isIso8601(body.taken_at)) return json({ error: 'taken_at must be a valid ISO 8601 timestamp' }, 400);

  const meter = db.prepare('SELECT 1 FROM meter WHERE id = ?').get(body.meter_id);
  if (!meter) return json({ error: 'meter not found' }, 400);

  const id = crypto.randomUUID();
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at) VALUES (?, ?, ?, ?, ?)').run(id, body.meter_id, body.kwh, body.demand_kw, body.taken_at);

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const stats = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(AVG(kwh), 0) as mean, COALESCE(CAST(sqrt(avg(kwh * kwh) - avg(kwh) * avg(kwh)) AS REAL), 0) as std
        FROM reading
        WHERE meter_id = ? AND taken_at >= ? AND id != ?
      `).get(body.meter_id, since, id) as { count: number; mean: number; std: number } | undefined;

      if (stats && stats.count >= 2 && stats.std > 0) {
        const z = Math.abs((body.kwh as number) - stats.mean) / stats.std;
        if (z > 3) {
          db.prepare("INSERT INTO alert (id, meter_id, severity, message, opened_at, status) VALUES (?, ?, 'WARNING', ?, ?, 'OPEN')").run(
            crypto.randomUUID(),
            body.meter_id,
            `Consumption anomaly detected: ${body.kwh} kWh vs ${stats.mean.toFixed(2)} kWh average.`,
            new Date().toISOString()
          );
        }
      }
    })();
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const row = db.prepare('SELECT * FROM reading WHERE id = ?').get(id);
  return json(row, 201);
}

export function deleteReading(c: Context, db: DB): Response {
  const id = c.req.param('id');
  if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
  const result = db.prepare('DELETE FROM reading WHERE id = ?').run(id);
  return result.changes > 0 ? json({ success: true }) : json({ error: 'not found' }, 404);
}

export async function importReadings(c: Context, db: DB): Promise<Response> {
 const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'file field is required' }, 400);

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return json({ error: 'file is empty' }, 400);

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const meterIdx = header.indexOf('meter_id');
  const kwhIdx = header.indexOf('kwh');
  const demandIdx = header.indexOf('demand_kw');
  const takenIdx = header.indexOf('taken_at');

  if (meterIdx === -1 || kwhIdx === -1 || demandIdx === -1 || takenIdx === -1) {
    return json({ error: 'CSV must have columns: meter_id, kwh, demand_kw, taken_at' }, 400);
  }

  let imported = 0;
  const errors: { row: number; message: string }[] = [];
  const BATCH_SIZE = 500;

  const insertStmt = db.prepare('INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at) VALUES (?, ?, ?, ?, ?)');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const meter_id = cols[meterIdx]?.trim();
    const kwh = Number(cols[kwhIdx]?.trim());
    const demand_kw = Number(cols[demandIdx]?.trim());
    const taken_at = cols[takenIdx]?.trim();

    if (!isUuid(meter_id)) { errors.push({ row: i, message: 'invalid meter_id' }); continue; }
    if (!isNonNegativeNumber(kwh)) { errors.push({ row: i, message: 'invalid kwh' }); continue; }
    if (!isNonNegativeNumber(demand_kw)) { errors.push({ row: i, message: 'invalid demand_kw' }); continue; }
    if (!isIso8601(taken_at)) { errors.push({ row: i, message: 'invalid taken_at' }); continue; }

    try {
      if (imported % BATCH_SIZE === 0) {
        db.exec('BEGIN');
      }
      insertStmt.run(crypto.randomUUID(), meter_id, kwh, demand_kw, taken_at);
      imported++;
      if (imported % BATCH_SIZE === 0 || i === lines.length - 1) {
        db.exec('COMMIT');
      }
    } catch (e) {
      db.exec('ROLLBACK');
      errors.push({ row: i, message: (e as Error).message });
    }
  }

  return json({ imported, errors });
}
