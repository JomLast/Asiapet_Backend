import fs from 'fs';
import path from 'path';

/**
 * Seed data lives at  ../data/seed  relative to the backend project root.
 * process.cwd() = D:\VetAsiaPet\backend  when started with `npm run dev`
 * or `npm run seed`.
 *
 * Every *.json file in that directory is served read-only via
 * GET /api/content/:type, keyed by its basename (e.g. "drugs", "lab-refs",
 * "fluid-maint", "bsa-k"). This means newly-extracted seed datasets become
 * available automatically — no whitelist to maintain.
 */
const SEED_DIR = path.resolve(process.cwd(), '../data/seed');

const _store: Record<string, unknown> = {};

/** Load every seed JSON file into memory once at boot, keyed by basename. */
export function loadContent(): void {
  if (!fs.existsSync(SEED_DIR)) {
    console.warn(`[content] Seed directory not found: ${SEED_DIR}`);
    return;
  }
  const files = fs.readdirSync(SEED_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'manifest.json'
  );
  for (const file of files) {
    const key = file.replace(/\.json$/, '');
    try {
      const raw = fs.readFileSync(path.join(SEED_DIR, file), 'utf-8');
      _store[key] = JSON.parse(raw);
    } catch (err) {
      console.warn(`[content] Failed to load ${file}: ${(err as Error).message}`);
    }
  }
  const total = Object.keys(_store).length;
  console.log(`[content] Loaded ${total} seed datasets from ${SEED_DIR}`);
}

/**
 * Reload a single dataset from disk into the in-memory store.
 * Called after admin content updates so GET /api/content/:type
 * reflects the change without a server restart.
 */
export function reloadDataset(type: string): void {
  const filePath = path.join(SEED_DIR, `${type}.json`);
  if (!fs.existsSync(filePath)) {
    delete _store[type];
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    _store[type] = JSON.parse(raw);
  } catch (err) {
    console.warn(`[content] Failed to reload ${type}: ${(err as Error).message}`);
  }
}

/**
 * Returns the parsed content for the given type (basename), or null if there
 * is no such seed file. The value may be an array (drugs, diseases, ...) or an
 * object map (lab-refs, fluid-maint, ...) depending on the source dataset.
 */
export function getContent(type: string): unknown | null {
  if (!(type in _store)) return null;
  return _store[type];
}
