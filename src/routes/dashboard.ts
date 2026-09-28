import { json } from "../lib/http";
import type { DashboardHandler } from "../types";

export const getDashboard: DashboardHandler = async (_req, env) => {
  const result = await env.DB.prepare(`
    WITH
      kpi AS (
        SELECT
          (SELECT COUNT(*) FROM site) AS total_sites,
          (SELECT COUNT(*) FROM meter WHERE status = 'ACTIVE') AS active_meters,
          (
            SELECT COALESCE(SUM(r.kwh), 0)
            FROM reading r
            JOIN meter m ON m.id = r.meter_id
            WHERE date(r.taken_at) = date('now')
          ) AS daily_kwh,
          (SELECT COUNT(*) FROM alert WHERE status = 'OPEN') AS open_alerts
      ),
      site_meters AS (
        SELECT
          s.id,
          s.name,
          s.region,
          s.capacity_kw,
          COUNT(m.id) AS meter_count,
          SUM(CASE WHEN m.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_meter_count,
          MAX(
            CASE
              WHEN m.status = 'FAULT' THEN 3
              WHEN a.status = 'OPEN' AND a.severity = 'CRITICAL' THEN 3
              WHEN a.status = 'OPEN' AND a.severity = 'WARNING' THEN 2
              WHEN a.status = 'OPEN' AND a.severity = 'INFO' THEN 1
              ELSE 0
            END
          ) AS status_rank
        FROM site s
        LEFT JOIN meter m ON m.site_id = s.id
        LEFT JOIN alert a ON a.meter_id = m.id AND a.status = 'OPEN'
        GROUP BY s.id, s.name, s.region, s.capacity_kw
      ),
      site_readings AS (
        SELECT
          s.id AS site_id,
          COALESCE(SUM(r.kwh), 0) AS total_kwh
        FROM site s
        LEFT JOIN meter m ON m.site_id = s.id
        LEFT JOIN reading r ON r.meter_id = m.id
        GROUP BY s.id
      )
    SELECT
      k.total_sites,
      k.active_meters,
      k.daily_kwh,
      k.open_alerts,
      sm.id,
      sm.name,
      sm.region,
      sm.capacity_kw,
      sm.active_meter_count,
      COALESCE(sr.total_kwh, 0) AS total_kwh,
      CASE sm.status_rank
        WHEN 3 THEN 'CRITICAL'
        WHEN 2 THEN 'WARNING'
        WHEN 1 THEN 'INFO'
        ELSE 'HEALTHY'
      END AS status
    FROM kpi k
    CROSS JOIN site_meters sm
    LEFT JOIN site_readings sr ON sr.site_id = sm.id
    ORDER BY sm.name
  `).all();

  const rows = result.results ?? [];
  const kpi = rows.length > 0 ? rows[0] : {
    total_sites: 0,
    active_meters: 0,
    daily_kwh: 0,
    open_alerts: 0,
  };

  const sites = rows.map((row) => ({
    id: row.id,
    name: row.name,
    region: row.region,
    capacity_kw: row.capacity_kw,
    status: row.status,
    active_meter_count: row.active_meter_count,
    total_kwh: row.total_kwh,
  }));

  return json({
    kpis: {
      total_sites: kpi.total_sites,
      active_meters: kpi.active_meters,
      daily_kwh: kpi.daily_kwh,
      open_alerts: kpi.open_alerts,
    },
    sites,
  });
};
