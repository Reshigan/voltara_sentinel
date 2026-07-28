# Voltara Energy Management

Voltara is a self-contained, edge-deployed energy monitoring platform for utility operations teams. It runs entirely on Cloudflare Workers with a D1 SQLite database and static assets served from the same Worker. The dashboard lets regional operators review substation health, manage sites, meters, readings, tariffs and alerts, and bulk-import historical data — all behind an existing VPN or reverse proxy.

## Prerequisites

- A Cloudflare account with Workers and D1 enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) v3 or later
- [Bun](https://bun.sh) for local development and tests

## Local development

```bash
bun install
wrangler d1 create voltara-db
```

Copy the database ID into `wrangler.toml` under `[[d1_databases]]`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "voltara-db"
database_id = "your-database-id"
```

Create the schema in your local D1 database:

```bash
wrangler d1 execute voltara-db --file=./migrations/0001_init.sql --local
wrangler d1 execute voltara-db --file=./migrations/0002_seed.sql --local
```

Start the local development server:

```bash
wrangler dev
```

Open `http://localhost:8787`.

## Running tests

```bash
bun test
```

Tests use `src/db.test.ts`, `src/validation.test.ts`, and the other `*.test.ts` files in `src/`. They run with Node's built-in test runner via `tsx`.

## Deployment

```bash
wrangler deploy
```

This publishes the Worker and uploads the static assets in `public/`.

### Migrations on the remote database

```bash
wrangler d1 execute voltara-db --file=./migrations/0001_init.sql --remote
wrangler d1 execute voltara-db --file=./migrations/0002_seed.sql --remote
```

Add new migrations in `migrations/` and apply them in the same sequential order on both local and remote databases.

## Architecture

- **Entry point:** `src/index.ts` — a single Cloudflare Worker fetch handler routing API calls and falling back to the `ASSETS` binding for static files.
- **Database:** Cloudflare D1 (`env.DB`), an SQLite-compatible database at the edge.
- **API server:** Hand-rolled router in `src/lib/http.ts`, no external framework.
- **Frontend:** Single-page application in `public/index.html`, `public/styles.css` and `public/app.js`, served as static assets. No build step.
- **Domain modules:**
  - `src/routes/*.ts` — REST endpoints for sites, meters, readings, tariffs, alerts, dashboard KPIs, daily digest and health.
  - `src/validation.ts` — shared input validators (UUIDs, enums, serial format, ISO 8601 timestamps, numeric ranges).
  - `src/db.ts` — D1 helpers and query builders.
  - `src/errors.ts` — structured error classes and response formatting.
  - `src/anomaly.ts` — synchronous z-score anomaly detection on reading insert.
  - `src/audit.ts` — append-only audit logging for meter and alert status changes.
  - `src/csv.ts` — CSV parsing helpers used by `POST /api/readings/import`.

## CSV import

Use the Python script in `tools/import_readings.py` or POST a multipart CSV directly:

```bash
curl -X POST http://localhost:8787/api/readings/import \
  -F file=@readings.csv
```

Expected CSV columns: `meter_id`, `kwh`, `demand_kw`, `taken_at`. The endpoint returns `{ imported: number, errors: [{ row, message }] }`. Inserts are batched in transactions of 500 rows.

## Security note

Voltara v1 is intentionally single-tenant and unauthenticated. Anyone with network access to the deployed Worker can read or mutate data. Always place it behind your organisation's existing VPN or a reverse proxy with authentication (e.g. Cloudflare Access, nginx basic auth). The health endpoint at `GET /api/health` intentionally returns only status metadata and no operational data.

No credentials, secrets or API keys are committed to this repository. The CI workflow scans for credential-shaped strings and fails the build if any are found.

## API endpoint reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check: status, DB connectivity, uptime |
| GET | `/api/dashboard` | KPIs and site cards with live-derived totals |
| GET | `/api/digest` | 24-hour summary for the morning briefing |
| GET | `/api/sites` | List sites |
| POST | `/api/sites` | Create a site |
| GET | `/api/sites/:id` | Get a site |
| PUT | `/api/sites/:id` | Update a site |
| DELETE | `/api/sites/:id` | Delete a site |
| GET | `/api/meters` | List meters |
| POST | `/api/meters` | Create a meter |
| GET | `/api/meters/:id` | Get a meter |
| PUT | `/api/meters/:id` | Update a meter |
| DELETE | `/api/meters/:id` | Delete a meter |
| GET | `/api/readings` | List readings |
| POST | `/api/readings` | Create a reading (runs anomaly detection) |
| POST | `/api/readings/import` | Bulk import readings from CSV |
| GET | `/api/tariffs` | List tariffs |
| POST | `/api/tariffs` | Create a tariff |
| GET | `/api/tariffs/:id` | Get a tariff |
| PUT | `/api/tariffs/:id` | Update a tariff |
| DELETE | `/api/tariffs/:id` | Delete a tariff |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create an alert |
| GET | `/api/alerts/:id` | Get an alert |
| PUT | `/api/alerts/:id` | Update an alert (acknowledge/close) |
| DELETE | `/api/alerts/:id` | Delete an alert |

## License

Internal use only — not open source.
