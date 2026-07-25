CREATE TABLE IF NOT EXISTS site (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  capacity_kw REAL NOT NULL CHECK(capacity_kw >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tariff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rate_per_kwh REAL NOT NULL CHECK(rate_per_kwh > 0),
  band TEXT NOT NULL CHECK(band IN ('OFF_PEAK', 'SHOULDER', 'PEAK')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meter (
  id TEXT PRIMARY KEY,
  serial TEXT NOT NULL UNIQUE CHECK(length(serial) BETWEEN 6 AND 20),
  site_id TEXT NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('ELECTRIC', 'GAS', 'WATER', 'SOLAR')),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'INACTIVE', 'FAULT')),
  tariff_id TEXT REFERENCES tariff(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reading (
  id TEXT PRIMARY KEY,
  meter_id TEXT NOT NULL REFERENCES meter(id) ON DELETE CASCADE,
  kwh REAL NOT NULL CHECK(kwh >= 0),
  demand_kw REAL NOT NULL CHECK(demand_kw >= 0),
  taken_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reading_meter_taken ON reading(meter_id, taken_at);
CREATE INDEX IF NOT EXISTS idx_reading_taken ON reading(taken_at);

CREATE TABLE IF NOT EXISTS alert (
  id TEXT PRIMARY KEY,
  meter_id TEXT NOT NULL REFERENCES meter(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK(severity IN ('INFO', 'WARNING', 'CRITICAL')),
  message TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('OPEN', 'ACKNOWLEDGED', 'CLOSED')),
  acknowledged_at TEXT,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_alert_status ON alert(status);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('meter', 'alert')),
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
