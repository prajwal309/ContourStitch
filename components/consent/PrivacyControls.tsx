'use client';

import { useActionState } from 'react';
import { deleteAccountMeasurements } from '@/lib/accounts/actions';
import { updateConsentPreference } from '@/lib/consent/actions';
import { agreements } from '@/lib/consent/agreements';
import { deleteProfile } from '@/lib/storage/profile';
import { useSession } from '@/components/SessionProvider';
import { AgreementLink } from './AgreementFields';

type Choice = 'revoke-camera' | 'revoke-improvement' | 'allow-improvement';

const choiceLabels = {
  'revoke-camera': 'Withdraw camera consent',
  'revoke-improvement': 'Withdraw optional consent',
  'allow-improvement': 'Save optional consent',
};

export function ConsentPreference({
  userId,
  choice,
}: {
  userId: string;
  choice: Choice;
}) {
  const [state, action, pending] = useActionState(
    updateConsentPreference.bind(null, userId),
    {},
  );
  return (
    <form className="agreement-flow" action={action}>
      <input type="hidden" name="choice" value={choice} />
      {choice === 'allow-improvement' && (
        <>
          <input
            type="hidden"
            name="version-IMPROVEMENT"
            value={agreements.IMPROVEMENT.version}
          />
          <div className="consent consent-with-agreement">
            <input
              id="privacy-improvement-consent"
              type="checkbox"
              name="IMPROVEMENT"
              required
            />
            <div>
              <label htmlFor="privacy-improvement-consent">
                I allow my measurement data to be used to improve ContourStitch.
              </label>{' '}
              (<AgreementLink type="IMPROVEMENT" />)
            </div>
          </div>
        </>
      )}
      <button className="secondary-button" disabled={pending}>
        {pending ? 'Saving…' : choiceLabels[choice]}
      </button>
      {state.saved && <p role="status">Your preference was saved.</p>}
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function DeleteMeasurementsForm({ userId }: { userId: string }) {
  const { setReport } = useSession();
  const [state, action, pending] = useActionState(
    async (previous: { error?: string; saved?: boolean }, form: FormData) => {
      const result = await deleteAccountMeasurements(userId, previous, form);
      if (result.saved) {
        try {
          deleteProfile();
          setReport(null);
        } catch {
          setReport(null);
          return {
            error:
              'Account measurements were deleted. This browser blocked clearing the local copy. Clear site data to remove it.',
          };
        }
      }
      return result;
    },
    {},
  );
  return (
    <details className="studio-section delete-confirm">
      <summary>Delete my measurement data</summary>
      <p>
        Delete your saved profiles, measurement history, family measurement
        shares, and saved fit selections. This also clears saved measurements
        from this browser. Your account stays open.
      </p>
      <form className="studio-form" action={action}>
        <label>
          Type DELETE to confirm measurement deletion
          <input name="confirmation" autoComplete="off" required />
        </label>
        <button className="secondary-button" disabled={pending}>
          {pending
            ? 'Deleting measurements…'
            : 'Permanently delete measurements'}
        </button>
        {state.saved && (
          <p role="status">
            Measurements deleted from your account and this browser.
          </p>
        )}
        {state.error && (
          <p role="alert" className="error">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
