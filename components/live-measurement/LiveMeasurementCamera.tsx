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
  type MeasurementKey,
  type MeasurementReport,
} from '@/lib/measurement/types';
import {
  acquisitionAnnouncement,
  acquisitionProgress,
  reachedAcquisitionMilestones,
} from '@/lib/live-measurement/feedback';
import { measurementProgress } from '@/lib/live-measurement/progress';
import {
  progressiveMeasurementKeys,
  type ProgressiveEstimate,
  type ProgressiveMeasurementKey,
} from '@/lib/live-measurement/progressive';
import { createScannerVisionEngine } from '@/lib/scanner/vision';
import type { VisionEngine, VisionFrame } from '@/lib/vision/types';
import { VoiceControls } from '@/components/voice/VoiceControls';
import { useVoiceGuidance } from '@/components/voice/useVoiceGuidance';

type Props = {
  heightCm: number;
  useReference: boolean;
  onReview: (report: MeasurementReport) => void;
  engineFactory?: () => Promise<VisionEngine>;
  verifyCameraAccess?: () => Promise<void>;
};

type Facing = 'environment' | 'user';
type Preview = Pick<VisionFrame, 'height' | 'width' | 'landmarks'>;
type Frozen = { width: number; height: number; bodyPixels: number };
type SmoothedValues = Partial<Record<ProgressiveMeasurementKey, number>>;

const progressiveLabels: Record<ProgressiveMeasurementKey, string> = {
  shoulder: labels.shoulder,
  arm: labels.arm,
  chest: labels.chest,
  waist: labels.waist,
  hip: labels.hip,
  inseam: labels.inseam,
  torso: 'Torso length',
  neck: labels.neck,
  sleeve: labels.sleeve,
};

function regionForPose(pose?: Pose) {
  switch (pose) {
    case 'front':
      return 'upper-body';
    case 'extended':
      return 'arms';
    case 'side':
      return 'torso';
    case 'back':
      return 'torso';
    case 'neck':
      return 'neck';
    default:
      return null;
  }
}

function wasMeasurementAcquired(
  key: ProgressiveMeasurementKey,
  acquired: ReadonlySet<MeasurementKey>,
) {
  return key !== 'torso' && acquired.has(key);
}

function acquisitionMessage({
  phase,
  pose,
  held,
  complete,
  error,
  message,
  status,
  hasPreview,
}: {
  phase: 'reference' | 'poses';
  pose?: Pose;
  held: boolean;
  complete: boolean;
  error: string;
  message: string;
  status: string;
  hasPreview: boolean;
}) {
  if (error) return 'Camera unavailable';
  if (complete) return 'Scan complete';
  if (phase === 'reference') return 'Preparing initial estimates';
  if (!hasPreview) return status;
  if (!held) return message;
  switch (pose) {
    case 'front':
      return 'Detecting body landmarks · front view';
    case 'extended':
      return 'Collecting arm landmarks';
    case 'side':
      return 'Collecting side view';
    case 'back':
      return 'Refining measurements';
    case 'neck':
      return 'Refining neck measurement';
    default:
      return 'Collecting camera observations';
  }
}

function useSmoothedEstimateValues(estimates: readonly ProgressiveEstimate[]) {
  const [values, setValues] = useState<SmoothedValues>({});
  const valuesRef = useRef<SmoothedValues>({});

  useEffect(() => {
    if (!estimates.length) return;
    const targets = new Map(
      estimates
        .filter(
          (estimate): estimate is ProgressiveEstimate & { valueCm: number } =>
            estimate.valueCm !== null,
        )
        .map(({ key, valueCm }) => [key, valueCm] as const),
    );
    const update = () => {
      const current = valuesRef.current;
      const next = { ...current };
      let changed = false;
      let moving = false;

      targets.forEach((target, key) => {
        const previous = current[key];
        const value =
          previous === undefined
            ? target
            : previous + (target - previous) * 0.24;
        const smoothed = Math.abs(target - value) < 0.15 ? target : value;

        if (previous !== smoothed) {
          next[key] = smoothed;
          changed = true;
        }
        if (Math.abs(target - smoothed) >= 0.15) moving = true;
      });

      if (changed) {
        valuesRef.current = next;
        setValues(next);
      }
      if (!moving) window.clearInterval(timer);
    };

    const timer = window.setInterval(update, 50);
    update();
    return () => window.clearInterval(timer);
  }, [estimates]);

  return values;
}

