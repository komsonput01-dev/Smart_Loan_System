/**
 * Drizzle ORM Schema — Smart Loan Management System
 *
 * CRITICAL: All monetary/financial fields use NUMERIC type (mapped to string in JS)
 * to prevent floating-point precision loss at the satang level.
 * Use decimal.js for all arithmetic operations on these values.
 */

import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'debtor']);

export const interestTypeEnum = pgEnum('interest_type', [
  'flat_daily',       // คงที่/วัน — คิดจากเงินต้นก้อนแรก รายวัน
  'flat_monthly',     // คงที่/เดือน — คิดจากเงินต้นก้อนแรก รายเดือน
  'effective_daily',  // ลดต้น/วัน — คิดจากเงินต้นคงเหลือ รายวัน
  'effective_monthly', // ลดต้น/เดือน — คิดจากเงินต้นคงเหลือ รายเดือน
]);

export const loanStatusEnum = pgEnum('loan_status', [
  'active',    // 🟢 ปกติ
  'upcoming',  // 🟡 ใกล้กำหนดชำระ (1–3 วัน)
  'overdue',   // 🔴 เกินกำหนดชำระ
  'closed',    // ✅ ปิดสัญญาแล้ว (ชำระครบ)
  'npl',       // ⚠️ หนี้เสีย (NPL)
]);

export const documentTypeEnum = pgEnum('document_type', [
  'id_card',    // สำเนาบัตรประชาชน
  'title_deed', // โฉนดที่ดิน
  'contract',   // สัญญาเงินกู้
  'other',      // เอกสารอื่น ๆ
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

/**
 * users — ผู้ใช้งานระบบ (sync จาก Clerk ผ่าน Webhook)
 * clerk_user_id เป็น key หลักในการ link กับ Clerk
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clerkUserId: text('clerk_user_id').notNull(),
    fullName: text('full_name'),
    email: text('email'),
    phone: text('phone'),                    // เบอร์โทรศัพท์
    lineUserId: text('line_user_id'),        // LINE User ID สำหรับส่งแจ้งเตือน
    role: userRoleEnum('role').notNull().default('debtor'),
    isActive: boolean('is_active').notNull().default(true),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('users_clerk_user_id_idx').on(t.clerkUserId),
    index('users_email_idx').on(t.email),
    index('users_role_idx').on(t.role),
  ]
);

/**
 * loans — สัญญาเงินกู้
 *
 * CRITICAL PRECISION NOTES:
 * - principal, outstanding_principal, accrued_interest → NUMERIC(15,2) = ฿0.00 precision
 * - interest_rate → NUMERIC(8,4) = รองรับ 0.0001% resolution
 * - ใช้ decimal.js เมื่อคำนวณในฝั่ง application
 */
export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // Financial fields — NUMERIC type (stored as string in JS, use decimal.js)
    principal: numeric('principal', { precision: 15, scale: 2 }).notNull(),
    outstandingPrincipal: numeric('outstanding_principal', { precision: 15, scale: 2 }).notNull(),
    accruedInterest: numeric('accrued_interest', { precision: 15, scale: 2 }).notNull().default('0'),
    totalInterestCollected: numeric('total_interest_collected', { precision: 15, scale: 2 }).notNull().default('0'),

    // Interest configuration — customizable per contract
    interestRate: numeric('interest_rate', { precision: 8, scale: 4 }).notNull(), // e.g. "3.0000" = 3%/period
    interestType: interestTypeEnum('interest_type').notNull(),

    // Dates
    startDate: date('start_date').notNull(),
    dueDate: date('due_date').notNull(),
    lastInterestCalcDate: date('last_interest_calc_date'), // วันที่คำนวณดอกเบี้ยล่าสุด

    // Status (computed & stored for dashboard performance)
    status: loanStatusEnum('status').notNull().default('active'),

    // Metadata
    note: text('note'),                    // หมายเหตุ
    bankAccountName: text('bank_account_name'),  // ชื่อบัญชีรับเงิน
    bankAccountNumber: text('bank_account_number'), // เลขบัญชีรับเงิน
    bankName: text('bank_name'),

    idCardImageUrl: text('id_card_image_url'),
    landDeedImageUrl: text('land_deed_image_url'),
    contractDocUrl: text('contract_doc_url'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('loans_user_id_idx').on(t.userId),
    index('loans_status_idx').on(t.status),
    index('loans_due_date_idx').on(t.dueDate),
    index('loans_due_date_status_idx').on(t.dueDate, t.status), // สำหรับ cron query
  ]
);

/**
 * payments — ประวัติการชำระเงิน
 *
 * Payment Allocation Logic (ตัดยอดอัจฉริยะ):
 * 1. amount_paid → หัก accrued_interest ก่อน (interest_portion)
 * 2. เศษเงินที่เหลือ → หัก outstanding_principal (principal_portion)
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'restrict' }),

    paymentDate: date('payment_date').notNull(),

    // NUMERIC precision for all monetary fields
    amountPaid: numeric('amount_paid', { precision: 15, scale: 2 }).notNull(),
    interestPortion: numeric('interest_portion', { precision: 15, scale: 2 }).notNull(),    // ส่วนที่หักดอกเบี้ย
    principalPortion: numeric('principal_portion', { precision: 15, scale: 2 }).notNull(),  // ส่วนที่หักเงินต้น
    remainingPrincipal: numeric('remaining_principal', { precision: 15, scale: 2 }).notNull(), // เงินต้นคงเหลือหลังชำระ
    accruedInterestBefore: numeric('accrued_interest_before', { precision: 15, scale: 2 }).notNull(), // ดอกเบี้ยค้างก่อนชำระ
    accruedInterestAfter: numeric('accrued_interest_after', { precision: 15, scale: 2 }).notNull(),   // ดอกเบี้ยค้างหลังชำระ

    note: text('note'),
    recordedBy: uuid('recorded_by').references(() => users.id), // admin ที่บันทึก

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('payments_loan_id_idx').on(t.loanId),
    index('payments_payment_date_idx').on(t.paymentDate),
  ]
);

/**
 * documents — เอกสารสำคัญที่ผูกกับสัญญา
 * เก็บเฉพาะ Vercel Blob pathname ไม่ใช่ signed URL (URL สร้างตอน request)
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),

    docType: documentTypeEnum('doc_type').notNull(),
    fileName: text('file_name').notNull(),         // ชื่อไฟล์ต้นฉบับ
    blobPathname: text('blob_pathname').notNull(),  // Vercel Blob pathname (for signed URL generation)
    mimeType: text('mime_type'),                    // e.g. "image/jpeg"
    fileSizeBytes: numeric('file_size_bytes', { precision: 10, scale: 0 }),

    uploadedBy: uuid('uploaded_by').references(() => users.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('documents_loan_id_idx').on(t.loanId),
  ]
);

/**
 * notification_logs — ประวัติการส่งแจ้งเตือน LINE
 * ใช้สำหรับ idempotency (ป้องกันส่งซ้ำในวันเดิม)
 */
export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),

    notificationType: text('notification_type').notNull(), // 't-3' | 't-1' | 'overdue'
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().default(sql`now()`),
    sentDate: date('sent_date').notNull(),  // วันที่ส่ง (สำหรับ idempotency check)
    success: boolean('success').notNull().default(true),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('notification_logs_loan_id_idx').on(t.loanId),
    index('notification_logs_sent_date_type_idx').on(t.sentDate, t.notificationType),
    uniqueIndex('notification_logs_idempotency_idx').on(t.loanId, t.sentDate, t.notificationType),
  ]
);

