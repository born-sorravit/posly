# Posly Design System

Posly คือระบบ POS สำหรับร้านค้าไทย ใช้บนแท็บเล็ต มือถือ และคอมพิวเตอร์ที่ร้านมีอยู่แล้ว หน้าตาต้องดูเป็นเครื่องมือทำงาน ไม่ใช่ของเล่น: พื้นสว่างอมม่วงจาง ๆ, การ์ดยกด้วยเงาแทนเส้น, สีแบรนด์ indigo ใช้เฉพาะจุดที่ต้องกด และตัวเลขเงินอ่านง่ายทุกที่

ไฟล์นี้คือกฎที่ทุกแอป (`apps/web`, `apps/admin`) ต้องทำตาม ค่าจริงอยู่ที่:

- `packages/ui/src/styles/globals.css`: token สีทั้งสองธีม มุม เงา breakpoint ฟอนต์ และ utility ของแบรนด์ (`.surface`, `.brand-gradient`, `.hero-surface`, `.hero-grid`, `.tint-surface`, `.tint-chip`, `.numeric`) ใช้ร่วมกันทุกแอป
- `apps/web/src/app/globals.css`: utility ที่มีแค่ web ใช้ (ภาพสินค้า, การพิมพ์ใบเสร็จ)
- `apps/*/src/lib/fonts.ts`: การโหลดฟอนต์

ถ้าไฟล์นี้กับโค้ดไม่ตรงกัน ให้ถือโค้ดเป็นหลัก แล้วแก้ไฟล์นี้ตาม ในโค้ดให้เรียกผ่าน Tailwind class ที่ map กับ token เสมอ (`bg-primary`, `text-muted-foreground`, `rounded-2xl`) ห้าม hard-code ค่าสีหรือใช้สีของ Tailwind ตรง ๆ อย่าง `bg-green-600`

## เนื้อหาและน้ำเสียง

- **ภาษา:** UI เป็นภาษาไทยสั้น ๆ แบบคนขายของพูด ไม่ใส่ "ครับ/ค่ะ" ในข้อความ UI เรียกผู้ใช้ว่า "คุณ" เท่าที่จำเป็น
- **ปุ่ม:** เป็นคำกริยาที่บอกผลตรง ๆ เช่น "บันทึก", "เพิ่มลงตะกร้า · ฿75", "เริ่มใช้ฟรี", "ลองอีกครั้ง" หลังทำสำเร็จ toast บอกผล เช่น "บันทึกสำเร็จ"
- **ข้อผิดพลาด:** บอกว่าเกิดอะไรขึ้นและทำอะไรต่อได้ ไม่ขอโทษ
  - "หน้านี้โหลดไม่สำเร็จ ลองใหม่อีกครั้ง"
  - "ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายหรือลบไปแล้ว"
- **คำทับศัพท์:** คำที่คนไทยใช้ทับศัพท์อยู่แล้วเขียนแบบเดิม เช่น POS, PromptPay, VAT, PIN
- **เงิน:** เก็บเป็นสตางค์ทุกที่ แสดงด้วย `formatBaht` จาก `@posly/utils/money` เช่น `฿12,450` ถ้ามีเศษสตางค์แสดง 2 หลัก เช่น `฿283.55`
- **วันที่และเวลา:** วันที่เป็นพุทธศักราชด้วย `formatThaiDate` เช่น `30 ก.ย. 2569` เวลาเป็น 24 ชั่วโมง เช่น `10:24` โซนเวลา Asia/Bangkok
- **Emoji:** ไม่ใช้ทั้งในข้อความและแทนไอคอน
- **ข้อความใน web:** อยู่ใน `apps/web/messages/th.json` ห้ามเขียนข้อความตรงใน component

## สี

### กฎการใช้

