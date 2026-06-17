// bundle-seed — copy the canonical content seed (../data/seed, in the VetAsiaPet monorepo) into this
// backend repo (./data/seed) so the standalone/deployed backend ships the latest drug/disease data.
//
// Workflow on the content machine, after editing AsiaPet.html:
//   node ../tools/extract-seed.mjs    (AsiaPet.html → ../data/seed/*.json)   [monorepo only]
//   npm run bundle-seed               (../data/seed → backend/data/seed)
//   git add data/seed && git commit && git push      (ship the updated content)
//
// On a cloned standalone backend there is no ../data/seed; the bundled copy is the source of truth.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../data/seed');   // monorepo canonical
const dst = path.resolve(here, '../data/seed');       // bundled-in-repo copy

if (!fs.existsSync(src)) {
  console.error(`✗ canonical seed not found at ${src}`);
  console.error('  This script only runs in the VetAsiaPet monorepo (run extract-seed.mjs first).');
  process.exit(1);
}
fs.mkdirSync(dst, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.json'))) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
  n++;
}
console.log(`✓ bundled ${n} seed files → backend/data/seed  (commit + push to ship to deployed backends)`);
