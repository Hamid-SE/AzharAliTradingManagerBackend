# Deploy backend (recommended: Railway)

## Railway (GitHub — works with private repos)

1. Open [railway.app](https://railway.app) → **Login with GitHub** (Hamid-SE).
2. **New Project** → **Deploy from GitHub repo**.
3. Choose **AzharAliTradingManagerBackend** (root of repo — no monorepo folder).
4. Wait for the first build. Open the service → **Variables** → add:

   | Key | Required |
   |-----|----------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Yes |
   | `AUTH_SECRET` | Yes (match frontend / Vercel) |
   | `ADMIN_EMAIL` | Yes |
   | `ADMIN_PASSWORD` | Yes |
   | `ADMIN_NAME` | Optional |
   | `FRONTEND_ORIGIN` | Vercel URL when ready (or `http://localhost:3000` for testing) |
   | `GEMINI_API_KEY` | Optional |

5. **Settings** → **Networking** → **Generate domain** (public HTTPS URL).
6. Redeploy if needed after variables are set.

## Test

- `https://YOUR-APP.up.railway.app/health` → `{"ok":true}`

Use that URL as `BACKEND_URL` in Vercel (frontend).

---

## Render (optional)

See `render.yaml` in this repo. Use **Git Provider** + repo access on GitHub, not “Public Git Repository” (repo is private).