import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Content versioning system — generates and caches a manifest describing
 * every JSON seed file, including MD5 hash, item count, and version number.
 */

// Seed dir resolver — keep in sync with content/loader.ts (standalone bundled vs monorepo parent).
function resolveSeedDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '../data/seed'),  // monorepo canonical
    path.resolve(process.cwd(), 'data/seed'),     // standalone repo: bundled copy
    path.resolve(__dirname, '../../data/seed'),   // compiled-dist fallback
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[1];
}
const SEED_DIR = resolveSeedDir();
const MANIFEST_PATH = path.join(SEED_DIR, 'manifest.json');

// ── Types ────────────────────────────────────────────────────────────────────

export interface DatasetMeta {
  version: number;
  count: number;
  hash: string;
}

export interface ContentManifest {
  version: number;
  updated: string;
  datasets: Record<string, DatasetMeta>;
}

// ── In-memory cache ──────────────────────────────────────────────────────────

let _manifest: ContentManifest | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function md5(content: string): string {
  return crypto.createHash('md5').update(content, 'utf-8').digest('hex');
}

function countItems(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data !== null && typeof data === 'object') return Object.keys(data).length;
  return 1;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Reads every JSON file in data/seed/, computes MD5 + item count,
 * writes manifest.json, and caches the result. Safe to call at boot.
 */
export function generateManifest(): ContentManifest {
  if (!fs.existsSync(SEED_DIR)) {
    console.warn(`[content-manager] Seed directory not found: ${SEED_DIR}`);
    _manifest = { version: 1, updated: new Date().toISOString(), datasets: {} };
    return _manifest;
  }

  const files = fs.readdirSync(SEED_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'manifest.json'
  );

  // Try to read existing manifest to preserve per-dataset version numbers
  let existing: ContentManifest | null = null;
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as ContentManifest;
    } catch {
      // Corrupt manifest — will regenerate from scratch
    }
  }

  const datasets: Record<string, DatasetMeta> = {};
  let globalVersion = existing?.version ?? 1;

  for (const file of files) {
    const key = file.replace(/\.json$/, '');
    try {
      const raw = fs.readFileSync(path.join(SEED_DIR, file), 'utf-8');
      const data = JSON.parse(raw);
      const hash = md5(raw);
      const count = countItems(data);

      // Preserve version from existing manifest if hash unchanged
      const prev = existing?.datasets[key];
      const version = prev ? (prev.hash === hash ? prev.version : prev.version + 1) : 1;

      datasets[key] = { version, count, hash };
    } catch (err) {
      console.warn(`[content-manager] Failed to hash ${file}: ${(err as Error).message}`);
    }
  }

  const manifest: ContentManifest = {
    version: globalVersion,
    updated: new Date().toISOString(),
    datasets,
  };

  // Write to disk
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[content-manager] Manifest written with ${Object.keys(datasets).length} datasets.`);
  } catch (err) {
    console.warn(`[content-manager] Failed to write manifest: ${(err as Error).message}`);
  }

  _manifest = manifest;
  return manifest;
}

/** Returns the cached manifest (call generateManifest first at boot). */
export function getManifest(): ContentManifest {
  if (!_manifest) {
    return generateManifest();
  }
  return _manifest;
}

/**
 * Replaces the contents of a seed JSON file, bumps its version in the
 * manifest, and reloads the content store.
 */
export function updateDataset(type: string, data: unknown): DatasetMeta {
  const filePath = path.join(SEED_DIR, `${type}.json`);
  const raw = JSON.stringify(data, null, 2);
  const hash = md5(raw);
  const count = countItems(data);

  // Read current version
  const manifest = getManifest();
  const prev = manifest.datasets[type];
  const version = prev ? prev.version + 1 : 1;

  // Write file
  fs.writeFileSync(filePath, raw, 'utf-8');

  // Update manifest
  manifest.datasets[type] = { version, count, hash };
  manifest.version = (manifest.version || 0) + 1;
  manifest.updated = new Date().toISOString();

  // Persist manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  _manifest = manifest;

  console.log(`[content-manager] Updated dataset '${type}' → v${version} (${count} items)`);
  return { version, count, hash };
}

/** Returns metadata for a single dataset type, or null if it doesn't exist. */
export function getDatasetMeta(type: string): DatasetMeta | null {
  const manifest = getManifest();
  return manifest.datasets[type] ?? null;
}
