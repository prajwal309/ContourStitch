import {
  agreementPath,
  agreements,
  registrationAgreements,
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
          <p className="muted">
            Documents open in a new tab so you can keep your place.
          </p>
          {types.map((type) => (
            <input
              key={type}
              type="hidden"
              name={`version-${type}`}
              value={agreements[type].version}
            />
          ))}
          {types.includes('CAMERA') && (
            <div className="consent consent-with-agreement">
              <input
                id="camera-body-measurement-consent"
                type="checkbox"
                name="CAMERA"
                required
              />
              <div>
                <label htmlFor="camera-body-measurement-consent">
                  I consent to camera-based body measurement processing.
                </label>{' '}
                (
                <AgreementLink type="CAMERA" />)
              </div>
            </div>
          )}
          {types.includes('ACCURACY') && (
            <div className="consent consent-with-agreement">
              <input
                id="measurement-accuracy-consent"
                type="checkbox"
                name="ACCURACY"
                required
              />
              <div>
                <label htmlFor="measurement-accuracy-consent">
                  I understand that measurements are estimates and may contain
                  errors.
                </label>{' '}
                (
                <AgreementLink type="ACCURACY" />)
              </div>
            </div>
          )}
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

const registrationLabel =
  'I agree to the Terms of Service, acknowledge the Privacy Policy, and consent to camera-based body measurement processing. I understand that measurements are estimates.';

export function RegistrationAgreementFields() {
  return (
    <>
      <fieldset className="agreement-options">
        <legend>Required agreement</legend>
        {registrationAgreements.map((type) => (
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
            name="REGISTRATION"
            aria-label={registrationLabel}
            required
          />
          <div>
            <label htmlFor="registration-consent">I agree to the </label>
            <AgreementLink type="TERMS" />
            <label htmlFor="registration-consent">, acknowledge the </label>
            <AgreementLink type="PRIVACY" />
            <label htmlFor="registration-consent">
              , and consent to camera-based body measurement processing. I
              understand that measurements are estimates.
            </label>
          </div>
        </div>
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
