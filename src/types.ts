export interface Site {
  id: string;
  name: string;
  region: string;
  capacity_kw: number;
  created_at: string;
  updated_at: string;
}

export interface Meter {
  id: string;
  serial: string;
  site_id: string;
  kind: 'ELECTRIC' | 'GAS' | 'WATER' | 'SOLAR';
  status: 'ACTIVE' | 'INACTIVE' | 'FAULT';
  tariff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reading {
  id: string;
  meter_id: string;
  kwh: number;
  demand_kw: number;
  taken_at: string;
  created_at: string;
}

export interface Tariff {
  id: string;
  name: string;
  rate_per_kwh: number;
  band: 'OFF_PEAK' | 'SHOULDER' | 'PEAK';
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  meter_id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  opened_at: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';
  acknowledged_at: string | null;
  closed_at: string | null;
}

export interface AuditLog {
  id: string;
  entity_type: 'meter' | 'alert';
  entity_id: string;
  field: string;
  old_value: string | null;
  new_value: string;
  changed_at: string;
}
