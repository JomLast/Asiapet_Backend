import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env before anything else
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { createApp } from './app';
import { runMigrations } from './db/schema';
import { loadContent } from './content/loader';
import { generateManifest } from './content/manager';

const PORT = Number(process.env.PORT) || 4000;

async function main(): Promise<void> {
  // Run DB migrations (idempotent — CREATE TABLE IF NOT EXISTS)
  runMigrations();

  // Generate content manifest (computes hashes for all seed files)
  generateManifest();

  // Load static content into memory
  loadContent();

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`[server] AsiaPet backend running on http://localhost:${PORT}`);
    console.log(`[server] Health: http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error('[server] Fatal error:', err);
  process.exit(1);
});