function useAcquiredMeasurementHighlights(
  estimates: readonly { key: MeasurementKey }[],
) {
  const [highlighted, setHighlighted] = useState<ReadonlySet<MeasurementKey>>(
    () => new Set(),
  );
  const known = useRef(new Set<MeasurementKey>());
  const timers = useRef(new Map<MeasurementKey, number>());

  useEffect(() => {
    const current = new Set(estimates.map(({ key }) => key));
    const newlyAcquired = [...current].filter((key) => !known.current.has(key));
    if (newlyAcquired.length) {
      setHighlighted((previous) => new Set([...previous, ...newlyAcquired]));
      for (const key of newlyAcquired) {
        const timer = timers.current.get(key);
        if (timer !== undefined) window.clearTimeout(timer);
        timers.current.set(
          key,
          window.setTimeout(() => {
            setHighlighted((previous) => {
              const next = new Set(previous);
              next.delete(key);
              return next;
            });
            timers.current.delete(key);
          }, 900),
        );
      }
    }
  }, [estimates]);
  useEffect(() => {
    known.current = new Set(estimates.map(({ key }) => key));
  }, [estimates]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  return highlighted;
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
  verifyCameraAccess,
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
  const current = poses[snapshot.index];
  const provisional = error ? null : snapshot.provisional;
  const liveReport = provisional ?? snapshot.report;
  const smoothedValues = useSmoothedEstimateValues(snapshot.progressive);
  const acquiredMeasurements = useAcquiredMeasurementHighlights(
    snapshot.report.estimates,
  );
  const completedViews = poses.slice(0, snapshot.index).map(({ id }) => id);
  const captureActive = !error && phase === 'poses' && !snapshot.complete;
  const focusedRegion = snapshot.held ? regionForPose(current?.id) : null;
  const hasPreview = preview !== null;
  const acquisitionText = acquisitionMessage({
    phase,
    pose: current?.id,
    held: snapshot.held,
    complete: snapshot.complete,
    error,
    message: snapshot.message,
    status,
    hasPreview,
  });
  const acquisition = acquisitionProgress(snapshot.report.estimates);
  const allMeasurementsAcquired = acquisition.percent === 100;
  const completionMessage = allMeasurementsAcquired
    ? 'All required measurements acquired. Thank you.'
    : 'Scan complete. Use a tape for any missing measurements.';
  const guidance = error
    ? 'Camera unavailable. Retry or enter tape measurements.'
    : snapshot.message;
  const spokenInstruction =
    phase === 'poses' && (hasPreview || snapshot.complete)
      ? snapshot.complete
        ? completionMessage
        : snapshot.message
      : undefined;
  const voiceGuidance = useVoiceGuidance(error ? undefined : spokenInstruction);
  const { announceAcquisition } = voiceGuidance;
  const cameraEvidenceCount = snapshot.progressive.filter(
    ({ source }) => source === 'blended' || source === 'camera',
  ).length;
  const sourceSummary = error
    ? cameraEvidenceCount
      ? `${cameraEvidenceCount} estimates retain camera evidence; others are references or need data.`
      : 'Camera unavailable · references shown where supported.'
    : cameraEvidenceCount
      ? `${cameraEvidenceCount} of ${progressiveMeasurementKeys.length} estimates include camera evidence; others remain references or need data.`
      : phase === 'reference'
        ? 'Height-based population references · camera observations have not started.'
        : 'Height-based population references · no camera evidence yet.';
  const armSides = liveReport.estimates.find(
    (estimate) => estimate.key === 'arm',
  )?.sidesCm;
  const armMismatch =
    !!armSides &&
    Math.abs(armSides.left - armSides.right) >= c.asymmetryNoticeCm;
  const lastAcceptedIndex = useRef(snapshot.index);
  const lastAcquisitionPercent = useRef(acquisition.percent);
  const acceptedKeys = useRef(
    new Set(snapshot.report.estimates.map(({ key }) => key)),
  );
  useEffect(() => {
    const currentKeys = new Set(
      snapshot.report.estimates.map(({ key }) => key),
    );
    const previousIndex = lastAcceptedIndex.current;
    const newlyAcquired = [...currentKeys].filter(
      (key) => !acceptedKeys.current.has(key),
    );
    if (
      phase === 'poses' &&
      !error &&
      snapshot.index > previousIndex &&
      poses[previousIndex]
    ) {
      const milestones = reachedAcquisitionMilestones(
        lastAcquisitionPercent.current,
        acquisition.percent,
      );
      announceAcquisition(
        acquisitionAnnouncement({
          view: poses[previousIndex].label,
          newlyAcquired,
          percent: acquisition.percent,
          milestones,
          complete: snapshot.complete,
        }),
      );
    }
    lastAcceptedIndex.current = snapshot.index;
    lastAcquisitionPercent.current = acquisition.percent;
    acceptedKeys.current = currentKeys;
  }, [
    acquisition.percent,
    announceAcquisition,
    error,
    phase,
    snapshot.complete,
    snapshot.index,
    snapshot.report.estimates,
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
        if (verifyCameraAccess) await verifyCameraAccess();
        if (stopped) return;
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
  }, [engineFactory, facing, heightCm, useReference, verifyCameraAccess]);

  function begin(calibration: Calibration) {
    scan.current = new GuidedScan(calibration, undefined, heightCm);
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
                  className={index < snapshot.index ? 'complete' : undefined}
                >
                  <b aria-hidden="true">
                    {index < snapshot.index ? '✓' : index + 1}
                  </b>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
            <h2 className="scan-instruction" aria-live="polite">
              {guidance}
            </h2>
          </>
        )}
        <div
          className={`camera-preview live-preview${snapshot.held ? ' is-scanning' : ''}`}
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
            <BodyGuide
              side={current?.id === 'side' && phase === 'poses'}
              focus={focusedRegion}
            />
          )}
        </div>
        {!snapshot.complete &&
          !error &&
          (phase === 'reference' || !preview) && (
            <p role="status" className="muted live-feedback">
              {status}
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
            <h2>{completionMessage}</h2>
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
            </div>
            <VoiceControls guidance={voiceGuidance} />
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
        <div className="live-estimates-heading">
          <h2 id="live-estimates-title">Live estimates</h2>
          <span>
            {error
              ? 'Camera off'
              : snapshot.complete
                ? 'Complete'
                : cameraEvidenceCount
                  ? 'Refining'
                  : 'Experimental'}
          </span>
        </div>
        <div className="live-acquisition">
          <div
            className={`live-acquisition-status${captureActive && snapshot.held ? ' is-scanning' : ''}`}
          >
            <span className="live-scan-indicator" aria-hidden="true" />
            <p role="status" aria-live="polite">
              {acquisitionText}
            </p>
          </div>
          <p className="live-source-summary">{sourceSummary}</p>
          {armMismatch && (
            <p className="live-arm-warning">
              Arm sides differ; tape-check both.
            </p>
          )}
          <div className="live-capture-progress">
            <div
              className="live-capture-track"
              role="progressbar"
              aria-label="Camera measurements acquired"
              aria-valuemin={0}
              aria-valuemax={acquisition.total}
              aria-valuenow={acquisition.count}
              aria-valuetext={`${acquisition.count} of ${acquisition.total} camera-supported measurements acquired (${acquisition.percent} percent)`}
            >
              <span style={{ width: `${acquisition.percent}%` }} />
            </div>
            <span>
              {acquisition.count}/{acquisition.total} · {acquisition.percent}%
            </span>
          </div>
        </div>
        <dl className="live-estimate-grid">
          {progressiveMeasurementKeys.map((key) => {
            const estimate = snapshot.progressive.find(
              (item) => item.key === key,
            )!;
            const progress = measurementProgress(key, estimate, {
              pose: current?.id,
              completedViews,
              captureActive,
              scanComplete: snapshot.complete,
            });
            const sourceLabel =
              estimate.source === 'prior'
                ? 'Height-based population reference'
                : estimate.source === 'blended'
                  ? 'Population reference refined with camera evidence'
                  : estimate.source === 'camera'
                    ? 'Camera-supported estimate'
                    : 'No supported estimate yet';
            const showSourceMarker =
              estimate.source !== 'prior' || (key === 'arm' && armMismatch);
            const rangeCm =
              estimate.rangeHalfWidthCm === null
                ? null
                : Math.max(1, Math.round(estimate.rangeHalfWidthCm));
            const rangeKind =
              estimate.source === 'prior'
                ? 'population variation'
                : 'working range';
            const displayValue =
              estimate.valueCm === null
                ? null
                : Math.round(smoothedValues[key] ?? estimate.valueCm);
            return (
              <div
                key={key}
                className={`live-estimate ${progress.state}${wasMeasurementAcquired(key, acquiredMeasurements) ? ' is-updated' : ''}`}
              >
                <dt>
                  <span className="live-estimate-name">
                    {progressiveLabels[key]}
                  </span>
                  <span
                    className={`live-source-indicator${showSourceMarker ? ` source-${estimate.source}` : ' is-empty'}${key === 'arm' && armMismatch ? ' is-warning' : ''}`}
                    title={
                      key === 'arm' && armMismatch
                        ? `${sourceLabel}. Verify both arm sides with a tape.`
                        : sourceLabel
                    }
                    aria-label={
                      showSourceMarker
                        ? key === 'arm' && armMismatch
                          ? `${sourceLabel}. Verify both arm sides with a tape.`
                          : sourceLabel
                        : undefined
                    }
                    role={showSourceMarker ? 'img' : undefined}
                  />
                  {wasMeasurementAcquired(key, acquiredMeasurements) && (
                    <span
                      className="live-acquired-check"
                      role="img"
                      aria-label="Camera measurement acquired"
                      title="Camera measurement acquired"
                    >
                      ✓
                    </span>
                  )}
                  <span className="live-estimate-accessible-state">
                    {progress.label}. {sourceLabel}
                    {wasMeasurementAcquired(key, acquiredMeasurements) &&
                      '. Camera measurement acquired'}
                  </span>
                </dt>
                <dd
                  className={`live-measurement-value${displayValue === null ? ' is-estimating' : ''}`}
                >
                  {displayValue === null ? (
                    'Estimating…'
                  ) : (
                    <>
                      <span>{displayValue}</span>
                      <span className="live-measurement-unit">cm</span>
                    </>
                  )}
                </dd>
                {rangeCm !== null && (
                  <dd
                    className="live-uncertainty"
                    aria-label={`Approximately plus or minus ${rangeCm} centimetres; ${rangeKind}. This is not a validated personal accuracy range.`}
                  >
                    <span aria-hidden="true">±{rangeCm} cm</span>
                    <span className="live-range-kind">
                      {estimate.source === 'prior' ? 'pop.' : 'working'}
                    </span>
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
        <p className="live-estimates-disclosure">
          Experimental estimates only. Ranges are population variation or
          unvalidated working ranges, not personal accuracy; confirm with a tape
          before garment production.
        </p>
        <details className="live-estimates-about">
          <summary>About these estimates</summary>
          <div>
            <p>
              Height-based references use equally weighted linear fits from the
              public ANSUR II men&apos;s and women&apos;s datasets. The source
              is U.S. military personnel, not a representative consumer or
              tailoring population; references are withheld outside 150–190 cm.
            </p>
            <p>
              Camera evidence is incorporated only when the current method
              supports it. In this build, inseam remains a height-based
              reference. The prior uses buttock circumference as a hip proxy,
              crotch height as an inseam proxy, and arm segments as a sleeve
              proxy. Arm-side differences may require separate tape checks.
            </p>
            <p>
              Population variation and camera working ranges are not calibrated
              personal error bounds or confidence probabilities. The measurement
              engine is experimental and does not guarantee fit.
            </p>
            <a
              href="https://www.openlab.psu.edu/datasets/ansur2/"
              target="_blank"
              rel="noreferrer"
            >
              ANSUR II source and methods
            </a>
          </div>
        </details>
      </section>
    </div>
  );
}
