# @posly/ui

shadcn/ui components (style `radix-nova`) ที่ใช้ร่วมกันทุก app + `cn()` + theme CSS

```ts
import { Button } from "@posly/ui/components/button";
import { cn } from "@posly/ui/lib/utils";
```

```css
/* globals.css ของแต่ละ app */
@import "@posly/ui/styles/globals.css";
```

- เพิ่ม component: `pnpm dlx shadcn@latest add <name>` ในโฟลเดอร์นี้
- app ที่ใช้ต้องใส่ `@posly/ui` ใน `transpilePackages` (ไม่มี build step)
