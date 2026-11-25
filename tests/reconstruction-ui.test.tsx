import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExperimentalRotation from '@/components/scanner/ExperimentalRotation';

vi.mock('@/lib/consent/actions', () => ({ authorizeMeasurement: vi.fn() }));

describe('experimental engine selection', () => {
  it('discloses that parametric fitting is unavailable without its licensed runtime', () => {
    render(
      <ExperimentalRotation
        access={{ userId: null, required: ['BODY_MEASUREMENT'] }}
      />,
    );
    const parametric = screen.getByRole('radio', {
      name: /Parametric 3D Body Fitting — Beta/,
    });
    fireEvent.click(parametric);
    expect(parametric).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(
      /commercial model license and PyTorch inference service/,
    );
    const cameraConsent = screen.getByLabelText(
      'I agree to the Body Measurement Consent & Accuracy Policy.',
    );
    const consent = cameraConsent.closest('.consent-with-agreement');
    expect(consent).toContainElement(
      screen.getByRole('link', { name: /Body Measurement Consent/ }),
    );
    fireEvent.click(cameraConsent);
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled();
  });

  it('exposes view-count ablations for the independent visual hull', () => {
    render(
      <ExperimentalRotation
        access={{ userId: null, required: ['BODY_MEASUREMENT'] }}
      />,
    );
    fireEvent.click(
      screen.getByRole('radio', {
        name: /Multi-View Silhouette Reconstruction — Beta/,
      }),
    );
    const select = screen.getByLabelText('Silhouette views');
    expect(select).toHaveValue('16');
    fireEvent.change(select, { target: { value: '64' } });
    expect(select).toHaveValue('64');
  });
});
