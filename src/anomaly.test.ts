import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateAnomaly } from "./anomaly";
import type { Reading } from "./lib/contract";

describe("anomaly", () => {
  it("returns null when fewer than 2 readings exist", () => {
    const result = evaluateAnomaly("meter-1", 99, [reading(100, "2025-01-01T00:00:00Z")]);
    assert.equal(result, null);
  });

  it("returns null when reading history is empty", () => {
    const result = evaluateAnomaly("meter-1", 99, []);
    assert.equal(result, null);
  });

  it("creates an alert when z-score exceeds 3", () => {
    const history = Array.from({ length: 30 }, (_, i) => reading(100, `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    const result = evaluateAnomaly("meter-1", 400, history);
    assert.notEqual(result, null);
    if (result === null) return;
    assert.equal(result.meter_id, "meter-1");
    assert.equal(result.severity, "WARNING");
    assert.equal(result.status, "OPEN");
    assert.match(result.message, /Consumption anomaly detected/);
  });

  it("returns null when z-score is within 3 standard deviations", () => {
    const history = Array.from({ length: 30 }, (_, i) => reading(100 + i * 0.1, `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    const result = evaluateAnomaly("meter-1", 101, history);
    assert.equal(result, null);
  });

  it("computes mean and standard deviation correctly", () => {
    // Exactly two readings of 100 and 200 => mean 150, stddev ~70.71.
    // A value of 400 is z-score ~3.54, which is > 3.
    const history = [
      reading(100, "2025-01-01T00:00:00Z"),
      reading(200, "2025-01-02T00:00:00Z"),
    ];
    const result = evaluateAnomaly("meter-1", 400, history);
    assert.notEqual(result, null);
    if (result === null) return;
    assert.match(result.message, /400/);
    assert.match(result.message, /150/);
  });
});

function reading(kwh: number, taken_at: string): Reading {
  return {
    id: crypto.randomUUID(),
    meter_id: "meter-1",
    kwh,
    demand_kw: 0,
    taken_at,
    created_at: taken_at,
  };
}
