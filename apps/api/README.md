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

## Railway

- **Database**: ใน Railway ใช้ `${{Postgres.DATABASE_URL}}` (private network, `DB_SSL=false`) ส่วนจากเครื่องตัวเองใช้ `DATABASE_PUBLIC_URL` กับ `DB_SSL=true`
- **Redis**: `REDIS_URL` ใช้ร่วมกันระหว่าง cache (`CacheService`) และ BullMQ ถ้าไม่ตั้ง cache จะใช้ Map ใน process
- **Storage**: Railway Bucket (S3-compatible, private) ตั้งค่าผ่าน `S3_*` และ `PUBLIC_API_URL`
  - `POST /api/v1/businesses/:businessId/uploads` → `{ uploadUrl, path, publicUrl }`
  - browser `PUT` ไฟล์ไปที่ `uploadUrl` (presigned) แล้วส่ง `path` กลับตอนบันทึกสินค้า/โลโก้
  - path ขึ้นต้นด้วย businessId เสมอ และถูกตรวจด้วย `assertOwnedPath`
  - `publicUrl` คือ `GET /api/v1/media/<path>` ซึ่ง redirect 302 ไปที่ presigned GET อายุ 1 ชม.
- **Deploy**: `railway.json` ดู [`docs/deployment.md`](docs/deployment.md)

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
