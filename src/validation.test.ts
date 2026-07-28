import assert from "node:assert";
import test from "node:test";
import {
  validateCreateSite,
  validateUpdateSite,
  validateCreateMeter,
  validateUpdateMeter,
  validateCreateReading,
  validateCreateTariff,
  validateUpdateTariff,
  validateCreateAlert,
  validateUpdateAlert,
  validateUuid,
  validateSerial,
  validateTimestamp,
  validateEnum,
  validateRange,
} from "./validation";

test("validateCreateSite accepts valid site", () => {
  const result = validateCreateSite({
    name: "North Substation",
    region: "NORTH",
    capacity_kw: 500,
  });
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.data?.name, "North Substation");
  assert.strictEqual(result.data?.region, "NORTH");
  assert.strictEqual(result.data?.capacity_kw, 500);
});

test("validateCreateSite rejects missing and invalid fields", () => {
  const result = validateCreateSite({
    name: "",
    region: "",
    capacity_kw: -1,
  });
  assert.strictEqual(result.ok, false);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes("name"));
  assert.ok(fields.includes("region"));
  assert.ok(fields.includes("capacity_kw"));
});

test("validateUpdateSite accepts partial updates", () => {
  const result = validateUpdateSite({ name: "Renamed Site" });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data?.name, "Renamed Site");
});

test("validateUpdateSite rejects negative capacity", () => {
  const result = validateUpdateSite({ capacity_kw: -10 });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "capacity_kw"));
});

test("validateCreateMeter accepts valid meter", () => {
  const result = validateCreateMeter({
    serial: "MTR001",
    site_id: "550e8400-e29b-41d4-a716-446655440000",
    kind: "ELECTRIC",
    status: "ACTIVE",
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data?.serial, "MTR001");
  assert.strictEqual(result.data?.kind, "ELECTRIC");
});

test("validateCreateMeter rejects short serial and invalid enums", () => {
  const result = validateCreateMeter({
    serial: "SHORT",
    site_id: "not-a-uuid",
    kind: "WIND",
    status: "BROKEN",
  });
  assert.strictEqual(result.ok, false);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes("serial"));
  assert.ok(fields.includes("site_id"));
  assert.ok(fields.includes("kind"));
  assert.ok(fields.includes("status"));
});

test("validateUpdateMeter accepts status change", () => {
  const result = validateUpdateMeter({ status: "FAULT" });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data?.status, "FAULT");
});

test("validateCreateReading accepts valid reading", () => {
  const result = validateCreateReading({
    meter_id: "550e8400-e29b-41d4-a716-446655440000",
    kwh: 125.5,
    demand_kw: 45.2,
    taken_at: "2025-01-16T10:00:00Z",
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data?.kwh, 125.5);
});

test("validateCreateReading rejects negative kwh and bad timestamp", () => {
  const result = validateCreateReading({
    meter_id: "550e8400-e29b-41d4-a716-446655440000",
    kwh: -1,
    demand_kw: -5,
    taken_at: "not-a-date",
  });
  assert.strictEqual(result.ok, false);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes("kwh"));
  assert.ok(fields.includes("demand_kw"));
  assert.ok(fields.includes("taken_at"));
});

test("validateCreateTariff accepts valid tariff", () => {
  const result = validateCreateTariff({
    name: "Peak Industrial",
    rate_per_kwh: 0.15,
    band: "PEAK",
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data?.band, "PEAK");
});

test("validateCreateTariff rejects invalid rate and band", () => {
  const result = validateCreateTariff({
    name: "Bad Tariff",
    rate_per_kwh: 0,
    band: "NIGHT",
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "rate_per_kwh"));
  assert.ok(result.errors.some((e) => e.field === "band"));
});

test("validateCreateAlert accepts valid alert", () => {
  const result = validateCreateAlert({
    meter_id: "550e8400-e29b-41d4-a716-446655440000",
    severity: "WARNING",
    message: "Consumption anomaly detected",
    opened_at: "2025-01-16T10:00:00Z",
    status: "OPEN",
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data?.severity, "WARNING");
});

test("validateCreateAlert rejects invalid severity and status", () => {
  const result = validateCreateAlert({
    meter_id: "550e8400-e29b-41d4-a716-446655440000",
    severity: "LOW",
    message: "",
    opened_at: "invalid",
    status: "DONE",
  });
  assert.strictEqual(result.ok, false);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes("severity"));
  assert.ok(fields.includes("message"));
  assert.ok(fields.includes("opened_at"));
  assert.ok(fields.includes("status"));
});

test("validateUpdateAlert accepts acknowledge with timestamp", () => {
  const result = validateUpdateAlert({
    status: "ACKNOWLEDGED",
    acknowledged_at: "2025-01-16T11:00:00Z",
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data?.status, "ACKNOWLEDGED");
});

test("validateUuid enforces UUID v4 format", () => {
  assert.strictEqual(validateUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.strictEqual(validateUuid("not-a-uuid"), false);
  assert.strictEqual(validateUuid("550e8400-e29b-41d4-a716-44665544000"), false);
  assert.strictEqual(validateUuid(""), false);
});

test("validateSerial enforces length 6-20", () => {
  assert.strictEqual(validateSerial("MTR001"), true);
  assert.strictEqual(validateSerial("A".repeat(20)), true);
  assert.strictEqual(validateSerial("SHORT"), false);
  assert.strictEqual(validateSerial("A".repeat(21)), false);
});

test("validateTimestamp enforces ISO 8601", () => {
  assert.strictEqual(validateTimestamp("2025-01-16T10:00:00Z"), true);
  assert.strictEqual(validateTimestamp("2025-01-16T10:00:00+00:00"), true);
  assert.strictEqual(validateTimestamp("2025-01-16"), false);
  assert.strictEqual(validateTimestamp("not-a-date"), false);
});

test("validateEnum restricts values", () => {
  assert.strictEqual(validateEnum("ACTIVE", ["ACTIVE", "INACTIVE", "FAULT"]), true);
  assert.strictEqual(validateEnum("UNKNOWN", ["ACTIVE", "INACTIVE", "FAULT"]), false);
});

test("validateRange checks inclusive numeric bounds", () => {
  assert.strictEqual(validateRange(0, 0, 100), true);
  assert.strictEqual(validateRange(100, 0, 100), true);
  assert.strictEqual(validateRange(-1, 0, 100), false);
  assert.strictEqual(validateRange(101, 0, 100), false);
});

test("validateRange supports exclusive lower bound", () => {
  assert.strictEqual(validateRange(0.01, 0, 1, true), true);
  assert.strictEqual(validateRange(0, 0, 1, true), false);
});
