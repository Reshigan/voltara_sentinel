import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  query,
  execute,
  runInTx,
  type D1Database,
  type D1Result,
} from "./db";

function createMockDb(): D1Database {
  const memory = new Map<string, { id: string; value: string; amount: number }>();
  return {
    prepare: (sql: string) => {
      const params: unknown[] = [];
      const statement = {
        bind: (...args: unknown[]) => {
          params.push(...args);
          return statement;
        },
        all: async (): Promise<D1Result<Record<string, unknown>>> => {
          const lowered = sql.trim().toLowerCase();
          if (lowered.startsWith("select * from items where id = ?")) {
            const id = String(params[0]);
            const row = memory.get(id);
            return { results: row ? [row] : [], success: true, meta: {} };
          }
          if (lowered.startsWith("select * from items")) {
            return { results: Array.from(memory.values()), success: true, meta: {} };
          }
          if (lowered.startsWith("select count(*) as cnt from items")) {
            return { results: [{ cnt: memory.size }], success: true, meta: {} };
          }
          return { results: [], success: true, meta: {} };
        },
        run: async (): Promise<D1Result<never>> => {
          const lowered = sql.trim().toLowerCase();
          if (lowered.startsWith("insert into items")) {
            const id = String(params[0]);
            memory.set(id, { id, value: String(params[1]), amount: Number(params[2]) });
            return { success: true, meta: { changes: 1 } };
          }
          if (lowered.startsWith("update items set value = ? where id = ?")) {
            const id = String(params[1]);
            const existing = memory.get(id);
            if (existing) {
              memory.set(id, { ...existing, value: String(params[0]) });
            }
            return { success: true, meta: { changes: existing ? 1 : 0 } };
          }
          if (lowered.startsWith("delete from items where id = ?")) {
            const id = String(params[0]);
            const removed = memory.delete(id);
            return { success: true, meta: { changes: removed ? 1 : 0 } };
          }
          return { success: true, meta: {} };
        },
      };
      return statement;
    },
    batch: async <T>(statements: { all?(): Promise<D1Result<T>>; run?(): Promise<D1Result<T>> }[]) => {
      const results: D1Result<T>[] = [];
      for (const s of statements) {
        if (s.all) {
          results.push(await s.all());
        } else if (s.run) {
          results.push(await s.run());
        }
      }
      return results;
    },
  } as D1Database;
}

describe("db helpers", () => {
  let db: D1Database;

  beforeEach(() => {
    db = createMockDb();
  });

  it("query returns typed rows", async () => {
    await execute(db, "INSERT INTO items (id, value, amount) VALUES (?, ?, ?)", [
      "a1",
      "hello",
      42,
    ]);
    const rows = await query<{ id: string; value: string; amount: number }>(
      db,
      "SELECT * FROM items WHERE id = ?",
      ["a1"]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "a1");
    assert.equal(rows[0].value, "hello");
    assert.equal(rows[0].amount, 42);
  });

  it("execute returns result with changes", async () => {
    const result = await execute(db, "INSERT INTO items (id, value, amount) VALUES (?, ?, ?)", [
      "b2",
      "world",
      7,
    ]);
    assert.equal(result.changes, 1);
  });

  it("parameterized queries prevent injection", async () => {
    await execute(db, "INSERT INTO items (id, value, amount) VALUES (?, ?, ?)", [
      "safe",
      "or 1=1",
      1,
    ]);
    const rows = await query<{ id: string }>(db, "SELECT * FROM items WHERE id = ?", ["safe"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "safe");
    const none = await query<{ id: string }>(db, "SELECT * FROM items WHERE id = ?", ["or 1=1"]);
    assert.equal(none.length, 0);
  });

  it("runInTx rolls back on error", async () => {
    let committed = false;
    await assert.rejects(
      runInTx(db, async () => {
        await execute(db, "INSERT INTO items (id, value, amount) VALUES (?, ?, ?)", [
          "tx1",
          "first",
          10,
        ]);
        throw new Error("forced rollback");
      }),
      /forced rollback/
    );
    committed = true;
    const rows = await query<{ id: string }>(db, "SELECT * FROM items WHERE id = ?", ["tx1"]);
    assert.equal(rows.length, 0);
    assert.equal(committed, true);
  });

  it("runInTx returns value on success", async () => {
    const value = await runInTx(db, async () => {
      await execute(db, "INSERT INTO items (id, value, amount) VALUES (?, ?, ?)", [
        "tx2",
        "second",
        20,
      ]);
      return "ok";
    });
    assert.equal(value, "ok");
    const rows = await query<{ id: string }>(db, "SELECT * FROM items WHERE id = ?", ["tx2"]);
    assert.equal(rows.length, 1);
  });
});
