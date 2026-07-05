/**
 * Single Loan API — GET/PATCH/DELETE for a specific loan
 * GET   /api/loans/[id] → loan detail with payments and documents
 * PATCH /api/loans/[id] → update loan status/notes
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, payments, documents } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch loan with user info
    const loanData = await db
      .select()
      .from(loans)
      .leftJoin(users, eq(loans.userId, users.id))
      .where(eq(loans.id, id))
      .limit(1);

    if (!loanData[0]) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Fetch payment history (newest first)
    const paymentHistory = await db
      .select()
      .from(payments)
      .where(eq(payments.loanId, id))
      .orderBy(desc(payments.paymentDate));

    // Fetch documents
    const loanDocuments = await db
      .select({
        id: documents.id,
        docType: documents.docType,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        fileSizeBytes: documents.fileSizeBytes,
        uploadedAt: documents.uploadedAt,
        // NOTE: blobPathname is NOT returned here for security
        // Use /api/signed-url?pathname=... to get a time-limited URL
      })
      .from(documents)
      .where(eq(documents.loanId, id));

    return NextResponse.json({
      loan: loanData[0].loans,
      user: loanData[0].users,
      payments: paymentHistory,
      documents: loanDocuments,
    });
  } catch (error) {
    console.error('[GET /api/loans/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    const adminUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!adminUser[0] || adminUser[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Only allow updating specific fields
    const allowedUpdates: Record<string, unknown> = {};
    if (body.status) allowedUpdates.status = body.status;
    if (body.note !== undefined) allowedUpdates.note = body.note;
    if (body.bankAccountName !== undefined) allowedUpdates.bankAccountName = body.bankAccountName;
    if (body.bankAccountNumber !== undefined) allowedUpdates.bankAccountNumber = body.bankAccountNumber;
    if (body.bankName !== undefined) allowedUpdates.bankName = body.bankName;
    if (body.dueDate) allowedUpdates.dueDate = body.dueDate;
    allowedUpdates.updatedAt = new Date();

    const [updated] = await db
      .update(loans)
      .set(allowedUpdates as any)
      .where(eq(loans.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    return NextResponse.json({ loan: updated });
  } catch (error) {
    console.error('[PATCH /api/loans/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
