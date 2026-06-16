# ⚠ DEPRECATED — Express + SQLite backend (no longer used by the app)

As of **2026-06-12** the system consolidated to a **single backend: Firebase (Firestore)**.
This Express + SQLite server is kept for reference only — the app no longer talks to it.

## What replaced it
| Old (this backend, REST) | New (Firebase) |
|---|---|
| `GET /api/content/*` (drug/disease updates) | Firestore `content/*` → app's `_content` module (`tools/seed-firestore.mjs` uploads) |
| `POST/GET /api/sync` (patient sync) | Firestore `clinics/{clinicId}/*` → app's `_cs` module |
| `POST /api/auth/login` (JWT) | Firebase Auth (email/password) |
| bookings / license | Firestore (already was) |

The app's `_bs` (backend-sync) module and the `DEFAULT_BACKEND_URL` / `ASIAPET_BACKEND_URL` build-time
injection were removed from `AsiaPet.html` and `build/`. See `docs/setup/START_HERE.md` →
"Single backend = Firebase".

Safe to delete this folder once you're confident nothing else references it. Left in place so the
REST schema / route handlers remain available if Firebase is ever reconsidered.
