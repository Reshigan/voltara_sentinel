# Decisions

- [review] Review found a problem: Contract requires UUID v4 TEXT primary keys; generated code uses integer autoincrement IDs. (+19 more). Fixing.
- [review] Review found a problem: The build brief specifies SQLite via better-sqlite3 with a Docker deployment, but the code uses D1Database (Cloudflare Workers) and wrangler.jsonc — the entire runtime is wrong; the app cannot run under `docker run` as required. (+24 more). Fixing.
- [review] Review found a problem: IDs are `number` in the shared contract but the brief mandates UUID v4 TEXT PKs. (+67 more). Fixing.
- [review] Design scores 2/10 against a world-class bar