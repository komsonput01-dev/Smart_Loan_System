/**
 * Clerk Webhook Handler — User Sync to Neon
 *
 * Events handled:
 *   user.created → สร้าง record ใน users table
 *   user.updated → อัปเดต fullName, email, avatarUrl
 *   user.deleted → ทำ soft-delete (isActive = false)
 *
 * Security: verify Svix signature ทุก request
 * ป้องกัน replay attacks และ forged webhooks
 *
 * Setup ใน Clerk Dashboard:
 *   Webhooks → Add Endpoint → URL: https://yourdomain.com/api/webhooks/clerk
 *   Events: user.created, user.updated, user.deleted
 */

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Clerk webhook event types
interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkWebhookUserData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  image_url: string | null;
  public_metadata: {
    role?: 'admin' | 'debtor';
    lineUserId?: string;
    phone?: string;
  };
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: ClerkWebhookUserData;
}

export async function POST(req: Request) {
  // ── 1. Verify Svix Signature ──────────────────────────────────────────────
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'CLERK_WEBHOOK_SECRET not configured' },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  const body = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('[Clerk Webhook] Signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  // ── 2. Process Event ──────────────────────────────────────────────────────
  const { type, data } = event;

  try {
    switch (type) {
      case 'user.created': {
        await handleUserCreated(data);
        break;
      }
      case 'user.updated': {
        await handleUserUpdated(data);
        break;
      }
      case 'user.deleted': {
        await handleUserDeleted(data);
        break;
      }
      default: {
        console.log(`[Clerk Webhook] Unhandled event type: ${type}`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error(`[Clerk Webhook] Error processing ${type}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function getPrimaryEmail(data: ClerkWebhookUserData): string | null {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  return primary?.email_address ?? null;
}

function getFullName(data: ClerkWebhookUserData): string {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.join(' ') || 'ไม่ระบุชื่อ';
}

async function handleUserCreated(data: ClerkWebhookUserData) {
  const email = getPrimaryEmail(data);
  const fullName = getFullName(data);
  const role = data.public_metadata?.role ?? 'admin';

  console.log(`[Clerk Webhook] Creating user: ${data.id} (${email})`);

  await db.insert(users).values({
    clerkUserId: data.id,
    fullName,
    email,
    phone: data.public_metadata?.phone ?? null,
    lineUserId: data.public_metadata?.lineUserId ?? null,
    role,
    avatarUrl: data.image_url,
    isActive: true,
  });

  console.log(`[Clerk Webhook] ✅ User created: ${data.id}`);
}

async function handleUserUpdated(data: ClerkWebhookUserData) {
  const email = getPrimaryEmail(data);
  const fullName = getFullName(data);
  const role = data.public_metadata?.role ?? 'admin';

  console.log(`[Clerk Webhook] Updating user: ${data.id}`);

  // Upsert — สร้างใหม่ถ้ายังไม่มี (เช่น webhook missed)
  await db
    .insert(users)
    .values({
      clerkUserId: data.id,
      fullName,
      email,
      phone: data.public_metadata?.phone ?? null,
      lineUserId: data.public_metadata?.lineUserId ?? null,
      role,
      avatarUrl: data.image_url,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        fullName,
        email,
        phone: data.public_metadata?.phone ?? null,
        lineUserId: data.public_metadata?.lineUserId ?? null,
        role,
        avatarUrl: data.image_url,
        updatedAt: new Date(),
      },
    });

  console.log(`[Clerk Webhook] ✅ User updated: ${data.id}`);
}

async function handleUserDeleted(data: ClerkWebhookUserData) {
  console.log(`[Clerk Webhook] Soft-deleting user: ${data.id}`);

  // Soft delete — ไม่ลบออกจาก DB เพื่อรักษาประวัติสัญญา
  await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.clerkUserId, data.id));

  console.log(`[Clerk Webhook] ✅ User soft-deleted: ${data.id}`);
}
