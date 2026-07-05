/**
 * Document Secure Stream Proxy API Route — Smart Loan Management System
 *
 * Route: GET /api/document?loanId=xxx&docType=yyy
 *
 * Security:
 *   1. Authenticates current user with Clerk.
 *   2. Validates permission: Admin can see any doc; Debtors can ONLY see their own docs.
 *   3. Resolves Private Vercel Blob URL from database.
 *   4. Streams the private binary blob to the client directly with secure headers (No public link exposed).
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { get } from '@vercel/blob';

export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const loanId = searchParams.get('loanId');
    const docType = searchParams.get('docType') as 'id_card' | 'title_deed' | 'contract';

    if (!loanId || !docType) {
      return NextResponse.json(
        { error: 'Missing loanId or docType parameter' },
        { status: 400 }
      );
    }

    // ── 1. Fetch User Record to check role ───────────────────────────────────
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User record not found' }, { status: 404 });
    }

    // ── 2. Fetch Loan Details to verify ownership ────────────────────────────
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Debtor protection: ensure debtor only accesses their own loans
    if (requestingUser.role === 'debtor' && loan.userId !== requestingUser.id) {
      return NextResponse.json(
        { error: 'Access denied: You do not own this loan contract' },
        { status: 403 }
      );
    }

    // Determine the corresponding private blob URL
    let blobUrl = '';
    if (docType === 'id_card') {
      blobUrl = loan.idCardImageUrl ?? '';
    } else if (docType === 'title_deed') {
      blobUrl = loan.landDeedImageUrl ?? '';
    } else if (docType === 'contract') {
      blobUrl = loan.contractDocUrl ?? '';
    }

    if (!blobUrl) {
      return NextResponse.json(
        { error: `Document type '${docType}' is not uploaded yet` },
        { status: 404 }
      );
    }

    // ── 3. Stream Private Blob content ───────────────────────────────────────
    // Using @vercel/blob get() to download private stream
    const blobResponse = await get(blobUrl, {
      access: 'private',
    });

    if (!blobResponse) {
      return NextResponse.json(
        { error: 'Blob not found in secure storage' },
        { status: 404 }
      );
    }

    // Return the file stream with correct Content-Type to render in <img> / <Image> tags
    return new NextResponse(blobResponse.stream, {
      headers: {
        'Content-Type': blobResponse.blob.contentType || 'image/jpeg',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });

  } catch (error: any) {
    console.error('[Document Secure Stream API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
