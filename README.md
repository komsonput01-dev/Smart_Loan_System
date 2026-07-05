# 🏦 Smart Loan Management System

ระบบบริหารจัดการสินเชื่อและลูกหนี้ สำหรับธุรกิจปล่อยกู้ขนาดเล็กถึงกลาง

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | Neon PostgreSQL (Serverless) |
| ORM | Drizzle ORM |
| Auth | Clerk |
| File Storage | Vercel Blob |
| Notification | LINE Messaging API |
| UI | Ant Design 5 |
| Financial Math | decimal.js (ป้องกัน floating-point error) |
| Deployment | Vercel |

---

## Features (6 Phases)

- **Phase 1** — Authentication (Clerk + Role-based: admin / debtor)
- **Phase 2** — Debtor & Loan Management (CRUD + Drizzle ORM)
- **Phase 3** — Interest Calculation Engine (flat/effective, daily/monthly) + Smart Allocation
- **Phase 4** — LINE Notification Engine (Queue-based, Batch Processing, Cron 08:30 ICT)
- **Phase 5** — Excel Export (SheetJS, 2 tabs: Summary + Raw_Data)
- **Phase 6** — File/Image Storage (Vercel Blob + Client-side Compression)

---

## 🚀 Deploy to Vercel — Step-by-Step

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "feat: initial production-ready build"
git remote add origin https://github.com/YOUR_USERNAME/smart-loan.git
git push -u origin main
```

> ⚠️ `.env.local` จะ**ไม่**ถูก push ขึ้น GitHub (อยู่ใน `.gitignore` แล้ว)

---

### Step 2 — Create Vercel Project

1. ไปที่ [vercel.com](https://vercel.com) → **Add New → Project**
2. Import repository จาก GitHub
3. Framework Preset เลือก **Next.js** (detect อัตโนมัติ)
4. **Root Directory**: `smart-loan` (ถ้า repo มีหลายโฟลเดอร์)
5. กด **Deploy** (ยังไม่ต้องตั้ง ENV ก็ได้ จะ fail ครั้งแรก ไม่เป็นไร)

---

### Step 3 — Set Environment Variables on Vercel

ไปที่ **Project Settings → Environment Variables** แล้วเพิ่มทุกค่าต่อไปนี้:

#### 🗄️ Neon PostgreSQL
| Key | คำอธิบาย | ที่มา |
|---|---|---|
| `DATABASE_URL` | Pooled connection string | [console.neon.tech](https://console.neon.tech) → Connection Details → Pooled |
| `DATABASE_URL_UNPOOLED` | Direct connection (for migrations) | เหมือนบน แต่ไม่ผ่าน pgbouncer |

#### 🔐 Clerk Authentication
| Key | คำอธิบาย | ที่มา |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public key | [dashboard.clerk.com](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Secret key | เหมือนบน |
| `CLERK_WEBHOOK_SECRET` | Webhook signing secret | Clerk Dashboard → Webhooks → Signing Secret |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | ค่าคงที่ |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | ค่าคงที่ |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` | ค่าคงที่ |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` | ค่าคงที่ |

#### 📦 Vercel Blob Storage
| Key | คำอธิบาย | ที่มา |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Blob read/write token | Vercel → Storage → Blob → Token |

#### 📱 LINE Messaging API
| Key | คำอธิบาย | ที่มา |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | Long-lived channel access token | [developers.line.biz](https://developers.line.biz) → Messaging API Channel |
| `LINE_CHANNEL_SECRET` | Channel secret | เหมือนบน |

#### ⚙️ App Settings
| Key | ตัวอย่างค่า | คำอธิบาย |
|---|---|---|
| `CRON_SECRET` | `your-random-32-char-secret` | ป้องกัน cron endpoint ถูกเรียกจากภายนอก |
| `BANK_NAME` | `ธนาคารกสิกรไทย` | ชื่อธนาคารสำหรับแจ้งเตือน T-1 |
| `BANK_ACCOUNT_NUMBER` | `xxx-x-xxxxx-x` | เลขบัญชีรับเงิน |
| `BANK_ACCOUNT_NAME` | `นาย สมชาย ใจดี` | ชื่อบัญชีรับเงิน |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | URL ของ app บน Vercel |

---

### Step 4 — Set Up Clerk Webhook

1. ไปที่ Clerk Dashboard → **Webhooks → Add Endpoint**
2. **URL**: `https://YOUR_APP.vercel.app/api/webhooks/clerk`
3. **Events**: เลือก `user.created`, `user.updated`, `user.deleted`
4. Copy **Signing Secret** → ใส่ใน `CLERK_WEBHOOK_SECRET` บน Vercel

