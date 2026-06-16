/**
 * Dev seed — run with: npm run seed
 * Creates a demo clinic, demo user, and sample patients/owners.
 * Safe to run multiple times (uses INSERT OR IGNORE / INSERT OR REPLACE).
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Bootstrap env before anything else
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

import bcrypt from 'bcryptjs';
import { getDb } from './connection';
import { runMigrations } from './schema';
import type { Visit } from '@shared/types';

async function seed(): Promise<void> {
  runMigrations();
  const db = getDb();

  // ── Clinic ──────────────────────────────────────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO clinics (id, name, active, expires_at)
    VALUES ('clinic-1', 'AsiaPet Demo Clinic', 1, NULL)
  `).run();

  // Default demo clinic
  db.prepare(`
    INSERT OR IGNORE INTO clinics (id, name, active, expires_at)
    VALUES ('demo', 'Demo Clinic', 1, NULL)
  `).run();

  console.log('[seed] Clinics ready: clinic-1, demo');

  // ── Demo user ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('asiapet123', 10);
  db.prepare(`
    INSERT OR REPLACE INTO users (id, email, password_hash, clinic_id, role, display_name)
    VALUES ('user-1', 'vet@asiapet.local', ?, 'clinic-1', 'vet', 'Demo Vet')
  `).run(passwordHash);

  console.log('[seed] User ready: vet@asiapet.local / asiapet123');

  // ── Admin user ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  db.prepare(`
    INSERT OR REPLACE INTO users (id, email, password_hash, clinic_id, role, display_name)
    VALUES ('user-admin', 'admin@asiapet.com', ?, 'demo', 'admin', 'Admin')
  `).run(adminHash);

  console.log('[seed] Admin ready: admin@asiapet.com / admin123');

  // ── Sample owners ────────────────────────────────────────────────────────────
  const owners = [
    {
      id: 'owner-1',
      name: 'สมชาย ใจดี',
      phone: '081-111-1111',
      line_id: 'somchai_jd',
      facebook: '',
      notes: 'ลูกค้าประจำ',
      created_at: new Date().toISOString(),
    },
    {
      id: 'owner-2',
      name: 'วิภา รักสัตว์',
      phone: '089-222-2222',
      line_id: 'vipa_rs',
      facebook: '',
      notes: '',
      created_at: new Date().toISOString(),
    },
  ];

  const insertOwner = db.prepare(`
    INSERT OR IGNORE INTO owners (id, clinic_id, name, phone, line_id, facebook, notes, created_at)
    VALUES (@id, 'clinic-1', @name, @phone, @line_id, @facebook, @notes, @created_at)
  `);
  for (const o of owners) insertOwner.run(o);

  console.log('[seed] Owners ready:', owners.map((o) => o.name).join(', '));

  // ── Sample patients ──────────────────────────────────────────────────────────
  const now = new Date().toISOString().slice(0, 10);

  const sampleVisit1: Visit = {
    date: '2024-01-15',
    opd: {
      weight: '5.2',
      temp: '38.5',
      cc: 'อาเจียน 2 วัน',
      dx: 'Gastroenteritis',
      plan: 'NPO 12h, IV fluid, metronidazole',
      vet: 'Demo Vet',
      savedAt: '2024-01-15T09:30:00.000Z',
    },
    rx: {
      items: [
        { name: 'Metronidazole 250 mg', instruction: '1 tab PO BID x 5 days', qty: '10' },
        { name: 'Omeprazole 20 mg', instruction: '1 cap PO SID x 5 days', qty: '5' },
      ],
      savedAt: '2024-01-15T09:45:00.000Z',
    },
  };

  const sampleVisit2: Visit = {
    date: '2024-03-10',
    opd: {
      weight: '3.8',
      temp: '38.9',
      cc: 'Annual wellness check',
      dx: 'Healthy',
      plan: 'Vaccination, flea prevention',
      vet: 'Demo Vet',
      savedAt: '2024-03-10T10:00:00.000Z',
    },
    vaccines: [
      {
        name: 'FVRCP',
        date: '2024-03-10',
        vet: 'Demo Vet',
        route: 'SC',
        nextDue: '2025-03-10',
      },
    ],
  };

  const patients = [
    {
      hn: 'HN-0001',
      name: 'บัดดี้',
      species: 'Dog',
      breed: 'Golden Retriever',
      sex: 'M',
      birthdate: '2020-05-01',
      color: 'Golden',
      owner: 'สมชาย ใจดี',
      owner_phone: '081-111-1111',
      owner_line: 'somchai_jd',
      owner_facebook: '',
      owner_id: 'owner-1',
      main_disease: '',
      allergies: '',
      deceased: 0,
      moved: 0,
      visits: JSON.stringify([sampleVisit1]),
      imported_at: null,
      uid: null,
    },
    {
      hn: 'HN-0002',
      name: 'มิ้ว',
      species: 'Cat',
      breed: 'Domestic Shorthair',
      sex: 'F',
      birthdate: '2021-11-20',
      color: 'Tabby',
      owner: 'วิภา รักสัตว์',
      owner_phone: '089-222-2222',
      owner_line: 'vipa_rs',
      owner_facebook: '',
      owner_id: 'owner-2',
      main_disease: '',
      allergies: '',
      deceased: 0,
      moved: 0,
      visits: JSON.stringify([sampleVisit2]),
      imported_at: null,
      uid: null,
    },
    {
      hn: 'HN-0003',
      name: 'โกลด์',
      species: 'Dog',
      breed: 'Labrador Retriever',
      sex: 'M',
      birthdate: '2019-08-15',
      color: 'Black',
      owner: 'สมชาย ใจดี',
      owner_phone: '081-111-1111',
      owner_line: 'somchai_jd',
      owner_facebook: '',
      owner_id: 'owner-1',
      main_disease: 'Hypothyroidism',
      allergies: 'Chicken',
      deceased: 0,
      moved: 0,
      visits: JSON.stringify([]),
      imported_at: null,
      uid: null,
    },
  ];

  const insertPatient = db.prepare(`
    INSERT OR IGNORE INTO patients
      (hn, clinic_id, name, species, breed, sex, birthdate, color,
       owner, owner_phone, owner_line, owner_facebook, owner_id,
       main_disease, allergies, deceased, moved, visits, imported_at, uid)
    VALUES
      (@hn, 'clinic-1', @name, @species, @breed, @sex, @birthdate, @color,
       @owner, @owner_phone, @owner_line, @owner_facebook, @owner_id,
       @main_disease, @allergies, @deceased, @moved, @visits, @imported_at, @uid)
  `);

  for (const p of patients) insertPatient.run(p);

  console.log('[seed] Patients ready:', patients.map((p) => `${p.hn} (${p.name})`).join(', '));

  // ── Sample appointment ────────────────────────────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO appointments (id, clinic_id, patient_hn, date, time, notes, status, created_at)
    VALUES ('appt-1', 'clinic-1', 'HN-0001', ?, '09:00', 'Annual check-up', 'confirmed', ?)
  `).run(now, new Date().toISOString());

  console.log('[seed] Sample appointment created.');
  console.log('[seed] Done. Login: vet@asiapet.local / asiapet123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
