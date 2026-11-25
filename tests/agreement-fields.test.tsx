import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AgreementFields } from '@/components/consent/AgreementFields';

it('keeps every consent statement and its legal link in one row', () => {
  render(
    <AgreementFields
      types={['CAMERA', 'ACCURACY', 'TERMS', 'PRIVACY']}
      showOptional
    />,
  );

  const pairs = [
    [
      'I consent to camera-based body measurement processing.',
      /Body Measurement Consent/,
    ],
    [
      'I understand that measurements are estimates and may contain errors.',
      /Measurement Accuracy Disclaimer/,
    ],
    [
      'I agree to the Terms of Service and acknowledge the Privacy Policy.',
      /Terms of Service/,
      /Privacy Policy/,
    ],
    [
      'I allow my measurement data to be used to improve ContourStitch.',
      /Optional Measurement Data Use/,
    ],
  ] as const;

  for (const [statement, ...linkNames] of pairs) {
    const checkbox = screen.getByLabelText(statement);
    const row = checkbox.closest('.consent-with-agreement');
    expect(row).not.toBeNull();
    for (const linkName of linkNames)
      expect(row).toContainElement(
        screen.getByRole('link', { name: linkName }),
      );
  }
});
