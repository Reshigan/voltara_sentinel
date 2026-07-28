import { describe, it } from "node:test";
import assert from "node:assert";
import { parseReadingsCsv, CsvReadingRow } from "./csv";

describe("csv", () => {
  it("parses a valid CSV with headers", () => {
    const csv = `meter_id,kwh,demand_kw,taken_at
METER-1,12.5,4.2,2025-01-16T10:00:00Z
METER-2,8.0,2.1,2025-01-16T11:00:00Z`;
    const { rows, errors } = parseReadingsCsv(csv);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows[0], {
      meter_id: "METER-1",
      kwh: 12.5,
      demand_kw: 4.2,
      taken_at: "2025-01-16T10:00:00Z",
    } as CsvReadingRow);
    assert.deepStrictEqual(rows[1], {
      meter_id: "METER-2",
      kwh: 8,
      demand_kw: 2.1,
      taken_at: "2025-01-16T11:00:00Z",
    } as CsvReadingRow);
  });

  it("handles quoted fields containing commas", () => {
    const csv = `meter_id,kwh,demand_kw,taken_at
"METER-1, rev-A",12.5,4.2,2025-01-16T10:00:00Z`;
    const { rows, errors } = parseReadingsCsv(csv);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].meter_id, "METER-1, rev-A");
  });

  it("handles quoted fields containing newlines", () => {
    const csv = `meter_id,kwh,demand_kw,taken_at
"METER-1\nline2",12.5,4.2,2025-01-16T10:00:00Z`;
    const { rows, errors } = parseReadingsCsv(csv);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].meter_id, "METER-1\nline2");
  });

  it("rejects CSV missing a required column", () => {
    const csv = `meter_id,kwh,demand_kw
METER-1,12.5,4.2`;
    const { rows, errors } = parseReadingsCsv(csv);
    assert.strictEqual(rows.length, 0);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /missing required columns/i);
  });

  it("yields the correct row count for 10k rows", () => {
    const header = "meter_id,kwh,demand_kw,taken_at";
    const line = "METER-1,1.0,0.5,2025-01-16T10:00:00Z";
    const body = Array.from({ length: 10000 }, () => line).join("\n");
    const { rows, errors } = parseReadingsCsv(`${header}\n${body}`);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(rows.length, 10000);
    assert.strictEqual(rows[9999].kwh, 1);
  });

  it("reports errors for malformed numeric values", () => {
    const csv = `meter_id,kwh,demand_kw,taken_at
METER-1,not-a-number,4.2,2025-01-16T10:00:00Z`;
    const { rows, errors } = parseReadingsCsv(csv);
    assert.strictEqual(rows.length, 0);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].row, 2);
    assert.match(errors[0].message, /kwh/i);
  });
});
