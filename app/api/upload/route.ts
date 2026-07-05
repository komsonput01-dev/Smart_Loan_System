/**
 * Upload API Route — Smart Loan Management System
 *
 * Route: POST /api/upload
 * Saves documents (ID card, title deed, or loan contract) in Vercel Blob.
 * Files are stored as private assets, and their references are recorded in
 * the 'loans' table (matching id_card_image_url, land_deed_image_url, or contract_doc_url).
 *
 * Auth: Requires Clerk authentication. Admin-only access.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const adminUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!adminUser[0] || adminUser[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const loanId = formData.get('loanId') as string;
    const docType = formData.get('docType') as 'id_card' | 'title_deed' | 'contract';

    if (!file || !loanId || !docType) {
      return NextResponse.json(
        { error: 'Missing file, loanId, or docType' },
        { status: 400 }
      );
    }

    // Validate loan exists
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const filename = `${loanId}_${docType}_${Date.now()}_${file.name}`;

    // Upload to Vercel Blob (Private store)
    // NOTE: Access is restricted and requires Signed URL verification endpoint to view.
    const blob = await put(filename, file, {
      access: 'private', // 100% Private as required
      addRandomSuffix: false,
    });

    // Update loan details with the secure Blob URL reference
    const updates: Record<string, string> = {};
    if (docType === 'id_card') {
      updates.idCardImageUrl = blob.url;
    } else if (docType === 'title_deed') {
      updates.landDeedImageUrl = blob.url;
    } else if (docType === 'contract') {
      updates.contractDocUrl = blob.url;
    }

    await db
      .update(loans)
      .set(updates)
      .where(eq(loans.id, loanId));

    console.log(`[Upload API] Private file successfully stored: ${blob.url} for Loan ${loanId}`);

    return NextResponse.json({
      success: true,
      url: blob.url,
    });

  } catch (error: any) {
    console.error('[Upload API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
