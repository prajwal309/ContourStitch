import 'server-only';

import type { ContactRecipient } from './types';

const recipients: Record<ContactRecipient, readonly string[]> = {
  all: [
    'tandooriwingslouisville@gmail.com',
    'pniraula@mit.edu',
    'nirsun77@gmail.com',
  ],
  teknath: ['tandooriwingslouisville@gmail.com'],
  prajwal: ['pniraula@mit.edu'],
  sundar: ['nirsun77@gmail.com'],
};

export function resolveContactRecipients(recipient: ContactRecipient) {
  return recipients[recipient];
}
