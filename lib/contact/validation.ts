import {
  isContactCategory,
  isContactRecipient,
  type ContactSubmission,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmail(value: string) {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value) &&
    !/[\r\n]/.test(value)
  );
}

export function parseContactSubmission(
  value: unknown,
): ContactSubmission | null {
  if (!isRecord(value)) return null;

  const recipient = value.recipient;
  const category = value.category;
  const email = typeof value.from === 'string' ? value.from.trim() : '';
  const subject =
    typeof value.subject === 'string'
      ? value.subject.trim().replace(/[\r\n\t ]+/g, ' ')
      : '';
  const message = typeof value.message === 'string' ? value.message.trim() : '';
  const website = typeof value.website === 'string' ? value.website.trim() : '';

  if (
    typeof recipient !== 'string' ||
    !isContactRecipient(recipient) ||
    typeof category !== 'string' ||
    !isContactCategory(category) ||
    !isEmail(email) ||
    subject.length < 1 ||
    subject.length > 120 ||
    message.length < 10 ||
    message.length > 5000 ||
    message.includes('\0') ||
    website.length > 500
  )
    return null;

  return {
    recipient,
    from: email,
    subject,
    category,
    message,
    website,
  };
}
