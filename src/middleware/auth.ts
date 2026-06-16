import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { ApiError } from '@shared/types';

interface JwtPayload {
  userId: string;
  clinicId: string;
  iat?: number;
  exp?: number;
}

function jwtSecret(): string {
  return process.env.JWT_SECRET || 'changeme_use_env_in_prod';
}

/** Sign a token with userId + clinicId claims (12 h expiry). */
export function signToken(userId: string, clinicId: string): string {
  return jwt.sign({ userId, clinicId }, jwtSecret(), { expiresIn: '12h' });
}

/**
 * Express middleware — validates Bearer token and attaches userId + clinicId
 * to the request object.  Intended for use on individual protected routes.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const body: ApiError = {
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header.',
    };
    res.status(401).json(body);
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret()) as JwtPayload;
    req.userId = payload.userId;
    req.clinicId = payload.clinicId;
    next();
  } catch {
    const body: ApiError = {
      error: 'UNAUTHORIZED',
      message: 'Token is invalid or has expired.',
    };
    res.status(401).json(body);
  }
}
