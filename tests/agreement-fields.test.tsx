import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  AgreementFields,
  RegistrationAgreementFields,
} from '@/components/consent/AgreementFields';
import { agreementPath } from '@/lib/consent/agreements';

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

it('uses the same linked wording when only one account agreement needs renewal', () => {
  render(
    <form aria-label="Review agreements">
      <AgreementFields types={['TERMS']} />
    </form>,
  );
  const checkbox = screen.getByRole('checkbox', {
    name: 'I agree to the Terms of Service and acknowledge the Privacy Policy.',
  });
  const row = checkbox.closest<HTMLDivElement>('.consent-with-agreement')!;
  const terms = within(row).getByRole('link', { name: /^Terms of Service/ });
  const privacy = within(row).getByRole('link', { name: /^Privacy Policy/ });
  expect(terms).toHaveAttribute('href', agreementPath('TERMS'));
  expect(terms).toHaveAccessibleDescription('Opens in a new tab');
  expect(privacy).toHaveAttribute('href', agreementPath('PRIVACY'));
  expect(privacy).toHaveAttribute('target', '_blank');
  terms.addEventListener('click', (event) => event.preventDefault());
  fireEvent.click(terms);
  expect(checkbox).not.toBeChecked();
  fireEvent.click(row.querySelector('label')!);
  const form = screen.getByRole<HTMLFormElement>('form', {
    name: 'Review agreements',
  });
  const data = new FormData(form);
  expect(data.get('ACCOUNT')).toBe('on');
  expect(data.has('version-TERMS')).toBe(true);
  expect(data.has('version-PRIVACY')).toBe(false);
});
