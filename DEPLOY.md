# AsiaPet — Deploy as a subscription web service

Everything a fresh machine needs to run + deploy the AsiaPet EHR as a **per-clinic subscription** SaaS.
Two repos, two processes:

| | Repo | What it is | Hosting |
|---|---|---|---|
| **Backend** | `Asiapet_Backend` | Express + SQLite REST API + admin panel — the **subscription brain** (auth, license, data, content). Self-contained (content seed is bundled). | Always-on Node host (Render / Railway / Fly / a VPS) |
| **Frontend** | `Asiapet_Frontend` | React + Vite SPA — pure client (UI + API calls). | Any static host (Netlify / Vercel / Cloudflare Pages) |

Subscription model is already built in: each **clinic** row has `active` (on/off) + `expires_at`. Login is
blocked if the clinic is inactive or expired. The **admin panel** turns clinics on/off and extends expiry.

---

## 1. Run locally (other computer — first time)

```bash
# --- Backend ---
git clone https://github.com/JomLast/Asiapet_Backend.git
cd Asiapet_Backend
cp .env.example .env            # then edit: set a long random JWT_SECRET
npm install
npm run seed                    # creates SQLite DB + a demo clinic + admin user
npm run dev                     # http://localhost:4000   (content seed is bundled — no monorepo needed)

# --- Frontend (new terminal) ---
git clone https://github.com/JomLast/Asiapet_Frontend.git
cd Asiapet_Frontend
cp .env.example .env            # VITE_API_URL=http://localhost:4000/api   (default is fine locally)
npm install
npm run dev                     # http://localhost:5173
```

**Default admin login** (created by `npm run seed`): `admin@asiapet.com` / `admin123` — **change the password
+ JWT_SECRET before going live.** Admin panel: **http://localhost:4000/admin**

---

## 2. Provision a subscriber (per clinic)

Done from the **admin panel** (`/admin`, log in as an admin user):
1. **Clinics tab → Create clinic** — name + `expiresAt` (the subscription end date).
2. Create that clinic's user account (email + password, `role` = normal) bound to the clinic — currently via
   DB / seed (`src/db/seed.ts` shows the `users` insert pattern); add an "add user" admin endpoint if you want
   it in the UI.
3. To **renew**: extend `expiresAt`.  To **suspend**: toggle `active = false`. Login is refused immediately.

Backend enforces this on every login (`src/routes/auth.ts`) and scopes all data by `clinic_id`, so clinics are
fully isolated.

---

## 3. Production deploy

**Backend** (Node host):
- Set env: `JWT_SECRET` (long random — REQUIRED), `PORT` (host usually injects it), `DEFAULT_CLINIC_ID`.
- Build + run: `npm run build && npm start`  (or `npm run dev` for simplicity).
- **Persistence:** SQLite lives at `data/asiapet.db`. Give the host a **persistent disk** mounted at `data/`,
  or migrate to Postgres for serious scale (schema is in `src/db/schema.ts`).
- **CORS:** `src/app.ts` currently reflects any origin (`origin: true`) — fine to start; for hardening, restrict
  it to your frontend domain.
- Content seed is **bundled** in `data/seed/` — no extra step.

**Frontend** (static host):
- Set `VITE_API_URL` = your deployed backend URL + `/api` (e.g. `https://api.yourdomain.com/api`).
- Build: `npm run build` → upload the `dist/` folder.

---

## 4. Update clinical content (drugs/diseases) later

Content is authored in the **VetAsiaPet monorepo** (`AsiaPet.html`), not here. To push an update to deployed
backends:
```bash
# in the monorepo:
node tools/extract-seed.mjs          # AsiaPet.html → data/seed/*.json   (verify-data must pass first)
cd backend && npm run bundle-seed    # data/seed → backend/data/seed
git add data/seed && git commit -m "content update" && git push
# then redeploy the backend
```
⚠ Clinical doses are verified against Carpenter/Plumb's/BSAVA ("ห้ามมั่ว") — never hand-edit `data/seed`; always
regenerate from `AsiaPet.html`.
