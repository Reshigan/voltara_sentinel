import type { Env } from "./lib/http";

export async function logChange(
  env: Env,
  entityType: "meter" | "alert",
  entityId: string,
  field: string,
  oldValue: string | null | undefined,
  newValue: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_log (id, entity_type, entity_id, field, old_value, new_value, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(crypto.randomUUID(), entityType, entityId, field, oldValue ?? null, newValue)
    .run();
}
