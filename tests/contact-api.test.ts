// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '@/lib/auth/auth';
import { allowContactAttempt } from '@/lib/contact/rate-limit';
import { POST } from '@/app/api/contact/route';

vi.mock('@/lib/auth/auth', () => ({ currentUser: vi.fn() }));
vi.mock('@/lib/contact/rate-limit', () => ({
  allowContactAttempt: vi.fn(),
}));

const fetchMock =
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const requestId = '123e4567-e89b-42d3-a456-426614174000';

function makeRequest(
  body: unknown,
  options: { origin?: string; idempotencyKey?: string } = {},
) {
  return new Request('https://contourstitch.test/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: options.origin ?? 'https://contourstitch.test',
      'Idempotency-Key': options.idempotencyKey ?? requestId,
    },
    body: JSON.stringify(body),
  });
}

function validMessage(overrides: Record<string, unknown> = {}) {
  return {
    recipient: 'prajwal',
    from: 'guest@example.com',
    subject: 'Fit profile feedback',
    category: 'Feedback',
    message: 'I have a suggestion about the fit profile.',
    website: '',
    ...overrides,
  };
}

function sentEmail() {
  const call = fetchMock.mock.calls[0];
  expect(call?.[0]).toBe('https://api.resend.com/emails');
  return {
    options: call?.[1],
    body: JSON.parse(String(call?.[1]?.body)) as {
      from: string;
      to: string[];
      reply_to: string;
      subject: string;
      text: string;
    },
  };
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test_key');
  vi.stubEnv('CONTACT_FROM_EMAIL', 'ContourStitch <contact@example.com>');
  vi.mocked(currentUser).mockClear();
  vi.mocked(allowContactAttempt).mockClear();
  vi.mocked(currentUser).mockResolvedValue(null);
  vi.mocked(allowContactAttempt).mockResolvedValue(true);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ id: 'email-id' }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('contact email endpoint', () => {
  it.each([
    ['teknath', 'tandooriwingslouisville@gmail.com'],
    ['prajwal', 'pniraula@mit.edu'],
    ['sundar', 'nirsun77@gmail.com'],
  ] as const)(
    'sends to %s and sets the guest as Reply-To',
    async (recipient, address) => {
      const response = await POST(makeRequest(validMessage({ recipient })));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: true });
      const { body, options } = sentEmail();
      expect(body.to).toEqual([address]);
      expect(body.reply_to).toBe('guest@example.com');
      expect(body.subject).toBe('[Feedback] Fit profile feedback');
      expect(options?.headers).toMatchObject({
        Authorization: 'Bearer re_test_key',
        'Idempotency-Key': requestId,
      });
    },
  );

  it('sends to all co-founders and trusts the registered account email', async () => {
    vi.mocked(currentUser).mockResolvedValue({
      id: 'registered-user',
      name: 'Registered User',
      email: 'account@example.com',
      image: null,
    });

    const response = await POST(
      makeRequest(
        validMessage({ recipient: 'all', from: 'spoofed@example.com' }),
      ),
    );

    expect(response.status).toBe(200);
    const { body } = sentEmail();
    expect(body.to).toEqual([
      'tandooriwingslouisville@gmail.com',
      'pniraula@mit.edu',
      'nirsun77@gmail.com',
    ]);
    expect(body.reply_to).toBe('account@example.com');
    expect(allowContactAttempt).toHaveBeenCalledWith('account@example.com');
  });

  it('rejects invalid input and rate-limited requests without sending', async () => {
    const invalid = await POST(
      makeRequest(validMessage({ category: 'Unlisted category' })),
    );
    expect(invalid.status).toBe(400);

    vi.mocked(allowContactAttempt).mockResolvedValue(false);
    const limited = await POST(makeRequest(validMessage()));
    expect(limited.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects spam-trap submissions without sending', async () => {
    const response = await POST(
      makeRequest(validMessage({ website: 'https://spam.example' })),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(allowContactAttempt).not.toHaveBeenCalled();
  });

  it('rejects cross-origin submissions', async () => {
    const response = await POST(
      makeRequest(validMessage(), { origin: 'https://other.example' }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not report success when email delivery is unconfigured or fails', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const unconfigured = await POST(makeRequest(validMessage()));
    expect(unconfigured.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 422 }));
    const failed = await POST(makeRequest(validMessage()));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toHaveProperty('error');
  });
});
