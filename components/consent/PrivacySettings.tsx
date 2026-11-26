import Link from 'next/link';
import { DeleteAccountForm } from '@/components/accounts/DeleteAccountForm';
import { Download } from 'lucide-react';
import { profileDate } from '@/lib/accounts/dates';
import { agreementReviewPath } from '@/lib/auth/return-path';
import {
  accountAgreements,
  agreements,
  isArchivedAgreement,
  missingAgreements,
  type Agreement,
  type ConsentState,
} from '@/lib/consent/agreements';
import { documents } from '@/lib/consent/documents';
import { reviewableAgreements } from '@/lib/consent/store';
import { AgreementLink } from './AgreementLink';
import { ConsentPreference, DeleteMeasurementsForm } from './PrivacyControls';

export function PrivacySettings({
  userId,
  hasPassword,
  state,
  acceptedVersions,
}: {
  userId: string;
  hasPassword: boolean;
  state: ConsentState;
  acceptedVersions: {
    type: Agreement;
    agreementVersion: string;
    acceptedAt: Date;
  }[];
}) {
  const archived = acceptedVersions.filter(
    ({ type, agreementVersion }) =>
      isArchivedAgreement(type) ||
      agreementVersion !== agreements[type].version,
  );
  return (
    <section
      className="account-panel privacy-settings"
      id="privacy-data"
      aria-labelledby="privacy-consent-title"
    >
      <div className="account-panel-heading">
        <div>
          <p className="eyebrow">Data controls</p>
          <h2 id="privacy-consent-title">Privacy &amp; Consent</h2>
          <p>
            Camera measurement consent is separate from account registration
            agreements and optional data-improvement sharing.
          </p>
        </div>
        <Download aria-hidden="true" />
      </div>
      <Link
        className="secondary-button account-export-link"
        href="/account/export"
      >
        Download my personal information
      </Link>
      <dl className="consent-status">
        {reviewableAgreements(state).map(({ type, event, active }) => (
          <div key={type}>
            <dt>
              {type === 'BODY_MEASUREMENT' && !active ? (
                'Measurement consent'
              ) : (
                <AgreementLink type={type} />
              )}
            </dt>
            <dd>
              {active && event?.acceptedAt
                ? `${type === 'PRIVACY' ? 'Acknowledged' : 'Accepted'} ${profileDate(event.acceptedAt)}`
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
              {type === 'BODY_MEASUREMENT' && (
                <ConsentPreference
                  key={`body-measurement-${active}`}
                  userId={userId}
                  choice={
                    active
                      ? 'revoke-body-measurement'
                      : 'allow-body-measurement'
                  }
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
                    <AgreementLink type={type} version={agreementVersion}>
                      {label}
                    </AgreementLink>
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
      {missingAgreements(state, accountAgreements).length > 0 && (
        <Link className="text-button" href={agreementReviewPath('/account')}>
          Review account agreements
        </Link>
      )}
      <DeleteMeasurementsForm userId={userId} hasPassword={hasPassword} />
      <DeleteAccountForm userId={userId} hasPassword={hasPassword} />
    </section>
  );
}
