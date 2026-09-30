# Deploy Posly Admin

Checklist สำหรับขึ้น `apps/admin` (platform admin monitor) บน production ครั้งแรก ทำตามลำดับจากบนลงล่าง ติ๊ก `[x]` เมื่อเสร็จ

ส่วน API, web, database และ Redis ใช้ตามเดิมใน [`apps/api/docs/deployment.md`](../../api/docs/deployment.md) ไฟล์นี้บอกเฉพาะสิ่งที่ admin เพิ่มเข้ามา

| ส่วน | ที่อยู่ | หมายเหตุ |
| --- | --- | --- |
| Admin | Vercel (region `sin1`) | โปรเจกต์ใหม่ Root Directory `apps/admin` ใช้ `apps/admin/vercel.json` |
| API | Railway (บริการเดิม) | route `/api/v1/admin/*` และ cron อยู่ใน API ตัวเดิม ไม่มีบริการใหม่ |
| Database | Railway PostgreSQL (ตัวเดิม) | ตารางใหม่มาจาก migration ที่ API รันเองตอน deploy |

admin คุยกับ API ผ่าน Next server ของตัวเองเท่านั้น (`/api/backend/*` และ `/api/auth/*`) browser ไม่เรียก API ตรง จึง **ไม่ต้องเพิ่ม URL ของ admin ใน `CORS_ORIGINS`**

---

## 1. API บน Railway

push `main` แล้ว Railway deploy API ให้เอง และ `preDeployCommand` ใน `apps/api/railway.json` รัน migration ก่อนเปิดเสมอ ข้อนี้จึงเป็นการ **ตรวจ** มากกว่าการสั่ง

- [ ] deploy ล่าสุดของบริการ API บน Railway สำเร็จ และ log ของ pre-deploy ขึ้น `Migration … has been executed successfully` หรือ `No migrations are pending`
- [ ] migration 5 ตัวนี้อยู่ในตาราง `migrations` แล้ว:
  - `PlatformAdmin1790720000000`: คอลัมน์ `user.is_platform_admin`
  - `AdminActionLog1790730000000`: ตาราง `admin_action_log`
  - `RefreshTokenFamily1790740000000`: คอลัมน์ `refresh_token.family_id`
  - `RefreshTokenAuthMethod1790750000000`: คอลัมน์ `refresh_token.auth_method`
  - `AdminNotesStatsAnnouncements1790760000000`: ตาราง `admin_note`, `platform_daily_stat` และค่า `ANNOUNCEMENT` ใน `notification_kind_enum`

  เช็คจากเครื่องตัวเองด้วย `DATABASE_PUBLIC_URL`:
  ```sh
  psql "$DATABASE_PUBLIC_URL" -c "SELECT name FROM migrations ORDER BY id DESC LIMIT 5"
  ```
- [ ] ตัวแปรของบริการ API (Railway → Variables):
  - `GOOGLE_CLIENT_ID` **ต้องมีค่า** เป็น OAuth client เดียวกับที่ web ใช้ บน production admin เข้าได้เฉพาะ session ที่ login ด้วย Google ถ้าค่านี้ว่าง Google sign-in ถูกปิด และจะไม่มีใครเข้า admin ได้เลย
  - `ADMIN_REQUIRE_GOOGLE` เว้นไว้ก็ได้ เพราะ production เปิดให้เอง ใส่ `false` เฉพาะตอนจำเป็นต้องให้ admin login ด้วยรหัสผ่านชั่วคราว แล้วต้องลบออกทันทีหลังใช้
  - `REDIS_URL` ควรมี: หน้า "สถานะระบบ" ใช้ดูจำนวน key และ hit rate ส่วน cache ของ dashboard ใช้ได้แม้ไม่มี (จะเก็บในหน่วยความจำของ API แต่ละตัวแทน)
- [ ] `https://<railway-domain>/healthcheck` ตอบ `"database":"up"`

## 2. web บน Vercel

web ต้องเป็นรุ่นที่รู้จักแจ้งเตือนชนิด `ANNOUNCEMENT` (มี `ANNOUNCEMENT` ใน `apps/web/src/lib/api/posly.ts`) ก่อนจะส่งประกาศครั้งแรกจาก admin

- [ ] deploy ล่าสุดของโปรเจกต์ web บน Vercel เป็น commit เดียวกับ API หรือใหม่กว่า
- [ ] **ห้ามส่งประกาศ** จนกว่าข้อนี้จะเสร็จ

## 3. Google Cloud

- [ ] เปิด OAuth client ของ `GOOGLE_CLIENT_ID` ใน Google Cloud Console → APIs & Services → Credentials
- [ ] เพิ่มใน **Authorized JavaScript origins** (ไม่ต้องมี path และไม่ต้องมี `/` ท้าย):
  - `https://<admin-domain>` คือ URL production ของ admin จากข้อ 4 จะได้ URL ก็ต่อเมื่อสร้างโปรเจกต์ Vercel แล้ว กลับมาเพิ่มทีหลังได้
  - `http://localhost:3003` สำหรับรัน admin ในเครื่อง
- [ ] บันทึก รอประมาณ 5 นาทีจนการตั้งค่าของ Google มีผล

## 4. Admin บน Vercel (โปรเจกต์ใหม่)

