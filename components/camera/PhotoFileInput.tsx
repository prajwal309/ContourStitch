'use client';

import { useEffect, useRef, useState } from 'react';
import { inferPhoto } from '@/lib/vision/pose';
import { assessQuality } from '@/lib/vision/quality';
import type { Capture, View } from '@/lib/vision/types';
import { CaptureChecklist } from './CaptureChecklist';

export function PhotoFileInput({
  view,
  onCapture,
  onManual,
  analyze = inferPhoto,
}: {
  view: View;
  onCapture: (capture: Capture) => void;
  onManual: () => void;
  analyze?: typeof inferPhoto;
}) {
  const pending = useRef<AbortController | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [override, setOverride] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => pending.current?.abort(), []);

  async function readPhoto(file: File) {
    pending.current?.abort();
    setCapture(null);
    setOverride(false);
    setError('');
    if (
      (file.type && !file.type.startsWith('image/')) ||
      file.size > 20 * 1024 * 1024
    ) {
      setProcessing(false);
      setError('Choose an image file under 20 MB.');
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setProcessing(true);
    try {
      const frame = await analyze(file, controller.signal);
      if (!controller.signal.aborted)
        setCapture({ ...frame, view, quality: assessQuality(frame, view) });
    } catch {
      if (!controller.signal.aborted)
        setError(
          'This photo couldn’t be read. Try a JPEG or PNG image, or use the camera.',
        );
    } finally {
      if (!controller.signal.aborted) setProcessing(false);
    }
  }

  const detectsBody = capture?.mask && capture.landmarks.length > 0;
  const passesChecks = capture?.quality.checks.every(({ passed }) => passed);

  return (
    <div className="account-section">
      <p className="muted">
        {view === 'front'
          ? 'Choose a full-body front photo with both feet visible and arms slightly away from your sides.'
          : 'Choose a full-body side photo with a clear view of your torso.'}{' '}
        The photo is processed in this browser.
      </p>
      <label className="photo-file-label">
        Choose {view} photo
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void readPhoto(file);
          }}
        />
      </label>
      {processing && <p role="status">Checking your photo…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {capture && (
        <>
          <CaptureChecklist checks={capture.quality.checks} />
          {detectsBody && !passesChecks && (
            <label className="consent">
              <input
                type="checkbox"
                checked={override}
                onChange={(event) => setOverride(event.target.checked)}
              />
              Use this photo despite quality warnings. This may reduce accuracy.
            </label>
          )}
          <button
            className="button"
            type="button"
            disabled={!detectsBody || (!passesChecks && !override)}
            onClick={() =>
              onCapture({
                ...capture,
                quality: { ...capture.quality, override },
              })
            }
          >
            Use {view} photo →
          </button>
        </>
      )}
      <button className="text-button" type="button" onClick={onManual}>
        Enter tape measurements instead
      </button>
    </div>
  );
}
