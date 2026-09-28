import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import { json, errorResponse, type Handler } from "../lib/http";
import { parseQuery, parseBody, type Env } from "../lib/http";
import { validators } from "../validation";
import { AppError, NotFoundError, ValidationError } from "../errors";
import { createReading, listReadings, importReadingsCsv } from "../db";
import { checkAnomaly } from "../anomaly";

const readingsListQuery = z.object({
  cursor: z.string().optional(),
  meter_id: validators.uuid.optional(),
  after: validators.isoDate.optional(),
  before: validators.isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const readingCreateBody = z.object({
  meter_id: validators.uuid,
  kwh: validators.nonNegativeNumber,
  demand_kw: validators.nonNegativeNumber,
  taken_at: validators.isoDate,
});

export const listReadings: Handler<"/api/readings"> = async (req, env) => {
  const url = new URL(req.url);
  const params = readingsListQuery.parse(parseQuery(url.searchParams));

  const { rows, nextCursor } = await dbListReadings(env.DB, params);
  return json({ rows, nextCursor });
};

export const createReading: Handler<"/api/readings"> = async (req, env) => {
  const body = readingCreateBody.parse(await parseBody(req));
  const reading = await dbCreateReading(env.DB, body);
  return json(reading, 201);
};

export const importReadings: Handler<"/api/readings/import"> = async (req, env) => {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    throw new ValidationError("expected multipart/form-data");
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError("missing file field");
  }

  const csvText = await file.text();
  const result = await dbImportReadingsCsv(env.DB, csvText);
  return json(result, result.errors.length ? 207 : 201);
};

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function dbListReadings(
  db: D1Database,
  params: z.infer<typeof readingsListQuery>
) {
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (params.meter_id) {
    conditions.push("r.meter_id = ?");
    bindings.push(params.meter_id);
  }
  if (params.after) {
    conditions.push("r.taken_at >= ?");
    bindings.push(params.after);
  }
  if (params.before) {
    conditions.push("r.taken_at <= ?");
    bindings.push(params.before);
  }
  if (params.cursor) {
    conditions.push("r.id > ?");
    bindings.push(params.cursor);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = params.limit + 1;
  const stmt = db.prepare(`
    SELECT r.id, r.meter_id, r.kwh, r.demand_kw, r.taken_at, r.created_at,
           m.serial AS meter_serial, s.name AS site_name
    FROM reading r
    JOIN meter m ON m.id = r.meter_id
    JOIN site s ON s.id = m.site_id
    ${where}
    ORDER BY r.id ASC
    LIMIT ?
  `);

  const rows = await stmt.bind(...bindings, limit).all();
  const results = (rows.results ?? []) as Record<string, unknown>[];
  const hasMore = results.length > params.limit;
  const page = hasMore ? results.slice(0, params.limit) : results;
  const nextCursor = hasMore && page.length ? String(page[page.length - 1].id) : null;

  return { rows: page, nextCursor };
}

async function dbCreateReading(
  db: D1Database,
  body: z.infer<typeof readingCreateBody>
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const meter = await db.prepare("SELECT id, status FROM meter WHERE id = ?").bind(body.meter_id).first<{ id: string; status: string }>();
  if (!meter) {
    throw new NotFoundError("meter not found");
  }

  await db.prepare(`
    INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, body.meter_id, body.kwh, body.demand_kw, body.taken_at, now).run();

  await checkAnomaly(db, body.meter_id, body.kwh, body.taken_at);

  return {
    id,
    meter_id: body.meter_id,
    kwh: body.kwh,
    demand_kw: body.demand_kw,
    taken_at: body.taken_at,
    created_at: now,
  };
}

async function dbImportReadingsCsv(db: D1Database, csvText: string) {
  const lines = csvText.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  if (lines.length === 0) {
    return { imported: 0, errors: [] };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const expected = ["meter_id", "kwh", "demand_kw", "taken_at"];
  for (const col of expected) {
    if (!header.includes(col)) {
      throw new ValidationError(`missing CSV column: ${col}`);
    }
  }

  const idx = {
    meter_id: header.indexOf("meter_id"),
    kwh: header.indexOf("kwh"),
    demand_kw: header.indexOf("demand_kw"),
    taken_at: header.indexOf("taken_at"),
  };

  const parsed: { meter_id: string; kwh: number; demand_kw: number; taken_at: string }[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) {
      errors.push({ row: rowNum, message: "too few columns" });
      continue;
    }

    const meter_id = cols[idx.meter_id]?.trim();
    const kwhRaw = cols[idx.kwh]?.trim();
    const demandRaw = cols[idx.demand_kw]?.trim();
    const taken_at = cols[idx.taken_at]?.trim();

    const parseRes = readingCreateBody.safeParse({
      meter_id,
      kwh: Number(kwhRaw),
      demand_kw: Number(demandRaw),
      taken_at,
    });

    if (!parseRes.success) {
      const issues = parseRes.error.issues.map((issue) => issue.message).join("; ");
      errors.push({ row: rowNum, message: issues });
      continue;
    }

    parsed.push(parseRes.data);
  }

  const imported = await insertReadingBatch(db, parsed);
  return { imported, errors };
}

async function insertReadingBatch(
  db: D1Database,
  rows: { meter_id: string; kwh: number; demand_kw: number; taken_at: string }[]
) {
  if (rows.length === 0) return 0;

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const now = new Date().toISOString();

    const values = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const bindings: (string | number)[] = [];
    const ids: string[] = [];

    for (const row of chunk) {
      const id = crypto.randomUUID();
      ids.push(id);
      bindings.push(id, row.meter_id, row.kwh, row.demand_kw, row.taken_at, now);
    }

    await db.prepare(`
      INSERT INTO reading (id, meter_id, kwh, demand_kw, taken_at, created_at)
      VALUES ${values}
    `).bind(...bindings).run();

    inserted += chunk.length;

    // Anomaly check is intentionally per-row but lightweight; D1 latency dominates.
    for (const row of chunk) {
      await checkAnomaly(db, row.meter_id, row.kwh, row.taken_at);
    }
  }

  return inserted;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
