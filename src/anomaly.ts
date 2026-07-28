import type { Env, Alert } from "./types";

const THRESHOLD_Z = 3;
const WINDOW_DAYS = 30;

export async function detectAnomaly(env: Env, meterId: string, newKwh: number): Promise<Omit<Alert, "id"> | null> {
  if (!Number.isFinite(newKwh) || newKwh < 0) return null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);
  const sinceText = since.toISOString();

  const { results } = await env.DB.prepare(
    "SELECT kwh FROM reading WHERE meter_id = ? AND taken_at >= ? ORDER BY taken_at DESC LIMIT 1000"
  )
    .bind(meterId, sinceText)
    .all<{ kwh: number }>();

  const values = results?.map((r) => r.kwh) ?? [];
  if (values.length < 2) return null;

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return null;

  const zScore = (newKwh - mean) / stddev;
  if (Math.abs(zScore) <= THRESHOLD_Z) return null;

  return {
    meter_id: meterId,
    severity: "WARNING",
    message: `Consumption anomaly detected: ${newKwh.toFixed(1)} kWh vs ${mean.toFixed(1)} kWh average`,
    opened_at: new Date().toISOString(),
    status: "OPEN",
  };
}
