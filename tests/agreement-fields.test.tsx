import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  AgreementFields,
  RegistrationAgreementFields,
} from '@/components/consent/AgreementFields';

it('uses one required measurement checkbox at registration and an unchecked independent opt-in', () => {
  render(<RegistrationAgreementFields />);
  const required = within(
    screen.getByRole('group', { name: 'Required agreements' }),
  );
  const checkbox = required.getByRole('checkbox', {
    name: 'I agree to the Body Measurement Consent & Accuracy Policy.',
  });
  expect(required.getAllByRole('checkbox')).toHaveLength(2);
  expect(checkbox).toHaveAccessibleName(
    'I agree to the Body Measurement Consent & Accuracy Policy.',
  );
  expect(checkbox).toBeRequired();
  expect(checkbox).not.toBeChecked();
  expect(
    required.getByRole('link', { name: /Terms of Service/ }),
  ).toHaveAttribute('target', '_blank');
  expect(
    required.getByRole('link', { name: /Privacy Policy/ }),
  ).toHaveAttribute('target', '_blank');
  const optional = within(
    screen.getByRole('group', { name: 'Optional consent' }),
  ).getByRole('checkbox');
  expect(optional).not.toBeRequired();
  expect(optional).not.toBeChecked();
});

it('keeps separate capture consent beside the camera agreement link', () => {
  render(<AgreementFields types={['BODY_MEASUREMENT']} />);
  const checkbox = screen.getByRole('checkbox', {
    name: 'I agree to the Body Measurement Consent & Accuracy Policy.',
  });
  expect(checkbox).toBeRequired();
  expect(checkbox.closest('.consent-with-agreement')).toContainElement(
    screen.getByRole('link', { name: /Body Measurement Consent/ }),
  );
});
