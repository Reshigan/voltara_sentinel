import type { D1Database, D1Result } from "@cloudflare/workers-types";

export type Env = {
  DB: D1Database;
};

export type Row = Record<string, unknown>;

export async function query<T = Row>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const { results } = await db.prepare(sql).bind(...params).all<T>();
  return results ?? [];
}

export async function execute(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run();
}

export async function runInTx<T>(
  db: D1Database,
  callback: (tx: D1Database) => Promise<T>
): Promise<T> {
  await db.prepare("BEGIN").run();
  try {
    const result = await callback(db);
    await db.prepare("COMMIT").run();
    return result;
  } catch (error) {
    await db.prepare("ROLLBACK").run();
    throw error;
  }
}
