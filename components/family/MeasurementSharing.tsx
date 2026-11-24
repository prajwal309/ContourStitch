'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateFamilyShare } from '@/lib/family/sharing';

export function MeasurementSharing({
  groupId,
  userId,
  organizerId,
  organizerName,
  choices,
  active,
}: {
  groupId: string;
  userId: string;
  organizerId: string;
  organizerName: string;
  choices: { id: string; label: string }[];
  active: string | null;
}) {
  const [state, submit, pending] = useActionState(
    updateFamilyShare.bind(null, groupId, userId, organizerId),
    {},
  );

  return (
    <section className="studio-panel studio-section">
      <h2>Share measurements</h2>
      <p>
        Choose a saved set to share with {organizerName}. The organizer can read
        that version only. Future edits stay private unless you share them.
      </p>
      {active && <p>Currently shared: {active}</p>}
      <form action={submit} className="studio-form">
        {choices.length ? (
          <>
            <label>
              Saved measurement set
              <select name="revision" defaultValue="">
                <option value="" disabled>
                  Choose a saved set
                </option>
                {choices.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button"
              type="submit"
              name="operation"
              value="share"
              disabled={pending}
            >
              Share with organizer
            </button>
          </>
        ) : (
          <Link href="/my-measurements" className="text-button">
            Open My Fit Profile
          </Link>
        )}
        {active && (
          <button
            className="text-button"
            type="submit"
            name="operation"
            value="revoke"
            disabled={pending}
          >
            Revoke access
          </button>
        )}
      </form>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.message && <p role="status">{state.message}</p>}
    </section>
  );
}
