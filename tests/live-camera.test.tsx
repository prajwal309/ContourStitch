import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LiveMeasurementCamera } from '@/components/live-measurement/LiveMeasurementCamera';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('offers retry and manual entry after camera denial', async () => {
  const engineFactory = vi.fn();
  const synthesis = Object.assign(new EventTarget(), {
    getVoices: () => [{ name: 'English', lang: 'en-US', default: true }],
    speak: vi.fn(),
    cancel: vi.fn(),
  });
  vi.stubGlobal('speechSynthesis', synthesis);
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(readonly text: string) {}
    },
  );
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
    },
  });
  render(
    <LiveMeasurementCamera
      heightCm={175}
      useReference={false}
      engineFactory={engineFactory}
      onReview={() => {}}
    />,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'permission was denied',
  );
  expect(
    screen.getByRole('button', { name: 'Try camera again' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Enter measurements manually' }),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Test voice' })).toBeEnabled();
  expect(synthesis.speak).not.toHaveBeenCalled();
  expect(engineFactory).not.toHaveBeenCalled();
});

it('reports a missing camera and can stop while requesting the stream', async () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException('Missing', 'NotFoundError')),
    },
  });
  const rendered = render(
    <LiveMeasurementCamera
      heightCm={175}
      useReference={false}
      onReview={() => {}}
    />,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No camera was found',
  );
  rendered.unmount();

  let deliver: (stream: MediaStream) => void = () => {};
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () =>
        new Promise<MediaStream>((resolve) => {
          deliver = resolve;
        }),
    },
  });
  const stop = vi.fn();
  const pending = render(
    <LiveMeasurementCamera
      heightCm={175}
      useReference={false}
      onReview={() => {}}
    />,
  );
  pending.unmount();
  deliver({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await waitFor(() => expect(stop).toHaveBeenCalledOnce());
});
