# AsiaPet Backend

Node.js + Express + TypeScript REST API for the AsiaPet veterinary EHR.

## Quick start

```bash
cd backend
cp .env.example .env          # edit JWT_SECRET before production
npm install
npm run seed                  # creates DB + demo data
npm run dev                   # tsx watch on http://localhost:4000
```

### Demo credentials
| Field | Value |
|-------|-------|
| Email | `vet@asiapet.local` |
| Password | `asiapet123` |
| Clinic ID | `clinic-1` |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled production server |
| `npm run seed` | Create demo clinic, user, and sample patients |
| `npm run typecheck` | Type-check without emitting files |

---

## Environment variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP port |
| `JWT_SECRET` | `changeme_...` | **Change in production** |
| `DEFAULT_CLINIC_ID` | `clinic-1` | Clinic for public booking `POST /api/bookings` |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |

---

## Architecture

```
src/
  index.ts          — entry: load env, run migrations, load content, start server
  app.ts            — Express factory: middleware + route wiring
  db/
    connection.ts   — better-sqlite3 singleton (WAL mode, foreign keys ON)
    schema.ts       — CREATE TABLE IF NOT EXISTS migrations (idempotent)
    seed.ts         — dev seed: demo clinic + user + patients
  middleware/
    auth.ts         — JWT sign/verify, requireAuth middleware
    errorHandler.ts — AppError class + central error handler
  content/
    loader.ts       — loads ../data/seed/*.json into memory at boot
  routes/
    health.ts
    auth.ts
    patients.ts     — includes nested /visits routes
    owners.ts
    appointments.ts
    bookings.ts     — POST is public; GET/PUT require auth
    content.ts      — public static content
    admin.ts        — bulk legacy import
```

Database file: `backend/data/asiapet.db` (gitignored, created automatically).

Static seed content: `../data/seed/` (read-only, never modified by the server).

---

## Endpoint reference

All routes are under `/api`. Protected routes require `Authorization: Bearer <token>`.

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check `{ ok, time }` |
| `POST` | `/api/auth/login` | Login → `{ token, user }` |
| `GET` | `/api/content/:type` | Static content array |
| `POST` | `/api/bookings` | Submit online booking (website form) |

**Content types:** `drugs`, `diseases`, `vaccines`, `lab-refs`, `husbandry`, `emergency`, `pain-scales`

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/me` | Current user from token |

### Patients

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/patients` | List `ListResponse<Patient>` (supports `?q=`, `?page=`, `?limit=`) |
| `POST` | `/api/patients` | Create patient |
| `GET` | `/api/patients/:hn` | Get patient |
| `PUT` | `/api/patients/:hn` | Update patient |
| `DELETE` | `/api/patients/:hn` | Delete patient |
| `GET` | `/api/patients/:hn/visits` | List visits `ListResponse<Visit>` |
| `POST` | `/api/patients/:hn/visits` | Add/upsert visit (keyed by `visit.date`) |
| `PUT` | `/api/patients/:hn/visits/:date` | Update specific visit |

### Owners

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/owners` | List owners (supports `?q=`, `?page=`, `?limit=`) |
| `POST` | `/api/owners` | Create owner |
| `GET` | `/api/owners/:id` | Get owner |
| `PUT` | `/api/owners/:id` | Update owner |
| `DELETE` | `/api/owners/:id` | Delete owner |

### Appointments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/appointments` | List (supports `?date=`, `?page=`, `?limit=`) |
| `POST` | `/api/appointments` | Create appointment |
| `PUT` | `/api/appointments/:id` | Update appointment |
| `DELETE` | `/api/appointments/:id` | Delete appointment |

### Bookings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/bookings` | Required | List clinic bookings |
| `POST` | `/api/bookings` | None | Public form submission |
| `PUT` | `/api/bookings/:id` | Required | Update booking status |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/import` | Bulk import legacy `asiaPetDB` dump |

---

## Error responses

All errors use the `ApiError` shape:

```json
{
  "error": "NOT_FOUND",
  "message": "Patient HN-9999 not found.",
  "details": { "field": "validation message" }
}
```

Common codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_SERVER_ERROR` (500).

---

## Tenant isolation

Every data query is scoped to `clinicId` extracted from the JWT. It is impossible for clinic A to access clinic B's data even with a valid token.

## Multi-tenant data model

```
clinics (id, name, active, expires_at)
users   (id, email, password_hash, clinic_id, role, display_name)
patients (hn PK + clinic_id PK, ...fields, visits TEXT JSON)
owners   (id PK + clinic_id PK, ...fields)
appointments (id PK + clinic_id PK, ...fields)
bookings     (id PK + clinic_id, ...fields)
```

Patient `visits` (array of `Visit`) is stored as a JSON text column and round-trips faithfully. The `POST /patients/:hn/visits` endpoint upserts by `visit.date`.
