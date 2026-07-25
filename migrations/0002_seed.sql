-- GENERATED seed (skipped in tests, applied on deploy).
INSERT INTO sites (name, region, capacity_kw, created_at, updated_at) VALUES ('North Substation', 'North', 500, '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO sites (name, region, capacity_kw, created_at, updated_at) VALUES ('South Depot', 'South', 350, '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO sites (name, region, capacity_kw, created_at, updated_at) VALUES ('East Industrial', 'East', 800, '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO tariffs (name, rate_per_kwh, band, created_at, updated_at) VALUES ('Off-Peak Basic', 0.08, 'OFF_PEAK', '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO tariffs (name, rate_per_kwh, band, created_at, updated_at) VALUES ('Peak Industrial', 0.15, 'PEAK', '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO meters (serial, site_id, kind, status, tariff_id, created_at, updated_at) VALUES ('MTR001', 1, 'ELECTRIC', 'ACTIVE', 1, '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO meters (serial, site_id, kind, status, tariff_id, created_at, updated_at) VALUES ('MTR002', 1, 'GAS', 'ACTIVE', 2, '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO meters (serial, site_id, kind, status, tariff_id, created_at, updated_at) VALUES ('MTR003', 2, 'ELECTRIC', 'ACTIVE', 1, '2025-01-15T08:00:00Z', '2025-01-15T08:00:00Z');
INSERT INTO readings (meter_id, kwh, demand_kw, taken_at, created_at) VALUES (1, 125.5, 45.2, '2025-01-16T10:00:00Z', '2025-01-16T10:00:00Z');
INSERT INTO readings (meter_id, kwh, demand_kw, taken_at, created_at) VALUES (1, 130, 48.1, '2025-01-16T11:00:00Z', '2025-01-16T11:00:00Z');
INSERT INTO readings (meter_id, kwh, demand_kw, taken_at, created_at) VALUES (2, 80.3, 22, '2025-01-16T10:00:00Z', '2025-01-16T10:00:00Z');
INSERT INTO readings (meter_id, kwh, demand_kw, taken_at, created_at) VALUES (3, 200, 75.5, '2025-01-16T10:00:00Z', '2025-01-16T10:00:00Z');
INSERT INTO alerts (meter_id, severity, message, opened_at, status, acknowledged_at, closed_at) VALUES (1, 'WARNING', 'Consumption anomaly detected: 130.0 kWh vs 125.5 kWh average', '2025-01-16T11:00:00Z', 'OPEN', NULL, NULL);
