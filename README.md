# Posly

POS แบบ SaaS สำหรับร้านเล็กในไทย (คาเฟ่ ร้านเครื่องดื่ม เบเกอรี่ ร้านค้าปลีก) — สมัครแล้วสร้างร้านและเริ่มขายได้ทันที

Monorepo แบบ **pnpm workspace + Turborepo**

```
posly/
├── apps/
│   ├── web/        @posly/web    POS + หลังร้าน — Next.js 16 · Tailwind 4 · TanStack Query · Zustand · Motion · Recharts · next-intl   :3000
│   ├── admin/      @posly/admin  Platform admin (ยังเป็น scaffold) — Next.js 16                                                        :3003
│   └── api/        @posly/api    Backend — NestJS 11 · PostgreSQL + TypeORM · BullMQ (Redis) · S3 bucket — บน Railway      :3001
└── packages/
    ├── ui/         @posly/ui     shadcn/ui components (radix-nova) + `cn()` + theme CSS (`styles/globals.css`)
    ├── types/      @posly/types  TypeScript types ของสัญญา API (`domain.ts`, `api.ts`)
    └── utils/      @posly/utils  money (satang), format (พ.ศ.), promptpay (EMVCo QR), tax-id
```

- packages เป็น **source-only**: export ไฟล์ `.ts`/`.tsx` ตรงๆ ไม่มี build step — Next คอมไพล์ให้ผ่าน `transpilePackages`
- import แบบ `@posly/ui/components/button`, `@posly/utils/money`, `@posly/types/domain`
- เพิ่ม shadcn component: `cd packages/ui && pnpm dlx shadcn@latest add <name>`
- `apps/api` ยังไม่ใช้ packages (NestJS build เป็น CommonJS แยก) — type ของ API ฝั่ง frontend อยู่ที่ `@posly/types` และยัง mirror DTO ด้วยมือ

## หลักที่ทั้งสองฝั่งยึด

| เรื่อง | กฎ |
| --- | --- |
| Multi-tenant | ทุก business resource อยู่ใต้ `/businesses/:businessId/...` และ `BusinessAccessGuard` ตรวจ membership จาก DB ทุก request — ไม่เชื่อ `businessId` จาก client |
| Role | อยู่ที่ `BusinessMember` ไม่ใช่ `User` (คนเดียวเป็นเจ้าของร้านหนึ่ง และแคชเชียร์อีกร้านได้) route ประกาศ **permission** ไม่ใช่ role |
| เงิน | integer satang ทุกที่ (`BIGINT` + transformer ฝั่ง backend, `lib/money.ts` ฝั่ง frontend) ห้าม float |
| Subscription | frontend ถาม `hasFeature("INVENTORY")` จากสิทธิ์ที่ API ส่งมา ไม่เทียบชื่อแพ็กเกจ |
| รูปภาพ | Railway Bucket (S3, private) — API ออก presigned upload URL, browser อัปโหลดตรง, DB เก็บแค่ path, เสิร์ฟผ่าน `/api/v1/media/*` |

## รันในเครื่อง

ต้องมี Node 24 และ pnpm (`corepack enable` — เวอร์ชันถูกกำหนดใน `packageManager` ของ root `package.json`)

```bash
nvm use 24
corepack enable
pnpm install                                  # ครั้งเดียวที่ root ติดตั้งทุก app/package
```

### Backend — API :3001 (Swagger: `/api-docs`)

ต่อ Railway environment สำหรับ dev (อ่าน `apps/api/.env.development.local` — ใช้ `DATABASE_PUBLIC_URL` / `REDIS_PUBLIC_URL`):

```bash
pnpm --filter @posly/api start:dev
```

หรือใช้ Postgres + Redis ใน docker (อ่าน `apps/api/.env`):

```bash
cp apps/api/.env.example apps/api/.env
docker compose -f apps/api/docker-compose.yml up -d
pnpm --filter @posly/api migration:run:src    # migrate จาก source — ไม่ต้อง build
pnpm --filter @posly/api start:local
```

