import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection';
import { signToken, requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type { LoginRequest, LoginResponse, AuthUser } from '@shared/types';

const router = Router();

// ── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'email and password are required.', {
        ...(email ? {} : { email: 'required' }),
        ...(password ? {} : { password: 'required' }),
      });
    }

    const db = getDb();

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim()) as DbUser | undefined;

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password.');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password.');
    }

    // Verify the clinic is active and not expired
    const clinic = db
      .prepare('SELECT * FROM clinics WHERE id = ?')
      .get(user.clinic_id) as DbClinic | undefined;

    if (!clinic || !clinic.active) {
      throw new AppError(403, 'FORBIDDEN', 'Clinic account is inactive.');
    }

    if (clinic.expires_at && new Date(clinic.expires_at) < new Date()) {
      throw new AppError(403, 'FORBIDDEN', 'Clinic subscription has expired.');
    }

    const token = signToken(user.id, user.clinic_id);

    const authUser: AuthUser = {
      userId: user.id,
      email: user.email,
      clinicId: user.clinic_id,
      role: user.role ?? undefined,
      displayName: user.display_name ?? undefined,
    };

    const body: LoginResponse = { token, user: authUser };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(req.userId) as DbUser | undefined;

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    const authUser: AuthUser = {
      userId: user.id,
      email: user.email,
      clinicId: user.clinic_id,
      role: user.role ?? undefined,
      displayName: user.display_name ?? undefined,
    };

    res.json(authUser);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/license ────────────────────────────────────────────────────

router.get('/license', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const clinicId = req.clinicId!;

    const clinic = db
      .prepare('SELECT * FROM clinics WHERE id = ?')
      .get(clinicId) as DbClinic | undefined;

    if (!clinic) {
      throw new AppError(404, 'NOT_FOUND', 'Clinic not found.');
    }

    let daysRemaining: number | null = null;
    if (clinic.expires_at) {
      const now = new Date();
      const exp = new Date(clinic.expires_at);
      daysRemaining = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      clinicId: clinic.id,
      clinicName: clinic.name,
      active: Boolean(clinic.active),
      expiresAt: clinic.expires_at,
      daysRemaining,
    });
  } catch (err) {
    next(err);
  }
});

// ── Local DB row types ────────────────────────────────────────────────────────

interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  clinic_id: string;
  role: string | null;
  display_name: string | null;
}

interface DbClinic {
  id: string;
  name: string;
  active: number;
  expires_at: string | null;
}

export default router;
