# Deployment

| Piece | Service | Notes |
| --- | --- | --- |
| API | Render (free web service, Singapore) | `apps/api/render.yaml` |
| Web | Vercel (region `sin1`) | `apps/web/vercel.json` |
| Database | Supabase Postgres | Session pooler, port 5432 |
| Images | Supabase Storage | Public bucket `posly` |

## Order

The two apps point at each other, so one of them has to go first with a placeholder.

1. **Supabase** (already done for this project)
   - Database: nothing to create — migrations run on every API start.
   - Storage: a **public** bucket named `posly`.
2. **Render — API.** New → Blueprint → this repo, blueprint path `apps/api/render.yaml`. Fill in
   the prompted variables:
   - `DATABASE_URL` — Supabase → Connect → *Session pooler* URI.
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API.
   - `CORS_ORIGINS`, `PUBLIC_WEB_URL` — put `https://placeholder.invalid` for now.
   - Leave `UPSTASH_*` and `GOOGLE_CLIENT_ID` empty.
   - When it is live, `https://<service>.onrender.com/healthcheck` returns `"database":"up"`.
3. **Vercel — web.** Import this repo, **Root Directory** `apps/web`, framework Next.js, and
   leave "Include files outside the root directory in the Build Step" on — the app imports
   `packages/*`. Vercel sees `pnpm-lock.yaml` at the repo root and installs the workspace.
   Environment variables:
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1` — without it Vercel picks a pnpm from the lockfile
     version instead of `packageManager` (pnpm 12), and ignores `allowBuilds`.
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<service>.onrender.com/api/v1`
   - `NEXT_PUBLIC_SITE_URL` = the Vercel production URL
   - These are inlined at **build** time: changing them needs a redeploy, not a restart.
4. **Back to Render.** Set `CORS_ORIGINS` and `PUBLIC_WEB_URL` to the Vercel production URL
   (no trailing slash) and let it redeploy. Invite links are built from `PUBLIC_WEB_URL`.

## Checks after the first deploy

- Register → onboarding → sample menu → sell one item → the dashboard shows it.
- Upload a product photo; it appears on the POS card (served from `*.supabase.co`).
- Employees → invite → the link starts with the Vercel URL, not `localhost`.

## Things that are easy to get wrong

- **pnpm on Render** runs as `corepack pnpm …` in `buildCommand`, pinned by `packageManager`
  in the root `package.json`. Never `corepack enable` there: `/usr/bin` is read-only and the build
  fails with `EROFS: read-only file system, unlink '/usr/bin/pnpm'`.
- **Free Render instances sleep** after ~15 minutes idle; the first request after that takes
  ~30–60 s. A shop opening in the morning will see one slow load. The paid starter plan does
  not sleep.
- **Direct Supabase host** (`db.<ref>.supabase.co`) is IPv6-only and fails on Render with
  `ENOTFOUND`. Use the pooler host.
- **Transaction pooler** (port 6543) breaks prepared statements and LISTEN/NOTIFY. Use 5432.
- **Never point e2e tests at Supabase.** `pnpm --filter @posly/api test:e2e` refuses to start without
  `E2E_DATABASE_URL`; give it the docker-compose database.
- **Cookies** are set by the Next app on its own domain (httpOnly, `secure` in production),
  so the API and web can live on different domains without third-party cookies.