- **พื้นและข้อความ:** พื้นหน้าใช้ `background` ข้อความหลัก `foreground` ข้อความรอง `muted-foreground`
- **`primary` (#635bff):** ใช้เฉพาะ 4 อย่าง: CTA, ไอคอนเมนูที่ active, สถานะที่เลือก และ focus ring ห้ามใช้ทาพื้นใหญ่หรือเป็นสีตกแต่ง ข้อความบน `primary` ใช้ `primary-foreground`
- **ปุ่มหลักขนาดใหญ่** (ชำระเงิน, เพิ่มลงตะกร้า, เริ่มใช้ฟรี, บันทึก): ใส่ `.brand-gradient` ให้ขอบบนดูมีแสง ส่วนปุ่มทั่วไปใช้ `primary` เรียบ ๆ
- **เมนู active และตัวเลือกที่ถูกเลือก:** พื้น `accent`, ตัวหนังสือ `accent-foreground`, ไอคอน `primary`
- **สีสถานะ:** ใช้ตามความหมายเท่านั้น และต้องมีคำหรือไอคอนคู่เสมอ ไม่ใช้สีอย่างเดียว
  - `success`: ชำระแล้ว, ยอดขึ้น
  - `warning`: สต็อกต่ำ, รอ
  - `danger` / `destructive`: คืนเงิน, ผิดพลาด, ยอดลง
- **ข้อจำกัดของสีสถานะเป็นตัวหนังสือ:**
  - `warning` ใช้เป็นพื้นหรือจุดเท่านั้น ห้ามเป็นตัวหนังสือบนพื้นขาว (contrast ราว 2.1:1)
  - `success` (ราว 3.3:1) และ `danger` (ราว 3.8:1) เป็นตัวหนังสือได้เมื่อ 14px ขึ้นไปและตัวหนา หรือวางบนพื้น tint ของตัวเอง
- **`brand-accent` (#22c55e):** สีรองของแบรนด์ ใช้ในภาพประกอบและแสงของ hero เท่านั้น ห้ามใช้บอกสถานะ
- **`.hero-surface` (พื้น #1e1b4b):** การ์ดทักทายบน dashboard เหมือนกันทั้งสองธีม ใช้ได้หนึ่งจุดต่อหน้า ข้อความบนนั้นเป็นสีขาว
- **โหมดมืด:** ไม่ใช่การกลับสี ทุก token มีค่าของตัวเองที่ปรับสำหรับพื้น #080d1a พื้นมืดห้ามเป็นดำสนิท เพราะดำสนิททำให้เงาหายหมด
- **สีใหม่:** ถ้าต้องมีสีใหม่ ให้เพิ่มเป็น token ใน `globals.css` ทั้งสองธีม แล้วเพิ่มในตารางนี้ด้วย

### Token

| token | สว่าง | มืด | ใช้ตอนไหน |
|---|---|---|---|
| `background` | `#f8f9fc` | `#080d1a` | พื้นหน้า และพื้นของ sidebar |
| `foreground` | `#111827` | `oklch(0.968 0.006 265)` | ข้อความหลัก |
| `card` | `#ffffff` | `#0e1526` | พื้นการ์ดทุกอัน (`.surface`), sheet |
| `card-foreground` | `#111827` | `oklch(0.968 0.006 265)` | ข้อความบนการ์ด |
| `popover` | `#ffffff` | `oklch(0.235 0.04 266)` | dropdown, popover, tooltip, tooltip ของกราฟ |
| `popover-foreground` | `#111827` | `oklch(0.968 0.006 265)` | ข้อความบน popover |
| `primary` | `#635bff` | `#7b74ff` | CTA, สถานะที่เลือก, focus ring |
| `primary-foreground` | `#ffffff` | `#ffffff` | ข้อความและไอคอนบน `primary` |
| `secondary` | `oklch(0.965 0.008 277)` | `oklch(0.27 0.035 266)` | ปุ่มรอง พื้นเงียบ ๆ |
| `secondary-foreground` | `#111827` | `oklch(0.968 0.006 265)` | ข้อความบน `secondary` |
| `muted` | `oklch(0.965 0.006 270)` | `oklch(0.27 0.035 266)` | hover ของแถว, ราง segmented, skeleton, chip กลาง ๆ |
| `muted-foreground` | `#64748b` | `oklch(0.72 0.03 260)` | ข้อความรอง, คำอธิบาย, หัวตาราง, เวลา |
| `accent` | `oklch(0.955 0.03 280)` | `oklch(0.32 0.08 277)` | พื้นลาเวนเดอร์ของเมนู active และตัวเลือกที่เลือก |
| `accent-foreground` | `oklch(0.45 0.2 277)` | `oklch(0.9 0.06 280)` | ข้อความบน `accent` |
| `destructive` | `#ef4444` | `oklch(0.7 0.19 22)` | ปุ่มลบ, ขอบ input ที่ผิด |
| `border` | `oklch(0.93 0.006 270)` | `oklch(0.8 0.03 270 / 8%)` | เส้นคั่นแถว, เส้นแบ่ง |
| `input` | `oklch(0.905 0.01 270)` | `oklch(0.8 0.03 270 / 12%)` | ขอบของ form control |
| `ring` | `#635bff` | `#7b74ff` | focus ring |
| `success` | `#16a34a` | `oklch(0.72 0.17 150)` | ชำระแล้ว, ยอดขึ้น, กราฟยอดขายชุดเดียว |
| `success-foreground` | `#ffffff` | `#0f172a` | ข้อความบนพื้น `success` |
| `warning` | `#f59e0b` | `oklch(0.8 0.15 75)` | สต็อกต่ำ, รอ (เป็นพื้นหรือจุดเท่านั้น) |
| `warning-foreground` | `#111827` | `#0f172a` | ข้อความบนพื้น `warning` |
| `danger` | `#ef4444` | `oklch(0.7 0.19 22)` | คืนเงิน, ผิดพลาด, ยอดลง, จุดแจ้งเตือนยังไม่อ่าน |
| `brand-accent` | `#22c55e` | `oklch(0.76 0.18 150)` | ภาพประกอบและแสงของ hero |
| `chart-1` … `chart-5` | `#635bff` `#0891b2` `#d97706` `oklch(0.7 0.14 220)` `oklch(0.68 0.17 350)` | `#746ef5` `#1ba3bd` `#ba7b1a` `oklch(0.74 0.13 220)` `oklch(0.72 0.16 350)` | สีกราฟหลายชุด ใช้ตามลำดับเสมอ |
| `sidebar-*` | ตามค่าใน `globals.css` | | ชุดเดียวกับข้างบน สำหรับ rail |

## พื้นผิว เงา และมุม

- **การ์ด:** การ์ด พาเนล และกล่องรายการทุกอันใช้ `.surface` (`card` + `--surface-shadow` + ขอบ `--surface-edge`) ผ่าน component `Surface` ซึ่งได้ `rounded-2xl p-5`
  - แยกชั้นด้วยแสง ไม่ใช้เส้นขอบ
  - โหมดสว่างใช้เงาอ่อนสองชั้น โหมดมืดใช้เส้นบาง `--surface-edge` แทน เพราะเงาไม่เห็นบนพื้นมืด
  - การ์ดที่กดได้เพิ่ม `.surface-hover`
- **เงา:** ใช้ scale `shadow-xs` ถึง `shadow-xl` ซึ่งอมสี indigo อ่อน
  - `shadow-xs`: แถวรายการในหน้าตั้งค่า
  - `shadow-sm`: ปุ่มที่เลือกใน segmented
  - `shadow-lg`: popover, tooltip, ปุ่ม "+" ของแถบล่าง
  - `shadow-xl`: dialog
  - ห้ามใช้เงาเทาหนัก
- **มุม:** ทุกขั้นคำนวณจาก `--radius: 0.5rem` (8px)

| class | ขนาด | ใช้กับ |
|---|---|---|
| `rounded-md` | 6.4px | ปุ่มเล็ก, pill ใน segmented |
| `rounded-lg` | 8px | ปุ่มและ input ขนาดปกติ, รายการใน dropdown |
| `rounded-xl` | 11.2px | แถวเมนู, แถวรายการ, ปุ่มและ input สูง 44px, ตัวเลือกใน sheet (ใช้บ่อยที่สุด) |
| `rounded-2xl` | 14.4px | การ์ดทุกอัน, metric card |
| `rounded-3xl` | 17.6px | dialog, bottom sheet (มุมบน), hero ของ dashboard |
| `rounded-full` | – | avatar, จุด, ปุ่มไอคอนกลม |

## ตัวอักษร

- **ฟอนต์:**
  - `font-sans` = Geist ตามด้วย Anuphan โหลดจาก Google Fonts ใน `fonts.ts`
  - ต้องเรียง Geist ก่อนเสมอ Geist ไม่มีอักษรไทย browser จะใช้ Anuphan เฉพาะตัวไทยให้เอง ถ้าสลับลำดับ ภาษาอังกฤษจะเป็น Anuphan ไปด้วย
  - `font-mono` = Geist Mono ใช้กับตัวอย่างใบเสร็จและปุ่มลัด (⌘K) เท่านั้น
- **ความสูงบรรทัด:** `html` ตั้ง line-height 1.6 เพราะสระและวรรณยุกต์ไทยซ้อนบนล่าง ถ้าบีบบรรทัดจะโดนตัด อย่าใช้ leading แน่นกว่าตารางข้างล่าง
- **ตัวเลข:** ตัวเลขที่อ่านไล่เป็นคอลัมน์ (ราคา ยอดรวม จำนวน) ใส่ `.numeric` ให้เป็น tabular figures เสมอ เงินใช้ sans ไม่ใช้ mono
- **หัวข้อ:** ใส่ `text-balance`

| ชื่อ | class | ใช้กับ |
|---|---|---|
| hero | `text-4xl tablet:text-5xl desktop:text-6xl font-bold leading-[1.15] tracking-tight` | หัวข้อใหญ่ของ landing หนึ่งครั้งต่อหน้า |
| display | `text-4xl font-semibold tracking-tight numeric` | ยอดเงินตัวใหญ่ (ยอดวันนี้, ยอดชำระ) |
| title-lg | `text-3xl tablet:text-4xl font-semibold tracking-tight` | หัวข้อ section ของ landing |
| page-title | `text-2xl font-semibold tracking-tight` | `<h1>` ของทุกหน้าผ่าน `PageHeader` |
| title | `text-lg font-semibold` | หัวข้อ dialog และ sheet |
| section | `text-base font-semibold` | `SectionTitle` ในการ์ด |
| body | `text-sm` | ข้อความทั่วไป, ช่องตาราง, ฟอร์ม, เมนู |
| label | `text-sm font-medium` | ปุ่ม, ชื่อเมนู, label ของฟิลด์ |
| caption | `text-xs text-muted-foreground` | คำอธิบาย, เวลา, หัวตาราง, badge |
| micro | `text-[11px] font-medium` | ป้ายของแถบล่างเท่านั้น |

## ระยะห่างและ layout

- **ระยะห่าง:** ใช้ scale 4px ของ Tailwind จัดกลุ่มด้วย `gap` ไม่ใช้ margin รายตัว
- **หน้า:** ใช้ `PageContainer`
  - กว้างสุด `max-w-7xl`
  - ขอบข้าง `px-4` บนมือถือและ tablet, `desktop:px-8` บน desktop
  - ระยะระหว่างบล็อก `space-y-6`
- **ในการ์ด:** padding `p-5` ระยะระหว่างปุ่มในแถว `gap-2`
- **Dialog:** ทุกอันใช้ `gap-6 p-6 sm:max-w-md` ส่วน footer ใช้ `-mx-6 -mb-6 mt-2 px-6 py-4` ห้ามบีบให้แน่น
- **Breakpoint:** มีสองตัวคือ `tablet` (768px) และ `desktop` (1280px) ในโค้ดแอปใช้ `tablet:` / `desktop:` แทน `sm/md/lg`
- **ขนาดคงที่:**
  - ปุ่มปกติ `h-9`
  - ปุ่มและ input บนมือถือ `h-11` (44px)
  - ปุ่มชำระเงินหรือเพิ่มลงตะกร้า `h-13`
  - header และแถบล่าง `h-16`
  - rail `w-64` (ย่อแล้ว 76px)

## มือถือ tablet desktop

- **Desktop (1280px ขึ้นไป):** sidebar เป็น rail ถาวร ท้าย rail มีการ์ดร้าน/สาขาและผู้ใช้
- **Tablet (768px ขึ้นไป):** ปุ่ม ☰ ใน header เปิด sidebar เป็น sheet ด้านซ้าย ตารางแสดงเต็ม
- **มือถือ:**
  - แถบล่าง (`MobileBottomNav`) มี หน้าหลัก, รายงาน, ปุ่ม "+" ยกขึ้นเพื่อเปิดขาย, แจ้งเตือน และเมนู
  - ปุ่มเมนูเปิด drawer ที่มีทุกหน้าตามสิทธิ์ หน้าใหม่ทุกหน้าต้องเข้าได้จาก drawer นี้
  - ร้าน/สาขาและผู้ใช้อยู่บน header เท่านั้น ไม่ซ้ำใน drawer
  - ตารางเปลี่ยนเป็นแถวผ่าน `mobileRow` ของ `DataTable`
- **เมนูของ landing:** ต่ำกว่า desktop ใช้ drawer ด้านขวาสูงเต็มจอ ข้างในมีลิงก์ แถวเลือกธีม และปุ่มหลักชิดขอบล่าง ห้ามเปลี่ยนเป็นแผงเลื่อนลงจากด้านบน
- **ขนาดที่กดได้บนมือถือ:** อย่างน้อย 44px ปุ่มบันทึกและปุ่มหลักในฟอร์มยืดเต็มความกว้าง (`h-11 w-full tablet:h-9 tablet:w-auto`)
- **Bottom sheet บนมือถือ:** ไม่มี X มุมขวาบน ให้วางปุ่ม "ยกเลิก" แบบ outline ข้างปุ่มหลักที่ขอบล่าง และเว้น `pb-[max(1rem,env(safe-area-inset-bottom))]` ทุกครั้ง
- **หน้าย่อยบนมือถือ:** ถ้าเข้ามาจากหน้าหลักของส่วนนั้น ต้องมีลิงก์ย้อนกลับเหนือชื่อหน้า เช่น `SettingsBackLink` ("‹ ตั้งค่า")
- **Header ที่ติดขอบบน (sticky):** ต้องมีพื้นหลังต่อขึ้นไปด้านบน (`before:bottom-full before:bg-background`) กันเนื้อหาโผล่เหนือ header ใน in-app browser ของ Telegram/Instagram บน iOS
- **Sheet รายละเอียดด้านขวา (เช่น บิลของโต๊ะ):** มือถือเต็มจอ (`data-[side=right]:w-full`) จาก tablet ขึ้นไป `sm:max-w-md` ปุ่มหลักอยู่แถบล่างที่ติดขอบ และเว้น safe-area เหมือน bottom sheet

## หน้าสำหรับลูกค้าของร้าน (ไม่ต้อง login)

หน้าที่ลูกค้าเปิดจาก QR บนโต๊ะ (`/t/[token]`) อยู่นอก app shell ไม่มี sidebar แถบล่าง หรือชื่อแบรนด์ Posly เด่น หน้าเป็นของร้าน

- **กว้างสุด `max-w-2xl` กลางจอ** ออกแบบสำหรับมือถือมือเดียวก่อน
- **Header sticky:** โลโก้ร้าน (`StoreAvatar`) ชื่อร้าน ชื่อโต๊ะ และปุ่ม "บิลของโต๊ะ" ใต้นั้นเป็นแถบหมวดหมู่ `Segmented` แบบ `chips`
- **เมนู:** การ์ด `.surface` หนึ่งแถวต่อสินค้า (ภาพ `ProductThumb`, ชื่อ, ราคา, ปุ่ม `+` ขนาด 44px ที่กลายเป็นตัวเลขจำนวนเมื่ออยู่ในตะกร้า) สินค้าหมดใช้ `StatusBadge` neutral "หมด" และจางลง
- **ตะกร้าและบิล:** ปุ่มลอย `brand-gradient` ล่างจอเปิด bottom sheet ส่วนบิลใช้ bottom sheet อีกอัน สถานะรายการใช้จุดสีคู่คำเสมอ (`warning` = กำลังทำ / รอยืนยัน, `success` = เสร็จแล้ว)
- **ห้ามแสดง** ต้นทุน จำนวนสต็อก ชื่อพนักงาน หรือชื่อลูกค้าคนอื่น

## โต๊ะ (floor)

- **การ์ดโต๊ะ:** `.surface surface-hover rounded-2xl p-4` ชื่อโต๊ะ `text-lg font-semibold` สถานะเป็น `StatusBadge` คู่คำเสมอ: ว่าง = `neutral`, มีลูกค้า = `info` + ยอดบิล, มีคำสั่งจาก QR รอ = `warning` + `ring-2 ring-warning` และจุดกะพริบ
- **คำสั่งที่รอยืนยัน:** กล่อง `bg-warning/10 ring-1 ring-warning/40` ปุ่ม "ปฏิเสธ" outline คู่ "ยืนยัน" primary
- **แจ้งเตือนคำสั่งใหม่:** toast พร้อมปุ่ม "ดู" และเสียง chime (`lib/sounds.ts` ชุดเดียวกับจอครัว) ทุกหน้าของแอป

## กราฟ

- **แกน:** ใช้ recharts หนึ่งกราฟหนึ่งตัววัด หนึ่งแกน y ห้ามใช้สองแกน ถ้าต้องดูสองตัววัดให้แยกเป็นสองกราฟ
- **สี:**
  - กราฟยอดขายชุดเดียวใช้ `success`
  - กราฟหลายชุดใช้ `chart-1` ถึง `chart-5` ตามลำดับเสมอ ห้ามวนสี และสีต้องติดกับข้อมูลชุดนั้น ไม่ใช่กับอันดับ
  - ชุดสีนี้ตรวจแล้วว่าคนตาบอดสีแยกได้ จึงไม่มีเขียวคู่กับเหลืองอำพัน
  - **สีตามตัววัด ไม่ใช่ตามตำแหน่งกราฟ:** ตัววัดเดียวกันต้องเป็นสีเดียวกันทุกหน้า และกราฟที่วางข้างกันต้องไม่ใช้สีเดียวกัน admin กำหนดไว้ที่ `apps/admin/src/lib/chart-colors.ts` (`MEASURE_COLOR`): เงิน `success`, ออเดอร์ `chart-1`, ผู้ใช้ใหม่ `chart-2`, ร้านใหม่ `chart-3`, ร้าน active `chart-5`
  - **สีแพ็กเกจ (`PLAN_COLOR`):** Free ใช้ `muted-foreground` (ฐานที่ไม่ได้จ่ายเงิน) Starter `chart-2` Pro `chart-1` Business `chart-3` ใช้ทั้งแท่งและจุดหน้าชื่อแพ็กเกจ และต้องมีชื่อกำกับเสมอ
  - เลขอันดับและ chip ที่ไม่ได้สื่อข้อมูลใช้ `muted` ไม่ใช้ `primary`/`accent` ม่วงจะได้ไม่ท่วมหน้า
  - **ตารางสีตามขนาด (heatmap):** ตัววัดที่เป็นเงินใช้ `heat-1` ถึง `heat-5` (เขียวโทนเดียวกับยอดขาย) ตัววัดที่เป็นจำนวน เช่น ออเดอร์ ใช้ `heat-count-1` ถึง `heat-count-5` (ม่วงของแบรนด์) สลับสีตาม toggle ทั้งกราฟ ตาราง และแท่งประกอบ (ตรวจแบบ ordinal แล้วทั้งสองธีม โหมดสว่างไล่อ่อนไปเข้ม โหมดมืดไล่มืดไปสว่าง) ช่องว่างใช้ `muted` ทำแบบเรียบ: ช่องเล็ก `h-6 rounded-[5px] gap-1.5` ไม่พิมพ์ตัวเลขในช่อง ชี้หรือแตะแล้วขึ้นป้ายตัวเลข (พื้น `popover`) เหนือช่อง และมีแถบ "น้อย … มาก" ใต้ตาราง heatmap อ่านยากสำหรับเจ้าของร้าน จึงต้องมีมุมมองกราฟแท่งให้สลับ (`Segmented` "กราฟ / ตาราง") และเปิดเป็นกราฟก่อน กราฟแท่งชุดเดียวใช้ `success` แท่งที่ค่าสูงสุดทึบเต็ม แท่งอื่นจางลง (`fillOpacity 0.4`) และมีบรรทัดบอกค่าสูงสุดเหนือกราฟ
- **หน้าตา:**
  - แกนและ label ใช้ `muted-foreground` เส้น grid ใช้ `border`
  - tooltip พื้น `popover` มุม `rounded-xl` เงา `shadow-lg`
- **ตัวเลข:** บนแกนย่อได้ (`฿12K`) ใน tooltip แสดงค่าเต็ม (`฿12,450`)

## Motion

ใช้ `motion/react` ทั้งสองแอป ของที่ใช้ร่วมกันอยู่ใน `components/motion/` ของแต่ละแอป (admin คัดลอกจาก web ถ้าแก้ที่หนึ่งให้แก้อีกที่ด้วย)

- **ใช้เพื่อบอกว่าอะไรเปลี่ยน ไม่ใช่เพื่อตกแต่ง:** สั้น ชะลอตอนท้าย ไม่เด้ง (ease `[0.22, 1, 0.36, 1]` ยาว 0.25–0.45 วินาที)
- **ของที่มีให้ใช้:**
  - `Reveal` สำหรับบล็อกเดียวที่เลื่อนขึ้นพร้อมจางเข้า
  - `Stagger` + `StaggerItem` สำหรับรายการที่เข้ามาทีละชิ้น ถ้ารายการมาจาก query ให้ใช้ `trigger="mount"` เสมอ (`"in-view"` ทำให้ชิ้นที่มาทีหลังค้างที่ opacity 0)
  - `HoverLift` สำหรับการ์ดที่ลอยขึ้นตอนชี้
  - admin มี `template.tsx` ให้ทุกหน้าจางเข้าสั้น ๆ ตอนเปลี่ยนหน้า
- **ตัวเลขนับขึ้น (`CountUp`):**
  - ใช้กับตัวเลขหลักในการ์ดสรุป (`StatCard` ของ admin) และตัวเลขใหญ่ของหน้า เช่น ยอดขายวันนี้ ไม่ใช้กับตัวเลขในตาราง กราฟ หรือ badge
  - นับจาก 0 ครั้งแรกที่เลื่อนมาเห็น ถ้าข้อมูล refetch แล้วค่าเปลี่ยน จะนับจากค่าเดิมไปค่าใหม่ใน 0.6 วินาที คนดูจะรู้ว่าตัวเลขขยับ
  - ส่ง `format` เป็นฟังก์ชันที่ไม่สร้างใหม่ทุก render เช่น `formatBaht` (รับหน่วยสตางค์) หรือ `formatNumber` ถ้าส่ง arrow function ใหม่ทุก render ตัวเลขจะเริ่มนับใหม่
  - HTML ที่ render ออกมาเป็นค่าจริงเสมอ แอนิเมชันเขียนลง DOM เอง ไม่ผ่าน state
  - web มีแบบเดิมที่ใช้ในหน้า landing: รับ `locale` แทน `format` และถ้าค่าเปลี่ยนจะนับใหม่จาก 0
- **Reduced motion:** `MotionConfig reducedMotion="user"` ใน `Providers` ตัด transform ออกให้เอง แต่ของที่ไม่ได้ใช้ transform (เช่น `CountUp`) ต้องเช็ก `prefers-reduced-motion` เองแล้วแสดงค่าจริงทันที
- **ห้ามแตกต่างระหว่าง server กับ client:** ห้ามเลือก element ต่างกันตาม `useReducedMotion()` ตอน render เพราะจะทำให้ hydrate ไม่ตรง

## ไอคอน

- **ชุดไอคอน:** ใช้ lucide-react ทั้งระบบ ตั้งไว้ใน `components.json`
- **ขนาด:**
  - `size-4` ในปุ่มและ badge
  - `size-[18px]` ในเมนู
  - `size-5` ในปุ่มไอคอนของ header และแถบล่าง
- **สี:** ไอคอนใช้สีเดียวกับข้อความข้าง ๆ ยกเว้นไอคอนเมนู active ที่เป็น `primary`
- **ปุ่มไอคอนอย่างเดียว:** ต้องมี `aria-label`

## โลโก้

- **ไฟล์:** อยู่ที่ `apps/web/public/icons` (admin มีสำเนาเฉพาะ `mark-96.png`) ใช้ตามที่เป็น ห้ามวาดใหม่หรือเปลี่ยนสี
- **`mark-96.png`:** mark ใน sidebar และ header แสดงขนาด 36px ในกรอบมุม 25% ข้างคำว่า "Posly" (`text-lg font-semibold`) บนหน้า sign-in ใช้ 48px
- **`icon-512.png`, `icon-192.png`, `apple-touch-icon.png`:** ไอคอนแอปและ PWA
- **`maskable-192.png`, `maskable-512.png`:** ไอคอน Android แบบ maskable
- **ที่ยังไม่มี:** โลโก้แบบ SVG และแบบตัวหนังสือแยก ถ้าต้องใช้ตัวหนังสือ ให้พิมพ์ "Posly" ด้วย `font-sans` ข้าง mark

## Component

- **shadcn:** component พื้นฐานเป็น shadcn (style `radix-nova`) อยู่ใน `packages/ui/src/components` import ด้วย `@posly/ui/components/<name>` มี accordion, alert, avatar, badge, button, card, checkbox, collapsible, command, dialog, dropdown-menu, input, input-group, label, pagination, popover, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, tooltip
- **ระดับแอปของ web:** อยู่ใน `apps/web/src/components/common` มี `PageHeader`, `PageContainer`, `Surface`, `SectionTitle`, `MetricCard`, `StatusBadge`, `EmptyState`, `Segmented`, `PageTabs`, `DataTable`, `ConfirmDialog`
- **แท็บของหน้าย่อย ใช้ `PageTabs` ไม่ใช่ `Segmented`:** ถ้าต้องสลับไปหน้าอื่น (เช่น สต็อก "สินค้า / วัตถุดิบ") ใช้ `PageTabs` ซึ่งเป็นลิงก์จริง มีไอคอน เส้นใต้ `primary` ที่แท็บปัจจุบัน และเส้น `border` ยาวเต็มแถว วางไว้ใต้ `PageHeader` ส่วน `Segmented` ใช้สลับค่าภายในหน้าเดียวกันเท่านั้น เช่น "กราฟ / ตาราง" หรือ "กรอกเอง / คิดจากสูตร"
- **admin ใช้ชุดเดียวกัน:** `apps/admin/src/components/common/primitives.tsx` และ `segmented.tsx` คัดลอกหน้าตามาจาก web (MetricCard → `StatCard`, `IconChip`, `Sparkline`, `StatusBadge`, `EmptyState`, `Segmented`) ถ้าแก้ฝั่งหนึ่งต้องแก้อีกฝั่งด้วย
- **หน้าแรกของแอป:** ขึ้นต้นด้วยการ์ด `.hero-surface` หนึ่งใบ ตามด้วยการ์ดตัวเลขแบบ `tinted` 4 ใบ (`success`, `primary`, `info`, `warning`) ที่มี sparkline ทั้ง dashboard ของร้านและภาพรวมของ admin
- **ก่อนสร้างใหม่:** ใช้ของที่มีอยู่ก่อนเสมอ
- **เพิ่ม shadcn component:** ใส่ใน `packages/ui` ไม่ใช่ในแอป
