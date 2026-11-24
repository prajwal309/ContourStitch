import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExperimentalRotation from '@/components/scanner/ExperimentalRotation';

describe('experimental engine selection', () => {
  it('discloses that parametric fitting is unavailable without its licensed runtime', () => {
    render(<ExperimentalRotation />);
    const parametric = screen.getByRole('radio', {
      name: /Parametric 3D Body Fitting — Beta/,
    });
    fireEvent.click(parametric);
    expect(parametric).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(
      /commercial model license and PyTorch inference service/,
    );
    fireEvent.click(
      screen.getByLabelText('I agree to browser-side camera processing.'),
    );
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled();
  });

  it('exposes view-count ablations for the independent visual hull', () => {
    render(<ExperimentalRotation />);
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
