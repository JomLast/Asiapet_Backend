import { Router, Request, Response } from 'express';
import { getContent } from '../content/loader';
import { getManifest, getDatasetMeta } from '../content/manager';
import type { ApiError } from '@shared/types';

const router = Router();

/** GET /api/content/manifest — returns the full content manifest (public). */
router.get('/manifest', (_req: Request, res: Response) => {
  res.json(getManifest());
});

/** GET /api/content/:type/version — returns version info for a single dataset. */
router.get('/:type/version', (req: Request, res: Response) => {
  const meta = getDatasetMeta(req.params.type);
  if (!meta) {
    const body: ApiError = {
      error: 'NOT_FOUND',
      message: `Unknown content type: ${req.params.type}`,
    };
    res.status(404).json(body);
    return;
  }
  res.json(meta);
});

/** GET /api/content/:type — returns dataset (existing, public). */
router.get('/:type', (req: Request, res: Response) => {
  const data = getContent(req.params.type);
  if (data === null) {
    const body: ApiError = {
      error: 'NOT_FOUND',
      message: `Unknown content type: ${req.params.type}`,
    };
    res.status(404).json(body);
    return;
  }
  res.json(data);
});

export default router;
