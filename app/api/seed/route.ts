/**
 * Seed API — Populate DB with sample debtors & loans
 *
 * GET /api/seed   → insert sample data (dev only, idempotent)
 *
 * Mirrors the MOCK_DEBTORS in DebtorTable.tsx so the real DB
 * matches what the UI was showing from mock data.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, loans } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// ─── Sample Data ────────────────────────────────────────────────────────────

const SAMPLE_DEBTORS = [
  {
    clerkId: 'debtor_seed_001',
    fullName: 'สมชาย มั่นคง',
    phone: '081-234-5678',
    email: 'somchai@example.com',
    lineUserId: null,
    loan: {
      loanRef: 'LN-2024-001',
      principal: '500000.00',
      outstanding: '420000.00',
      interestRate: '3.0000',
      interestType: 'effective_monthly' as const,
      startDate: '2024-01-07',
      dueDate: '2026-07-07',
      status: 'upcoming' as const,
      totalInterestCollected: '42000.00',
      accruedInterest: '2100.00',
      bankName: 'กสิกรไทย',
      bankAccountName: 'สมชาย มั่นคง',
      bankAccountNumber: '123-4-56789-0',
    },
  },
  {
    clerkId: 'debtor_seed_002',
    fullName: 'นาง วิไลวรรณ ทองดี',
    phone: '082-345-6789',
    email: 'wilaiwan@example.com',
    lineUserId: 'U111222333',
    loan: {
      loanRef: 'LN-2024-002',
      principal: '200000.00',
      outstanding: '85000.00',
      interestRate: '2.5000',
      interestType: 'flat_monthly' as const,
      startDate: '2024-01-15',
      dueDate: '2026-06-15',
      status: 'overdue' as const,
      totalInterestCollected: '35000.00',
      accruedInterest: '4250.00',
      bankName: 'ไทยพาณิชย์',
      bankAccountName: 'วิไลวรรณ ทองดี',
      bankAccountNumber: '456-7-89012-3',
    },
  },
  {
    clerkId: 'debtor_seed_003',
    fullName: 'นาย ประเสริฐ ศรีวิไล',
    phone: '083-456-7890',
    email: 'prasert@example.com',
    lineUserId: 'U444555666',
    loan: {
      loanRef: 'LN-2024-003',
      principal: '1000000.00',
      outstanding: '780000.00',
      interestRate: '4.0000',
      interestType: 'effective_daily' as const,
      startDate: '2024-02-01',
      dueDate: '2026-08-01',
      status: 'active' as const,
      totalInterestCollected: '88000.00',
      accruedInterest: '3200.00',
      bankName: 'กรุงเทพ',
      bankAccountName: 'ประเสริฐ ศรีวิไล',
      bankAccountNumber: '789-0-12345-6',
    },
  },
  {
    clerkId: 'debtor_seed_004',
    fullName: 'นางสาว กัญญารัตน์ สุขใจ',
    phone: '084-567-8901',
    email: 'kanyarat@example.com',
    lineUserId: null,
    loan: {
      loanRef: 'LN-2024-004',
      principal: '150000.00',
      outstanding: '60000.00',
      interestRate: '3.5000',
      interestType: 'flat_daily' as const,
      startDate: '2024-01-05',
      dueDate: '2026-07-05',
      status: 'upcoming' as const,
      totalInterestCollected: '31500.00',
      accruedInterest: '525.00',
      bankName: 'กรุงไทย',
      bankAccountName: 'กัญญารัตน์ สุขใจ',
      bankAccountNumber: '012-3-45678-9',
    },
  },
  {
    clerkId: 'debtor_seed_005',
    fullName: 'นาย อนุชา พรมมา',
    phone: '085-678-9012',
    email: 'anucha@example.com',
    lineUserId: 'U777888999',
    loan: {
      loanRef: 'LN-2024-005',
      principal: '300000.00',
      outstanding: '300000.00',
      interestRate: '5.0000',
      interestType: 'effective_monthly' as const,
      startDate: '2024-01-20',
      dueDate: '2026-05-20',
      status: 'overdue' as const,
      totalInterestCollected: '0.00',
      accruedInterest: '22500.00',
      bankName: 'ทหารไทยธนชาต',
      bankAccountName: 'อนุชา พรมมา',
      bankAccountNumber: '345-6-78901-2',
    },
  },
  {
    clerkId: 'debtor_seed_006',
    fullName: 'นาง มาลัย รุ่งเรือง',
    phone: '086-789-0123',
    email: 'malai@example.com',
    lineUserId: 'UAAABBBCCC',
    loan: {
      loanRef: 'LN-2024-006',
      principal: '800000.00',
      outstanding: '520000.00',
      interestRate: '2.7500',
      interestType: 'effective_monthly' as const,
      startDate: '2024-03-15',
      dueDate: '2026-09-15',
      status: 'active' as const,
      totalInterestCollected: '66000.00',
      accruedInterest: '1430.00',
      bankName: 'กสิกรไทย',
      bankAccountName: 'มาลัย รุ่งเรือง',
      bankAccountNumber: '678-9-01234-5',
    },
  },
  {
    clerkId: 'debtor_seed_007',
    fullName: 'นาย สุรชัย ใจดี',
    phone: '087-890-1234',
    email: 'surachai@example.com',
    lineUserId: null,
    loan: {
      loanRef: 'LN-2024-007',
      principal: '450000.00',
      outstanding: '380000.00',
      interestRate: '3.2500',
      interestType: 'flat_monthly' as const,
      startDate: '2024-01-06',
      dueDate: '2026-07-06',
      status: 'upcoming' as const,
      totalInterestCollected: '43875.00',
      accruedInterest: '1462.50',
      bankName: 'ไทยพาณิชย์',
      bankAccountName: 'สุรชัย ใจดี',
      bankAccountNumber: '901-2-34567-8',
    },
  },
  {
    clerkId: 'debtor_seed_008',
    fullName: 'นาง รัตนา สิงห์ทอง',
    phone: '088-901-2345',
    email: 'ratana@example.com',
    lineUserId: 'UDDDEEEFFF',
    loan: {
      loanRef: 'LN-2024-008',
      principal: '600000.00',
      outstanding: '0.00',
      interestRate: '2.0000',
      interestType: 'flat_monthly' as const,
      startDate: '2024-03-01',
      dueDate: '2026-03-01',
      status: 'closed' as const,
      totalInterestCollected: '24000.00',
      accruedInterest: '0.00',
    },
  },
];

export async function GET() {
  // Safety: only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Seed disabled in production' }, { status: 403 });
  }

  try {
    const results: string[] = [];

    for (const sample of SAMPLE_DEBTORS) {
      // 1. Upsert debtor user
      const [user] = await db
        .insert(users)
        .values({
          clerkUserId: sample.clerkId,
          fullName: sample.fullName,
          phone: sample.phone,
          email: sample.email,
          lineUserId: sample.lineUserId,
          role: 'debtor',
          isActive: true,
        })
        .onConflictDoUpdate({
          target: users.clerkUserId,
          set: {
            fullName: sample.fullName,
            phone: sample.phone,
            email: sample.email,
            lineUserId: sample.lineUserId,
            updatedAt: new Date(),
          },
        })
        .returning({ id: users.id, fullName: users.fullName });

      // 2. Check if loan already exists for this user
      const existingLoans = await db
        .select({ id: loans.id })
        .from(loans)
        .where(eq(loans.userId, user.id))
        .limit(1);

      if (existingLoans.length === 0) {
        // Insert loan
        await db.insert(loans).values({
          userId: user.id,
          principal: sample.loan.principal,
          outstandingPrincipal: sample.loan.outstanding,
          accruedInterest: sample.loan.accruedInterest,
          totalInterestCollected: sample.loan.totalInterestCollected,
          interestRate: sample.loan.interestRate,
          interestType: sample.loan.interestType,
          startDate: sample.loan.startDate,
          dueDate: sample.loan.dueDate,
          lastInterestCalcDate: sample.loan.startDate,
          status: sample.loan.status,
          note: `รหัสสัญญา: ${sample.loan.loanRef}`,
          bankName: sample.loan.bankName,
          bankAccountName: sample.loan.bankAccountName,
          bankAccountNumber: sample.loan.bankAccountNumber,
        });
        results.push(`✅ Created: ${user.fullName} (${sample.loan.loanRef})`);
      } else {
        results.push(`⏭️ Skipped (exists): ${user.fullName}`);
      }
    }

    // Count totals
    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(users)
      .where(eq(users.role, 'debtor'));

    return NextResponse.json({
      success: true,
      message: `Seed completed — ${total} debtors total`,
      results,
    });
  } catch (error) {
    console.error('[Seed] Error:', error);
    return NextResponse.json(
      { error: 'Seed failed', detail: String(error) },
      { status: 500 }
    );
  }
}
