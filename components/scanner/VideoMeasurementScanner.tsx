'use client';
import { useEffect, useRef, useState } from 'react';
import { requestCamera, releaseCamera, cameraError } from '@/lib/camera/media';
import { createScannerVisionEngine } from '@/lib/scanner/vision';
import type { VisionEngine, VisionFrame } from '@/lib/vision/types';
import { Scanner } from '@/lib/scanner/scanner';
import { scanConfig } from '@/lib/scanner/config';
import { instructions } from '@/lib/scanner/instructions';
import { geometryBaseline } from '@/lib/scanner/features';
import type { ScanSnapshot } from '@/lib/scanner/types';
import { BodyGuide } from '@/components/camera/BodyGuide';
import { PoseOverlay } from '@/components/camera/PoseOverlay';
import type { Prediction } from '@/lib/scanner/measurementModel';
import { samplingLevels } from '@/lib/measurement/landmarks';
export function VideoMeasurementScanner({
  heightCm,
  onClose,
  engineFactory = createScannerVisionEngine,
}: {
  heightCm: number;
  onClose: () => void;
  engineFactory?: () => Promise<VisionEngine>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [frame, setFrame] = useState<VisionFrame | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(
    'Preparing the private on-device scanner…',
  );
  const [debug, setDebug] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [modelStatus, setModelStatus] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function runModel() {
    if (!snapshot?.result) return;
    setModelStatus('Loading development model…');
    let model:
      import('@/lib/scanner/measurementModel').MeasurementModel | undefined;
    try {
      const { MeasurementModel } =
        await import('@/lib/scanner/measurementModel');
      model = await MeasurementModel.load({ allowSynthetic: true });
      const value = await model.predict(snapshot.result.features);
      if (alive.current) {
        setPrediction(value);
        setModelStatus(
          'Development prediction only. Synthetic training cannot establish accuracy.',
        );
      }
    } catch (e) {
      if (alive.current)
        setModelStatus(e instanceof Error ? e.message : 'Model unavailable');
    } finally {
      await model?.dispose();
    }
  }
  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let engine: VisionEngine | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scanner = new Scanner({ type: 'KNOWN_HEIGHT', heightCm });
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      releaseCamera(stream);
      engine?.close();
      if (video.current) video.current.srcObject = null;
    };
    const interrupt = () => {
      stop();
      setFrame(null);
      setError(
        'Camera paused. Restart the scan after returning to this page or rotating your device.',
      );
    };
    const hidden = () => {
      if (document.hidden) interrupt();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', stop);
    window.addEventListener('orientationchange', interrupt);
    async function start() {
      try {
        stream = await requestCamera(facing);
        if (stopped) {
          releaseCamera(stream);
          return;
        }
        const element = video.current;
        if (!element) throw new Error('Preview missing');
        element.srcObject = stream;
        await element.play();
        if (stopped) return;
        engine = await engineFactory();
        if (stopped) {
          engine.close();
          return;
        }
        setDebug(
          process.env.NODE_ENV === 'development' &&
            new URLSearchParams(window.location.search).get('debug') === '1',
        );
        setStatus('Keep your whole body inside the guide.');
        async function tick() {
          if (stopped || !engine) return;
          try {
            if (element && element.readyState >= 2 && element.videoWidth) {
              const nextFrame = await engine.infer(element);
              if (stopped) return;
              const next = scanner.update(nextFrame);
              setSnapshot({ ...next });
              setFrame({ ...nextFrame, mask: null });
              if (next.state === 'COMPLETE' || next.state === 'ERROR') {
                stop();
                setFrame(null);
                return;
              }
            }
            timer = setTimeout(tick, scanConfig.intervalMs);
          } catch (e) {
            stop();
            setFrame(null);
            setError(cameraError(e));
          }
        }
        void tick();
      } catch (e) {
        stop();
        if (video.current) {
          setFrame(null);
          setError(cameraError(e));
        }
      }
    }
    void start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('orientationchange', interrupt);
    };
  }, [facing, attempt, heightCm, engineFactory]);
  function restart() {
    setPrediction(null);
    setModelStatus('');
    setError('');
    setSnapshot(null);
    setFrame(null);
    setStatus('Preparing the private on-device scanner…');
    setAttempt((v) => v + 1);
  }
  const result = snapshot?.result;
  const levels = frame ? samplingLevels(frame) : null;
  return (
    <div>
      {!result && (
        <>
          <div
            className="camera-preview"
            style={{
              aspectRatio: frame ? `${frame.width}/${frame.height}` : '3/4',
            }}
          >
            <div
              className={
                facing === 'user' ? 'camera-source mirrored' : 'camera-source'
              }
            >
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                aria-label="Guided video scan preview"
              />
              {debug && frame && (
                <>
                  <PoseOverlay
                    landmarks={frame.landmarks}
                    width={frame.width}
                    height={frame.height}
                  />
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="scan-debug-overlay"
                  >
                    {levels &&
                      (['chest', 'waist', 'hip'] as const).map((key) => (
                        <g key={key}>
                          <line
                            x1="10"
                            x2="90"
                            y1={levels[key] * 100}
                            y2={levels[key] * 100}
                            stroke="var(--camera-detail)"
                            strokeWidth=".3"
                          />
                          <text
                            x="10"
                            y={levels[key] * 100 - 1}
                            fill="var(--camera-detail)"
                            fontSize="3"
                          >
                            {key}
                          </text>
                        </g>
                      ))}
                    {snapshot?.analysis?.bounds && (
                      <rect
                        x={snapshot.analysis.bounds.left * 100}
                        y={snapshot.analysis.bounds.top * 100}
                        width={
                          (snapshot.analysis.bounds.right -
                            snapshot.analysis.bounds.left) *
                          100
                        }
                        height={
                          (snapshot.analysis.bounds.bottom -
                            snapshot.analysis.bounds.top) *
                          100
                        }
                        fill="none"
                        stroke="var(--camera-guide)"
                        strokeWidth=".4"
                      />
                    )}
                    <line
                      x1="50"
                      x2="50"
                      y1="0"
                      y2="100"
                      stroke="var(--camera-guide)"
                      strokeWidth=".2"
                    />
                  </svg>
                </>
              )}
            </div>
            <BodyGuide
              side={snapshot?.analysis?.orientation?.includes('SIDE')}
            />
          </div>
          <p role="status" className="scan-instruction">
            {snapshot ? instructions[snapshot.instruction] : status}
          </p>
          <progress
            value={snapshot?.progress ?? 0}
            max={100}
            aria-label="Rotation scan progress"
          />
          <p className="muted">
            {snapshot?.progress ?? 0}% · Rotation coverage is approximate. Pause
            briefly at each side and at the back.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {debug && snapshot && (
            <pre className="scan-debug">
              {JSON.stringify({ ...snapshot, result: undefined }, null, 2)}
            </pre>
          )}
          <button
            className="secondary-button"
            onClick={() => {
              restart();
              setFacing((v) => (v === 'environment' ? 'user' : 'environment'));
            }}
          >
            Switch camera · {facing === 'environment' ? 'rear' : 'front'}
          </button>
        </>
      )}
      {result && (
        <div>
          <h2>Scan complete</h2>
          <p>
            The camera is off. These geometric estimates are experimental;
            confirm with a tape before making garments. Confidence intervals are
            unavailable until real calibration data exists.
          </p>
          <dl className="scan-results">
            {Object.entries(geometryBaseline(result.features)).map(
              ([key, value]) => (
                <div key={key}>
                  <dt>
                    {key
                      .replace('Cm', '')
                      .replace(/^[a-z]/, (v) => v.toUpperCase())}
                  </dt>
                  <dd>
                    {value === null
                      ? 'Unavailable — use a tape'
                      : `${Math.round(value)} cm`}
                  </dd>
                </div>
              ),
            )}
          </dl>
          <p>
            Scan quality: {Math.round(result.quality.overall * 100)}% (capture
            heuristic, not measurement accuracy).
          </p>
          <ul>
            {result.quality.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {debug && (
            <details open>
              <summary>Extracted scan features</summary>
              <button
                className="secondary-button"
                onClick={() => void runModel()}
              >
                Test optional ONNX model
              </button>
              <p role="status">{modelStatus}</p>
              {prediction && (
                <pre className="scan-debug">
                  {JSON.stringify(prediction, null, 2)}
                </pre>
              )}
              <pre className="scan-debug">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
      <div className="scan-actions">
        <button className="button" onClick={restart}>
          Restart scan
        </button>
        <button className="text-button" onClick={onClose}>
          Close scanner
        </button>
      </div>
    </div>
  );
}
