import express from 'express';
import cors from 'cors';
import path from 'path';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import patientsRouter from './routes/patients';
import ownersRouter from './routes/owners';
import appointmentsRouter from './routes/appointments';
import bookingsRouter from './routes/bookings';
import contentRouter from './routes/content';
import adminRouter from './routes/admin';
import syncRouter from './routes/sync';
import updatesRouter from './routes/updates';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): express.Application {
  const app = express();

  // ── Global middleware ───────────────────────────────────────────────────────
  // Allow all origins: frontend runs from file:// (Electron), localhost, or direct open
  app.use(
    cors({
      origin: true,   // reflect request origin — needed for file:// and Electron
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Routes ──────────────────────────────────────────────────────────────────
  // Public — no auth required
  app.use('/api/health', healthRouter);
  app.use('/api/content', contentRouter);   // GET /api/content/:type

  // Auth routes (login is public, /me requires auth — handled inside the router)
  app.use('/api/auth', authRouter);

  // Public booking creation (POST /api/bookings — website form)
  // Auth-required operations (GET, PUT) are also in this router, handled per-route.
  app.use('/api/bookings', bookingsRouter);

  // Protected routes (auth enforced inside each router via requireAuth middleware)
  app.use('/api/patients', patientsRouter);
  app.use('/api/owners', ownersRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/sync', syncRouter);

  // ── Electron auto-update server ──────────────────────────────────────────────
  // electron-updater (generic provider) fetches /updates/latest.yml then downloads .exe
  app.use('/updates', updatesRouter);

  // ── Admin dashboard ─────────────────────────────────────────────────────────
  // Serve admin/index.html at /admin (single-page admin UI)
  const adminDir = path.resolve(process.cwd(), 'admin');
  app.use('/admin', express.static(adminDir));
  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'));
  });

  // 404 for unmatched /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found.' });
  });

  // Central error handler — MUST be last
  app.use(errorHandler);

  return app;
}
