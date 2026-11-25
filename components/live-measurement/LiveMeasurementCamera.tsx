'use client';

import { measurementCopy } from '@/lib/measurement/copy';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BodyGuide } from '@/components/camera/BodyGuide';
import { LiveEstimateCard } from './LiveEstimateCard';
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
  MultiViewScan,
  supportedMeasurements,
  type MultiViewSnapshot,
} from '@/lib/live-measurement/multiview/engine';
import { multiViewConfig } from '@/lib/live-measurement/multiview/config';
import type { Anchor } from '@/lib/live-measurement/multiview/observe';
import { createObservationClient } from '@/lib/live-measurement/multiview/worker-client';
import { MeshPreview } from '@/components/reconstruction/MeshPreview';
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
import {
  formatPrecision,
  precisionProgress,
} from '@/lib/live-measurement/precision';
import {
  measurementDependencies,
  type ProgressiveMeasurementKey,
} from '@/lib/live-measurement/progressive';
import { createScannerVisionEngine } from '@/lib/scanner/vision';
import type { VisionEngine, VisionFrame } from '@/lib/vision/types';
import { VoiceControls } from '@/components/voice/VoiceControls';
import { useVoiceGuidance } from '@/components/voice/useVoiceGuidance';

type Props = {
  heightCm: number;
  useReference: boolean;
  multiView?: boolean;
  onReview: (report: MeasurementReport) => void;
  engineFactory?: () => Promise<VisionEngine>;
  verifyCameraAccess?: () => Promise<void>;
};

type Facing = 'environment' | 'user';
type Preview = Pick<VisionFrame, 'height' | 'width' | 'landmarks'>;
type ReferenceFrame = {
  bodyPixels?: number;
  anchorPixels?: Partial<Record<Anchor, number>>;
  timestamp: number;
};
type Frozen = Omit<ReferenceFrame, 'timestamp'> & {
  width: number;
  height: number;
};
type DisplayKey = ProgressiveMeasurementKey | 'outseam';
type ScanSnapshot = ReturnType<GuidedScan['snapshot']> | MultiViewSnapshot;

function newScan(
  multiView: boolean,
  calibration: Calibration,
  heightCm: number,
) {
  return multiView
    ? new MultiViewScan(calibration, heightCm)
    : new GuidedScan(calibration, undefined, heightCm);
}

const progressiveLabels: Record<DisplayKey, string> = {
  shoulder: labels.shoulder,
  arm: labels.arm,
  chest: labels.chest,
  waist: labels.waist,
  hip: labels.hip,
  inseam: labels.inseam,
  torso: 'Torso length',
  neck: labels.neck,
  sleeve: labels.sleeve,
  outseam: labels.outseam,
};

