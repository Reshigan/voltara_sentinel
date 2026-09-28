import type { Env } from "../lib/http";
import { json } from "../lib/http";

export type DigestHandler = (
  req: Request,
  env: Env,
) => Promise<Response>;

interface DigestRow {
  total_kwh: number;
  peak_demand_kw: number;
  new_alerts: number;
  acknowledged_alerts: number;
}

interface TopSite {
  name: string;
  kwh: number;
}

interface CriticalSite {
  name: string;
  alert_count: number;
}

export const getDigest: DigestHandler = async (_req, env) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const summary = await env.DB.prepare(
    `SELECT
      COALESCE((SELECT SUM(r.kwh) FROM readings r WHERE r.taken_at >= ?), 0) AS total_kwh,
      COALESCE((SELECT MAX(r.demand_kw) FROM readings r WHERE r.taken_at >= ?), 0) AS peak_demand_kw,
      COALESCE((SELECT COUNT(*) FROM alerts a WHERE a.opened_at >= ?), 0) AS new_alerts,
      COALESCE((SELECT COUNT(*) FROM alerts a WHERE a.acknowledged_at >= ?), 0) AS acknowledged_alerts`,
  )
    .bind(since, since, since, since)
    .first<DigestRow>();

  if (!summary) {
    return json(
      {
        total_kwh: 0,
        peak_demand_kw: 0,
        new_alerts: 0,
        acknowledged_alerts: 0,
        top_sites: [],
        critical_sites: [],
      },
      200,
    );
  }

  const topSites = await env.DB.prepare(
    `SELECT s.name, COALESCE(SUM(r.kwh), 0) AS kwh
     FROM sites s
     JOIN meters m ON m.site_id = s.id
     JOIN readings r ON r.meter_id = m.id
     WHERE r.taken_at >= ?
     GROUP BY s.id
     ORDER BY kwh DESC
     LIMIT 3`,
  )
    .bind(since)
    .all<TopSite>();

  const criticalSites = await env.DB.prepare(
    `SELECT s.name, COUNT(*) AS alert_count
     FROM sites s
     JOIN meters m ON m.site_id = s.id
     JOIN alerts a ON a.meter_id = m.id
     WHERE a.severity = 'CRITICAL' AND a.status = 'OPEN'
     GROUP BY s.id
     ORDER BY alert_count DESC`,
  )
    .all<CriticalSite>();

  return json(
    {
      total_kwh: summary.total_kwh,
      peak_demand_kw: summary.peak_demand_kw,
      new_alerts: summary.new_alerts,
      acknowledged_alerts: summary.acknowledged_alerts,
      top_sites: topSites.results ?? [],
      critical_sites: criticalSites.results ?? [],
    },
    200,
  );
};