export const lineNotificationStatusEnum = pgEnum('line_notification_status', ['pending', 'sent', 'failed']);

/**
 * line_notifications — คิวการส่งแจ้งเตือน LINE เพื่อป้องกันปัญหา Timeout บน Serverless
 */
export const lineNotifications = pgTable(
  'line_notifications',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    lineUserId: text('line_user_id').notNull(),
    messageText: text('message_text').notNull(),
    status: lineNotificationStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('line_notifications_status_idx').on(t.status),
    index('line_notifications_loan_id_idx').on(t.loanId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  loans: many(loans),
  recordedPayments: many(payments, { relationName: 'recordedBy' }),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  user: one(users, { fields: [loans.userId], references: [users.id] }),
  payments: many(payments),
  documents: many(documents),
  notificationLogs: many(notificationLogs),
  lineNotifications: many(lineNotifications),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  loan: one(loans, { fields: [payments.loanId], references: [loans.id] }),
  recordedBy: one(users, {
    fields: [payments.recordedBy],
    references: [users.id],
    relationName: 'recordedBy',
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  loan: one(loans, { fields: [documents.loanId], references: [loans.id] }),
  uploadedBy: one(users, { fields: [documents.uploadedBy], references: [users.id] }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  loan: one(loans, { fields: [notificationLogs.loanId], references: [loans.id] }),
}));

export const lineNotificationsRelations = relations(lineNotifications, ({ one }) => ({
  loan: one(loans, { fields: [lineNotifications.loanId], references: [loans.id] }),
}));

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type LineNotification = typeof lineNotifications.$inferSelect;
export type NewLineNotification = typeof lineNotifications.$inferInsert;

// Useful joined types
export type LoanWithUser = Loan & { user: User };
export type LoanWithPayments = Loan & { payments: Payment[] };
export type LoanFull = Loan & { user: User; payments: Payment[]; documents: Document[] };

