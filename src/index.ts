// FROZEN — Sentinel golden template. Do not edit; write handlers in src/handlers/.
import { routes } from "./routes";
import { json, matchRoute, type Env } from "./lib/http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hit = matchRoute(routes, request.method, url.pathname);
    if (hit) {
      try {
        return await hit.route.handler(request, env, hit.params);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
