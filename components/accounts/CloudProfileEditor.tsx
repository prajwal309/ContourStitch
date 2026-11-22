'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MeasurementResult } from '@/components/measurement/MeasurementResult';
import { useSession } from '@/components/SessionProvider';
import { mergeMeasurements } from '@/lib/measurement/corrections';
import { deleteCloudProfile, updateCloudProfile } from '@/lib/accounts/actions';
import { profileDate } from '@/lib/accounts/dates';
import type { LocalProfile } from '@/lib/storage/profile';

const errors = {
  session: 'Your session expired or changed.',
  invalid: 'Review the measurements and try again.',
  stale: 'This profile changed or was deleted. Reload it before trying again.',
  duplicate: 'Another profile already has these measurements.',
  unavailable: 'This change could not be saved. Please try again.',
};

export function CloudProfileEditor({
  profile,
  userId,
  id,
  version,
  updatedAt,
}: {
  profile: LocalProfile;
  userId: string;
  id: string;
  version: number;
  updatedAt: string;
}) {
  const [report, setReport] = useState(profile.report);
  const { report: scanDraft } = useSession();
  const [unit, setUnit] = useState(profile.unit);
  const [saved, setSaved] = useState({
    report: profile.report,
    unit: profile.unit,
    version,
    updatedAt,
  });
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<keyof typeof errors | null>(null);
  const router = useRouter();
  const changed = report !== saved.report || unit !== saved.unit;

  function submit(operation: 'save' | 'delete') {
    setError(null);
    setNotice('');
    startTransition(async () => {
      try {
        if (operation === 'delete') {
          const result = await deleteCloudProfile(userId, id, saved.version);
          if (result.ok) router.replace('/my-measurements');
          else setError(result.error);
        } else {
          const result = await updateCloudProfile(userId, id, saved.version, {
            version: 1,
            report,
            unit,
          });
          if (result.ok) {
            setSaved({
              report,
              unit,
              version: result.version,
              updatedAt: result.updatedAt,
            });
            setNotice('Changes saved to your account.');
          } else {
            setError(result.error);
          }
        }
      } catch {
        setError('unavailable');
      }
    });
  }

  return (
    <fieldset className="cloud-editor" disabled={pending}>
      <p className="muted">
        Last updated{' '}
        <time dateTime={saved.updatedAt}>
          {profileDate(new Date(saved.updatedAt))}
        </time>
      </p>
      {scanDraft?.source === 'live-video' && !!scanDraft.estimates.length && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setReport((current) => mergeMeasurements(current, scanDraft));
            setNotice(
              'Scan measurements added to this draft. Review and choose Save changes to update this profile.',
            );
          }}
        >
          Apply current scan to this profile
        </button>
      )}
      <MeasurementResult
        report={report}
        initialUnit={unit}
        onChange={setReport}
        onUnitChange={setUnit}
        cloudActions={
          <>
            <button
              className="button"
              type="button"
              disabled={
                !changed ||
                confirmDelete ||
                error === 'stale' ||
                error === 'session'
              }
              onClick={() => submit('save')}
            >
              Save changes
            </button>
            {confirmDelete ? (
              <div className="delete-confirm account-section">
                <p>Permanently delete this profile from your account?</p>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={error === 'stale' || error === 'session'}
                  onClick={() => submit('delete')}
                >
                  Yes, delete profile
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep profile
                </button>
              </div>
            ) : (
              <button
                className="text-button delete-button"
                type="button"
                onClick={() => setConfirmDelete(true)}
              >
                Delete profile
              </button>
            )}
            <p role="status" className="status-message">
              {pending ? 'Saving your change…' : notice}
            </p>
            {error && (
              <p role="alert" className="error">
                {errors[error]}
                {error === 'session' && (
                  <>
                    {' '}
                    <Link className="inline-link" href="/sign-in">
                      Sign in again
                    </Link>
                  </>
                )}
                {error === 'stale' && (
                  <>
                    {' '}
                    <button
                      className="text-button"
                      onClick={() => window.location.reload()}
                      type="button"
                    >
                      Reload profile
                    </button>
                  </>
                )}
              </p>
            )}
          </>
        }
      />
    </fieldset>
  );
}
