import { currentUser } from '@/lib/auth/auth';
import { resolveContactRecipients } from '@/lib/contact/config';
import { allowContactAttempt } from '@/lib/contact/rate-limit';
import { parseContactSubmission } from '@/lib/contact/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };
const maxBodyBytes = 12_000;
const idempotencyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: 'Please submit this form from ContourStitch.' }, 403);
  if (
    request.headers.get('content-type')?.split(';', 1)[0] !== 'application/json'
  )
    return json({ error: 'Please submit a valid message.' }, 415);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const sender = process.env.CONTACT_FROM_EMAIL?.trim();
  if (!apiKey || !sender || /[\r\n]/.test(sender))
    return json(
      {
        error: 'Email delivery is not configured yet. Please try again later.',
      },
      503,
    );

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  if (!idempotencyPattern.test(idempotencyKey))
    return json({ error: 'Please retry sending your message.' }, 400);

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > maxBodyBytes)
    return json({ error: 'Your message is too long.' }, 413);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > maxBodyBytes)
    return json({ error: 'Your message is too long.' }, 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Please submit a valid message.' }, 400);
  }
  const submission = parseContactSubmission(body);
  if (!submission)
    return json(
      {
        error:
          'Check your email, subject, category, and message, then try again.',
      },
      400,
    );
  if (submission.website)
    return json({ error: 'Unable to send this message.' }, 400);

  let user;
  try {
    user = await currentUser();
  } catch {
    return json(
      { error: 'We couldn’t verify your account. Please try again shortly.' },
      503,
    );
  }
  const from = user?.email?.trim() || submission.from;

  let allowed: boolean;
  try {
    allowed = await allowContactAttempt(from);
  } catch {
    console.error('Contact message rate limiting is unavailable.');
    return json(
      {
        error: 'Messages are temporarily unavailable. Please try again later.',
      },
      503,
    );
  }
  if (!allowed)
    return json(
      {
        error:
          'Too many messages were sent. Please wait a little and try again.',
      },
      429,
    );

  const recipients = resolveContactRecipients(submission.recipient);
  const email = {
    from: sender,
    to: recipients,
    reply_to: from,
    subject: `[${submission.category}] ${submission.subject}`,
    text: `Category: ${submission.category}\nFrom: ${from}\n\n${submission.message}`,
  };

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(email),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error('Contact email delivery request failed.');
    return json(
      {
        error:
          'We couldn’t send your message right now. Your draft is still here; please try again.',
      },
      502,
    );
  }

  if (!response.ok) {
    console.error(
      'Contact email provider rejected the message.',
      response.status,
    );
    return json(
      {
        error:
          'We couldn’t send your message right now. Your draft is still here; please try again.',
      },
      502,
    );
  }

  return json({ sent: true });
}
