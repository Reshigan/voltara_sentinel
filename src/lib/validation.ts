const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SERIAL_RE = /^[A-Za-z0-9]{6,20}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function isIso8601(v: unknown): v is string {
  return typeof v === 'string' && ISO_RE.test(v);
}

export function isMeterSerial(v: unknown): v is string {
  return typeof v === 'string' && SERIAL_RE.test(v);
}

export function isEnum<T extends string>(values: readonly T[]): (v: unknown) => v is T {
  return (v: unknown): v is T => typeof v === 'string' && (values as readonly string[]).includes(v);
}

export function isNonNegativeNumber(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v) && v >= 0;
}

export function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v) && v > 0;
}

export function isOptional(v: unknown): v is null | undefined {
  return v === null || v === undefined;
}
