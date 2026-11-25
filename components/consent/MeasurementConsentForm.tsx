'use client';

import { useActionState, useCallback } from 'react';
import {
  authorizeMeasurement,
  type AgreementActionState,
} from '@/lib/consent/actions';
import type { Agreement } from '@/lib/consent/agreements';
import { AgreementFields } from './AgreementFields';

export type MeasurementAccess = {
  userId: string | null;
  required: Agreement[];
};

export function MeasurementConsentForm({
  access,
  onContinue,
  disabled,
  label,
}: {
  access: MeasurementAccess;
  onContinue: () => void;
  disabled?: boolean;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    async (previous: AgreementActionState, form: FormData) => {
      const result = await authorizeMeasurement(access.userId, previous, form);
      if (result.saved) onContinue();
      return result;
    },
    {},
  );

  return (
    <form action={action} className="agreement-flow">
      <AgreementFields types={access.required} />
      <button className="button" disabled={disabled || pending}>
        {pending ? 'Checking your choices…' : label}
      </button>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function useCameraAccessCheck(userId: string | null) {
  return useCallback(async () => {
    if (!userId) return;
    const result = await authorizeMeasurement(userId, {}, new FormData());
    if (!result.saved)
      throw new DOMException(
        result.error ?? 'Review the current measurement agreements.',
        'MeasurementConsentError',
      );
  }, [userId]);
}
