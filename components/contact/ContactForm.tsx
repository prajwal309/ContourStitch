'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  contactCategories,
  contactRecipients,
  isContactCategory,
  isContactRecipient,
  type ContactCategory,
  type ContactRecipient,
} from '@/lib/contact/types';
import styles from '@/app/contact/ContactPage.module.css';

const recipientNames: Record<ContactRecipient, string> = {
  all: 'All Co-founders',
  teknath: 'Teknath',
  prajwal: 'Prajwal',
  sundar: 'Sundar',
};

const sentMessage =
  'Your message has been sent successfully. Thank you for reaching out!';

type Props = {
  initialEmail: string;
  registeredEmail: boolean;
};

type IdempotencyEntry = { fingerprint: string; key: string };

export function ContactForm({ initialEmail, registeredEmail }: Props) {
  const [recipient, setRecipient] = useState<ContactRecipient>('all');
  const [email, setEmail] = useState(initialEmail);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<ContactCategory>('General Inquiry');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const idempotencyEntry = useRef<IdempotencyEntry | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError('');
    setSent(false);
    const submission = {
      recipient,
      from: email,
      subject,
      category,
      message,
      website,
    };
    const fingerprint = JSON.stringify(submission);
    if (idempotencyEntry.current?.fingerprint !== fingerprint) {
      idempotencyEntry.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }
    const requestKey = idempotencyEntry.current.key;

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey,
        },
        body: fingerprint,
      });
      const result: unknown = await response.json().catch(() => null);
      const sentSuccessfully =
        typeof result === 'object' &&
        result !== null &&
        'sent' in result &&
        result.sent === true;

      if (!response.ok || !sentSuccessfully) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'We couldn’t send your message. Your draft is still here; please try again.';
        setError(message);
        return;
      }

      setRecipient('all');
      setEmail(initialEmail);
      setSubject('');
      setCategory('General Inquiry');
      setMessage('');
      setWebsite('');
      idempotencyEntry.current = null;
      setSent(true);
    } catch {
      setError(
        'We couldn’t reach the email service. Your draft is still here; please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.composer} onSubmit={submit} aria-busy={pending}>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="contact-recipient">To</label>
          <select
            className={styles.control}
            id="contact-recipient"
            name="recipient"
            value={recipient}
            onChange={(event) => {
              const value = event.target.value;
              if (isContactRecipient(value)) setRecipient(value);
            }}
            required
          >
            {contactRecipients.map((option) => (
              <option key={option} value={option}>
                {recipientNames[option]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-from">From</label>
          <input
            className={styles.control}
            id="contact-from"
            name="from"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={registeredEmail}
            required
          />
          {registeredEmail && (
            <p className={styles.hint}>Using the email on your account.</p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-subject">Subject</label>
          <input
            className={styles.control}
            id="contact-subject"
            name="subject"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-category">Category</label>
          <select
            className={styles.control}
            id="contact-category"
            name="category"
            value={category}
            onChange={(event) => {
              const value = event.target.value;
              if (isContactCategory(value)) setCategory(value);
            }}
            required
          >
            {contactCategories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.wide}`}>
          <label htmlFor="contact-message">Message</label>
          <textarea
            className={`${styles.control} ${styles.message}`}
            id="contact-message"
            name="message"
            minLength={10}
            maxLength={5000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
        </div>

        <div className={styles.trap} aria-hidden="true">
          <label htmlFor="contact-website">Leave this field empty</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className={`${styles.feedback} ${styles.error}`} role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className={`${styles.feedback} ${styles.success}`} role="status">
          {sentMessage}
        </p>
      )}

      <div className={styles.actions}>
        <button
          className={`button ${styles.sendButton}`}
          type="submit"
          disabled={pending}
        >
          {pending ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send Message'
          )}
        </button>
      </div>
    </form>
  );
}
