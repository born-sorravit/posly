# @posly/api (`apps/api`)

NestJS 11 API ของ Posly โครงสร้างตาม `gov-jobs-backend`

```
src/
  config/          configuration.ts — env ทั้งหมดผ่านที่เดียว, refuse to start ถ้าขาดค่าจำเป็น
  constants/       ชื่อ queue และ job options
  models/          entities + repositories (ModelModule เป็น @Global)
    users/ auth/ businesses/ branches/
  modules/         feature modules (controller + service + dto)
    auth/ businesses/ branches/ storage/ queue/ health/
  shared/
    database/      typeorm.config.ts, migrations/, seeds/
    decorators/    @Public, @CurrentUser, @CurrentMembership, @RequirePermission
    guards/        JwtAuthGuard, BusinessAccessGuard (tenant boundary)
    enums/         MemberRole, Permission (+ ROLE_PERMISSIONS), BusinessType, ...
    utils/         money.util.ts (satang), pagination.util.ts, date.util.ts
    interceptors/ filters/ cache/ dto/ interfaces/
```

## Multi-tenant

Global guards: `ThrottlerGuard → JwtAuthGuard → BusinessAccessGuard`

- route ใดที่มี param `:businessId` ถูกตรวจอัตโนมัติ: user → active membership → permission
- ไม่ใช่สมาชิก → **404** (ไม่ยืนยันว่าร้านมีอยู่), สมาชิกแต่ไม่มีสิทธิ์ → 403
- handler ใช้ `@CurrentMembership()` แล้ว scope ทุก query ด้วย `membership.businessId`
- param ต้องชื่อ `businessId` เท่านั้น

## Supabase

- **Database**: ใช้ *Session pooler* URI (port 5432, database ชื่อ `postgres`, `DB_SSL=true`) — ดูหมายเหตุใน `.env.example`
- **Storage**: สร้าง public bucket `posly` แล้วใส่ `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  - `POST /api/v1/businesses/:businessId/uploads` → `{ uploadUrl, path, publicUrl }`
  - browser `PUT` ไฟล์ไปที่ `uploadUrl` แล้วส่ง `path` กลับตอนบันทึกสินค้า/โลโก้
  - path ขึ้นต้นด้วย businessId เสมอ และถูกตรวจด้วย `assertOwnedPath`

## Scripts

```bash
# จาก root: pnpm --filter @posly/api <script>  หรือ cd apps/api แล้ว pnpm <script>
pnpm start:local                          # dev, reads .env
pnpm build
name=AddProducts pnpm migration:generate
pnpm migration:run
pnpm test                                 # unit (money, tenant guard, pagination, interceptor)
pnpm lint && pnpm typecheck
```
