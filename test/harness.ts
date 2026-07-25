// FROZEN — Sentinel golden template. Test harness: boots the Worker's fetch
// handler against a real in-memory D1 (SCHEMA migrations applied in path order;
// seed migrations skipped) and a filesystem-backed ASSETS shim. Tests call
// request() like a browser would.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import worker from "../src/index";
import type { Env } from "../src/lib/http";
import { D1Shim } from "./d1";

const ROOT = join(import.meta.dir, "..");

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js") || path.endsWith(".ts")) return "text/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

const assets: Env["ASSETS"] = {
  async fetch(input: RequestInfo | URL): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = join(ROOT, "public", rel);
    if (!existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(readFileSync(file), { headers: { "content-type": contentType(rel) } });
  },
} as Env["ASSETS"];

/** Fresh app per call: new in-memory DB with every SCHEMA migration applied.
 * Seed migrations (name contains "seed") are skipped — they load demo rows for
 * the live deploy, but a pre-seeded DB breaks every "empty state" assertion.
 * Tests insert their own fixtures. */
export function makeEnv(): Env {
  const db = new D1Shim();
  const dir = join(ROOT, "migrations");
  if (existsSync(dir)) {
    const schema = readdirSync(dir).filter((n) => n.endsWith(".sql") && !/seed/i.test(n)).sort();
    for (const name of schema) {
      db.db.exec(readFileSync(join(dir, name), "utf8"));
    }
  }
  return { DB: db as unknown as Env["DB"], ASSETS: assets };
}

/** Run one request through the Worker exactly as deployed. */
export async function request(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: () => Promise<unknown>; text: () => Promise<string> }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  return worker.fetch(new Request(`http://app.local${path}`, init), env);
}
