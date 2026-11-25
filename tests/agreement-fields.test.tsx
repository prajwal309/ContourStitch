import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  AgreementFields,
  RegistrationAgreementFields,
} from '@/components/consent/AgreementFields';

it('requires account agreements at registration without requesting measurement consent', () => {
  render(<RegistrationAgreementFields />);
  const required = within(
    screen.getByRole('group', { name: 'Required agreements' }),
  );
  const checkbox = required.getByRole('checkbox', {
    name: 'I agree to the Terms of Service and acknowledge the Privacy Policy.',
  });
  expect(required.getAllByRole('checkbox')).toHaveLength(1);
  expect(checkbox).toBeRequired();
  expect(checkbox).not.toBeChecked();
  expect(
    required.queryByRole('checkbox', {
      name: 'I agree to the Body Measurement Consent & Accuracy Policy.',
    }),
  ).not.toBeInTheDocument();
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
