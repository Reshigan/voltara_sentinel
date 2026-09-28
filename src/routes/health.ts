import type { HealthHandler } from "../contract";
import { json } from "../lib/http";

export const health: HealthHandler = async (_req, env) => {
  await env.DB.prepare("SELECT 1").first();
  return json({ status: "ok", db: "connected", uptime: Date.now() });
};
