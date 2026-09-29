# @posly/utils

Pure functions ที่ไม่ผูกกับ React — ทดสอบด้วย `pnpm --filter @posly/utils test`

| ไฟล์ | |
| --- | --- |
| `money.ts` | เงินเป็น integer satang (`fromBaht`, `formatBaht`, ภาษี) |
| `format.ts` | วันที่แบบไทย (พ.ศ., เวลา Bangkok) |
| `promptpay.ts` | Thai QR / PromptPay payload (EMVCo + CRC16) |
| `tax-id.ts` | ตรวจ / จัดรูปเลขผู้เสียภาษี 13 หลัก |
