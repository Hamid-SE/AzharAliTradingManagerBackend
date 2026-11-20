# Deploy backend on Render

## One-time (Dashboard)

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with GitHub (**Hamid-SE**).
2. **New → Blueprint**.
3. Connect **AzharAliTradingManagerBackend** → branch **main** → Blueprint path **`render.yaml`**.
4. Review the web service → **Apply**.
5. Open the new service → **Environment** → add values (copy from your local `backend/.env`, never commit):

   | Key | Required |
   |-----|----------|
   | `MONGODB_URI` | Yes |
   | `AUTH_SECRET` | Yes (same as Vercel frontend later) |
   | `ADMIN_EMAIL` | Yes |
   | `ADMIN_PASSWORD` | Yes |
   | `ADMIN_NAME` | Optional |
   | `FRONTEND_ORIGIN` | Yes after frontend URL exists |
   | `GEMINI_API_KEY` | Optional |

6. Save — Render redeploys. Wait until deploy status is **Live**.

## Test

- `https://YOUR-SERVICE.onrender.com/health` → `{"ok":true}`
- POST `https://YOUR-SERVICE.onrender.com/api/auth/login` with JSON `{"email":"...","password":"..."}` → `200`
- With session cookie, `GET /api/dashboard` → JSON metrics

`NODE_ENV` is set to `production` in the Blueprint (secure cookies — use HTTPS only).

## Manual web service (no Blueprint)

**New → Web Service** → same repo → Build: `npm install`, Start: `npm start`, Health: `/health`, same env vars.

## Public repo on Render (no GitHub app)

If the repo is **public**, on **New Web Service** → **Public Git Repository** tab:

`https://github.com/Hamid-SE/AzharAliTradingManagerBackend`

Click **Connect**, then set the same build/start commands and environment variables.