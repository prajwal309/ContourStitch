import { expect, it } from 'vitest';
import { registrationEvents } from '@/lib/consent/store';

it('does not record measurement consent during account registration', () => {
  const events = registrationEvents(false);

  expect(events.map(({ type }) => type)).toEqual([
    'TERMS',
    'PRIVACY',
    'IMPROVEMENT',
  ]);
  expect(
    events
      .filter(({ status }) => status === 'ACCEPTED')
      .map(({ type }) => type),
  ).toEqual(['TERMS', 'PRIVACY']);
});