---

### Step 5 — Run Database Migration

หลัง deploy ครั้งแรกสำเร็จ ให้รัน migration บน local machine:

```bash
# ใช้ DATABASE_URL_UNPOOLED (direct connection) สำหรับ migration
DATABASE_URL=<YOUR_UNPOOLED_URL> npx drizzle-kit push
```

หรือถ้าตั้งใน `.env.local` แล้ว:

```bash
npx drizzle-kit push
```

---

### Step 6 — Verify Cron Job

Vercel จะรัน cron อัตโนมัติตาม `vercel.json`:
- **Schedule**: `30 1 * * *` = **08:30 ICT ทุกวัน**
- **Endpoint**: `GET /api/cron/notifications`
- **Auth**: Bearer token จาก `CRON_SECRET`

ทดสอบ manual ได้จาก Vercel Dashboard → **Cron Jobs → Trigger**

---

### Step 7 — Set Admin Role

หลัง deploy สำเร็จ ให้ไปที่ Neon Console → SQL Editor แล้วรัน:

```sql
-- เปลี่ยน user ตัวเองเป็น admin (ใช้ clerk_user_id จาก Clerk Dashboard)
UPDATE users
SET role = 'admin'
WHERE clerk_user_id = 'user_xxxxxxxxxxxxxxxxxx';
```

---

## 📁 Project Structure

```
smart-loan/
├── app/
│   ├── api/
│   │   ├── cron/notifications/   # LINE Notification Cron Job
│   │   ├── debtors/              # Debtor CRUD
│   │   ├── loans/                # Loan CRUD
│   │   ├── payments/             # Payment Recording + Allocation
│   │   ├── export/               # Excel Export (SheetJS)
│   │   ├── upload/               # File Upload (Vercel Blob)
│   │   ├── document/             # Signed URL for document preview
│   │   └── webhooks/clerk/       # Clerk User Sync
│   └── dashboard/                # Protected Admin UI
├── components/
│   └── dashboard/
│       ├── DocumentUpload.tsx    # Camera + compression + preview
│       ├── ExportButton.tsx      # Excel export button
│       └── ...
├── lib/
│   ├── db/
│   │   ├── index.ts              # Drizzle client
│   │   └── schema.ts             # Database schema
│   ├── interest-calculator.ts    # Interest engine (decimal.js)
│   ├── payment-allocator.ts      # Smart payment allocation
│   ├── line-notify.ts            # LINE Messaging API client
│   └── image-compression.ts     # Client-side image compressor
├── vercel.json                   # Cron, security headers, timeouts
├── drizzle.config.ts
└── .env.example                  # Environment variable template
```

---

## 🔒 Security Notes

- ทุก API route ตรวจสอบ Clerk session ก่อนทำงาน
- `/api/cron/*` ป้องกันด้วย `Authorization: Bearer <CRON_SECRET>`
- `/api/webhooks/clerk` ป้องกันด้วย svix signature
- ไม่มีการเก็บ signed URL ลงฐานข้อมูล (สร้าง on-demand มี expiry 5 นาที)
- Security headers ทุก route: `X-Frame-Options`, `HSTS`, `X-Content-Type-Options`

---

## 💰 ค่าใช้จ่าย (Free Tier)

| Service | Free Tier | หมายเหตุ |
|---|---|---|
| Vercel | Hobby (Free) | รองรับ cron, blob, functions |
| Neon | Free (0.5 GB) | เพียงพอสำหรับระบบขนาดเล็ก |
| Clerk | Free (10,000 MAU) | เกินกว่านั้นมีค่าใช้จ่าย |
| LINE Messaging | Free (500 msg/เดือน) | Messaging API แบบฟรี |
| Vercel Blob | Free (1 GB) | เกินมีค่าใช้จ่าย |
