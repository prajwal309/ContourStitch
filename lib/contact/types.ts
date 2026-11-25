export const contactRecipients = [
  'all',
  'teknath',
  'prajwal',
  'sundar',
] as const;

export const contactCategories = [
  'General Inquiry',
  'Feedback',
  'Bug Report',
  'Feature Request',
  'Business Inquiry',
  'Other',
] as const;

export type ContactRecipient = (typeof contactRecipients)[number];
export type ContactCategory = (typeof contactCategories)[number];

export function isContactRecipient(value: string): value is ContactRecipient {
  return contactRecipients.some((recipient) => recipient === value);
}

export function isContactCategory(value: string): value is ContactCategory {
  return contactCategories.some((category) => category === value);
}

export type ContactSubmission = {
  recipient: ContactRecipient;
  from: string;
  subject: string;
  category: ContactCategory;
  message: string;
  website: string;
};
