import { getDb } from './connection';

/** Run all CREATE TABLE IF NOT EXISTS migrations synchronously on startup. */
export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS clinics (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      clinic_id     TEXT NOT NULL REFERENCES clinics(id),
      role          TEXT,
      display_name  TEXT
    );

    CREATE TABLE IF NOT EXISTS patients (
      hn             TEXT NOT NULL,
      clinic_id      TEXT NOT NULL REFERENCES clinics(id),
      name           TEXT NOT NULL,
      species        TEXT,
      breed          TEXT,
      sex            TEXT,
      birthdate      TEXT,
      color          TEXT,
      owner          TEXT,
      owner_phone    TEXT,
      owner_line     TEXT,
      owner_facebook TEXT,
      owner_id       TEXT,
      main_disease   TEXT,
      allergies      TEXT,
      deceased       INTEGER NOT NULL DEFAULT 0,
      moved          INTEGER NOT NULL DEFAULT 0,
      visits         TEXT NOT NULL DEFAULT '[]',
      imported_at    TEXT,
      uid            TEXT,
      updated_at     TEXT,
      PRIMARY KEY (hn, clinic_id)
    );

    CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);

    CREATE TABLE IF NOT EXISTS owners (
      id         TEXT NOT NULL,
      clinic_id  TEXT NOT NULL REFERENCES clinics(id),
      name       TEXT NOT NULL,
      phone      TEXT,
      line_id    TEXT,
      facebook   TEXT,
      notes      TEXT,
      created_at TEXT,
      PRIMARY KEY (id, clinic_id)
    );

    CREATE INDEX IF NOT EXISTS idx_owners_clinic ON owners(clinic_id);

    CREATE TABLE IF NOT EXISTS appointments (
      id          TEXT NOT NULL,
      clinic_id   TEXT NOT NULL REFERENCES clinics(id),
      patient_hn  TEXT,
      date        TEXT NOT NULL,
      time        TEXT,
      notes       TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TEXT,
      PRIMARY KEY (id, clinic_id)
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments(clinic_id, date);

    CREATE TABLE IF NOT EXISTS bookings (
      id         TEXT NOT NULL,
      clinic_id  TEXT NOT NULL,
      name       TEXT,
      phone      TEXT,
      pet_name   TEXT,
      species    TEXT,
      date       TEXT,
      time       TEXT,
      reason     TEXT,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT,
      PRIMARY KEY (id, clinic_id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_clinic ON bookings(clinic_id);

    CREATE TABLE IF NOT EXISTS content_versions (
      type       TEXT PRIMARY KEY,
      version    INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );
  `);

  // Add updated_at column if missing (safe for existing DBs)
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN updated_at TEXT`);
  } catch {
    // Column already exists — ignore
  }

  console.log('[db] Migrations applied.');
}
