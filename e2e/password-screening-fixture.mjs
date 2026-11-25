// Only the breach corpus response is simulated. The form, screening policy,
// rate limits, credential hashing, recovery, sessions and database writes are real.
import { createHash } from 'node:crypto';

const breached = createHash('sha1')
  .update('correcthorsebatterystaple')
  .digest('hex')
  .toUpperCase();
const upstream = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (
    url.origin === 'https://api.pwnedpasswords.com' &&
    url.pathname.startsWith('/range/')
  ) {
    const prefix = url.pathname.split('/').at(-1);
    const line =
      prefix === breached.slice(0, 5)
        ? `${breached.slice(5)}:37`
        : `${'0'.repeat(35)}:0`;
    return Promise.resolve(new Response(line));
  }
  return upstream(input, init);
};
