import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type {
  Patient,
  Visit,
  CreatePatientRequest,
  UpdatePatientRequest,
  ListResponse,
} from '@shared/types';

const router = Router();

// All patient routes require auth.
router.use(requireAuth);

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function parsePage(query: Record<string, unknown>): { limit: number; offset: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
  return { limit, offset: (page - 1) * limit };
}

// ── GET /api/patients ─────────────────────────────────────────────────────────

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { limit, offset } = parsePage(req.query as Record<string, unknown>);

    const search = (req.query.q as string | undefined)?.trim();
    const whereExtra = search ? `AND (name LIKE ? OR hn LIKE ? OR owner LIKE ?)` : '';
    const searchArgs = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

    const total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM patients WHERE clinic_id = ? ${whereExtra}`)
        .get(clinicId, ...searchArgs) as { c: number }
    ).c;

    const rows = db
      .prepare(
        `SELECT * FROM patients WHERE clinic_id = ? ${whereExtra} ORDER BY hn LIMIT ? OFFSET ?`
      )
      .all(clinicId, ...searchArgs, limit, offset) as DbPatient[];

    const body: ListResponse<Patient> = {
      items: rows.map(rowToPatient),
      total,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/patients ────────────────────────────────────────────────────────

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const body = req.body as CreatePatientRequest;

    if (!body.hn) throw new AppError(400, 'VALIDATION_ERROR', 'hn is required.', { hn: 'required' });
    if (!body.name) throw new AppError(400, 'VALIDATION_ERROR', 'name is required.', { name: 'required' });

    const existing = db
      .prepare('SELECT hn FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(body.hn, clinicId);
    if (existing) throw new AppError(409, 'CONFLICT', `Patient HN ${body.hn} already exists.`);

    db.prepare(`
      INSERT INTO patients
        (hn, clinic_id, name, species, breed, sex, birthdate, color,
         owner, owner_phone, owner_line, owner_facebook, owner_id,
         main_disease, allergies, deceased, moved, visits, imported_at, uid)
      VALUES
        (@hn, @clinic_id, @name, @species, @breed, @sex, @birthdate, @color,
         @owner, @owner_phone, @owner_line, @owner_facebook, @owner_id,
         @main_disease, @allergies, @deceased, @moved, @visits, @imported_at, @uid)
    `).run({
      hn: body.hn,
      clinic_id: clinicId,
      name: body.name,
      species: body.species ?? null,
      breed: body.breed ?? null,
      sex: body.sex ?? null,
      birthdate: body.birthdate ?? null,
      color: body.color ?? null,
      owner: body.owner ?? null,
      owner_phone: body.ownerPhone ?? null,
      owner_line: body.ownerLine ?? null,
      owner_facebook: body.ownerFacebook ?? null,
      owner_id: body.ownerId ?? null,
      main_disease: body.mainDisease ?? null,
      allergies: body.allergies ?? null,
      deceased: body.deceased ? 1 : 0,
      moved: body.moved ? 1 : 0,
      visits: JSON.stringify(body.visits ?? []),
      imported_at: body._importedAt ?? null,
      uid: body._uid ?? null,
    });

    const row = db
      .prepare('SELECT * FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(body.hn, clinicId) as DbPatient;
    res.status(201).json(rowToPatient(row));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/patients/:hn ─────────────────────────────────────────────────────

router.get('/:hn', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(req.params.hn, req.clinicId) as DbPatient | undefined;

    if (!row) throw new AppError(404, 'NOT_FOUND', `Patient ${req.params.hn} not found.`);
    res.json(rowToPatient(row));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/patients/:hn ─────────────────────────────────────────────────────

router.put('/:hn', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { hn } = req.params;

    const existing = db
      .prepare('SELECT * FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(hn, clinicId) as DbPatient | undefined;
    if (!existing) throw new AppError(404, 'NOT_FOUND', `Patient ${hn} not found.`);

    const body = req.body as UpdatePatientRequest;
    const current = rowToPatient(existing);

    db.prepare(`
      UPDATE patients SET
        name = @name, species = @species, breed = @breed, sex = @sex,
        birthdate = @birthdate, color = @color,
        owner = @owner, owner_phone = @owner_phone, owner_line = @owner_line,
        owner_facebook = @owner_facebook, owner_id = @owner_id,
        main_disease = @main_disease, allergies = @allergies,
        deceased = @deceased, moved = @moved,
        visits = @visits, imported_at = @imported_at, uid = @uid
      WHERE hn = @hn AND clinic_id = @clinic_id
    `).run({
      hn,
      clinic_id: clinicId,
      name: body.name ?? current.name,
      species: body.species ?? current.species ?? null,
      breed: body.breed ?? current.breed ?? null,
      sex: body.sex ?? current.sex ?? null,
      birthdate: body.birthdate ?? current.birthdate ?? null,
      color: body.color ?? current.color ?? null,
      owner: body.owner ?? current.owner ?? null,
      owner_phone: body.ownerPhone ?? current.ownerPhone ?? null,
      owner_line: body.ownerLine ?? current.ownerLine ?? null,
      owner_facebook: body.ownerFacebook ?? current.ownerFacebook ?? null,
      owner_id: body.ownerId ?? current.ownerId ?? null,
      main_disease: body.mainDisease ?? current.mainDisease ?? null,
      allergies: body.allergies ?? current.allergies ?? null,
      deceased: (body.deceased ?? current.deceased) ? 1 : 0,
      moved: (body.moved ?? current.moved) ? 1 : 0,
      visits: JSON.stringify(body.visits ?? current.visits),
      imported_at: body._importedAt ?? current._importedAt ?? null,
      uid: body._uid ?? current._uid ?? null,
    });

    const updated = db
      .prepare('SELECT * FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(hn, clinicId) as DbPatient;
    res.json(rowToPatient(updated));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/patients/:hn ──────────────────────────────────────────────────

router.delete('/:hn', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM patients WHERE hn = ? AND clinic_id = ?')
      .run(req.params.hn, req.clinicId);

    if (result.changes === 0) {
      throw new AppError(404, 'NOT_FOUND', `Patient ${req.params.hn} not found.`);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/patients/:hn/visits ──────────────────────────────────────────────

router.get('/:hn/visits', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT visits FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(req.params.hn, req.clinicId) as { visits: string } | undefined;

    if (!row) throw new AppError(404, 'NOT_FOUND', `Patient ${req.params.hn} not found.`);

    const visits = JSON.parse(row.visits || '[]') as Visit[];
    const body: ListResponse<Visit> = { items: visits, total: visits.length };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/patients/:hn/visits ─────────────────────────────────────────────

router.post('/:hn/visits', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { hn } = req.params;

    const row = db
      .prepare('SELECT visits FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(hn, clinicId) as { visits: string } | undefined;
    if (!row) throw new AppError(404, 'NOT_FOUND', `Patient ${hn} not found.`);

    const newVisit = req.body as Visit;
    if (!newVisit.date) {
      throw new AppError(400, 'VALIDATION_ERROR', 'visit.date is required.', { date: 'required' });
    }

    const visits = JSON.parse(row.visits || '[]') as Visit[];

    // Upsert by date — if same date exists, replace it.
    const idx = visits.findIndex((v) => v.date === newVisit.date);
    if (idx >= 0) {
      visits[idx] = newVisit;
    } else {
      visits.push(newVisit);
    }

    db.prepare('UPDATE patients SET visits = ? WHERE hn = ? AND clinic_id = ?')
      .run(JSON.stringify(visits), hn, clinicId);

    res.status(201).json(newVisit);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/patients/:hn/visits/:date ────────────────────────────────────────

router.put('/:hn/visits/:date', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { hn, date } = req.params;

    const row = db
      .prepare('SELECT visits FROM patients WHERE hn = ? AND clinic_id = ?')
      .get(hn, clinicId) as { visits: string } | undefined;
    if (!row) throw new AppError(404, 'NOT_FOUND', `Patient ${hn} not found.`);

    const visits = JSON.parse(row.visits || '[]') as Visit[];
    const idx = visits.findIndex((v) => v.date === date);
    if (idx < 0) throw new AppError(404, 'NOT_FOUND', `Visit on ${date} not found.`);

    const updatedVisit: Visit = { ...(req.body as Visit), date };
    visits[idx] = updatedVisit;

    db.prepare('UPDATE patients SET visits = ? WHERE hn = ? AND clinic_id = ?')
      .run(JSON.stringify(visits), hn, clinicId);

    res.json(updatedVisit);
  } catch (err) {
    next(err);
  }
});

export default router;
