import type { NextRequest } from 'next/server';
import { accountSignInEnabled, authentication } from '@/lib/auth/auth';

export const runtime = 'nodejs';

function unavailable() {
  return new Response('Sign-in is currently unavailable.', {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET = (request: NextRequest) => {
  if (authentication) return authentication.handlers.GET(request);
  if (
    accountSignInEnabled &&
    request.nextUrl.pathname === '/api/auth/providers'
  )
    return Response.json({}, { headers: { 'Cache-Control': 'no-store' } });
  return unavailable();
};
export const POST = (request: NextRequest) =>
  authentication?.handlers.POST(request) ?? unavailable();
