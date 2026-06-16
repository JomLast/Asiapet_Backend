// Augment Express Request to carry JWT claims attached by auth middleware.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      clinicId?: string;
    }
  }
}

export {};
