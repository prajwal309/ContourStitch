import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PhotoFileInput } from '@/components/camera/PhotoFileInput';
import { fixture } from './fixtures';

it('uses the same quality gate and marks an explicitly overridden local photo', async () => {
  const frame = { ...fixture(), brightness: 0 };
  const analyze = vi.fn().mockResolvedValue(frame);
  const capture = vi.fn();
  const photo = new File(['photo'], 'front.jpg', { type: 'image/jpeg' });

  render(
    <PhotoFileInput
      view="front"
      onCapture={capture}
      onManual={() => {}}
      analyze={analyze}
    />,
  );
  fireEvent.change(screen.getByLabelText('Choose front photo'), {
    target: { files: [photo] },
  });

  const submit = await screen.findByRole('button', { name: /Use front photo/ });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(submit);
  expect(analyze).toHaveBeenCalledWith(photo, expect.any(AbortSignal));
  expect(capture).toHaveBeenCalledWith(
    expect.objectContaining({
      quality: expect.objectContaining({ override: true }),
    }),
  );
});
