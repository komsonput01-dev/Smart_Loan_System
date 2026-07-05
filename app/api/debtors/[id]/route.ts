/**
 * Single Debtor API — PATCH for updating a debtor's profile, DELETE for soft deleting
 *
 * PATCH  /api/debtors/[id] → update debtor details (Admin only)
 * DELETE /api/debtors/[id] → delete / disable debtor (Admin only)
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ensureUser } from '@/lib/db/ensureUser';
import { z } from 'zod';

const UpdateDebtorSchema = z.object({
  fullName: z.string().min(1, 'กรุณาระบุชื่อ-นามสกุล'),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  phone: z.string().optional(),
  lineUserId: z.string().optional(),
  address: z.string().optional(),
  idCardNumber: z.string().optional(),
  note: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateDebtorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(users)
      .set({
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        lineUserId: parsed.data.lineUserId || null,
        address: parsed.data.address || null,
        idCardNumber: parsed.data.idCardNumber || null,
        note: parsed.data.note || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Debtor not found' }, { status: 404 });
    }

    return NextResponse.json({ debtor: updated });
  } catch (error) {
    console.error('[PATCH /api/debtors/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Soft-delete: set isActive to false
    const [deleted] = await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Debtor not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Debtor soft-deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/debtors/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
