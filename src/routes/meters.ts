import { json, type Env, type Handler } from "../lib/http";
import { Database } from "../db";
import { validate } from "../validation";
import { NotFoundError, ValidationError } from "../errors";
import { logAudit } from "../audit";
import { randomUUID } from "crypto";

// Shared contract types (expected from src/lib/http.ts and domain contract)
export type MeterKind = "ELECTRIC" | "GAS" | "WATER" | "SOLAR";
export type MeterStatus = "ACTIVE" | "INACTIVE" | "FAULT";

export interface MeterRow {
  id: string;
  serial: string;
  site_id: string;
  kind: MeterKind;
  status: MeterStatus;
  tariff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeterListItem extends MeterRow {
  site_name: string;
  tariff_name: string | null;
}

export interface MeterWithReadings extends MeterRow {
  site_name: string;
  tariff_name: string | null;
  recent_readings: Array<{
    id: string;
    kwh: number;
    demand_kw: number;
    taken_at: string;
  }>;
}

export interface MetersListQuery {
  cursor?: string;
  limit?: string;
}

export interface MetersCreateBody {
  serial: string;
  site_id: string;
  kind: MeterKind;
  status: MeterStatus;
  tariff_id?: string | null;
}

export interface MetersUpdateBody {
  serial?: string;
  site_id?: string;
  kind?: MeterKind;
  status?: MeterStatus;
  tariff_id?: string | null;
}

export type MetersListHandler = Handler<never, MetersListQuery, MeterListItem[]>;
export type MetersGetHandler = Handler<{ id: string }, never, MeterWithReadings>;
export type MetersCreateHandler = Handler<never, never, MeterRow, MetersCreateBody>;
export type MetersUpdateHandler = Handler<{ id: string }, never, MeterRow, MetersUpdateBody>;
export type MetersDeleteHandler = Handler<{ id: string }, never, { deleted: true }>;

const PAGE_SIZE = 50;
const METER_KINDS: MeterKind[] = ["ELECTRIC", "GAS", "WATER", "SOLAR"];
const METER_STATUSES: MeterStatus[] = ["ACTIVE", "INACTIVE", "FAULT"];

function getDb(env: Env): Database {
  return new Database(env.DB);
}

function parseLimit(raw?: string): number {
  if (!raw) return PAGE_SIZE;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 200) return PAGE_SIZE;
  return n;
}