- [ ] Vercel → Add New → Project → import repo นี้
- [ ] **Root Directory**: `apps/admin`
- [ ] **Framework Preset**: Next.js
- [ ] เปิด "Include files outside the root directory in the Build Step" ไว้ เพราะ admin import `packages/*`
- [ ] Environment Variables (Production):
  - `ENABLE_EXPERIMENTAL_COREPACK` = `1` เพื่อให้ Vercel ใช้ pnpm ตาม `packageManager` เหมือนโปรเจกต์ web
  - `NEXT_PUBLIC_API_BASE_URL` = `https://<railway-domain>/api/v1`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = ค่าเดียวกับ `GOOGLE_CLIENT_ID` ของ API
  - ตัวแปร `NEXT_PUBLIC_*` ถูกฝังตอน build เปลี่ยนค่าแล้วต้อง **redeploy** ไม่ใช่แค่ restart
- [ ] Deploy แล้วจด URL production เช่น `https://posly-admin.vercel.app` กลับไปเพิ่มในข้อ 3
- [ ] (ไม่บังคับ) ตั้ง custom domain เช่น `admin.<โดเมน>` แล้วเพิ่ม origin นั้นในข้อ 3 ด้วย
- [ ] (แนะนำ) Settings → Deployment Protection เปิด Vercel Authentication ไว้กับ preview deployments ด้วย

## 5. ตั้งผู้ดูแลคนแรก

บัญชีต้องมีอยู่แล้ว ถ้ายังไม่มี ให้ login ที่ web ด้วย Google หนึ่งครั้งก่อน จากนั้นเลือกทางใดทางหนึ่ง:

- [ ] **ทาง A: Railway shell (แนะนำ)** รันบนเครื่องของ Railway ใช้ private network และไฟล์ที่ build แล้ว:
  ```sh
  railway ssh --service <api-service>
  node apps/api/dist/scripts/set-admin.js nt.sorravit@gmail.com
  ```
- [ ] **ทาง B: จากเครื่องตัวเอง** ต่อผ่าน public URL ของ database:
  ```sh
  DATABASE_URL="$DATABASE_PUBLIC_URL" DB_SSL=true \
    pnpm --filter @posly/api admin:set -- nt.sorravit@gmail.com
  ```

ถ้าสำเร็จ log จะขึ้น `nt.sorravit@gmail.com → platform admin` ถอนสิทธิ์ด้วยคำสั่งเดียวกันแล้วต่อท้ายด้วย `off`

## 6. ตรวจหลัง deploy

- [ ] เปิด `https://<admin-domain>` แล้วถูกพาไปหน้า login
- [ ] กด "เข้าสู่ระบบด้วย Google" ด้วยบัญชีจากข้อ 5 แล้วเข้าหน้า "ภาพรวมแพลตฟอร์ม" ได้
  - ถ้าปุ่ม Google ขึ้น error `origin_mismatch` แปลว่า origin ในข้อ 3 ยังไม่ตรงกับ URL หรือยังไม่มีผล
  - ถ้าเห็นหน้า "ต้องเข้าสู่ระบบด้วย Google" แปลว่า login ด้วยรหัสผ่านมา ให้ออกจากระบบแล้วเข้าด้วย Google
  - ถ้าเห็นหน้า "ไม่มีสิทธิ์เข้าถึง" แปลว่าข้อ 5 ยังไม่ได้ทำกับบัญชีนี้
- [ ] login ที่ admin ด้วยอีเมลและรหัสผ่านของบัญชี admin แล้วต้องเห็นหน้า "ต้องเข้าสู่ระบบด้วย Google"
- [ ] บัญชีที่ไม่ใช่ admin login แล้วต้องเห็นหน้า "ไม่มีสิทธิ์เข้าถึง" และ `GET /api/v1/admin/overview` ด้วย token ของบัญชีนั้นต้องได้ `404`
- [ ] หน้า "สถานะระบบ" Database กับ Cache ขึ้น "ปกติ" และ Migrations ค้างรันขึ้น "ไม่มี"
- [ ] หน้า "การเติบโต" การ์ด MRR ขึ้นตัวเลข และวันถัดไปกราฟ MRR รายวันเริ่มมีเส้น (cron `platform-daily-stat` 00:05 เวลาไทย)
- [ ] กด ⌘K แล้วพิมพ์ชื่อร้าน ต้องเจอร้านนั้น
- [ ] หน้ารายละเอียดร้านใดก็ได้ เขียนบันทึกทดสอบแล้วลบ ต้องสำเร็จทั้งคู่
- [ ] (ไม่บังคับ) ส่งประกาศทดสอบโดยเลือก "เฉพาะแพ็กเกจ" ที่มีแค่ร้านของตัวเอง หรือร้าน demo โดยเปิด "รวมร้าน demo" ไว้ แล้วเปิดกระดิ่งของร้านนั้นใน web ต้องเห็นประกาศพร้อมไอคอนโทรโข่ง

## ถ้าต้องถอยกลับ

- **ปิด admin:** Vercel → โปรเจกต์ admin → Settings → เปิด Deployment Protection หรือลบโปรเจกต์ API ยังปลอดภัย เพราะ `/api/v1/admin/*` ตอบ `404` กับทุกคนที่ไม่ใช่ admin
- **ถอนสิทธิ์ admin:** ใช้คำสั่งในข้อ 5 แล้วต่อท้ายด้วย `off` มีผลทันทีในครั้งถัดไปที่เรียก API เพราะ guard อ่านสิทธิ์จาก database ทุกครั้ง
- **migration:** ไม่ต้องย้อน ทั้ง 5 ตัวเพิ่มแค่คอลัมน์และตารางใหม่ โค้ดเดิมไม่ได้อ่าน ส่วนค่า `ANNOUNCEMENT` ใน enum ของ Postgres ลบไม่ได้ แต่ถ้าไม่ได้ใช้ก็ไม่มีผลอะไร
