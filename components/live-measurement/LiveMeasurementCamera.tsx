'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BodyGuide } from '@/components/camera/BodyGuide';
import { PoseOverlay } from '@/components/camera/PoseOverlay';
import { cameraError, releaseCamera, requestCamera } from '@/lib/camera/media';
import {
  calibrateReference,
  type Calibration,
} from '@/lib/live-measurement/calibration';
import { liveConfig as c } from '@/lib/live-measurement/config';
import {
  facing as frameFacing,
  frameFraming,
  poses,
  type Pose,
} from '@/lib/live-measurement/guidance';
import { GuidedScan } from '@/lib/live-measurement/session';
import {
  labels,
  liveMeasurementKeys,
  type MeasurementReport,
} from '@/lib/measurement/types';
import { createScannerVisionEngine } from '@/lib/scanner/vision';
import type { VisionEngine, VisionFrame } from '@/lib/vision/types';

type Props = {
  heightCm: number;
  useReference: boolean;
  onReview: (report: MeasurementReport) => void;
  engineFactory?: () => Promise<VisionEngine>;
};

type Facing = 'environment' | 'user';
type Preview = Pick<VisionFrame, 'height' | 'width' | 'landmarks'>;
type Frozen = { width: number; height: number; bodyPixels: number };
type LiveKey = (typeof liveMeasurementKeys)[number];
const poseMeasurements: Record<Pose, readonly LiveKey[]> = {
  front: ['sleeve'],
  extended: ['arm'],
  side: ['chest', 'waist', 'hip'],
  back: ['sleeve', 'chest', 'waist', 'hip'],
  neck: ['neck'],
};

function requestHint(key: LiveKey, index: number) {
  if (key === 'arm')
    return index <= 1 ? 'Needs arms extended' : 'Needs tape or a retake';
  if (key === 'sleeve')
    return index === 0 ? 'Needs front pose' : 'Needs tape or a retake';
  if (key === 'neck')
    return index < poses.length
      ? 'Needs side and neck views'
      : 'Needs tape or a retake';
  return index <= 2 ? 'Needs front and side views' : 'Needs tape or a retake';
}

function speak(text: string, voice: SpeechSynthesisVoice) {
  window.speechSynthesis.cancel();
  const request = new SpeechSynthesisUtterance(text);
  request.voice = voice;
  request.lang = voice.lang;
  window.speechSynthesis.speak(request);
}

export function LiveMeasurementCamera(props: Props) {
  const [facing, setFacing] = useState<Facing>('environment');
  const [attempt, setAttempt] = useState(0);

  return (
    <CameraRun
      key={`${facing}-${attempt}`}
      {...props}
      facing={facing}
      onRetry={() => setAttempt((value) => value + 1)}
      onSwitch={() =>
        setFacing((value) => (value === 'environment' ? 'user' : 'environment'))
      }
    />
  );
}

