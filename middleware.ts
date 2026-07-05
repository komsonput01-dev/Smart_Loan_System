import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Clerk Authentication Proxy (formerly middleware)
 *
 * Protected routes: /dashboard/** และ /api/** (ยกเว้น webhooks)
 * Public routes: /, /sign-in, /sign-up, /api/webhooks/**
 *
 * Role-based access:
 * - /dashboard/** → ต้องมี session (ทั้ง admin และ debtor)
 * - Admin-only routes จะ check role ใน server components/actions
 */

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',   // Clerk webhook — ไม่ต้อง auth (verify ด้วย svix signature แทน)
  '/api/cron/(.*)',       // Cron jobs — protect ด้วย CRON_SECRET header แทน
  '/api/seed(.*)',        // Dev-only seed endpoint — protected by NODE_ENV check inside handler
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

