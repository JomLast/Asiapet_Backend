import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type { Patient, Visit } from '@shared/types';

const router = Router();
router.use(requireAuth);

// ── DB row type ──────────────────────────────────────────────────────────────

interface DbPatient {
  hn: string;
  clinic_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  birthdate: string | null;
  color: string | null;
  owner: string | null;
  owner_phone: string | null;
  owner_line: string | null;
  owner_facebook: string | null;
  owner_id: string | null;
  main_disease: string | null;
  allergies: string | null;
  deceased: number;
  moved: number;
  visits: string;
  imported_at: string | null;
  uid: string | null;
  updated_at: string | null;
}

function rowToPatient(row: DbPatient): Patient {
  return {
    hn: row.hn,
    name: row.name,
    species: row.species ?? undefined,
    breed: row.breed ?? undefined,
    sex: row.sex ?? undefined,
    birthdate: row.birthdate ?? undefined,
    color: row.color ?? undefined,
    owner: row.owner ?? undefined,
    ownerPhone: row.owner_phone ?? undefined,
    ownerLine: row.owner_line ?? undefined,
    ownerFacebook: row.owner_facebook ?? undefined,
    ownerId: row.owner_id ?? undefined,
    mainDisease: row.main_disease ?? undefined,
    allergies: row.allergies ?? undefined,
    deceased: Boolean(row.deceased),
    moved: Boolean(row.moved),
    visits: JSON.parse(row.visits || '[]') as Visit[],
    _importedAt: row.imported_at ?? undefined,
    _uid: row.uid ?? undefined,
  };
}

// ── POST /api/sync/push ─────────────────────────────────────────────────────

router.post('/push', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { patients, timestamp } = req.body as {
      patients?: Record<string, Patient>;
      timestamp?: string;
    };

    if (!patients || typeof patients !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'patients object is required.');
    }

    const now = timestamp || new Date().toISOString();

    const upsert = db.prepare(`
      INSERT OR REPLACE INTO patients
        (hn, clinic_id, name, species, breed, sex, birthdate, color,
         owner, owner_phone, owner_line, owner_facebook, owner_id,
         main_disease, allergies, deceased, moved, visits, imported_at, uid, updated_at)
      VALUES
        (@hn, @clinic_id, @name, @species, @breed, @sex, @birthdate, @color,
         @owner, @owner_phone, @owner_line, @owner_facebook, @owner_id,
         @main_disease, @allergies, @deceased, @moved, @visits, @imported_at, @uid, @updated_at)
    `);

    let count = 0;

    const runSync = db.transaction(() => {
      for (const [hn, p] of Object.entries(patients)) {
        upsert.run({
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
          imported_at: p._importedAt ?? null,
          uid: p._uid ?? null,
          updated_at: now,
        });
        count++;
      }
    });

    runSync();

    res.json({ ok: true, synced: count, timestamp: now });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sync/pull?since=<iso-timestamp> ────────────────────────────────

router.get('/pull', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const since = req.query.since as string | undefined;

    if (!since) {
      throw new AppError(400, 'VALIDATION_ERROR', 'since query parameter is required (ISO timestamp).');
    }

    const rows = db.prepare(`
      SELECT * FROM patients
      WHERE clinic_id = ? AND updated_at > ?
      ORDER BY hn
    `).all(clinicId, since) as DbPatient[];

    const patients: Record<string, Patient> = {};
    for (const row of rows) {
      patients[row.hn] = rowToPatient(row);
    }

    res.json({
      patients,
      count: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sync/full ──────────────────────────────────────────────────────

router.get('/full', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;

    const rows = db.prepare(`
      SELECT * FROM patients
      WHERE clinic_id = ?
      ORDER BY hn
    `).all(clinicId) as DbPatient[];

    const patients: Record<string, Patient> = {};
    for (const row of rows) {
      patients[row.hn] = rowToPatient(row);
    }

    res.json({
      patients,
      count: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
