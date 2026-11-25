import 'server-only';

import { createHash } from 'node:crypto';

export async function passwordScreening(password: string) {
  const digest = createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    // Pwned Passwords only receives the prefix. SHA-1 is never used for stored passwords.
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { 'Add-Padding': 'true' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(3500),
      },
    );
    if (!response.ok) return 'unavailable';

    const lines = (await response.text()).trim().split(/\r?\n/);
    let found = false;
    for (const line of lines) {
      const entry = /^([A-F0-9]{35}):(\d+)$/.exec(line);
      if (!entry) return 'unavailable';
      if (entry[1] === suffix && Number(entry[2]) > 0) found = true;
    }
    return found ? 'compromised' : 'clear';
  } catch {
    return 'unavailable';
  }
}

export async function passwordScreeningError(password: string) {
  const status = await passwordScreening(password);
  if (status === 'compromised')
    return 'This password has appeared in a data breach. Choose a different one.';
  if (status === 'unavailable')
    return 'Password safety check is unavailable. Try again before setting a new password.';
}
