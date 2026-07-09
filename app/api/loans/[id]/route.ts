/**
 * Single Loan API — GET/PATCH/DELETE for a specific loan
 * GET   /api/loans/[id] → loan detail with payments and documents
 * PATCH /api/loans/[id] → update loan status/notes
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, payments, documents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ensureUser } from '@/lib/db/ensureUser';
import { calculateComputedLoanStatus } from '@/lib/interest-calculator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
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

    // Authorization check: debtors can only see their own active/closed loans (not drafts)
    const isDebtor = currentUser.role === 'debtor';
    const loanDetail = loanData[0].loans;
    if (isDebtor) {
      if (loanDetail.userId !== currentUser.id || loanDetail.status === 'draft') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Fetch creator and approver names
    let creatorName = null;
    let approverName = null;

    if (loanDetail.createdBy) {
      const [creator] = await db
        .select({ name: users.fullName })
        .from(users)
        .where(eq(users.id, loanDetail.createdBy))
        .limit(1);
      if (creator) creatorName = creator.name;
    }

    if (loanDetail.approvedBy) {
      const [approver] = await db
        .select({ name: users.fullName })
        .from(users)
        .where(eq(users.id, loanDetail.approvedBy))
        .limit(1);
      if (approver) approverName = approver.name;
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
      })
      .from(documents)
      .where(eq(documents.loanId, id));

    const computedStatus = calculateComputedLoanStatus({
      status: loanDetail.status,
      dueDate: loanDetail.dueDate,
      outstandingPrincipal: loanDetail.outstandingPrincipal,
    });

    return NextResponse.json({
      loan: {
        ...loanDetail,
        status: computedStatus,
        creatorName,
        approverName,
      },
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
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require admin or staff role
    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const isStaff = currentUser.role === 'staff';

    // Verify staff restrictions: Staff cannot change status or financial dates/terms
    if (isStaff) {
      if (body.status || body.dueDate || body.principal || body.interestRate || body.interestType) {
        return NextResponse.json({ error: 'Staff role is not allowed to modify status or financial terms' }, { status: 403 });
      }
    }

    // Fetch current loan status to check for approval transitions
    const [currentLoan] = await db
      .select({ status: loans.status })
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!currentLoan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Only allow updating specific fields
    const allowedUpdates: Record<string, unknown> = {};
    if (body.status) {
      allowedUpdates.status = body.status;
      // If Admin is approving a draft loan to active
      if (body.status === 'active' && currentLoan.status === 'draft') {
        allowedUpdates.approvedBy = currentUser.id;
      }
    }
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

    return NextResponse.json({ loan: updated });
  } catch (error) {
    console.error('[PATCH /api/loans/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
