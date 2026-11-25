import {
  agreementPath,
  agreements,
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

export function AgreementFields({
  types,
  showOptional = false,
}: {
  types: readonly Agreement[];
  showOptional?: boolean;
}) {
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
            <div>
              <label className="consent">
                <input type="checkbox" name="CAMERA" required />I consent to
                camera-based body measurement processing.
              </label>
              <p>
                <AgreementLink type="CAMERA" />
              </p>
            </div>
          )}
          {types.includes('ACCURACY') && (
            <div>
              <label className="consent">
                <input type="checkbox" name="ACCURACY" required />I understand
                that measurements are estimates and may contain errors.
              </label>
              <p>
                <AgreementLink type="ACCURACY" />
              </p>
            </div>
          )}
          {account && (
            <div>
              <label className="consent">
                <input type="checkbox" name="ACCOUNT" required />
                {types.includes('TERMS') && types.includes('PRIVACY')
                  ? 'I agree to the Terms of Service and acknowledge the Privacy Policy.'
                  : types.includes('TERMS')
                    ? 'I agree to the Terms of Service.'
                    : 'I acknowledge the Privacy Policy.'}
              </label>
              <p>
                {types.includes('TERMS') && <AgreementLink type="TERMS" />}
                {types.includes('TERMS') && types.includes('PRIVACY') && ' · '}
                {types.includes('PRIVACY') && <AgreementLink type="PRIVACY" />}
              </p>
            </div>
          )}
        </fieldset>
      )}
      {showOptional && (
        <fieldset className="agreement-options">
          <legend>Optional consent</legend>
          <input
            type="hidden"
            name="version-IMPROVEMENT"
            value={agreements.IMPROVEMENT.version}
          />
          <label className="consent">
            <input type="checkbox" name="IMPROVEMENT" />I allow my measurement
            data to be used to improve ContourStitch.
          </label>
          <p className="muted">
            You can use ContourStitch without sharing and withdraw permission in
            My Account. <AgreementLink type="IMPROVEMENT" />
          </p>
        </fieldset>
      )}
    </>
  );
}