### Frontend (เปิดอีก terminal)

```bash
cp apps/web/.env.example apps/web/.env.local  # ครั้งแรก
pnpm --filter @posly/web dev                  # POS    → http://localhost:3000
pnpm --filter @posly/admin dev                # Admin  → http://localhost:3003
```

`pnpm dev` ที่ root รัน web + admin พร้อมกันในคำสั่งเดียว — **ไม่รวม API** ต้องเปิด API แยกตามด้านบน

จะ `cd` เข้าโฟลเดอร์ app แล้วสั่ง `pnpm <script>` ก็ได้ เช่น `cd apps/api && pnpm start:dev`

คำสั่งรวมที่ root (รันผ่าน turbo ทุก workspace, cache ผลลัพธ์):

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm turbo run build --filter=@posly/web...   # เฉพาะ web + packages ที่มันใช้
```

## ร้านตัวอย่าง (demo)

```bash
pnpm --filter @posly/api seed:demo               # สร้าง 3 ร้าน: ออเดอร์ย้อนหลัง 30 วัน, ลูกค้าประจำ, ค่าใช้จ่าย, ตั๋วครัว (ถ้ามีอยู่แล้วจะไม่ทำซ้ำ)
pnpm --filter @posly/api seed:demo -- --reset    # ลบของเดิมแล้วสร้างใหม่ (ออเดอร์จะขยับมาถึงวันนี้)
pnpm --filter @posly/api seed:demo -- --remove   # ลบร้านและบัญชี demo ทั้งหมด
```

รหัสผ่านทุกบัญชี: `Demo1234!`

| บัญชี | ร้าน / บทบาท |
| --- | --- |
| `nan@demo.posly` | Sunny Cafe (OWNER, แพ็กเกจ Business — มีจอครัว) · Baan Bakery (OWNER, Pro) — ลองสลับร้าน |
| `ton@demo.posly` | Sunny Cafe (MANAGER) |
| `mind@demo.posly` | Sunny Cafe (CASHIER) |
| `boss@demo.posly` | Baan Bakery (CASHIER) |
| `daeng@demo.posly` | ร้านป้าแดง มินิมาร์ท (OWNER) |

### ปุ่ม "ทดลองใช้" บนหน้า landing

ลูกค้าเลือกบทบาทแล้วเข้าได้ทันทีโดยไม่ต้องใส่รหัส (`POST /api/v1/auth/demo`): เจ้าของ → `nan`, ผู้จัดการ → `ton`, แคชเชียร์ → `mind`
บัญชี demo ขายของ แก้สินค้า ลูกค้า สต็อก และค่าใช้จ่ายได้ตามปกติ แต่ route ที่มี `@DemoBlocked()` จะตอบ 403 ได้แก่ รหัสผ่าน/โปรไฟล์ สมาชิกและ PIN billing ข้อมูลร้าน/สาขา อัปโหลด และส่งใบเสร็จทางอีเมล

เปิดใช้:

1. รัน seed บน DB ปลายทางหนึ่งครั้ง
2. ตั้ง `DEMO_ENABLED=true` ที่ API และ `NEXT_PUBLIC_DEMO_ENABLED=true` ที่ web (ต้อง redeploy web)
3. สร้าง Railway Cron service ใน project เดียวกัน (repo เดียวกัน ใช้ build command จาก `apps/api/railway.json`) เพื่อรีเซ็ตทุกคืน:
   - Cron schedule: `0 20 * * *` (UTC = ตี 3 เวลาไทย)
   - Start command: `node apps/api/dist/shared/database/seeds/demo.seed.js --reset`
   - Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `DB_SSL=false`

## Deployment targets

| ส่วน | บริการ |
| --- | --- |
| Web (`apps/web`) | Vercel — Root Directory `apps/web` |
| API (`apps/api`) | Railway — `apps/api/railway.json` |
| PostgreSQL | Railway PostgreSQL (private network) |
| Queue (BullMQ) / Cache | Railway Redis |
| รูปสินค้า / โลโก้ | Railway Bucket (private, เสิร์ฟผ่าน `/api/v1/media/*`) |

## Deploy

ดู [`apps/api/docs/deployment.md`](apps/api/docs/deployment.md) — Railway (`railway.json`) + Vercel (`vercel.json`)

## สถานะ

ทุกแถวคือ API + UI ที่ใช้งานจริง (ไม่มีหน้าที่ใช้ข้อมูลตัวอย่างแล้ว) มี e2e test ครอบใน `apps/api/test/`

| ส่วน | สถานะ |
| --- | --- |
| Auth: สมัคร/เข้าสู่ระบบ, refresh token rotation, ลืมรหัสผ่าน (ลิงก์ใช้ครั้งเดียว 30 นาที) | done |
| Multi-tenant: business / branch / member, permission ต่อ route, สลับร้าน | done |
| Onboarding + เมนูตัวอย่างตามประเภทร้าน + tour แนะนำการใช้งาน (รวม + รายหน้า 9 หน้า) | done |
| Catalog: หมวดหมู่ (เลือกได้ว่าเข้าครัวไหม), สินค้า, หน่วยนับ, **ตัวเลือกสินค้า (modifier groups)** | done |
| สต็อก: ปรับ/รับเข้า/ตรวจนับ + ประวัติ, แจ้งใกล้หมด/หมด | done (แพ็กเกจ Pro+) |
| POS: server คิดราคาเอง, idempotent, เลขออเดอร์ต่อร้าน, ตัดสต็อก, ส่วนลด (`orders:discount`), ลูกค้า, **ป้ายออเดอร์** (ทานที่ร้าน / กลับบ้าน / เดลิเวอรี + โต๊ะ/คิว) | done |
| ใบเสร็จ: พิมพ์, ตั้งค่า (โลโก้ / เลขผู้เสียภาษี / ข้อความท้าย), **ส่งทางอีเมล** | done — ส่งจริงเมื่อตั้ง `RESEND_API_KEY` |
| Orders: รายการ, รายละเอียด, คืนเงิน/ยกเลิก + audit log, ส่งออก CSV | done |
| **จอครัว (Kitchen Display)**: ใหม่ → กำลังทำ → พร้อมเสิร์ฟ, ติ๊กทีละรายการ, เรียกคืน, เสียงเตือน | done (แพ็กเกจ Business) |
| **Realtime**: SSE + Postgres LISTEN/NOTIFY — จอครัว กระดิ่ง หน้าหลัก รายการขาย อัปเดตทันที (polling ช้าเป็น safety net) | done |
| Dashboard / รายงาน: ยอดขาย กำไรขั้นต้น กำไรหลังหักค่าใช้จ่าย (ตาม timezone ร้าน), ส่งออก CSV | done |
| ลูกค้า: รายชื่อ ยอดใช้จ่าย ประวัติออเดอร์ ผูกกับการขาย | done (แพ็กเกจ Pro+) |
| ค่าใช้จ่าย: บันทึกตามหมวด สรุป หักในรายงานกำไร | done (แพ็กเกจ Pro+) |
| การแจ้งเตือนในแอป: สต็อก, คืนเงิน/ยกเลิก, สรุปยอดรายวัน, โควตาออเดอร์, ตัดบัตรไม่ผ่าน — ตั้งค่าได้ต่อคน | done |
| พนักงาน: เชิญด้วยลิงก์ใช้ครั้งเดียว, role, **กำหนดสิทธิ์รายคน** (Business), **PIN สลับแคชเชียร์** | done |
| ตั้งค่าร้าน: ข้อมูลร้าน, PromptPay, **ภาษี/VAT** (รวม/ไม่รวมในราคา, ตรวจเลขผู้เสียภาษี), ใบเสร็จ, การแจ้งเตือน | done |
| แพ็กเกจ: Free / Starter / Pro / Business, โควตาออเดอร์·พนักงาน·สาขา, feature gate | done |
| **ชำระค่าแพ็กเกจ (Stripe)**: Checkout, เปลี่ยนแพ็กเกจแบบ prorate, ยกเลิก, Customer Portal, webhook | done — ใช้จริงเมื่อตั้ง `STRIPE_*` |
| PWA: ติดตั้งลงเครื่อง, service worker หน้าออฟไลน์ (ไม่ cache ข้อมูลร้าน) | done |
| Landing page + ราคาจาก API | done |
| Google sign-in | API + BFF พร้อม (`POST /auth/google`, `/api/auth/google`) — ปุ่มหน้าเข้าสู่ระบบยังกดไม่ได้: ต้องต่อ Google Identity Services ฝั่งเว็บ และตั้ง client id |
| แจ้งเตือนผ่าน LINE, ซัพพอร์ตก่อนใคร | ยังไม่ทำ (ติดป้าย "เร็วๆ นี้" ในการ์ดแพ็กเกจ) |
| หลายสาขาเต็มรูปแบบ (สต็อกแยกสาขา โอนสต็อก รายงานเทียบสาขา), ขายขณะออฟไลน์ | ยังไม่ทำ |

### ตัวแปรที่เปิดฟีเจอร์เสริม (backend `.env`)

ไม่ตั้งก็รันได้ — ฟีเจอร์นั้นจะปิดตัวเองและบอกผู้ใช้ตรงๆ

| ตัวแปร | เปิดอะไร | ถ้าไม่ตั้ง |
| --- | --- | --- |
| `RESEND_API_KEY`, `MAIL_FROM` | อีเมลรีเซ็ตรหัสผ่าน, ส่งใบเสร็จ | เขียนเนื้อหาอีเมลลง log แทน, หน้าจอบอกว่ายังไม่ได้ส่ง |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | ชำระค่าแพ็กเกจด้วยบัตร | หน้าแพ็กเกจให้ติดต่อทีม, ตั้งแพ็กเกจด้วย `pnpm --filter @posly/api subscription:set` |
| `GOOGLE_CLIENT_ID` (+ `NEXT_PUBLIC_GOOGLE_CLIENT_ID` ฝั่ง frontend) | ฝั่ง API ตรวจ Google ID token | ปฏิเสธการเข้าสู่ระบบด้วย Google (ปุ่มฝั่งเว็บยังต้องต่อ Google Identity Services ก่อน) |
| `CORS_ORIGINS` | ต้องมีโดเมนเว็บ — realtime (SSE) ต่อจากเบราว์เซอร์ตรงไปที่ API | จอไม่อัปเดตทันที (ยังมี polling) |

## ทดสอบ

```bash
pnpm test                                                                             # unit ทุก workspace
E2E_DATABASE_URL=postgres://posly:posly@localhost:5434/posly pnpm --filter @posly/api test:e2e   # ต้องเป็น DB ทิ้งได้ — ห้ามชี้ Railway
```

## CI

`.github/workflows/ci.yml` รันทุก push เข้า `main` และทุก pull request — แยก job ตามแอป และรันเฉพาะฝั่งที่มีไฟล์เปลี่ยน
(แก้ workflow / lockfile จะรันทั้งสองฝั่ง, กด **Run workflow** เองก็รันทั้งสองฝั่ง)

| Job | ขั้นตอน |
| --- | --- |
| Backend (`apps/api/**`) | `pnpm install` → Biome → `tsc` → unit → migrate **ฐานข้อมูลว่าง** (Postgres 17 ใน service container) → e2e ทั้งหมด → `nest build` |
| Frontend (`apps/web`, `apps/admin`, `packages/**`) | `pnpm install` → `turbo run lint typecheck test build` ของ web + admin + packages ที่ใช้ |

- e2e ใช้ Postgres ของ runner เท่านั้น (`E2E_DATABASE_URL`) ไม่มี secret ของ Railway / Stripe / Resend ใน CI
- migrate จาก DB ว่างทุกครั้ง: migration ที่รันได้แค่บน schema เดิมจะพังที่นี่ ไม่ใช่ตอน deploy
- ไม่ต้องตั้ง secret ใดๆ ใน GitHub
