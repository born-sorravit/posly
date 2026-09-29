# @posly/web (`apps/web`)

Next.js 16 frontend ของ Posly โครงสร้างตาม `gov-jobs-frontend` — **ตอนนี้ทุกหน้าใช้ mock data** (`src/lib/mock/`) เพื่อ validate UX ก่อนเชื่อม API

```
src/
  app/[locale]/
    (auth)/login, register        หน้า auth แบบ card กลางจอ
    onboarding/                   welcome → ประเภทร้าน → ข้อมูลร้าน → สินค้าแรก → พร้อมขาย
    (app)/                        ทุกหน้าที่อยู่ใน AppShell (sidebar + topbar + bottom nav)
      dashboard pos orders products categories inventory customers reports employees settings notifications
  app/api/auth/*, api/backend/*   BFF: token อยู่ใน httpOnly cookie, browser ไม่เห็น token
  proxy.ts                        next-intl + refresh session ก่อน render (Next 16 ใช้ proxy แทน middleware)
  components/
    common/                       PageHeader, Surface, MetricCard, StatTrend, StatusBadge, EmptyState,
                                  Skeletons, Segmented, SearchInput, DataTable, ConfirmDialog, ProductThumb
    layout/                       AppShell, AppSidebar (ย่อได้), AppHeader, StoreSwitcher, UserMenu,
                                  MobileBottomNav, CommandMenu (⌘K), Notifications
    pos/                          PosScreen, ProductCard, ModifierDialog, CartPanel, CheckoutDialog
    dashboard/ orders/ products/ catalog/ people/ reports/ settings/ onboarding/ auth/
  stores/                         Zustand: cart-store (POS ทำงานได้โดยไม่พึ่ง network), workspace-store
  hooks/                          use-workspace (business/branch/hasFeature), use-media-query, use-now
  lib/                            api/uploads.ts (presigned upload ไป bucket), auth/, permissions.ts, mock/
messages/th.json                  ข้อความทั้งหมด (type-checked ผ่าน global.d.ts)
```

ของที่ย้ายไปแชร์ใน `packages/`:

| เดิม | ตอนนี้ |
| --- | --- |
| `@/components/ui/*` | `@posly/ui/components/*` (shadcn, theme อยู่ที่ `@posly/ui/styles/globals.css`) |
| `@/lib/money`, `format`, `promptpay`, `tax-id` | `@posly/utils/*` |
| `@/types/domain`, `@/types/api` | `@posly/types/*` |

`@/lib/utils` ยัง re-export `cn` จาก `@posly/ui/lib/utils` ให้ import เดิมใช้ได้

## Breakpoints

`tablet` 768px · `desktop` 1280px (กำหนดใน `globals.css`)

- desktop: sidebar ถาวร (ย่อเหลือไอคอนได้)
- tablet: sidebar เป็น sheet — POS ได้เต็มความกว้าง, ตะกร้าอยู่ขวาตลอด
- mobile: bottom nav (หน้าหลัก · รายงาน · + · แจ้งเตือน · โปรไฟล์), POS มีแถบตะกร้าลอย → bottom sheet

## POS shortcuts

`/` ค้นหา · `Enter` ชำระเงิน · `Esc` ปิด modal · `+` / `-` จำนวนรายการล่าสุด · `⌘K` command menu

## Scripts

```bash
pnpm --filter @posly/web dev
pnpm --filter @posly/web build
pnpm --filter @posly/web test        # vitest (money / promptpay / tax-id อยู่ที่ packages/utils)
pnpm turbo run lint typecheck --filter=@posly/web...
```