function CameraRun({
  heightCm,
  useReference,
  onReview,
  facing,
  onRetry,
  onSwitch,
  engineFactory = createScannerVisionEngine,
}: Props & { facing: Facing; onRetry: () => void; onSwitch: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopCapture = useRef<(() => void) | null>(null);
  const scan = useRef<GuidedScan | null>(null);
  const referenceFrame = useRef<{
    bodyPixels: number;
    timestamp: number;
  } | null>(null);
  const [phase, setPhase] = useState<'reference' | 'poses'>(
    useReference ? 'reference' : 'poses',
  );
  const [snapshot, setSnapshot] = useState(() =>
    new GuidedScan({ kind: 'height', heightCm }).snapshot(),
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Requesting camera permission…');
  const [canFreeze, setCanFreeze] = useState(false);
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const [referenceError, setReferenceError] = useState('');
  const [upper, setUpper] = useState(25);
  const [lower, setLower] = useState(75);
  const [length, setLength] = useState('');
  const [overlay, setOverlay] = useState(true);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voiceNotice, setVoiceNotice] = useState('');
  const current = poses[snapshot.index];
  const provisional = error ? null : snapshot.provisional;
  const liveReport = provisional ?? snapshot.report;
  const guidance =
    current && 'tip' in current
      ? `${current.instruction} ${current.tip}`
      : current?.instruction;
  const hasPreview = preview !== null;
  const spokenInstruction = snapshot.complete
    ? 'The scan is complete. Review your measurements.'
    : phase === 'poses'
      ? guidance
      : undefined;

  useEffect(() => {
    if (!voice || !spokenInstruction || error) return;
    speak(spokenInstruction, voice);
    return () => window.speechSynthesis.cancel();
  }, [voice, spokenInstruction, error]);

  useEffect(() => {
    if (
      !voice ||
      !hasPreview ||
      error ||
      phase !== 'poses' ||
      snapshot.complete ||
      snapshot.held ||
      snapshot.message === 'Match the pose and hold still.' ||
      snapshot.message === guidance
    )
      return;
    const timer = setTimeout(() => speak(snapshot.message, voice), 2400);
    return () => clearTimeout(timer);
  }, [
    voice,
    hasPreview,
    error,
    phase,
    snapshot.complete,
    snapshot.held,
    snapshot.message,
    guidance,
  ]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const referenceCanvas = canvas.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let engine: VisionEngine | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastVideoTime = -1;
    scan.current = useReference
      ? null
      : new GuidedScan({ kind: 'height', heightCm });

    function stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      releaseCamera(stream);
      engine?.close();
      referenceFrame.current = null;
      if (referenceCanvas) {
        referenceCanvas.width = 0;
        referenceCanvas.height = 0;
      }
      if (element) element.srcObject = null;
    }
    stopCapture.current = stop;

    function interrupt() {
      if (stopped) return;
      stop();
      setPreview(null);
      setFrozen(null);
      setError(
        'The camera was interrupted. Retry with the phone in the same orientation for the entire scan.',
      );
    }

    function onVisibility() {
      if (document.hidden) interrupt();
    }

    async function tick() {
      if (stopped || !element || !engine) return;
      try {
        if (
          element.readyState >= 2 &&
          element.videoWidth &&
          lastVideoTime !== element.currentTime
        ) {
          lastVideoTime = element.currentTime;
          const frame = await engine.infer(element);
          if (stopped) return;
          setPreview({
            width: frame.width,
            height: frame.height,
            landmarks: frame.landmarks,
          });
          const currentScan = scan.current;
          if (currentScan) {
            const next = currentScan.update(frame);
            setStatus('Camera ready.');
            setSnapshot(next);
            if (next.complete) {
              setPreview(null);
              stop();
              return;
            }
          } else {
            const { bounds, message } = frameFraming(frame);
            const view = frameFacing(frame);
            const suitable = !!(bounds && frame.mask && view === 'front');
            referenceFrame.current =
              suitable && bounds && frame.mask
                ? {
                    bodyPixels:
                      (bounds.height * frame.height) / frame.mask.height,
                    timestamp: frame.timestamp,
                  }
                : null;
            setCanFreeze(suitable);
            setStatus(
              message ??
                (suitable
                  ? 'Full body in view. Capture the reference when it is in position.'
                  : 'Face the camera for reference calibration.'),
            );
          }
        }
        timer = setTimeout(tick, c.intervalMs);
      } catch (failure) {
        stop();
        setPreview(null);
        setFrozen(null);
        setError(cameraError(failure));
      }
    }

    async function start() {
      try {
        const requested = await requestCamera(facing);
        if (stopped || !element) {
          releaseCamera(requested);
          return;
        }
        stream = requested;
        for (const track of stream.getTracks())
          track.addEventListener?.('ended', interrupt, { once: true });
        element.srcObject = stream;
        await element.play();
        if (stopped) return;
        setStatus('Loading the private on-device model…');
        const initialized = await engineFactory();
        if (stopped) {
          initialized.close();
          return;
        }
        engine = initialized;
        void tick();
      } catch (failure) {
        if (stopped) return;
        stop();
        setError(cameraError(failure));
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('orientationchange', interrupt);
    window.addEventListener('pagehide', interrupt);
    void start();
    return () => {
      stop();
      stopCapture.current = null;
      scan.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('orientationchange', interrupt);
      window.removeEventListener('pagehide', interrupt);
    };
  }, [engineFactory, facing, heightCm, useReference]);

  function begin(calibration: Calibration) {
    scan.current = new GuidedScan(calibration);
    setSnapshot(scan.current.snapshot());
    setPhase('poses');
    setFrozen(null);
    setReferenceError('');
    if (canvas.current) {
      canvas.current.width = 0;
      canvas.current.height = 0;
    }
  }

  function freezeReference() {
    const frame = referenceFrame.current;
    const image = video.current;
    const target = canvas.current;
    if (
      !frame ||
      !image ||
      !target ||
      !preview ||
      performance.now() - frame.timestamp > c.maxGapMs
    ) {
      setReferenceError('Wait for the camera to settle and try again.');
      return;
    }
    target.width = preview.width;
    target.height = preview.height;
    const context = target.getContext('2d');
    if (!context) {
      setReferenceError(
        'This browser could not show a reference frame. Use your height instead.',
      );
      return;
    }
    context.drawImage(image, 0, 0, target.width, target.height);
    setReferenceError('');
    setFrozen({
      width: target.width,
      height: target.height,
      bodyPixels: frame.bodyPixels,
    });
  }

  function applyReference() {
    const calibrated =
      frozen &&
      calibrateReference(
        heightCm,
        Number(length),
        frozen.bodyPixels,
        ((lower - upper) / 100) * frozen.height,
      );
    if (!calibrated) {
      setReferenceError(
        'The reference does not agree with your entered height. Check its length and marker positions, or use your height.',
      );
      return;
    }
    begin(calibrated);
  }

  function skipPose() {
    if (!scan.current) return;
    const next = scan.current.skip();
    setSnapshot(next);
    if (next.complete) {
      stopCapture.current?.();
      setPreview(null);
    }
  }

  function enableVoice() {
    if (voice) {
      window.speechSynthesis.cancel();
      setVoice(null);
      return;
    }
    const local = window.speechSynthesis
      ?.getVoices()
      .find(
        (item) => item.localService && item.lang.toLowerCase().startsWith('en'),
      );
    if (local && typeof SpeechSynthesisUtterance !== 'undefined') {
      setVoiceNotice('');
      if (spokenInstruction) speak(spokenInstruction, local);
      setVoice(local);
    } else
      setVoiceNotice(
        'A local English voice is unavailable. You can use the on-screen instructions.',
      );
  }

  function review() {
    stopCapture.current?.();
    onReview(snapshot.report);
  }

  const ratio = preview ? preview.width / preview.height : null;
  return (
    <div className="live-scan">
      <div>
        {phase === 'poses' && !snapshot.complete && (
          <>
            <ol
              className="flow-progress live-progress"
              aria-label={`Pose ${snapshot.index + 1} of ${poses.length}`}
            >
              {poses.map(({ id, label }, index) => (
                <li
                  key={id}
                  aria-current={index === snapshot.index ? 'step' : undefined}
                  className={
                    index < snapshot.index && !snapshot.skipped.includes(id)
                      ? 'complete'
                      : undefined
                  }
                >
                  <b aria-hidden="true">
                    {snapshot.skipped.includes(id)
                      ? '–'
                      : index < snapshot.index
                        ? '✓'
                        : index + 1}
                  </b>
                  <span>
                    {label}
                    {snapshot.skipped.includes(id) ? ' (skipped)' : ''}
                  </span>
                </li>
              ))}
            </ol>
            <h2 className="scan-instruction" aria-live="polite">
              {guidance}
            </h2>
          </>
        )}
        <div
          className="camera-preview live-preview"
          hidden={snapshot.complete || !!frozen}
          style={
            ratio
              ? ({
                  aspectRatio: ratio,
                  '--preview-ratio': ratio,
                } as CSSProperties)
              : { aspectRatio: '3 / 4' }
          }
        >
          <div
            className={`camera-source${facing === 'user' ? ' mirrored' : ''}`}
          >
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              aria-label="Live camera preview"
            />
            {!!preview && overlay && <PoseOverlay {...preview} />}
          </div>
          {overlay && (
            <BodyGuide side={current?.id === 'side' && phase === 'poses'} />
          )}
        </div>
        {!snapshot.complete && !error && (
          <p role="status" className="muted live-feedback">
            {phase === 'reference'
              ? status
              : preview
                ? snapshot.message
                : status}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div
          hidden={!frozen}
          className="reference-preview"
          style={
            frozen
              ? ({
                  '--preview-ratio': frozen.width / frozen.height,
                } as CSSProperties)
              : undefined
          }
        >
          <canvas ref={canvas} aria-label="Temporary calibration frame" />
          {frozen && (
            <>
              <span className="reference-marker" style={{ top: `${upper}%` }}>
                Top
              </span>
              <span className="reference-marker" style={{ top: `${lower}%` }}>
                Bottom
              </span>
            </>
          )}
        </div>

        {phase === 'reference' && !error && (
          <div className="review-box">
            <h2>Calibrate with a reference</h2>
            <p>
              Use a rigid object of known length, such as a ruler. Place it
              upright beside you in the same plane as your body. Keep the phone
              level and in the same position for every pose.
            </p>
            {frozen ? (
              <>
                <label>
                  Reference length in centimetres
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    inputMode="decimal"
                    value={length}
                    onChange={(event) => setLength(event.target.value)}
                  />
                </label>
                <label>
                  Top marker
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.5}
                    value={upper}
                    onChange={(event) => setUpper(Number(event.target.value))}
                  />
                </label>
                <label>
                  Bottom marker
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.5}
                    value={lower}
                    onChange={(event) => setLower(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={applyReference}
                >
                  Use reference scale
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setFrozen(null);
                    if (canvas.current) {
                      canvas.current.width = 0;
                      canvas.current.height = 0;
                    }
                  }}
                >
                  Retake reference
                </button>
              </>
            ) : (
              <button
                type="button"
                className="secondary-button"
                disabled={!canFreeze}
                onClick={freezeReference}
              >
                Capture reference frame
              </button>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => begin({ kind: 'height', heightCm })}
            >
              Use my height instead
            </button>
            {referenceError && (
              <p className="error" role="alert">
                {referenceError}
              </p>
            )}
          </div>
        )}

        {snapshot.complete ? (
          <div className="review-box">
            <h2>Scan complete</h2>
            <p>
              The camera is off. Review the estimates, confirm them with a tape,
              and enter any missing measurements.
            </p>
            <button type="button" className="button" onClick={review}>
              Review measurements
            </button>
            <button type="button" className="text-button" onClick={onRetry}>
              Retake scan
            </button>
          </div>
        ) : (
          <>
            <div className="scan-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onSwitch}
              >
                Switch camera · {facing === 'user' ? 'front' : 'rear'}
              </button>
              {error && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onRetry}
                >
                  Try camera again
                </button>
              )}
              {!error && phase === 'poses' && (
                <button
                  type="button"
                  className="text-button"
                  onClick={skipPose}
                  disabled={!preview}
                >
                  Skip this pose
                </button>
              )}
            </div>
            <div className="scan-actions">
              <label className="consent">
                <input
                  type="checkbox"
                  checked={overlay}
                  onChange={(event) => setOverlay(event.target.checked)}
                />{' '}
                Show body overlay
              </label>
              <button
                type="button"
                className="text-button"
                onClick={enableVoice}
              >
                {voice ? 'Mute spoken guidance' : 'Enable spoken guidance'}
              </button>
            </div>
            {voiceNotice && (
              <p role="status" className="muted">
                {voiceNotice}
              </p>
            )}
            <button type="button" className="text-button" onClick={review}>
              Enter tape measurements instead
            </button>
          </>
        )}
      </div>

      <section
        className="live-estimates"
        aria-labelledby="live-estimates-title"
      >
        <h2 id="live-estimates-title">Live estimates</h2>
        <p className="muted">
          Experimental body measurements. Figures can change as you hold a pose.
          Garment ease is separate.
        </p>
        <dl>
          {liveMeasurementKeys.map((key) => {
            const estimate = liveReport.estimates.find(
              (item) => item.key === key,
            );
            const refining =
              !error &&
              snapshot.held &&
              current &&
              poseMeasurements[current.id].includes(key);
            const evidence = refining
              ? estimate && provisional
                ? 'Refining with repeatable frames'
                : 'Checking frames'
              : estimate
                ? 'Ready for tape check'
                : requestHint(key, snapshot.index);
            return (
              <div key={key}>
                <dt>{labels[key]}</dt>
                <dd>{estimate ? `${Math.round(estimate.valueCm)} cm` : '—'}</dd>
                <dd className="muted">{evidence}</dd>
                {estimate?.sidesCm && (
                  <>
                    <dd className="muted">
                      Left {Math.round(estimate.sidesCm.left)} cm · Right{' '}
                      {Math.round(estimate.sidesCm.right)} cm
                    </dd>
                    {Math.abs(estimate.sidesCm.left - estimate.sidesCm.right) >=
                      c.asymmetryNoticeCm && (
                      <dd className="tape-warning">
                        Check both arms with a tape.
                      </dd>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
}
