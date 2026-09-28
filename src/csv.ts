import type { CsvParseResult, ReadingImportRow } from "./lib/contract";
import { ValidationError } from "./errors";

const REQUIRED_COLUMNS = ["meter_serial", "kwh", "demand_kw", "taken_at"] as const;

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

function unquote(value: string): string {
  return value.trim();
}

function validateHeaders(headers: string[]): void {
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    throw new ValidationError(`Missing required columns: ${missing.join(", ")}`);
  }
}

function validateRow(
  row: Record<string, string>,
  lineNumber: number
): ReadingImportRow {
  const meterSerial = unquote(row.meter_serial ?? "");
  if (meterSerial.length < 6 || meterSerial.length > 20) {
    throw new ValidationError(
      `Row ${lineNumber}: meter_serial must be between 6 and 20 characters`
    );
  }
  const kwh = Number(row.kwh);
  if (!Number.isFinite(kwh) || kwh < 0) {
    throw new ValidationError(
      `Row ${lineNumber}: kwh must be a non-negative number`
    );
  }
  const demandKw = Number(row.demand_kw);
  if (!Number.isFinite(demandKw) || demandKw < 0) {
    throw new ValidationError(
      `Row ${lineNumber}: demand_kw must be a non-negative number`
    );
  }
  const takenAt = unquote(row.taken_at ?? "");
  if (!takenAt) {
    throw new ValidationError(
      `Row ${lineNumber}: taken_at is required and must be an ISO 8601 timestamp`
    );
  }
  const date = new Date(takenAt);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(
      `Row ${lineNumber}: taken_at must be a valid ISO 8601 timestamp`
    );
  }
  return { meter_serial: meterSerial, kwh, demand_kw: demandKw, taken_at: takenAt };
}

export async function* parseCsvStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<Record<string, string>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let headers: string[] | null = null;
  let rowNumber = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const fields = splitCsvLine(line);
        if (headers === null) {
          headers = fields.map((h) => unquote(h.toLowerCase()));
          validateHeaders(headers);
          continue;
        }
        rowNumber++;
        if (fields.length !== headers.length) {
          throw new ValidationError(
            `Row ${rowNumber}: expected ${headers.length} columns, got ${fields.length}`
          );
        }
        const row: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
          row[headers[i]] = unquote(fields[i]);
        }
        yield row;
      }
    }
    if (buffer.trim()) {
      const fields = splitCsvLine(buffer);
      if (headers === null) {
        headers = fields.map((h) => unquote(h.toLowerCase()));
        validateHeaders(headers);
      } else {
        rowNumber++;
        if (fields.length !== headers.length) {
          throw new ValidationError(
            `Row ${rowNumber}: expected ${headers.length} columns, got ${fields.length}`
          );
        }
        const row: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
          row[headers[i]] = unquote(fields[i]);
        }
        yield row;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function parseCsvForImport(
  stream: ReadableStream<Uint8Array>
): Promise<CsvParseResult> {
  const rows: ReadingImportRow[] = [];
  const errors: { row: number; message: string }[] = [];
  let lineIndex = 0;
  try {
    for await (const raw of parseCsvStream(stream)) {
      lineIndex++;
      try {
        rows.push(validateRow(raw, lineIndex));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: lineIndex, message });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { imported: 0, errors: [{ row: 0, message }] };
  }
  return { imported: rows.length, errors };
}
