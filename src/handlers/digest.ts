import type { Context } from 'hono';
import type { DB } from '../lib/db';
import { json } from '../lib/http';

interface Digest {
  total_kwh: number;
  peak_demand_kw: number;
  new_alerts: number;
  acknowledged_alerts: number;
  top_sites: { name: string; kwh: number }[];
  critical_sites: { name: string; alert_count: number }[];
}

export function getDigest(_c: Context, db: DB): Response {
  void _c;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(r.kwh), 0) as total_kwh,
      COALESCE(MAX(r.demand_kw), 0) as peak_demand_kw
    FROM reading r
    WHERE r.taken_at >= ?
  `).get(since) as { total_kwh: number; peak_demand_kw: number } | undefined;

  const newAlerts = db.prepare(`SELECT COUNT(*) as count FROM alert WHERE opened_at >= ?`).get(since) as { count: number } | undefined;
  const ackAlerts = db.prepare(`SELECT COUNT(*) as count FROM alert WHERE status = 'ACKNOWLEDGED' AND acknowledged_at >= ?`).get(since) as { count: number } | undefined;

  const topSites = db.prepare(`
    SELECT s.name, COALESCE(SUM(r.kwh), 0) as kwh
    FROM site s
    JOIN meter m ON m.site_id = s.id
    JOIN reading r ON r.meter_id = m.id
    WHERE r.taken_at >= ?
    GROUP BY s.id, s.name
    ORDER BY kwh DESC
    LIMIT 3
  `).all(since) as { name: string; kwh: number }[];

  const criticalSites = db.prepare(`
    SELECT s.name, COUNT(a.id) as alert_count
    FROM site s
    JOIN meter m ON m.site_id = s.id
    JOIN alert a ON a.meter_id = m.id
    WHERE a.severity = 'CRITICAL' AND a.opened_at >= ?
    GROUP BY s.id, s.name
    ORDER BY alert_count DESC
    LIMIT 3
  `).all(since) as { name: string; alert_count: number }[];

  const digest: Digest = {
    total_kwh: totals?.total_kwh ?? 0,
    peak_demand_kw: totals?.peak_demand_kw ?? 0,
    new_alerts: newAlerts?.count ?? 0,
    acknowledged_alerts: ackAlerts?.count ?? 0,
    top_sites: topSites,
    critical_sites: criticalSites
  };

  return json(digest);
}
