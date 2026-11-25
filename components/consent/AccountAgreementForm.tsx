'use client';

import { useActionState } from 'react';
import { AgreementFields } from './AgreementFields';
import { acceptAccountAgreements } from '@/lib/consent/actions';
import type { Agreement } from '@/lib/consent/agreements';

export function AccountAgreementForm({
  userId,
  next,
  required,
}: {
  userId: string;
  next: string;
  required: Agreement[];
}) {
  const [state, action, pending] = useActionState(
    acceptAccountAgreements.bind(null, userId, next),
    {},
  );
  return (
    <form className="studio-form" action={action}>
      <AgreementFields types={required} />
      <button className="button" disabled={pending}>
        {pending ? 'Saving…' : 'Accept and continue'}
      </button>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
