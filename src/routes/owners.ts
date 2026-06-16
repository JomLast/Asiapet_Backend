import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type {
  Owner,
  CreateOwnerRequest,
  UpdateOwnerRequest,
  ListResponse,
} from '@shared/types';

const router = Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DbOwner {
  id: string;
  clinic_id: string;
  name: string;
  phone: string | null;
  line_id: string | null;
  facebook: string | null;
  notes: string | null;
  created_at: string | null;
}

function rowToOwner(row: DbOwner): Owner {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    lineId: row.line_id ?? undefined,
    facebook: row.facebook ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

function parsePage(query: Record<string, unknown>): { limit: number; offset: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
  return { limit, offset: (page - 1) * limit };
}

// ── GET /api/owners ───────────────────────────────────────────────────────────

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { limit, offset } = parsePage(req.query as Record<string, unknown>);
    const search = (req.query.q as string | undefined)?.trim();
    const whereExtra = search ? 'AND (name LIKE ? OR phone LIKE ?)' : '';
    const searchArgs = search ? [`%${search}%`, `%${search}%`] : [];

    const total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM owners WHERE clinic_id = ? ${whereExtra}`)
        .get(clinicId, ...searchArgs) as { c: number }
    ).c;

    const rows = db
      .prepare(`SELECT * FROM owners WHERE clinic_id = ? ${whereExtra} ORDER BY name LIMIT ? OFFSET ?`)
      .all(clinicId, ...searchArgs, limit, offset) as DbOwner[];

    const body: ListResponse<Owner> = { items: rows.map(rowToOwner), total };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/owners ──────────────────────────────────────────────────────────

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const body = req.body as CreateOwnerRequest;

    if (!body.name) {
      throw new AppError(400, 'VALIDATION_ERROR', 'name is required.', { name: 'required' });
    }

    const id = body.id || randomUUID();
    const createdAt = new Date().toISOString();

    const existing = db
      .prepare('SELECT id FROM owners WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId);
    if (existing) throw new AppError(409, 'CONFLICT', `Owner ID ${id} already exists.`);

    db.prepare(`
      INSERT INTO owners (id, clinic_id, name, phone, line_id, facebook, notes, created_at)
      VALUES (@id, @clinic_id, @name, @phone, @line_id, @facebook, @notes, @created_at)
    `).run({
      id,
      clinic_id: clinicId,
      name: body.name,
      phone: body.phone ?? null,
      line_id: body.lineId ?? null,
      facebook: body.facebook ?? null,
      notes: body.notes ?? null,
      created_at: createdAt,
    });

    const row = db
      .prepare('SELECT * FROM owners WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbOwner;
    res.status(201).json(rowToOwner(row));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/owners/:id ───────────────────────────────────────────────────────

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM owners WHERE id = ? AND clinic_id = ?')
      .get(req.params.id, req.clinicId) as DbOwner | undefined;

    if (!row) throw new AppError(404, 'NOT_FOUND', `Owner ${req.params.id} not found.`);
    res.json(rowToOwner(row));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/owners/:id ───────────────────────────────────────────────────────

router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM owners WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbOwner | undefined;
    if (!existing) throw new AppError(404, 'NOT_FOUND', `Owner ${id} not found.`);

    const body = req.body as UpdateOwnerRequest;
    const current = rowToOwner(existing);

    db.prepare(`
      UPDATE owners SET
        name = @name, phone = @phone, line_id = @line_id,
        facebook = @facebook, notes = @notes, created_at = @created_at
      WHERE id = @id AND clinic_id = @clinic_id
    `).run({
      id,
      clinic_id: clinicId,
      name: body.name ?? current.name,
      phone: body.phone ?? current.phone ?? null,
      line_id: body.lineId ?? current.lineId ?? null,
      facebook: body.facebook ?? current.facebook ?? null,
      notes: body.notes ?? current.notes ?? null,
      created_at: body.createdAt ?? current.createdAt ?? null,
    });

    const updated = db
      .prepare('SELECT * FROM owners WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbOwner;
    res.json(rowToOwner(updated));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/owners/:id ────────────────────────────────────────────────────

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM owners WHERE id = ? AND clinic_id = ?')
      .run(req.params.id, req.clinicId);

    if (result.changes === 0) {
      throw new AppError(404, 'NOT_FOUND', `Owner ${req.params.id} not found.`);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
