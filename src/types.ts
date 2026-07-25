// GENERATED from the manifest. Do not edit — regenerated on every build.
import type { Handler } from "./lib/http";

/** A shared error envelope so single-row endpoints can 404 while staying typed. */
export interface ApiError { error: string }
/** Untyped row for free-form query endpoints. */
export type Row = Record<string, unknown>;

export interface Site {
  id: number;
  name: string;
  region: string;
  capacity_kw: number;
  created_at: string;
  updated_at: string;
}

export interface Meter {
  id: number;
  serial: string;
  site_id: number;
  kind: string;
  status: string;
  tariff_id: number;
  created_at: string;
  updated_at: string;
}

export interface Reading {
  id: number;
  meter_id: number;
  kwh: number;
  demand_kw: number;
  taken_at: string;
  created_at: string;
}

export interface Tariff {
  id: number;
  name: string;
  rate_per_kwh: number;
  band: string;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: number;
  meter_id: number;
  severity: string;
  message: string;
  opened_at: string;
  status: string;
  acknowledged_at: string;
  closed_at: string;
}

export interface Audit_log {
  id: number;
  entity_type: string;
  entity_id: number;
  field: string;
  old_value: string;
  new_value: string;
  changed_at: string;
}

export type ListSitesResponse = Site[];
export type ListSitesHandler = Handler<ListSitesResponse>;
export type GetSiteResponse = Site | ApiError;
export type GetSiteHandler = Handler<GetSiteResponse>;
export type CreateSiteResponse = Site | ApiError;
export type CreateSiteHandler = Handler<CreateSiteResponse>;
export type UpdateSiteResponse = Site | ApiError;
export type UpdateSiteHandler = Handler<UpdateSiteResponse>;
export type DeleteSiteResponse = { ok: boolean } | ApiError;
export type DeleteSiteHandler = Handler<DeleteSiteResponse>;
export type ListMetersResponse = Meter[];
export type ListMetersHandler = Handler<ListMetersResponse>;
export type GetMeterResponse = Meter | ApiError;
export type GetMeterHandler = Handler<GetMeterResponse>;
export type CreateMeterResponse = Meter | ApiError;
export type CreateMeterHandler = Handler<CreateMeterResponse>;
export type UpdateMeterResponse = Meter | ApiError;
export type UpdateMeterHandler = Handler<UpdateMeterResponse>;
export type DeleteMeterResponse = { ok: boolean } | ApiError;
export type DeleteMeterHandler = Handler<DeleteMeterResponse>;
export type ListReadingsResponse = Reading[];
export type ListReadingsHandler = Handler<ListReadingsResponse>;
export type GetReadingResponse = Reading | ApiError;
export type GetReadingHandler = Handler<GetReadingResponse>;
export type CreateReadingResponse = Reading | ApiError;
export type CreateReadingHandler = Handler<CreateReadingResponse>;
export type DeleteReadingResponse = { ok: boolean } | ApiError;
export type DeleteReadingHandler = Handler<DeleteReadingResponse>;
export type ListTariffsResponse = Tariff[];
export type ListTariffsHandler = Handler<ListTariffsResponse>;
export type GetTariffResponse = Tariff | ApiError;
export type GetTariffHandler = Handler<GetTariffResponse>;
export type CreateTariffResponse = Tariff | ApiError;
export type CreateTariffHandler = Handler<CreateTariffResponse>;
export type UpdateTariffResponse = Tariff | ApiError;
export type UpdateTariffHandler = Handler<UpdateTariffResponse>;
export type DeleteTariffResponse = { ok: boolean } | ApiError;
export type DeleteTariffHandler = Handler<DeleteTariffResponse>;
export type ListAlertsResponse = Alert[];
export type ListAlertsHandler = Handler<ListAlertsResponse>;
export type GetAlertResponse = Alert | ApiError;
export type GetAlertHandler = Handler<GetAlertResponse>;
export type CreateAlertResponse = Alert | ApiError;
export type CreateAlertHandler = Handler<CreateAlertResponse>;
export type UpdateAlertResponse = Alert | ApiError;
export type UpdateAlertHandler = Handler<UpdateAlertResponse>;
export type AcknowledgeAlertResponse = Row[];
export type AcknowledgeAlertHandler = Handler<AcknowledgeAlertResponse>;
export type GetDashboardKpisResponse = Row[];
export type GetDashboardKpisHandler = Handler<GetDashboardKpisResponse>;
export type GetDashboardSitesResponse = Row[];
export type GetDashboardSitesHandler = Handler<GetDashboardSitesResponse>;
export type GetDigestResponse = Row[];
export type GetDigestHandler = Handler<GetDigestResponse>;
export type GetHealthResponse = Row[];
export type GetHealthHandler = Handler<GetHealthResponse>;
export type ImportReadingsResponse = Row[];
export type ImportReadingsHandler = Handler<ImportReadingsResponse>;
