package.json — Project manifest with scripts for dev, build, typecheck, lint, and test using Bun toolchain. Dependencies: hono, better-sqlite3, uuid. DevDependencies: typescript, @types/better-sqlite3, eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, vite, @vitejs/plugin-react, vitest.
tsconfig.json — TypeScript strict mode configuration targeting Node 22 with ESM modules, path aliases for src/, and skipLibCheck for faster builds.
.eslintrc.json — ESLint configuration with TypeScript rules, no-unused-vars, no-console, and strict type-checking. Zero warnings allowed.
.github/workflows/ci.yml — CI pipeline running typecheck, lint, and test on every push. Uses Bun for all steps.
Dockerfile — Multi-stage Docker build: stage 1 builds frontend with Vite, stage 2 runs Node 22 Alpine with better-sqlite3, copies built assets and server code. Entrypoint runs migrations then starts server.
docker-entrypoint.sh — Container entrypoint: sets SQLite file permissions to 0600, runs migrations sequentially, then starts the Node server. Exits non-zero on migration failure.
migrations/0001_init.sql — Initial schema: creates all tables (site, meter, reading, tariff, alert, audit_log, _migrations) with constraints, indexes, and foreign keys. Enables WAL mode, sets pragmas.
migrations/0002_seed.sql — Demo seed data: 3 sites, 5 meters, 2 tariffs, 50 readings, 3 alerts. Provides realistic first-run experience. Skipped in test harness.
src/types.ts — Frozen contract: TypeScript interfaces for all entity rows, API request/response shapes, and Handler type aliases. Single source of truth imported by all other modules.
src/db.ts — Database singleton: initializes better-sqlite3 connection with WAL pragmas, runs pending migrations, exports prepared statement helpers. Closes on SIGTERM.
src/validation.ts — Input validation utilities: UUID format, ISO 8601 timestamps, enum values, numeric ranges, serial format. Returns structured error objects used by handlers.
src/anomaly.ts — Z-score anomaly detection: queries 30-day readings for a meter, computes mean/stddev, returns anomaly flag and message. Called synchronously during reading insert.
src/handlers/sites.ts — Site CRUD handlers: list (cursor pagination), get, create, update, delete. All queries scoped to tenant. Audit logging on status changes. Tests: test/sites.test.ts.
src/handlers/meters.ts — Meter CRUD handlers: list, get, create, update, delete. Validates serial format, enum values. Audit logging on status changes. Tests: test/meters.test.ts.
src/handlers/readings.ts — Reading handlers: list (cursor pagination), get, create, CSV import. Anomaly detection on insert. CSV import batches 500-row transactions. Tests: test/readings.test.ts.
src/handlers/tariffs.ts — Tariff CRUD handlers: list, get, create, update, delete. Validates band enum and rate range. Tests: test/tariffs.test.ts.
src/handlers/alerts.ts — Alert handlers: list, get, update (acknowledge/close), delete. Audit logging on status changes. Tests: test/alerts.test.ts.
src/handlers/dashboard.ts — Dashboard KPI handler: single query returning total_sites, active_meters, daily_kwh, open_alerts, and site cards with derived totals. Tests: test/dashboard.test.ts.
src/handlers/digest.ts — Daily digest handler: structured 24-hour summary with total_kwh, peak_demand, alert counts, top 3 sites, critical sites. Single optimized query. Tests: test/digest.test.ts.
src/handlers/health.ts — Health check handler: returns status, db connectivity, uptime. No authentication required.
src/routes.ts — Route table: maps HTTP method + path patterns to handler functions. Imports all handlers and exports array for Hono router.
src/index.ts — Application entry point: creates Hono app, registers routes, serves static frontend assets, handles graceful shutdown. Listens on PORT env var (default 8080).
src/frontend/index.html — SPA shell: mounts React app, loads Inter font, sets dark theme CSS variables. Single div#root.
src/frontend/main.tsx — React entry: renders App component into DOM, imports global CSS.
src/frontend/App.tsx — Root component: single-page layout with KPI band, site card grid, and modal routing. Manages global state via React context and SWR for data fetching.
src/frontend/api.ts — API client: typed fetch wrappers for all endpoints. Handles error responses, JSON parsing, and query parameter serialization.
src/frontend/components/KpiBand.tsx — KPI band component: horizontal row of 4 metric cards (sites, meters, kWh, alerts). Uses ARIA live region for dynamic updates. Responsive 2x2 grid on mobile.
src/frontend/components/SiteCardGrid.tsx — Site card grid: responsive grid of site cards with status pills, meter counts, and aggregated kWh. Each card clickable to expand detail.
src/frontend/components/StatusPill.tsx — Status pill component: renders colored left-border + text label. Supports meter statuses (active/inactive/fault) and alert severities (info/warning/critical). WCAG AA compliant.
src/frontend/components/EntityList.tsx — Generic entity list component: renders table/grid with empty state, loading state, cursor pagination. Used by meters, readings, tariffs, alerts list views.
src/frontend/components/EntityForm.tsx — Generic form component: create/edit forms with inline validation, error messages linked via aria-describedby, keyboard navigation. Used by all entity CRUD operations.
src/frontend/components/Modal.tsx — Modal component: accessible dialog with focus trapping, Escape to close, focus return on close. Used for detail views, forms, and confirmations.
src/frontend/components/ConfirmDialog.tsx — Confirmation dialog: modal variant with message and confirm/cancel buttons. Used for delete operations.
src/frontend/styles/global.css — Global styles: CSS custom properties for design tokens (colors, spacing, typography), Inter font import, reset styles, dark theme base.
src/frontend/styles/KpiBand.module.css — KPI band styles: horizontal flex layout, metric card styling, responsive breakpoints for 2x2 mobile grid.
src/frontend/styles/SiteCardGrid.module.css — Site card grid styles: CSS grid with auto-fill, card styling with 8px radius, 1px borders, status pill positioning.
src/frontend/styles/StatusPill.module.css — Status pill styles: colored left border variants (green/amber/red), text label styling, WCAG contrast ratios.
src/frontend/styles/EntityList.module.css — Entity list styles: table/grid layout, empty state styling, pagination controls, loading skeleton.
src/frontend/styles/EntityForm.module.css — Form styles: input fields, labels, error messages, validation states, submit button styling.
src/frontend/styles/Modal.module.css — Modal styles: overlay, centered dialog, focus ring, responsive sizing.
test/harness.ts — Test harness: creates in-memory SQLite database with schema migrations (skips seed files), provides makeEnv() and request() helpers for integration tests.
test/sites.test.ts — Site endpoint tests: CRUD operations, validation, pagination, audit logging on status changes. Uses test harness with in-memory DB.
test/meters.test.ts — Meter endpoint tests: CRUD operations, serial validation, enum validation, audit logging. Tests cascade delete from site.
test/readings.test.ts — Reading endpoint tests: CRUD, CSV import with 100-row batch, anomaly detection trigger, pagination. Verifies KPI updates after insert.
test/tariffs.test.ts — Tariff endpoint tests: CRUD operations, band validation, rate validation, unique name constraint.
test/alerts.test.ts — Alert endpoint tests: CRUD, acknowledge flow, audit logging, status transitions. Verifies open-alert count changes.
test/dashboard.test.ts — Dashboard KPI tests: verifies 4 metrics accuracy, site card aggregation, updates after CRUD operations. Performance test with 1000 readings.
test/digest.test.ts — Digest endpoint tests: verifies 24-hour summary structure, top sites ordering, critical sites detection, alert counts.
tools/import_readings.py — Sample Python script for CSV import: reads CSV file, sends multipart/form-data to /api/readings/import endpoint. Demonstrates integration pattern for Priya.
README.md — Project documentation: overview, quick start with docker run, API reference, deployment guide, development setup, testing instructions. All commands runnable as written.