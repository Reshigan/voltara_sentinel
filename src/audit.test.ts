import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { logChange } from "./audit";
import type { D1Database } from "./db";

interface BoundArgs {
  values: unknown[];
}

class FakeStatement {
  constructor(private args: BoundArgs[]) {}

  bind(...values: unknown[]) {
    this.args.push({ values });
    return this;
  }

  async run() {
    return { meta: { last_row_id: 1, changes: 1 }, results: [], success: true };
  }
}

function makeFakeDb(): { db: D1Database; bindings: BoundArgs[] } {
  const bindings: BoundArgs[] = [];
  const db = {
    prepare(sql: string) {
      return new FakeStatement(bindings) as ReturnType<D1Database["prepare"]>;
    },
  } as D1Database;
  return { db, bindings };
}

describe("logChange", () => {
  it("inserts an audit row with the correct fields", async () => {
    const { db, bindings } = makeFakeDb();

    await logChange(db, {
      entityType: "meter",
      entityId: "meter-123",
      field: "status",
      oldValue: "ACTIVE",
      newValue: "FAULT",
    });

    assert.equal(bindings.length, 1);
    const [row] = bindings[0].values;
    assert.equal(typeof row, "string");
    assert.equal(bindings[0].values[1], "meter");
    assert.equal(bindings[0].values[2], "meter-123");
    assert.equal(bindings[0].values[3], "status");
    assert.equal(bindings[0].values[4], "ACTIVE");
    assert.equal(bindings[0].values[5], "FAULT");
  });

  it("handles a null old value", async () => {
    const { db, bindings } = makeFakeDb();

    await logChange(db, {
      entityType: "alert",
      entityId: "alert-456",
      field: "status",
      oldValue: null,
      newValue: "ACKNOWLEDGED",
    });

    assert.equal(bindings.length, 1);
    assert.equal(bindings[0].values[1], "alert");
    assert.equal(bindings[0].values[2], "alert-456");
    assert.equal(bindings[0].values[3], "status");
    assert.equal(bindings[0].values[4], null);
    assert.equal(bindings[0].values[5], "ACKNOWLEDGED");
  });

  it("uses an ISO 8601 timestamp", async () => {
    const { db, bindings } = makeFakeDb();
    const before = new Date().toISOString();

    await logChange(db, {
      entityType: "meter",
      entityId: "meter-789",
      field: "status",
      oldValue: "INACTIVE",
      newValue: "ACTIVE",
    });

    const after = new Date().toISOString();
    const ts = bindings[0].values[6];
    assert.equal(typeof ts, "string");
    assert.ok(ts >= before && ts <= after, `timestamp ${ts} not in expected range`);
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    assert.ok(iso.test(ts as string), `timestamp ${ts} is not ISO 8601`);
  });
});
