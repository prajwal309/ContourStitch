import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  AgreementFields,
  RegistrationAgreementFields,
} from '@/components/consent/AgreementFields';

it('uses one required registration checkbox and an unchecked independent opt-in', () => {
  render(<RegistrationAgreementFields />);
  const required = within(
    screen.getByRole('group', { name: 'Required agreement' }),
  );
  const [checkbox] = required.getAllByRole('checkbox');
  expect(required.getAllByRole('checkbox')).toHaveLength(1);
  expect(checkbox).toHaveAccessibleName(
    'I agree to the Terms of Service, acknowledge the Privacy Policy, and consent to camera-based body measurement processing. I understand that measurements are estimates.',
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
  render(<AgreementFields types={['CAMERA', 'ACCURACY']} />);
  const checkbox = screen.getByRole('checkbox', {
    name: 'I consent to camera-based body measurement processing.',
  });
  expect(checkbox).toBeRequired();
  expect(checkbox.closest('.consent-with-agreement')).toContainElement(
    screen.getByRole('link', { name: /Body Measurement Consent/ }),
  );
});
