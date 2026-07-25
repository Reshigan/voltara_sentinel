import type { Context } from 'hono';
import type { DB } from '../lib/db';
import { json } from '../lib/http';

let startTime = Date.now();

export function getHealth(_c: Context, db: DB): Response {
  void _c;
  try {
    db.prepare('SELECT 1').get();
    return json({ status: 'ok', db: 'connected', uptime: Math.floor((Date.now() - startTime) / 1000) });
  } catch {
    return json({ status: 'error', db: 'disconnected', uptime: 0 }, 500);
  }
}
