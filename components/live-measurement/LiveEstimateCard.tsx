import { memo, type CSSProperties } from 'react';
import type { ProgressiveSource } from '@/lib/live-measurement/progressive';

type Props = {
  label: string;
  state: 'pending' | 'measuring' | 'refining' | 'acquired';
  status: string;
  source: ProgressiveSource;
  value: number | null;
  range: string | null;
  fraction?: number;
  durationMs?: number;
  active: boolean;
  armMismatch: boolean;
};

const sources: Record<ProgressiveSource, string> = {
  prior: 'Height-based population reference',
  blended: 'Population reference refined with camera evidence',
  camera: 'Camera-supported estimate',
  unavailable: 'No supported estimate yet',
};

export const LiveEstimateCard = memo(function LiveEstimateCard({
  label,
  state,
  status,
  source,
  value,
  range,
  fraction,
  durationMs,
  active,
  armMismatch,
}: Props) {
  const sourceLabel = armMismatch
    ? `${sources[source]}. Verify both arm sides with a tape.`
    : sources[source];
  const showSourceMarker = source !== 'prior' || armMismatch;
  const rangeKind =
    fraction === undefined ? 'population variation' : 'camera repeatability';
  const rangeLabel = range
    ? `Approximately plus or minus ${range} centimetres; ${rangeKind}. This is not a validated personal accuracy range.`
    : undefined;
  return (
    <div className={`live-estimate is-${state}${active ? ' is-active' : ''}`}>
      <dt>
        <span className="live-estimate-name">{label}</span>
        {state === 'acquired' ? (
          <span
            className="live-acquired-check"
            role="img"
            aria-label="Camera measurement acquired"
            title="Camera measurement acquired"
          >
            ✓
          </span>
        ) : (
          <span
            className={`live-source-indicator${showSourceMarker ? ` source-${source}` : ' is-empty'}${armMismatch ? ' is-warning' : ''}`}
            title={showSourceMarker ? sourceLabel : undefined}
            aria-label={showSourceMarker ? sourceLabel : undefined}
            role={showSourceMarker ? 'img' : undefined}
          />
        )}
        <span className="live-estimate-accessible-state">
          {status}. {sourceLabel}
        </span>
      </dt>
      <dd
        className={`live-measurement-value${value === null ? ' is-estimating' : ''}`}
      >
        {value === null ? (
          '—'
        ) : (
          <>
            <span>{value}</span>
            <span className="live-measurement-unit">cm</span>
          </>
        )}
      </dd>
      <dd className="live-precision">
        <span
          className="live-uncertainty"
          aria-label={rangeLabel}
          title={rangeLabel}
        >
          {range === null ? '—' : `±${range} cm`}
          {range !== null && fraction === undefined && (
            <span className="live-range-kind">pop.</span>
          )}
        </span>
        <span
          className="live-precision-track"
          role={fraction === undefined ? undefined : 'progressbar'}
          aria-hidden={fraction === undefined ? true : undefined}
          aria-label={fraction === undefined ? undefined : `${label} precision`}
          aria-valuenow={
            fraction === undefined ? undefined : Math.round(100 * fraction)
          }
          aria-valuetext={
            fraction === undefined
              ? undefined
              : `${status}, ±${range} centimetres camera repeatability`
          }
        >
          <span
            className="live-precision-fill"
            style={
              {
                '--precision-progress': fraction ?? 0,
                '--precision-duration': `${durationMs ?? 0}ms`,
              } as CSSProperties
            }
          />
        </span>
      </dd>
    </div>
  );
});
