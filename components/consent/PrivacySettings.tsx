import Link from 'next/link';
import { DeleteAccountForm } from '@/components/accounts/DeleteAccountForm';
import { profileDate } from '@/lib/accounts/dates';
import { agreementReviewPath } from '@/lib/auth/return-path';
import {
  agreements,
  type Agreement,
  type ConsentState,
} from '@/lib/consent/agreements';
import { documents } from '@/lib/consent/documents';
import { reviewableAgreements } from '@/lib/consent/store';
import { AgreementLink } from './AgreementFields';
import { ConsentPreference, DeleteMeasurementsForm } from './PrivacyControls';

export function PrivacySettings({
  userId,
  state,
  acceptedVersions,
}: {
  userId: string;
  state: ConsentState;
  acceptedVersions: {
    type: Agreement;
    agreementVersion: string;
    acceptedAt: Date;
  }[];
}) {
  const archived = acceptedVersions.filter(
    ({ type, agreementVersion }) =>
      agreementVersion !== agreements[type].version,
  );
  return (
    <section
      className="studio-panel privacy-settings"
      id="privacy-consent"
      aria-labelledby="privacy-consent-title"
    >
      <h2 id="privacy-consent-title">Privacy &amp; Consent</h2>
      <p>Your body. Your data. Your choice.</p>
      <dl className="consent-status">
        {reviewableAgreements(state).map(({ type, event, active }) => (
          <div key={type}>
            <dt>
              <AgreementLink type={type} />
            </dt>
            <dd>
              {active && event?.acceptedAt
                ? `${type === 'PRIVACY' || type === 'ACCURACY' ? 'Acknowledged' : 'Accepted'} ${profileDate(event.acceptedAt)}`
                : event?.status === 'REVOKED' && event.revokedAt
                  ? `Withdrawn ${profileDate(event.revokedAt)}`
                  : event?.status === 'ACCEPTED'
                    ? 'New version available'
                    : type === 'IMPROVEMENT'
                      ? 'Off'
                      : 'Awaiting your review'}
              {event?.acceptedAt &&
                event.agreementVersion === agreements[type].version && (
                  <span className="consent-version">
                    Version {event.agreementVersion}
                  </span>
                )}
              {type === 'CAMERA' && event?.status === 'ACCEPTED' && (
                <ConsentPreference
                  key={`camera-${event.status}`}
                  userId={userId}
                  choice="revoke-camera"
                />
              )}
              {type === 'IMPROVEMENT' && (
                <ConsentPreference
                  key={`improvement-${event?.status ?? 'new'}-${active}`}
                  userId={userId}
                  choice={
                    event?.status === 'ACCEPTED'
                      ? 'revoke-improvement'
                      : 'allow-improvement'
                  }
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
      {archived.length > 0 && (
        <details className="studio-section">
          <summary>Previously accepted versions</summary>
          <ul className="agreement-history">
            {archived.map(({ type, agreementVersion, acceptedAt }) => {
              const label = `${agreements[type].title} · Version ${agreementVersion}`;
              return (
                <li key={`${type}-${agreementVersion}`}>
                  {Object.hasOwn(documents[type], agreementVersion) ? (
                    <AgreementLink
                      type={type}
                      version={agreementVersion}
                      label={label}
                    />
                  ) : (
                    label
                  )}
                  <span> · {profileDate(acceptedAt)}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <Link className="text-button" href={agreementReviewPath('/account')}>
        Review account agreements
      </Link>
      <DeleteMeasurementsForm userId={userId} />
      <DeleteAccountForm userId={userId} />
    </section>
  );
}
