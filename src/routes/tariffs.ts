import { z } from "zod";
import type { Env } from "../db";
import { json, notFound } from "../lib/http";
import type { Tariff } from "../types";

const tariffInput = z.object({
  name: z.string().min(1),
  rate_per_kwh: z.number().positive(),
  band: z.enum(["OFF_PEAK", "SHOULDER", "PEAK"]),
});

const csp = (db: Env["DB"], sql: string, params?: unknown[]) =>
  db.prepare(sql).bind(...(params ?? []));

export default [
  {
    method: "GET",
    path: "/api/tariffs",
    handler: async (_request: Request, env: Env) => {
      const { results } = await env.DB.prepare("SELECT * FROM tariff ORDER BY name").all<Tariff>();
      return json(results ?? []);
    },
  },
  {
    method: "POST",
    path: "/api/tariffs",
    handler: async (request: Request, env: Env) => {
      const body = await request.json();
      const parsed = tariffInput.safeParse(body);
      if (!parsed.success) {
        return json({ error: parsed.error.message }, 400);
      }
      const { name, rate_per_kwh, band } = parsed.data;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      try {
        await env.DB.prepare(
          "INSERT INTO tariff (id, name, rate_per_kwh, band, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(id, name, rate_per_kwh, band, now, now).run();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/UNIQUE/.test(message)) {
          return json({ error: "duplicate tariff name" }, 409);
        }
        throw err;
      }
      return json({ id, name, rate_per_kwh, band, created_at: now, updated_at: now }, 201);
    },
  },
  {
    method: "GET",
    path: "/api/tariffs/:id",
    handler: async (_request: Request, env: Env, params: Record<string, string>) => {
      const row = await csp(env.DB, "SELECT * FROM tariff WHERE id = ?", [params.id]).first<Tariff>();
      if (!row) return notFound();
      return json(row);
    },
  },
  {
    method: "PUT",
    path: "/api/tariffs/:id",
    handler: async (request: Request, env: Env, params: Record<string, string>) => {
      const body = await request.json();
      const parsed = tariffInput.partial().safeParse(body);
      if (!parsed.success) {
        return json({ error: parsed.error.message }, 400);
      }
      const updates = parsed.data;
      const existing = await csp(env.DB, "SELECT * FROM tariff WHERE id = ?", [params.id]).first<Tariff>();
      if (!existing) return notFound();
      const name = updates.name ?? existing.name;
      const rate_per_kwh = updates.rate_per_kwh ?? existing.rate_per_kwh;
      const band = updates.band ?? existing.band;
      const now = new Date().toISOString();
      try {
        await env.DB.prepare(
          "UPDATE tariff SET name = ?, rate_per_kwh = ?, band = ?, updated_at = ? WHERE id = ?"
        ).bind(name, rate_per_kwh, band, now, params.id).run();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/UNIQUE/.test(message)) {
          return json({ error: "duplicate tariff name" }, 409);
        }
        throw err;
      }
      return json({ ...existing, name, rate_per_kwh, band, updated_at: now });
    },
  },
  {
    method: "DELETE",
    path: "/api/tariffs/:id",
    handler: async (_request: Request, env: Env, params: Record<string, string>) => {
      await env.DB.prepare("DELETE FROM tariff WHERE id = ?").bind(params.id).run();
      return json({ deleted: true });
    },
  },
];