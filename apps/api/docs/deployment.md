# Deployment

| Piece | Service | Notes |
| --- | --- | --- |
| API | Railway service | `apps/api/railway.json` |
| Database | Railway PostgreSQL | Private network, `DB_SSL=false` |
| Cache / queues | Railway Redis | `REDIS_URL`; shared by the cache and BullMQ |
| Images | Railway Storage Bucket | Private; served through `GET /api/v1/media/…` |
| Web | Vercel (region `sin1`) | `apps/web/vercel.json` |

## Order

The two apps point at each other, so one of them has to go first with a placeholder.

1. **Railway project.** New Project, in the region closest to the shops (Singapore). Then add
   **Database → PostgreSQL**, **Database → Redis** and **Bucket** (the same region).
   - Database: nothing to create. The API's pre-deploy command runs migrations.
2. **Railway API service.** Add **GitHub Repo → this repo**. In the service's Settings:
   - **Root Directory**: leave it empty (repo root). The API is a pnpm workspace member.
   - **Config file path**: `/apps/api/railway.json`. It sets the build, pre-deploy migration,
     start command, health check (`/healthcheck`) and watch paths, so a web-only commit
     doesn't redeploy the API.
   - **Networking → Generate Domain**.
   - Variables. Use the **Raw Editor**; `${{…}}` references resolve inside Railway:
     ```
     NODE_ENV=production
     API_PREFIX=api
     APP_TIMEZONE=Asia/Bangkok
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     DB_SSL=false
     REDIS_URL=${{Redis.REDIS_URL}}
     S3_ENDPOINT=${{Bucket.ENDPOINT}}
     S3_BUCKET=${{Bucket.BUCKET}}
     S3_REGION=${{Bucket.REGION}}
     S3_ACCESS_KEY_ID=${{Bucket.ACCESS_KEY_ID}}
     S3_SECRET_ACCESS_KEY=${{Bucket.SECRET_ACCESS_KEY}}
     PUBLIC_API_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
     JWT_SECRET=<long random string>
     CORS_ORIGINS=https://placeholder.invalid
     PUBLIC_WEB_URL=https://placeholder.invalid
     GOOGLE_CLIENT_ID=
     RESEND_API_KEY=
     MAIL_FROM=
     STRIPE_SECRET_KEY=
     STRIPE_WEBHOOK_SECRET=
     ```
     Rename `Postgres`, `Redis` and `Bucket` if your services have different names.
   - When it is live, `https://<domain>/healthcheck` returns `"database":"up"`.
3. **Bucket CORS.** The browser PUTs uploads straight to the bucket. On every boot the API sets
   a CORS rule from `CORS_ORIGINS`. Check its log for "Could not set the bucket's CORS rule".
   If that warning appears, set the rule by hand:
   ```sh
   AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… aws s3api put-bucket-cors \
     --endpoint-url https://t3.storageapi.dev --bucket <bucket> \
     --cors-configuration '{"CORSRules":[{"AllowedOrigins":["https://<vercel-url>"],"AllowedMethods":["PUT","GET","HEAD"],"AllowedHeaders":["Content-Type"],"MaxAgeSeconds":3600}]}'
   ```
4. **Vercel web.** Import this repo with **Root Directory** `apps/web` and framework Next.js.
   Leave "Include files outside the root directory in the Build Step" on, because the app imports
   `packages/*`. Environment variables:
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1`. Without it Vercel picks a pnpm from the lockfile
     version instead of `packageManager` (pnpm 12), and ignores `allowBuilds`.
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<railway-domain>/api/v1`. `next.config.ts` also
     allows image optimisation for this host's `/api/v1/media/**`.
   - `NEXT_PUBLIC_SITE_URL` = the Vercel production URL.
   - These are inlined at **build** time. Changing them needs a redeploy, not a restart.
5. **Back to Railway.** Set `CORS_ORIGINS` and `PUBLIC_WEB_URL` to the Vercel production URL
   (no trailing slash). The service redeploys, and the bucket's CORS rule follows. Invite links
   are built from `PUBLIC_WEB_URL`.
6. **Stripe** (if billing is on). Point the webhook at
   `https://<railway-domain>/api/v1/billing/webhook`, then put its `whsec_…` in
   `STRIPE_WEBHOOK_SECRET`.

## Moving off Render, Supabase and Upstash

Nothing needs to be migrated, because the Railway database starts fresh. Seed a demo with
`pnpm --filter @posly/api seed:demo` against `DATABASE_PUBLIC_URL` if you want one. Order:

1. Complete steps 1–5 above. Render keeps serving until Vercel is switched over.
2. Redeploy Vercel with the new `NEXT_PUBLIC_API_BASE_URL`.
3. Move the Stripe webhook (step 6).
4. Delete the Render service, then pause or delete the Supabase project and the Upstash
   database.

## Checks after the first deploy

- Register, go through onboarding, add the sample menu and sell one item. The dashboard should show the sale.
- Upload a product photo. It should appear on the POS card, and its URL is
  `https://<railway-domain>/api/v1/media/…`, which answers `302` to the bucket.
- Employees → invite: the link should start with the Vercel URL, not `localhost`.
- The API log says `Cache: Redis`.

## Things that are easy to get wrong

- **Private network vs public URL.** Inside Railway, use `DATABASE_URL` and `REDIS_URL`: they are
  private, have no egress, and Postgres needs no TLS. From your machine, use
  `DATABASE_PUBLIC_URL` and `REDIS_PUBLIC_URL` (TCP proxy) with `DB_SSL=true`.
- **IPv6.** Railway's private network can resolve to IPv6. ioredis is created with `family: 0`
  for that reason. Keep it if you add another Redis client.
- **Presigned URLs expire.** Never store a bucket URL. Store the object path and build URLs with
  `StorageService.publicUrl`, which points at `/media`.
- **Never point e2e tests at Railway.** `pnpm --filter @posly/api test:e2e` refuses to start
  without `E2E_DATABASE_URL`. Give it the docker-compose database.
- **Cookies** are set by the Next app on its own domain (httpOnly, `secure` in production),
  so the API and web can live on different domains without third-party cookies.
