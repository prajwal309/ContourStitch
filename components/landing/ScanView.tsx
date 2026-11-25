import Image from 'next/image';
import type { CSSProperties } from 'react';

export function ScanView({ hero = false }: { hero?: boolean }) {
  return (
    <div
      className={`scan-figure scan-figure--side${hero ? ' scan-figure--hero' : ''}`}
    >
      <Image
        src="/editorial/fit-scan-side.webp"
        alt="Side view showing chest, waist and hip contour depths"
        width={690}
        height={920}
        sizes={
          hero
            ? '(max-width: 699px) 54vw, (max-width: 1100px) 27vw, 350px'
            : '(max-width: 699px) min(65vw, 272px), 336px'
        }
        loading={hero ? 'eager' : 'lazy'}
        fetchPriority={hero ? 'high' : undefined}
      />
      <div className="scan-contour" aria-hidden="true" />
      <div className="scan-frame" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="scan-annotations" aria-hidden="true">
        {[
          ['Chest depth', 27.1, 42.4, 58],
          ['Waist depth', 37.7, 43.8, 56],
          ['Hip depth', 46.8, 44.2, 60.7],
        ].map(([label, y, left, right]) => (
          <div
            className="scan-rule"
            key={label}
            style={
              {
                top: `${y}%`,
                '--rule-left': `${left}%`,
                '--rule-right': `${right}%`,
              } as CSSProperties
            }
          >
            <span className="scan-rule-body" />
            <span className="scan-rule-label">{label}</span>
          </div>
        ))}
        {[
          [48.2, 9.5],
          [53.7, 22],
          [53, 35.8],
          [46.6, 48.4],
          [53.4, 46.7],
          [53.7, 68.6],
          [55, 88.4],
        ].map(([x, y]) => (
          <span
            className="scan-landmark"
            key={`${x}-${y}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        ))}
      </div>
    </div>
  );
}
