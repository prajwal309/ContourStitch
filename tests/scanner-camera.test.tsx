import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VideoMeasurementScanner } from '@/components/scanner/VideoMeasurementScanner';
afterEach(() => vi.restoreAllMocks());
it('explains denial without initializing vision', async () => {
  const factory = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
    },
  });
  render(
    <VideoMeasurementScanner
      heightCm={170}
      onClose={() => {}}
      engineFactory={factory}
    />,
  );
  await expect(screen.findByRole('alert')).resolves.toHaveTextContent(
    'permission was denied',
  );
  expect(factory).not.toHaveBeenCalled();
});
it('stops camera tracks when unmounted during initialization', async () => {
  const stop = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    },
  });
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => new Promise(() => {}));
  const rendered = render(
    <VideoMeasurementScanner heightCm={170} onClose={() => {}} />,
  );
  await waitFor(() => expect(play).toHaveBeenCalled());
  rendered.unmount();
  expect(stop).toHaveBeenCalledOnce();
});
