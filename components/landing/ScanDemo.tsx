'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import dynamic from 'next/dynamic';
import { measurementsByStage } from './demo-data';
import { demoCycleSeconds, demoStages, getDemoFrame } from './demo-timeline';

const BodyMeshPreview = dynamic(
  () => import('./BodyMeshPreview').then((module) => module.BodyMeshPreview),
  {
    ssr: false,
    loading: () => (
      <div className="body-mesh-loading-state" role="status">
        Loading 3D preview...
      </div>
    ),
  },
);

const frameIntervalMs = 60;

export function ScanDemo() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timelineRef = useRef({ elapsedSeconds: 0 });

  useEffect(() => {
    let startTime: number | null = null;
    let lastUiUpdate = Number.NEGATIVE_INFINITY;
    let animationFrame = 0;

    const updateTimeline = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = ((timestamp - startTime) / 1000) % demoCycleSeconds;
      timelineRef.current.elapsedSeconds = elapsed;

      if (timestamp - lastUiUpdate >= frameIntervalMs) {
        setElapsedSeconds(elapsed);
        lastUiUpdate = timestamp;
      }

      animationFrame = requestAnimationFrame(updateTimeline);
    };

    animationFrame = requestAnimationFrame(updateTimeline);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const frame = getDemoFrame(elapsedSeconds);
  const stage = demoStages[frame.stageIndex];
  const measurements = measurementsByStage[frame.stage];

  return (
    <div className="landing-demo">
      <div className="demo-stage">
        <span className="demo-view-label">
          <ScanLine size={16} aria-hidden="true" /> 3D mannequin · {stage.title}
        </span>
        <BodyMeshPreview activeStage={frame.stage} timelineRef={timelineRef} />
      </div>
      <div className="demo-editor" data-stage={frame.stage}>
        <ol className="demo-progress" aria-label="Measurement demo progress">
          {demoStages.map(({ id, shortTitle }, index) => (
            <li
              key={id}
              className={index === frame.stageIndex ? 'is-active' : undefined}
              aria-current={index === frame.stageIndex ? 'step' : undefined}
            >
              <span className="demo-progress-marker">{index + 1}</span>
              <span>{shortTitle}</span>
            </li>
          ))}
        </ol>
        <div
          className="demo-progress-track"
          role="progressbar"
          aria-label="16-second demo cycle"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(
            (frame.elapsedSeconds / demoCycleSeconds) * 100,
          )}
        >
          <span
            className="demo-progress-fill"
            style={{
              width: `${(frame.elapsedSeconds / demoCycleSeconds) * 100}%`,
            }}
          />
        </div>

        <p className="demo-sample-label">Illustrative sample measurements</p>
        <h3 className="demo-stage-title" aria-live="polite">
          {stage.title}
        </h3>
        <p className="demo-description">
          {frame.stage === 'front'
            ? 'Front guides trace shoulder breadth, chest, waist and inseam.'
            : frame.stage === 'side'
              ? 'A quarter-turn reveals chest, waist and hip depth.'
              : frame.stage === 'review'
                ? 'Circumference rings wrap each contour as the sample estimates are reviewed.'
                : 'A sample Fit Passport gathers key measurements for a final check.'}
        </p>

        {frame.stage === 'results' ? (
          <section
            className="demo-passport"
            aria-label="Sample Digital Fit Passport"
          >
            <div className="demo-passport-heading">
              <span>Digital Fit Passport</span>
              <span className="demo-passport-badge">Sample</span>
            </div>
            <dl className="passport-readings">
              {measurements.map(({ label, value }, index) => {
                const reveal = Math.min(
                  1,
                  Math.max(0, (frame.secondsIntoStage - index * 0.22) / 0.85),
                );
                return (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {reveal > 0.08 ? Math.round(value * reveal) : '—'}
                      <span> cm</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ) : (
          <dl className="demo-readings" aria-label="Sample measurements">
            {measurements.map(({ label, value }, index) => {
              const reveal = Math.min(
                1,
                Math.max(0, (frame.secondsIntoStage - index * 0.28) / 0.9),
              );
              return (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {reveal > 0.08 ? Math.round(value * reveal) : '—'}
                    <span> cm</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        <p className="demo-disclaimer">Demo</p>
      </div>
    </div>
  );
}
