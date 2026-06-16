import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getContent, reloadDataset } from '../content/loader';
import { getManifest, updateDataset, getDatasetMeta } from '../content/manager';
import type {
  LegacyImportRequest,
  LegacyImportResponse,
  Patient,
  Owner,
  Appointment,
} from '@shared/types';

const router = Router();
router.use(requireAuth);

// ── Admin middleware ─────────────────────────────────────────────────────────

/** Checks that the authenticated user has role = 'admin'. */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const db = getDb();
  const user = db
    .prepare('SELECT role FROM users WHERE id = ?')
    .get(req.userId) as { role: string | null } | undefined;

  if (!user || user.role !== 'admin') {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Admin access required.',
    });
    return;
  }
  next();
}

// ── POST /api/admin/import ──────────────────────────────────────────────────

router.post('/import', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const body = req.body as LegacyImportRequest;

    let patientCount = 0;
    let ownerCount = 0;
    let appointmentCount = 0;

    const insertPatient = db.prepare(`
      INSERT OR REPLACE INTO patients
        (hn, clinic_id, name, species, breed, sex, birthdate, color,
         owner, owner_phone, owner_line, owner_facebook, owner_id,
         main_disease, allergies, deceased, moved, visits, imported_at, uid, updated_at)
      VALUES
        (@hn, @clinic_id, @name, @species, @breed, @sex, @birthdate, @color,
         @owner, @owner_phone, @owner_line, @owner_facebook, @owner_id,
         @main_disease, @allergies, @deceased, @moved, @visits, @imported_at, @uid, @updated_at)
    `);

    const insertOwner = db.prepare(`
      INSERT OR REPLACE INTO owners (id, clinic_id, name, phone, line_id, facebook, notes, created_at)
      VALUES (@id, @clinic_id, @name, @phone, @line_id, @facebook, @notes, @created_at)
    `);

    const insertAppointment = db.prepare(`
      INSERT OR REPLACE INTO appointments (id, clinic_id, patient_hn, date, time, notes, status, created_at)
      VALUES (@id, @clinic_id, @patient_hn, @date, @time, @notes, @status, @created_at)
    `);

    const runImport = db.transaction(() => {
      if (body.patients) {
        for (const [hn, patient] of Object.entries(body.patients)) {
          const p = patient as Patient;
          insertPatient.run({
            hn: p.hn || hn,
            clinic_id: clinicId,
            name: p.name,
            species: p.species ?? null,
            breed: p.breed ?? null,
            sex: p.sex ?? null,
            birthdate: p.birthdate ?? null,
            color: p.color ?? null,
            owner: p.owner ?? null,
            owner_phone: p.ownerPhone ?? null,
            owner_line: p.ownerLine ?? null,
            owner_facebook: p.ownerFacebook ?? null,
            owner_id: p.ownerId ?? null,
            main_disease: p.mainDisease ?? null,
            allergies: p.allergies ?? null,
            deceased: p.deceased ? 1 : 0,
            moved: p.moved ? 1 : 0,
            visits: JSON.stringify(p.visits ?? []),
            imported_at: p._importedAt ?? new Date().toISOString(),
            uid: p._uid ?? null,
            updated_at: new Date().toISOString(),
          });
          patientCount++;
        }
      }

      if (body.owners) {
        for (const [id, owner] of Object.entries(body.owners)) {
          const o = owner as Owner;
          insertOwner.run({
            id: o.id || id,
            clinic_id: clinicId,
            name: o.name,
            phone: o.phone ?? null,
            line_id: o.lineId ?? null,
            facebook: o.facebook ?? null,
            notes: o.notes ?? null,
            created_at: o.createdAt ?? null,
          });
          ownerCount++;
        }
      }

      if (body.appointments) {
        for (const appt of body.appointments as Appointment[]) {
          insertAppointment.run({
            id: appt.id || randomUUID(),
            clinic_id: clinicId,
            patient_hn: appt.patientHN ?? null,
            date: appt.date,
            time: appt.time ?? null,
            notes: appt.notes ?? null,
            status: appt.status ?? 'pending',
            created_at: appt.createdAt ?? null,
          });
          appointmentCount++;
        }
      }
    });

    runImport();

    const result: LegacyImportResponse = {
      patients: patientCount,
      owners: ownerCount,
      appointments: appointmentCount,
    };

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Admin-only routes below
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/stats ────────────────────────────────────────────────────

router.get('/stats', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicCount = (db.prepare('SELECT COUNT(*) AS c FROM clinics').get() as { c: number }).c;
    const patientCount = (db.prepare('SELECT COUNT(*) AS c FROM patients').get() as { c: number }).c;

    const manifest = getManifest();
    const drugMeta = getDatasetMeta('drugs');
    const diseaseMeta = getDatasetMeta('diseases');

    res.json({
      clinicCount,
      patientCount,
      drugCount: drugMeta?.count ?? 0,
      diseaseCount: diseaseMeta?.count ?? 0,
      contentVersion: manifest.version,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/clinics ──────────────────────────────────────────────────

router.get('/clinics', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM clinics ORDER BY name').all() as DbClinic[];
    res.json(rows.map(clinicRowToJson));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/clinics ─────────────────────────────────────────────────

router.post('/clinics', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const { name, expiresAt } = req.body as { name?: string; expiresAt?: string };

    if (!name) {
      throw new AppError(400, 'VALIDATION_ERROR', 'name is required.', { name: 'required' });
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO clinics (id, name, active, expires_at)
      VALUES (?, ?, 1, ?)
    `).run(id, name, expiresAt ?? null);

    const row = db.prepare('SELECT * FROM clinics WHERE id = ?').get(id) as DbClinic;
    res.status(201).json(clinicRowToJson(row));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/admin/clinics/:id ──────────────────────────────────────────────

router.put('/clinics/:id', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM clinics WHERE id = ?').get(id) as DbClinic | undefined;
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Clinic ${id} not found.`);
    }

    const body = req.body as { name?: string; active?: boolean; expiresAt?: string | null };

    db.prepare(`
      UPDATE clinics SET
        name = ?,
        active = ?,
        expires_at = ?
      WHERE id = ?
    `).run(
      body.name ?? existing.name,
      body.active !== undefined ? (body.active ? 1 : 0) : existing.active,
      body.expiresAt !== undefined ? body.expiresAt : existing.expires_at,
      id
    );

    const updated = db.prepare('SELECT * FROM clinics WHERE id = ?').get(id) as DbClinic;
    res.json(clinicRowToJson(updated));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/content/:type ────────────────────────────────────────────

router.get('/content/:type', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = getContent(req.params.type);
    if (data === null) {
      throw new AppError(404, 'NOT_FOUND', `Unknown content type: ${req.params.type}`);
    }
    const meta = getDatasetMeta(req.params.type);
    res.json({ meta, data });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/admin/content/:type ────────────────────────────────────────────

router.put('/content/:type', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    const data = req.body;

    if (data === undefined || data === null) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body is required.');
    }

    const meta = updateDataset(type, data);
    reloadDataset(type);

    res.json({ ok: true, type, ...meta });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/content/drugs/:index ───────────────────────────────────

router.patch('/content/drugs/:index', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const index = parseInt(req.params.index, 10);
    const drugs = getContent('drugs');

    if (!Array.isArray(drugs)) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Drugs dataset is not an array.');
    }
    if (isNaN(index) || index < 0 || index >= drugs.length) {
      throw new AppError(404, 'NOT_FOUND', `Drug index ${req.params.index} out of range (0..${drugs.length - 1}).`);
    }

    // Merge patch into existing drug
    const updated = [...drugs];
    updated[index] = { ...updated[index], ...req.body };

    const meta = updateDataset('drugs', updated);
    reloadDataset('drugs');

    res.json({ ok: true, index, drug: updated[index], ...meta });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/content/drugs ───────────────────────────────────────────

router.post('/content/drugs', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const drugs = getContent('drugs');

    if (!Array.isArray(drugs)) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Drugs dataset is not an array.');
    }

    const newDrug = req.body;
    if (!newDrug || typeof newDrug !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body must be a drug object.');
    }

    const updated = [...drugs, newDrug];
    const meta = updateDataset('drugs', updated);
    reloadDataset('drugs');

    res.status(201).json({ ok: true, index: updated.length - 1, drug: newDrug, ...meta });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/admin/content/drugs/:index ───────────────────────────────────

router.delete('/content/drugs/:index', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const index = parseInt(req.params.index, 10);
    const drugs = getContent('drugs');

    if (!Array.isArray(drugs)) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Drugs dataset is not an array.');
    }
    if (isNaN(index) || index < 0 || index >= drugs.length) {
      throw new AppError(404, 'NOT_FOUND', `Drug index ${req.params.index} out of range (0..${drugs.length - 1}).`);
    }

    const removed = drugs[index];
    const updated = drugs.filter((_: unknown, i: number) => i !== index);

    const meta = updateDataset('drugs', updated);
    reloadDataset('drugs');

    res.json({ ok: true, removed, ...meta });
  } catch (err) {
    next(err);
  }
});

// ── Local DB row types ──────────────────────────────────────────────────────

interface DbClinic {
  id: string;
  name: string;
  active: number;
  expires_at: string | null;
}

function clinicRowToJson(row: DbClinic) {
  return {
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    expiresAt: row.expires_at,
  };
}

export default router;
