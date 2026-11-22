import type { NextRequest } from 'next/server';
import { authentication } from '@/lib/auth/auth';

export const runtime = 'nodejs';

function unavailable() {
  return new Response('Sign-in is currently unavailable.', {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET = (request: NextRequest) =>
  authentication?.handlers.GET(request) ?? unavailable();
export const POST = (request: NextRequest) =>
  authentication?.handlers.POST(request) ?? unavailable();
