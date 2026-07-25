// FROZEN — Sentinel golden template. Shared HTTP plumbing for every handler.
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export type Params = Record<string, string>;

/** A Response that also carries, at the type level only, the JSON body it was
 * built from. json<T>() stamps it; a handler typed Handler<T> must return it.
 * This is the ONE place TypeScript can see the API's JSON shape — a bare
 * Response erases it, and every cross-file drift the fix loop used to thrash on
 * lived in that blind spot. Phantom field: never present at runtime. */
export type Json<T> = Response & { readonly __body?: T };

export type Handler<R = unknown> = (
  request: Request,
  env: Env,
  params: Params,
) => Json<R> | Promise<Json<R>>;

export interface Route {
  /** Uppercase HTTP method: "GET", "POST", ... */
  method: string;
  /** Path pattern; ":name" segments capture into params. e.g. "/api/meters/:id" */
  path: string;
  handler: Handler;
}

/** JSON response with correct content-type. The return type remembers T, so a
 * handler declared Handler<Foo> that json()s the wrong shape fails typecheck. */
export function json<T>(data: T, status = 200): Json<T> {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  }) as Json<T>;
}

/** Parse a JSON request body; returns null on missing/invalid JSON. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Resolve the tenant for a request — every generated app is multi-tenant:
 * reads filter by this, writes stamp it. Order: ?tenant= query, X-Tenant
 * header, else "default". */
export function tenantOf(request: Request): string {
  const q = new URL(request.url).searchParams.get("tenant");
  return q || request.headers.get("x-tenant") || "default";
}

/** Match method + pathname against the route table. First match wins. */
export function matchRoute(
  routes: readonly Route[],
  method: string,
  pathname: string,
): { route: Route; params: Params } | null {
  const parts = pathname.split("/").filter(Boolean);
  for (const route of routes) {
    if (route.method !== method) continue;
    const pattern = route.path.split("/").filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params: Params = {};
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i]!;
      if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(parts[i]!);
      else if (p !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}
