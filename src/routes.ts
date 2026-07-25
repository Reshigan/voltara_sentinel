import { Hono } from 'hono';
import type { DB } from './lib/db';
import { listSites, getSite, createSite, updateSite, deleteSite, getDashboardKpis, getDashboardSites } from './handlers/site';
import { listMeters, getMeter, createMeter, updateMeter, deleteMeter } from './handlers/meter';
import { listReadings, getReading, createReading, deleteReading, importReadings } from './handlers/reading';
import { listTariffs, getTariff, createTariff, updateTariff, deleteTariff } from './handlers/tariff';
import { listAlerts, getAlert, createAlert, updateAlert, deleteAlert, acknowledgeAlert } from './handlers/alert';
import { getHealth } from './handlers/health';
import { getDigest } from './handlers/digest';

export function apiRoutes(db: DB): Hono {
  const app = new Hono();

  app.get('/health', (c) => getHealth(c, db));
  app.get('/digest', (c) => getDigest(c, db));

  app.get('/dashboard/kpis', (c) => getDashboardKpis(c, db));
  app.get('/dashboard/sites', (c) => getDashboardSites(c, db));

  app.get('/sites', (c) => listSites(c, db));
  app.post('/sites', (c) => createSite(c, db));
  app.get('/sites/:id', (c) => getSite(c, db));
  app.put('/sites/:id', (c) => updateSite(c, db));
  app.delete('/sites/:id', (c) => deleteSite(c, db));

  app.get('/meters', (c) => listMeters(c, db));
  app.post('/meters', (c) => createMeter(c, db));
  app.get('/meters/:id', (c) => getMeter(c, db));
  app.put('/meters/:id', (c) => updateMeter(c, db));
  app.delete('/meters/:id', (c) => deleteMeter(c, db));

  app.get('/readings', (c) => listReadings(c, db));
  app.post('/readings', (c) => createReading(c, db));
  app.get('/readings/:id', (c) => getReading(c, db));
  app.delete('/readings/:id', (c) => deleteReading(c, db));
  app.post('/readings/import', (c) => importReadings(c, db));

  app.get('/tariffs', (c) => listTariffs(c, db));
  app.post('/tariffs', (c) => createTariff(c, db));
  app.get('/tariffs/:id', (c) => getTariff(c, db));
  app.put('/tariffs/:id', (c) => updateTariff(c, db));
  app.delete('/tariffs/:id', (c) => deleteTariff(c, db));

  app.get('/alerts', (c) => listAlerts(c, db));
  app.post('/alerts', (c) => createAlert(c, db));
  app.get('/alerts/:id', (c) => getAlert(c, db));
  app.put('/alerts/:id', (c) => updateAlert(c, db));
  app.delete('/alerts/:id', (c) => deleteAlert(c, db));
  app.put('/alerts/:id/acknowledge', (c) => acknowledgeAlert(c, db));

  return app;
}
