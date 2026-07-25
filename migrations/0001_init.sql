-- GENERATED schema.
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  region TEXT,
  capacity_kw REAL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS meters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default',
  serial TEXT,
  site_id INTEGER,
  kind TEXT,
  status TEXT,
  tariff_id INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default',
  meter_id INTEGER,
  kwh REAL,
  demand_kw REAL,
  taken_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS tariffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  rate_per_kwh REAL,
  band TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default',
  meter_id INTEGER,
  severity TEXT,
  message TEXT,
  opened_at TEXT,
  status TEXT,
  acknowledged_at TEXT,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default',
  entity_type TEXT,
  entity_id INTEGER,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT
);
