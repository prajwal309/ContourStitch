import type { Metadata } from 'next';
import { currentUser } from '@/lib/auth/auth';
import { ContactForm } from '@/components/contact/ContactForm';
import styles from './ContactPage.module.css';

export const metadata: Metadata = {
  title: 'Contact & Feedback | ContourStitch',
  description: 'Send a message to the ContourStitch co-founders.',
};

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const user = await currentUser();
  const registeredEmail = user?.email?.trim() ?? '';

  return (
    <main id="main" className={`flow ${styles.page}`}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>We’re listening</p>
        <h1>Contact &amp; feedback</h1>
        <p>
          Send a note to the ContourStitch co-founders. Your email address is
          used for a reply.
        </p>
      </header>
      <ContactForm
        initialEmail={registeredEmail}
        registeredEmail={Boolean(registeredEmail)}
      />
    </main>
  );
}
