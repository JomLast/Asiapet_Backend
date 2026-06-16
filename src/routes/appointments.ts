import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type {
  Appointment,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  ListResponse,
} from '@shared/types';

const router = Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DbAppointment {
  id: string;
  clinic_id: string;
  patient_hn: string | null;
  date: string;
  time: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
}

function rowToAppointment(row: DbAppointment): Appointment {
  return {
    id: row.id,
    patientHN: row.patient_hn ?? undefined,
    date: row.date,
    time: row.time ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

function parsePage(query: Record<string, unknown>): { limit: number; offset: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
  return { limit, offset: (page - 1) * limit };
}

// ── GET /api/appointments ─────────────────────────────────────────────────────

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { limit, offset } = parsePage(req.query as Record<string, unknown>);

    // Optional date filter
    const dateFilter = req.query.date as string | undefined;
    const whereExtra = dateFilter ? 'AND date = ?' : '';
    const dateArgs = dateFilter ? [dateFilter] : [];

    const total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM appointments WHERE clinic_id = ? ${whereExtra}`)
        .get(clinicId, ...dateArgs) as { c: number }
    ).c;

    const rows = db
      .prepare(
        `SELECT * FROM appointments WHERE clinic_id = ? ${whereExtra} ORDER BY date DESC, time LIMIT ? OFFSET ?`
      )
      .all(clinicId, ...dateArgs, limit, offset) as DbAppointment[];

    const body: ListResponse<Appointment> = { items: rows.map(rowToAppointment), total };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/appointments ────────────────────────────────────────────────────

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const body = req.body as CreateAppointmentRequest;

    if (!body.date) {
      throw new AppError(400, 'VALIDATION_ERROR', 'date is required.', { date: 'required' });
    }

    const id = body.id || randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO appointments (id, clinic_id, patient_hn, date, time, notes, status, created_at)
      VALUES (@id, @clinic_id, @patient_hn, @date, @time, @notes, @status, @created_at)
    `).run({
      id,
      clinic_id: clinicId,
      patient_hn: body.patientHN ?? null,
      date: body.date,
      time: body.time ?? null,
      notes: body.notes ?? null,
      status: body.status ?? 'pending',
      created_at: createdAt,
    });

    const row = db
      .prepare('SELECT * FROM appointments WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbAppointment;
    res.status(201).json(rowToAppointment(row));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/appointments/:id ─────────────────────────────────────────────────

router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM appointments WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbAppointment | undefined;
    if (!existing) throw new AppError(404, 'NOT_FOUND', `Appointment ${id} not found.`);

    const body = req.body as UpdateAppointmentRequest;
    const current = rowToAppointment(existing);

    db.prepare(`
      UPDATE appointments SET
        patient_hn = @patient_hn, date = @date, time = @time,
        notes = @notes, status = @status, created_at = @created_at
      WHERE id = @id AND clinic_id = @clinic_id
    `).run({
      id,
      clinic_id: clinicId,
      patient_hn: body.patientHN ?? current.patientHN ?? null,
      date: body.date ?? current.date,
      time: body.time ?? current.time ?? null,
      notes: body.notes ?? current.notes ?? null,
      status: body.status ?? current.status ?? 'pending',
      created_at: body.createdAt ?? current.createdAt ?? null,
    });

    const updated = db
      .prepare('SELECT * FROM appointments WHERE id = ? AND clinic_id = ?')
      .get(id, clinicId) as DbAppointment;
    res.json(rowToAppointment(updated));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/appointments/:id ──────────────────────────────────────────────

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM appointments WHERE id = ? AND clinic_id = ?')
      .run(req.params.id, req.clinicId);

    if (result.changes === 0) {
      throw new AppError(404, 'NOT_FOUND', `Appointment ${req.params.id} not found.`);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
