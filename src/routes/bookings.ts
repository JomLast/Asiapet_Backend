import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type { Booking, UpdateBookingRequest, ListResponse } from '@shared/types';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DbBooking {
  id: string;
  clinic_id: string;
  name: string | null;
  phone: string | null;
  pet_name: string | null;
  species: string | null;
  date: string | null;
  time: string | null;
  reason: string | null;
  status: string | null;
  created_at: string | null;
}

function rowToBooking(row: DbBooking): Booking {
  return {
    id: row.id,
    name: row.name ?? undefined,
    phone: row.phone ?? undefined,
    petName: row.pet_name ?? undefined,
    species: row.species ?? undefined,
    date: row.date ?? undefined,
    time: row.time ?? undefined,
    reason: row.reason ?? undefined,
    status: row.status ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

function parsePage(query: Record<string, unknown>): { limit: number; offset: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
  return { limit, offset: (page - 1) * limit };
}

// ── GET /api/bookings  (requires auth) ────────────────────────────────────────

router.get('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { limit, offset } = parsePage(req.query as Record<string, unknown>);

    const total = (
      db
        .prepare('SELECT COUNT(*) AS c FROM bookings WHERE clinic_id = ?')
        .get(clinicId) as { c: number }
    ).c;

    const rows = db
      .prepare('SELECT * FROM bookings WHERE clinic_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(clinicId, limit, offset) as DbBooking[];

    const body: ListResponse<Booking> = { items: rows.map(rowToBooking), total };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/bookings  (public — no auth) ────────────────────────────────────

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();

    // Public endpoint: use the DEFAULT_CLINIC_ID env var or fall back to 'clinic-1'.
    const clinicId = process.env.DEFAULT_CLINIC_ID || 'clinic-1';

    const body = req.body as Partial<Booking>;
    const id = body.id || randomUUID();
    const createdAt = body.createdAt ?? new Date().toISOString();

    db.prepare(`
      INSERT INTO bookings (id, clinic_id, name, phone, pet_name, species, date, time, reason, status, created_at)
      VALUES (@id, @clinic_id, @name, @phone, @pet_name, @species, @date, @time, @reason, @status, @created_at)
    `).run({
      id,
      clinic_id: clinicId,
      name: body.name ?? null,
      phone: body.phone ?? null,
      pet_name: body.petName ?? null,
      species: body.species ?? null,
      date: body.date ?? null,
      time: body.time ?? null,
      reason: body.reason ?? null,
      status: body.status ?? 'pending',
      created_at: createdAt,
    });

    const row = db
      .prepare('SELECT * FROM bookings WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbBooking;
    res.status(201).json(rowToBooking(row));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/bookings/:id  (requires auth) ────────────────────────────────────

router.put('/:id', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM bookings WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbBooking | undefined;
    if (!existing) throw new AppError(404, 'NOT_FOUND', `Booking ${id} not found.`);

    const body = req.body as UpdateBookingRequest;
    const current = rowToBooking(existing);

    db.prepare(`
      UPDATE bookings SET
        name = @name, phone = @phone, pet_name = @pet_name,
        species = @species, date = @date, time = @time,
        reason = @reason, status = @status, created_at = @created_at
      WHERE id = @id AND clinic_id = @clinic_id
    `).run({
      id,
      clinic_id: clinicId,
      name: body.name ?? current.name ?? null,
      phone: body.phone ?? current.phone ?? null,
      pet_name: body.petName ?? current.petName ?? null,
      species: body.species ?? current.species ?? null,
      date: body.date ?? current.date ?? null,
      time: body.time ?? current.time ?? null,
      reason: body.reason ?? current.reason ?? null,
      status: body.status ?? current.status ?? 'pending',
      created_at: body.createdAt ?? current.createdAt ?? null,
    });

    const updated = db
      .prepare('SELECT * FROM bookings WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbBooking;
    res.json(rowToBooking(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
