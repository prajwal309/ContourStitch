import { useId, type ReactNode } from 'react';
import {
  agreements,
  accountAgreements,
  type Agreement,
} from '@/lib/consent/agreements';
import { AgreementLink } from './AgreementLink';

function AgreementCheckbox({
  name,
  types,
  label,
  children,
  required = true,
}: {
  name: 'ACCOUNT' | 'BODY_MEASUREMENT' | 'IMPROVEMENT';
  types: readonly Agreement[];
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="consent consent-with-agreement">
      {types.map((type) => (
        <input
          key={type}
          type="hidden"
          name={`version-${type}`}
          value={agreements[type].version}
        />
      ))}
      <input
        id={id}
        type="checkbox"
        name={name}
        aria-label={label}
        required={required}
      />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}

export function AgreementFields({ types }: { types: readonly Agreement[] }) {
  if (types.length === 0) return null;
  const account = accountAgreements.filter((type) => types.includes(type));

  return (
    <fieldset className="agreement-options">
      <legend>Required agreements</legend>
      {account.length > 0 && (
        <AgreementCheckbox
          name="ACCOUNT"
          types={account}
          label={`I agree to the ${agreements.TERMS.title} and acknowledge the ${agreements.PRIVACY.title}.`}
        >
          I agree to the <AgreementLink type="TERMS" /> and acknowledge the{' '}
          <AgreementLink type="PRIVACY" />.
        </AgreementCheckbox>
      )}
      {types.includes('BODY_MEASUREMENT') && <BodyMeasurementAgreement />}
    </fieldset>
  );
}

export function BodyMeasurementAgreement() {
  return (
    <AgreementCheckbox
      name="BODY_MEASUREMENT"
      types={['BODY_MEASUREMENT']}
      label={`I agree to the ${agreements.BODY_MEASUREMENT.title}.`}
    >
      I agree to the{' '}
      <strong>
        <AgreementLink type="BODY_MEASUREMENT" />
      </strong>
      .
    </AgreementCheckbox>
  );
}

export function ImprovementAgreement({ required }: { required: boolean }) {
  const label =
    'I allow my measurement data to be used to improve ContourStitch.';
  return (
    <AgreementCheckbox
      name="IMPROVEMENT"
      types={['IMPROVEMENT']}
      label={label}
      required={required}
    >
      {label} (<AgreementLink type="IMPROVEMENT" />)
    </AgreementCheckbox>
  );
}

export function RegistrationAgreementFields() {
  return (
    <>
      <AgreementFields types={accountAgreements} />
      <fieldset className="agreement-options">
        <legend>Optional consent</legend>
        <ImprovementAgreement required={false} />
        <p className="muted">Change this choice anytime in My Account.</p>
      </fieldset>
    </>
  );
}
