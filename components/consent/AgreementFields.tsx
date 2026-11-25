import { useId } from 'react';
import {
  agreementPath,
  agreements,
  accountAgreements,
  type Agreement,
} from '@/lib/consent/agreements';

export function AgreementLink({
  type,
  version,
  label,
}: {
  type: Agreement;
  version?: string;
  label?: string;
}) {
  return (
    <a
      href={agreementPath(type, version)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label ?? agreements[type].title}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function AgreementFields({ types }: { types: readonly Agreement[] }) {
  const account = types.includes('TERMS') || types.includes('PRIVACY');
  return (
    <>
      {types.length > 0 && (
        <fieldset className="agreement-options">
          <legend>Required agreements</legend>
          {account && (
            <p className="muted">
              Documents open in a new tab so you can keep your place.
            </p>
          )}
          {types
            .filter((type) => type !== 'BODY_MEASUREMENT')
            .map((type) => (
              <input
                key={type}
                type="hidden"
                name={`version-${type}`}
                value={agreements[type].version}
              />
            ))}
          {types.includes('BODY_MEASUREMENT') && <BodyMeasurementAgreement />}
          {account && (
            <div className="consent consent-with-agreement">
              <input
                id="account-agreement-consent"
                type="checkbox"
                name="ACCOUNT"
                required
              />
              <div>
                <label htmlFor="account-agreement-consent">
                  {types.includes('TERMS') && types.includes('PRIVACY')
                    ? 'I agree to the Terms of Service and acknowledge the Privacy Policy.'
                    : types.includes('TERMS')
                      ? 'I agree to the Terms of Service.'
                      : 'I acknowledge the Privacy Policy.'}
                </label>{' '}
                ({types.includes('TERMS') && <AgreementLink type="TERMS" />}
                {types.includes('TERMS') && types.includes('PRIVACY') && ' · '}
                {types.includes('PRIVACY') && <AgreementLink type="PRIVACY" />})
              </div>
            </div>
          )}
        </fieldset>
      )}
    </>
  );
}

export const bodyMeasurementAgreementLabel = `I agree to the ${agreements.BODY_MEASUREMENT.title}.`;

export function BodyMeasurementAgreement() {
  const id = useId();
  return (
    <div className="consent consent-with-agreement">
      <input
        type="hidden"
        name="version-BODY_MEASUREMENT"
        value={agreements.BODY_MEASUREMENT.version}
      />
      <input
        id={id}
        type="checkbox"
        name="BODY_MEASUREMENT"
        aria-label={bodyMeasurementAgreementLabel}
        required
      />
      <div>
        <label htmlFor={id}>I agree to the </label>
        <strong>
          <AgreementLink type="BODY_MEASUREMENT" />
        </strong>
        <label htmlFor={id}>.</label>
      </div>
    </div>
  );
}

export function RegistrationAgreementFields() {
  return (
    <>
      <fieldset className="agreement-options">
        <legend>Required agreements</legend>
        {accountAgreements.map((type) => (
          <input
            key={type}
            type="hidden"
            name={`version-${type}`}
            value={agreements[type].version}
          />
        ))}
        <div className="consent consent-with-agreement">
          <input
            id="registration-consent"
            type="checkbox"
            name="ACCOUNT"
            aria-label="I agree to the Terms of Service and acknowledge the Privacy Policy."
            required
          />
          <div>
            <label htmlFor="registration-consent">I agree to the </label>
            <AgreementLink type="TERMS" />
            <label htmlFor="registration-consent"> and acknowledge the </label>
            <AgreementLink type="PRIVACY" />
            <label htmlFor="registration-consent">.</label>
          </div>
        </div>
        <BodyMeasurementAgreement />
      </fieldset>
      <fieldset className="agreement-options">
        <legend>Optional consent</legend>
        <input
          type="hidden"
          name="version-IMPROVEMENT"
          value={agreements.IMPROVEMENT.version}
        />
        <div className="consent consent-with-agreement">
          <input
            id="optional-improvement-consent"
            type="checkbox"
            name="IMPROVEMENT"
          />
          <div>
            <label htmlFor="optional-improvement-consent">
              I allow my measurement data to be used to improve ContourStitch.
            </label>{' '}
            (<AgreementLink type="IMPROVEMENT" />)
          </div>
        </div>
        <p className="muted">Change this choice anytime in My Account.</p>
      </fieldset>
    </>
  );
}