const anatomyForMeasurement: Record<DisplayKey, string> = {
  shoulder: 'shoulders',
  arm: 'arms',
  sleeve: 'arms',
  chest: 'chest',
  waist: 'waist',
  hip: 'hips',
  torso: 'torso',
  neck: 'neck',
  inseam: 'legs',
  outseam: 'legs',
};

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
  multiView = false,
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
  const scan = useRef<GuidedScan | MultiViewScan | null>(null);
  const referenceFrame = useRef<ReferenceFrame | null>(null);
  const [phase, setPhase] = useState<'reference' | 'poses'>(
    useReference ? 'reference' : 'poses',
  );
  const [snapshot, setSnapshot] = useState<ScanSnapshot>(() =>
    newScan(multiView, { kind: 'height', heightCm }, heightCm).snapshot(),
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [timings, setTimings] = useState<{
    inferenceMs: number;
    geometryMs: number;
    processingFps: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Requesting camera permission…');
  const [canFreeze, setCanFreeze] = useState(false);
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const [referenceError, setReferenceError] = useState('');
  const [upper, setUpper] = useState(25);
  const [lower, setLower] = useState(75);
  const [length, setLength] = useState('');
  const [overlay, setOverlay] = useState(true);
  const adaptive = 'target' in snapshot ? snapshot : undefined;
  const current = adaptive
    ? poses.find(({ id }) => id === adaptive.target)
    : poses[snapshot.index];
  const provisional = error ? null : snapshot.provisional;
  const liveReport = provisional ?? snapshot.report;
  const captureActive = !error && phase === 'poses' && !snapshot.complete;
  const hasPreview = preview !== null;
  const estimates = snapshot.progressive.map((estimate) => {
    const { key } = estimate;
    const precision = estimate.cameraPrecision;
    const progress = precisionProgress(precision);
    const acquired = key !== 'torso' && progress?.acquired === true;
    const dependencies =
      key === 'outseam' ? undefined : measurementDependencies[key];
    const contributing =
      'status' in estimate
        ? adaptive?.evidence.some((item) => item.key === key && item.visible)
        : snapshot.held &&
          current &&
          dependencies &&
          (dependencies.requiredViews.includes(current.id) ||
            dependencies.optionalViews.includes(current.id));
    const active = Boolean(
      captureActive && hasPreview && contributing && !acquired,
    );
    return {
      estimate,
      active,
      acquired,
      fraction: progress?.acquired && !acquired ? 0.99 : progress?.fraction,
      durationMs: progress?.durationMs,
      uncertainty: precision?.uncertaintyCm,
    };
  });
  const focusedRegions = [
    ...new Set(
      estimates
        .filter(({ active }) => active)
        .map(({ estimate }) => anatomyForMeasurement[estimate.key]),
    ),
  ].join(' ');
  const acquiredKeys = estimates.flatMap(({ acquired, estimate }) =>
    acquired && estimate.key !== 'torso' ? [estimate.key] : [],
  );
  const acquisitionSignature = acquiredKeys.join(',');
  const acquisitionText =
    adaptive && hasPreview && !error
      ? snapshot.message
      : acquisitionMessage({
          phase,
          pose: current?.id,
          held: snapshot.held,
          complete: snapshot.complete,
          error,
          message: snapshot.message,
          status,
          hasPreview,
        });
  const acquisition = acquisitionProgress(
    acquiredKeys.map((key) => ({ key })),
    adaptive ? supportedMeasurements : undefined,
  );
  const allMeasurementsAcquired = acquisition.percent === 100;
  const completionMessage = allMeasurementsAcquired
    ? adaptive
      ? 'All available camera measurements acquired.'
      : 'All required measurements acquired. Thank you.'
    : 'Scan complete. Verify estimates and enter missing measurements manually.';
  const guidance = error
    ? 'Camera unavailable. Retry or enter measurements manually.'
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
      ? `${cameraEvidenceCount} of ${snapshot.progressive.length} estimates include camera evidence; others remain references or need data.`
      : phase === 'reference'
        ? 'Height-based population references · camera observations have not started.'
        : adaptive &&
            !adaptive.calibrated &&
            adaptive.evidence.some(({ observed }) => observed)
          ? 'Camera contours collected. A metric reference is needed for centimetres.'
          : 'Height-based population references · no camera evidence yet.';
  const armSides = liveReport.estimates.find(
    (estimate) => estimate.key === 'arm',
  )?.sidesCm;
  const armMismatch =
    !!armSides &&
    Math.abs(armSides.left - armSides.right) >= c.asymmetryNoticeCm;
  const lastAcquisitionPercent = useRef(0);
  const acceptedKeys = useRef(new Set<MeasurementKey>());
  const complete = snapshot.complete;
  useEffect(() => {
    if (phase !== 'poses' || error) return;
    const keys = acquisitionSignature
      ? (acquisitionSignature.split(',') as MeasurementKey[])
      : [];
    const newlyAcquired = keys.filter((key) => !acceptedKeys.current.has(key));
    acceptedKeys.current = new Set(keys);
    if (!newlyAcquired.length) return;

    const milestones = reachedAcquisitionMilestones(
      lastAcquisitionPercent.current,
      acquisition.percent,
    );
    lastAcquisitionPercent.current = Math.max(
      lastAcquisitionPercent.current,
      acquisition.percent,
    );
    const announcement = acquisitionAnnouncement({
      view: 'Camera',
      newlyAcquired,
      percent: acquisition.percent,
      milestones,
      complete,
    });
    announceAcquisition(`Measurement acquired. ${announcement}`);
  }, [
    acquisition.percent,
    acquisitionSignature,
    announceAcquisition,
    complete,
    error,
    phase,
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
    let priorProcessingAt: number | undefined;
    const localDiagnostics =
      multiView && process.env.NODE_ENV === 'development';
    let observationClient:
      ReturnType<typeof createObservationClient> | undefined;
    scan.current = useReference
      ? null
      : newScan(multiView, { kind: 'height', heightCm }, heightCm);

    function stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      releaseCamera(stream);
      engine?.close();
      observationClient?.close();
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
          const inferenceAt = localDiagnostics ? performance.now() : 0;
          const frame = await engine.infer(element);
          const geometryAt = localDiagnostics ? performance.now() : 0;
          if (stopped) return;
          setPreview({
            width: frame.width,
            height: frame.height,
            landmarks: frame.landmarks,
          });
          const currentScan = scan.current;
          const observation = observationClient
            ? await observationClient.observe(frame)
            : null;
          if (stopped) return;
          if (currentScan !== scan.current) {
            timer = setTimeout(tick, multiViewConfig.inferenceIntervalMs);
            return;
          }
          if (currentScan) {
            const next =
              currentScan instanceof MultiViewScan
                ? observation
                  ? currentScan.update(observation)
                  : currentScan.snapshot()
                : currentScan.update(frame);
            setStatus('Camera ready.');
            setSnapshot(next);
            if (localDiagnostics) {
              if (priorProcessingAt !== undefined)
                setTimings({
                  inferenceMs: geometryAt - inferenceAt,
                  geometryMs: performance.now() - geometryAt,
                  processingFps: 1000 / (inferenceAt - priorProcessingAt),
                });
              priorProcessingAt = inferenceAt;
            }
            if (next.complete) {
              setPreview(null);
              stop();
              return;
            }
          } else if (observation) {
            const anchorPixels = Object.fromEntries(
              observation.regions.map(({ anchor, anchorPixels }) => [
                anchor,
                anchorPixels,
              ]),
            );
            const suitable =
              observation.yaw !== null &&
              Math.abs(observation.yaw) <= c.viewToleranceDegrees &&
              observation.regions.length > 0;
            referenceFrame.current = suitable
              ? { anchorPixels, timestamp: frame.timestamp }
              : null;
            setCanFreeze(suitable);
            setStatus(
              observation.message ??
                (suitable
                  ? 'Reference frame ready to capture.'
                  : 'Face the camera with your torso or thighs and the reference object in view.'),
            );
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
        timer = setTimeout(
          tick,
          multiView ? multiViewConfig.inferenceIntervalMs : c.intervalMs,
        );
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
        if (multiView) observationClient = createObservationClient();
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
  }, [
    engineFactory,
    facing,
    heightCm,
    multiView,
    useReference,
    verifyCameraAccess,
  ]);

  function begin(calibration: Calibration) {
    scan.current = newScan(multiView, calibration, heightCm);
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
      anchorPixels: frame.anchorPixels,
    });
  }

  function applyReference() {
    const objectPixels = frozen ? ((lower - upper) / 100) * frozen.height : 0;
    const objectCm = Number(length);
    const anchorCm =
      frozen?.anchorPixels &&
      objectPixels >= c.minReferencePixels &&
      Number.isFinite(objectCm) &&
      objectCm > 0
        ? Object.fromEntries(
            Object.entries(frozen.anchorPixels).flatMap(([anchor, pixels]) => {
              const cm = (pixels / objectPixels) * objectCm;
              const fraction = cm / heightCm;
              return fraction >= 0.08 && fraction <= 0.55 ? [[anchor, cm]] : [];
            }),
          )
        : null;
    const calibrated =
      anchorCm && Object.keys(anchorCm).length
        ? { kind: 'reference' as const, heightCm, anchorCm }
        : frozen?.bodyPixels
          ? calibrateReference(
              heightCm,
              objectCm,
              frozen.bodyPixels,
              objectPixels,
            )
          : null;
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
    onReview(
      scan.current instanceof MultiViewScan
        ? scan.current.finish().report
        : snapshot.report,
    );
  }

  const ratio = preview ? preview.width / preview.height : null;
  return (
    <div className="live-scan">
      <div>
        {phase === 'poses' && !snapshot.complete && (
          <>
            {!adaptive && (
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
            )}
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
              focus={focusedRegions}
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
              upright beside you in the same plane as your body. Keep the camera
              level and in place throughout the scan.
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
            {adaptive && !!snapshot.report.estimates.length && (
              <button
                type="button"
                className="secondary-button"
                onClick={review}
              >
                Review measurements
              </button>
            )}
            <button type="button" className="text-button" onClick={review}>
              {measurementCopy.enterManually}
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
          {estimates.map(
            ({
              estimate,
              active,
              acquired,
              uncertainty,
              fraction,
              durationMs,
            }) => {
              const cameraValue =
                uncertainty === undefined ? undefined : estimate.cameraValueCm;
              const valueCm = cameraValue ?? estimate.valueCm;
              const state = acquired
                ? 'acquired'
                : active
                  ? uncertainty === undefined
                    ? 'measuring'
                    : 'refining'
                  : 'pending';
              const status = acquired
                ? 'Acquired'
                : active
                  ? uncertainty === undefined
                    ? 'Measuring'
                    : 'Refining'
                  : snapshot.complete && uncertainty !== undefined
                    ? 'Target not reached'
                    : snapshot.complete ||
                        ('status' in estimate &&
                          estimate.status === 'Insufficient Data')
                      ? 'Insufficient data'
                      : uncertainty !== undefined
                        ? 'Awaiting refinement'
                        : estimate.source === 'prior'
                          ? 'Population reference'
                          : 'Pending';
              const range =
                uncertainty ??
                (estimate.source === 'prior'
                  ? estimate.rangeHalfWidthCm
                  : null);
              return (
                <LiveEstimateCard
                  key={estimate.key}
                  label={progressiveLabels[estimate.key]}
                  state={state}
                  status={status}
                  source={
                    cameraValue === undefined ? estimate.source : 'camera'
                  }
                  value={valueCm === null ? null : Math.round(valueCm)}
                  range={range === null ? null : formatPrecision(range)}
                  fraction={fraction}
                  durationMs={durationMs}
                  active={active}
                  armMismatch={estimate.key === 'arm' && armMismatch}
                />
              );
            },
          )}
        </dl>
        {adaptive?.mesh && (
          <details className="live-estimates-about">
            <summary>View reconstructed torso</summary>
            <MeshPreview
              mesh={adaptive.mesh}
              label="Interactive torso surface interpolated between observed cross-sections."
            />
            <p>
              Observed cross-sections anchor this model. The surface between
              them is interpolated.
            </p>
          </details>
        )}
        {adaptive && process.env.NODE_ENV === 'development' && (
          <details className="live-estimates-about">
            <summary>Development diagnostics</summary>
            {timings && (
              <p>
                Latest frame · detector {timings.inferenceMs.toFixed(1)} ms ·
                geometry including worker transfer{' '}
                {timings.geometryMs.toFixed(1)} ms ·{' '}
                {timings.processingFps.toFixed(1)} processed frames per second
              </p>
            )}
            <p>
              {adaptive.calibrated
                ? 'Metric anchor established'
                : 'Relative observations only'}
            </p>
            <ul>
              {adaptive.evidence.map((item) => (
                <li key={item.key}>
                  {progressiveLabels[item.key]} · {item.informativeFrames}{' '}
                  frames · {item.angleBuckets} angles ·{' '}
                  {Math.round(item.coverage * 100)}% coverage ·{' '}
                  {item.visible ? 'visible' : 'out of view'}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="live-estimates-disclosure">
          Bars track camera repeatability against a ±{c.precision.targetCm} cm
          target. Population ranges show reference variation. Confirm all
          estimates with a tape before garment production.
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
              Population variation and camera repeatability ranges are
              uncalibrated. An acquired measurement reached the repeatability
              target with stable observations. The measurement engine is
              experimental and does not guarantee fit.
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
