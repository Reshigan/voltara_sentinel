import { z } from "zod";
import { ValidationError } from "./errors";
import type {
  CreateSiteInput,
  UpdateSiteInput,
  CreateMeterInput,
  UpdateMeterInput,
  CreateReadingInput,
  CreateTariffInput,
  UpdateTariffInput,
  UpdateAlertInput,
  ImportReadingRow,
} from "./contract";

const uuidSchema = z.string().uuid();

export const createSiteSchema = z.object({
  name: z.string().min(1).max(255),
  region: z.string().min(1).max(255),
  capacity_kw: z.number().nonnegative(),
}) satisfies z.ZodType<CreateSiteInput>;

export const updateSiteSchema = createSiteSchema.partial() satisfies z.ZodType<UpdateSiteInput>;

export const createMeterSchema = z.object({
  serial: z.string().min(6).max(20),
  site_id: uuidSchema,
  kind: z.enum(["ELECTRIC", "GAS", "WATER", "SOLAR"]),
  status: z.enum(["ACTIVE", "INACTIVE", "FAULT"]),
  tariff_id: uuidSchema.optional(),
}) satisfies z.ZodType<CreateMeterInput>;

export const updateMeterSchema = createMeterSchema.partial().extend({
  site_id: uuidSchema.optional(),
}) satisfies z.ZodType<UpdateMeterInput>;

export const createReadingSchema = z.object({
  meter_id: uuidSchema,
  kwh: z.number().nonnegative(),
  demand_kw: z.number().nonnegative(),
  taken_at: z.string().datetime(),
}) satisfies z.ZodType<CreateReadingInput>;

export const createTariffSchema = z.object({
  name: z.string().min(1).max(255),
  rate_per_kwh: z.number().positive(),
  band: z.enum(["OFF_PEAK", "SHOULDER", "PEAK"]),
}) satisfies z.ZodType<CreateTariffInput>;

export const updateTariffSchema = createTariffSchema.partial() satisfies z.ZodType<UpdateTariffInput>;

export const updateAlertSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "CLOSED"]),
}) satisfies z.ZodType<UpdateAlertInput>;

export const importReadingRowSchema = z.object({
  meter_id: uuidSchema,
  kwh: z.coerce.number().nonnegative(),
  demand_kw: z.coerce.number().nonnegative(),
  taken_at: z.string().datetime(),
}) satisfies z.ZodType<ImportReadingRow>;

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.map(String),
    message: issue.message,
  }));
  throw new ValidationError("Validation failed", issues);
}
