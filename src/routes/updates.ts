import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Self-hosted Electron auto-update server.
 *
 * electron-updater (generic provider) checks:
 *   GET /updates/latest.yml       → version info (YAML)
 *   GET /updates/<filename>.exe   → installer binary
 *   GET /updates/<filename>.blockmap → delta info
 *
 * Release workflow:
 *   1. npm run build:sale   (on dev machine → produces dist/)
 *   2. Copy dist/latest.yml + dist/Asiapet-Setup-*.exe + *.blockmap
 *      into  backend/updates/
 *   3. All clients auto-detect and download on next launch.
 *
 * Admin can also upload via POST /updates/upload (multipart).
 */

const UPDATES_DIR = path.resolve(process.cwd(), 'updates');

// Ensure updates dir exists
if (!fs.existsSync(UPDATES_DIR)) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
}

// GET /updates/latest.yml — electron-updater reads this first
router.get('/latest.yml', (_req, res) => {
  const ymlPath = path.join(UPDATES_DIR, 'latest.yml');
  if (!fs.existsSync(ymlPath)) {
    return res.status(404).send('No update available');
  }
  res.type('text/yaml').sendFile(ymlPath);
});

// GET /updates/:filename — serve .exe, .blockmap, etc.
router.get('/:filename', (req, res) => {
  const filename = req.params.filename;

  // Security: only allow expected file types, no path traversal
  if (!/^[\w\-\.]+\.(exe|blockmap|yml|yaml|json)$/i.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(UPDATES_DIR, filename);
  if (!filePath.startsWith(UPDATES_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Set appropriate content type
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.exe': 'application/octet-stream',
    '.blockmap': 'application/octet-stream',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.json': 'application/json',
  };
  res.type(types[ext] || 'application/octet-stream');
  res.sendFile(filePath);
});

// GET /updates — list available update files (admin info)
router.get('/', (_req, res) => {
  try {
    const files = fs.readdirSync(UPDATES_DIR)
      .filter(f => /\.(exe|blockmap|yml|yaml)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(UPDATES_DIR, f));
        return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
      });

    // Parse version from latest.yml if it exists
    let currentVersion = null;
    const ymlPath = path.join(UPDATES_DIR, 'latest.yml');
    if (fs.existsSync(ymlPath)) {
      const yml = fs.readFileSync(ymlPath, 'utf-8');
      const match = yml.match(/^version:\s*(.+)$/m);
      if (match) currentVersion = match[1].trim();
    }

    res.json({ currentVersion, files });
  } catch (e) {
    res.json({ currentVersion: null, files: [] });
  }
});

export default router;