function validateMeterBody(body: Record<string, unknown>, isUpdate = false): void {
  const errors: Record<string, string> = {};

  if (!isUpdate || body.serial !== undefined) {
    const serial = body.serial;
    if (typeof serial !== "string" || serial.length < 6 || serial.length > 20 || !/^[a-zA-Z0-9._-]+$/.test(serial)) {
      errors.serial = "Serial must be 6-20 alphanumeric characters, dots, dashes, or underscores.";
    }
  }

  if (!isUpdate || body.site_id !== undefined) {
    const siteId = body.site_id;
    if (typeof siteId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(siteId)) {
      errors.site_id = "Site ID must be a valid UUID.";
    }
  }

  if (!isUpdate || body.kind !== undefined) {
    const kind = body.kind;
    if (!METER_KINDS.includes(kind as MeterKind)) {
      errors.kind = "Kind must be one of ELECTRIC, GAS, WATER, SOLAR.";
    }
  }

  if (!isUpdate || body.status !== undefined) {
    const status = body.status;
    if (!METER_STATUSES.includes(status as MeterStatus)) {
      errors.status = "Status must be one of ACTIVE, INACTIVE, FAULT.";
    }
  }

  if (body.tariff_id !== undefined && body.tariff_id !== null) {
    const tariffId = body.tariff_id;
    if (typeof tariffId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(tariffId)) {
      errors.tariff_id = "Tariff ID must be a valid UUID or null.";
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
}

export const listMeters: MetersListHandler = async (req, env) => {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = parseLimit(url.searchParams.get("limit") || undefined);

  const db = getDb(env);

  const rows = await db.query<MeterListItem>(
    `SELECT m.*, s.name AS site_name, t.name AS tariff_name
     FROM meter m
     JOIN site s ON s.id = m.site_id
     LEFT JOIN tariff t ON t.id = m.tariff_id
     WHERE (?1 IS NULL OR m.id > ?1)
     ORDER BY m.id
     LIMIT ?2`,
    [cursor ?? null, limit]
  );

  return json(rows);
};

export const getMeter: MetersGetHandler = async (req, env, params) => {
  const { id } = params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    throw new ValidationError({ id: "Invalid UUID format." });
  }

  const db = getDb(env);

  const meters = await db.query<MeterListItem>(
    `SELECT m.*, s.name AS site_name, t.name AS tariff_name
     FROM meter m
     JOIN site s ON s.id = m.site_id
     LEFT JOIN tariff t ON t.id = m.tariff_id
     WHERE m.id = ?1
     LIMIT 1`,
    [id]
  );

  if (meters.length === 0) {
    throw new NotFoundError("meter", id);
  }

  const meter = meters[0];

  const recentReadings = await db.query<{ id: string; kwh: number; demand_kw: number; taken_at: string }>(
    `SELECT id, kwh, demand_kw, taken_at
     FROM reading
     WHERE meter_id = ?1
     ORDER BY taken_at DESC
     LIMIT 10`,
    [id]
  );

  return json({ ...meter, recent_readings: recentReadings });
};

export const createMeter: MetersCreateHandler = async (req, env) => {
  const body = await req.json() as Record<string, unknown>;
  validateMeterBody(body, false);

  const { serial, site_id, kind, status, tariff_id } = body as MetersCreateBody;
  const id = randomUUID();
  const now = new Date().toISOString();

  const db = getDb(env);

  const siteExists = await db.query<{ id: string }>("SELECT id FROM site WHERE id = ?1 LIMIT 1", [site_id]);
  if (siteExists.length === 0) {
    throw new NotFoundError("site", site_id);
  }

  if (tariff_id) {
    const tariffExists = await db.query<{ id: string }>("SELECT id FROM tariff WHERE id = ?1 LIMIT 1", [tariff_id]);
    if (tariffExists.length === 0) {
      throw new NotFoundError("tariff", tariff_id);
    }
  }

  try {
    await db.exec(
      `INSERT INTO meter (id, serial, site_id, kind, status, tariff_id, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      [id, serial, site_id, kind, status, tariff_id ?? null, now, now]
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: meter.serial")) {
      throw new ValidationError({ serial: "A meter with this serial already exists." });
    }
    throw err;
  }

  await logAudit(db, "meter", id, "status", null, status);

  const rows = await db.query<MeterRow>("SELECT * FROM meter WHERE id = ?1 LIMIT 1", [id]);
  return json(rows[0], 201);
};

export const updateMeter: MetersUpdateHandler = async (req, env, params) => {
  const { id } = params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    throw new ValidationError({ id: "Invalid UUID format." });
  }

  const body = await req.json() as Record<string, unknown>;
  validateMeterBody(body, true);

  if (Object.keys(body).length === 0) {
    throw new ValidationError({ _form: "No fields provided for update." });
  }

  const db = getDb(env);

  const existing = await db.query<MeterRow>("SELECT * FROM meter WHERE id = ?1 LIMIT 1", [id]);
  if (existing.length === 0) {
    throw new NotFoundError("meter", id);
  }
  const oldMeter = existing[0];

  if (body.site_id) {
    const siteExists = await db.query<{ id: string }>("SELECT id FROM site WHERE id = ?1 LIMIT 1", [body.site_id]);
    if (siteExists.length === 0) {
      throw new NotFoundError("site", body.site_id as string);
    }
  }

  if (body.tariff_id !== undefined) {
    if (body.tariff_id) {
      const tariffExists = await db.query<{ id: string }>("SELECT id FROM tariff WHERE id = ?1 LIMIT 1", [body.tariff_id]);
      if (tariffExists.length === 0) {
        throw new NotFoundError("tariff", body.tariff_id as string);
      }
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const now = new Date().toISOString();

  if (body.serial !== undefined) {
    fields.push("serial = ?" + (values.length + 1));
    values.push(body.serial);
  }
  if (body.site_id !== undefined) {
    fields.push("site_id = ?" + (values.length + 1));
    values.push(body.site_id);
  }
  if (body.kind !== undefined) {
    fields.push("kind = ?" + (values.length + 1));
    values.push(body.kind);
  }
  if (body.status !== undefined) {
    fields.push("status = ?" + (values.length + 1));
    values.push(body.status);
  }
  if (body.tariff_id !== undefined) {
    fields.push("tariff_id = ?" + (values.length + 1));
    values.push(body.tariff_id);
  }

  fields.push("updated_at = ?" + (values.length + 1));
  values.push(now);

  values.push(id);

  try {
    await db.exec(
      `UPDATE meter SET ${fields.join(", ")} WHERE id = ?${values.length}`,
      values
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: meter.serial")) {
      throw new ValidationError({ serial: "A meter with this serial already exists." });
    }
    throw err;
  }

  const newStatus = (body.status ?? oldMeter.status) as MeterStatus;
  if (body.status !== undefined && body.status !== oldMeter.status) {
    await logAudit(db, "meter", id, "status", oldMeter.status, newStatus);
  }

  const rows = await db.query<MeterRow>("SELECT * FROM meter WHERE id = ?1 LIMIT 1", [id]);
  return json(rows[0]);
};

export const deleteMeter: MetersDeleteHandler = async (req, env, params) => {
  const { id } = params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    throw new ValidationError({ id: "Invalid UUID format." });
  }

  const db = getDb(env);

  const existing = await db.query<{ id: string }>("SELECT id FROM meter WHERE id = ?1 LIMIT 1", [id]);
  if (existing.length === 0) {
    throw new NotFoundError("meter", id);
  }

  await db.exec("DELETE FROM meter WHERE id = ?1", [id]);
  return json({ deleted: true });
};
