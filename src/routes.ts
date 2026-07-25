// GENERATED from the manifest. Do not edit.
import type { Route } from "./lib/http";
import { listSites, getSite, createSite, updateSite, deleteSite, getDashboardKpis, getDashboardSites, getHealth } from "./handlers/site";
import { listMeters, getMeter, createMeter, updateMeter, deleteMeter } from "./handlers/meter";
import { listReadings, getReading, createReading, deleteReading, getDigest, importReadings } from "./handlers/reading";
import { listTariffs, getTariff, createTariff, updateTariff, deleteTariff } from "./handlers/tariff";
import { listAlerts, getAlert, createAlert, updateAlert, acknowledgeAlert } from "./handlers/alert";

export const routes: Route[] = [
  { method: "GET", path: "/api/sites", handler: listSites },
  { method: "GET", path: "/api/sites/:id", handler: getSite },
  { method: "POST", path: "/api/sites", handler: createSite },
  { method: "PUT", path: "/api/sites/:id", handler: updateSite },
  { method: "DELETE", path: "/api/sites/:id", handler: deleteSite },
  { method: "GET", path: "/api/meters", handler: listMeters },
  { method: "GET", path: "/api/meters/:id", handler: getMeter },
  { method: "POST", path: "/api/meters", handler: createMeter },
  { method: "PUT", path: "/api/meters/:id", handler: updateMeter },
  { method: "DELETE", path: "/api/meters/:id", handler: deleteMeter },
  { method: "GET", path: "/api/readings", handler: listReadings },
  { method: "GET", path: "/api/readings/:id", handler: getReading },
  { method: "POST", path: "/api/readings", handler: createReading },
  { method: "DELETE", path: "/api/readings/:id", handler: deleteReading },
  { method: "GET", path: "/api/tariffs", handler: listTariffs },
  { method: "GET", path: "/api/tariffs/:id", handler: getTariff },
  { method: "POST", path: "/api/tariffs", handler: createTariff },
  { method: "PUT", path: "/api/tariffs/:id", handler: updateTariff },
  { method: "DELETE", path: "/api/tariffs/:id", handler: deleteTariff },
  { method: "GET", path: "/api/alerts", handler: listAlerts },
  { method: "GET", path: "/api/alerts/:id", handler: getAlert },
  { method: "POST", path: "/api/alerts", handler: createAlert },
  { method: "PUT", path: "/api/alerts/:id", handler: updateAlert },
  { method: "POST", path: "/api/alerts/:id/acknowledge", handler: acknowledgeAlert },
  { method: "GET", path: "/api/dashboard/kpis", handler: getDashboardKpis },
  { method: "GET", path: "/api/dashboard/sites", handler: getDashboardSites },
  { method: "GET", path: "/api/digest", handler: getDigest },
  { method: "GET", path: "/api/health", handler: getHealth },
  { method: "POST", path: "/api/readings/import", handler: importReadings },
];
