import { ellipseCircumference } from '@/lib/measurement/circumference';
import { median } from '@/lib/measurement/silhouette';
import type {
  MeasurementEstimate,
  MeasurementReport,
} from '@/lib/measurement/types';
import {
  anthropometricPrior,
  progressiveMeasurementKeys,
} from '../anthropometric-priors';
import type { Calibration } from '../calibration';
import type { GuidedScan } from '../session';
import { liveConfig } from '../config';
import { precisionProgress } from '../precision';
import { multiViewConfig as c } from './config';
import {
  angularCoefficient,
  fitSection,
  Keyframes,
  robustPaths,
  type ViewEvidence,
} from './fusion';
import { torsoMesh } from './mesh';
import {
  paths,
  sections,
  type Anchor,
  type FrameObservation,
  type RegionObservation,
  type Section,
} from './observe';
import {
  planNextObservation,
  type EvidenceKey,
  type EvidenceStatus,
} from './planner';

type Snapshot = ReturnType<GuidedScan['snapshot']>;
type Estimate = Snapshot['progressive'][number];
export type MultiViewEstimate = Omit<Estimate, 'key'> & {
  key: Estimate['key'] | 'outseam';
  status: 'Estimating' | 'Refining' | 'Acquired' | 'Insufficient Data';
  priorWeight: 0 | 1;
};

export type MultiViewSnapshot = Omit<Snapshot, 'progressive'> & {
  progressive: MultiViewEstimate[];
  target: ReturnType<typeof planNextObservation>['target'];
  calibrated: boolean;
  evidence: EvidenceStatus[];
  mesh: ReturnType<typeof torsoMesh>;
};

type WidthFit = NonNullable<ReturnType<typeof fitSection>> & { anchor: Anchor };
const anchors = ['torso', 'thigh'] as const;
export const supportedMeasurements = [
  'shoulder',
  'arm',
  'chest',
  'sleeve',
  'neck',
  'waist',
  'hip',
  'outseam',
] as const;
export const multiViewKeys = [
  ...progressiveMeasurementKeys,
  'outseam',
] as const;
const descriptions: Record<EvidenceKey, string> = {
  shoulder: 'Near-frontal shoulder-joint distance proxy',
  chest: 'Multi-angle torso cross-section ellipse at chest level',
  waist: 'Multi-angle torso cross-section ellipse at waist level',
  hip: 'Multi-angle torso cross-section ellipse at hip level',
  neck: 'Multi-angle silhouette cross-section ellipse below the ears',
  arm: 'Bilateral straight shoulder-to-wrist distance with extended arms',
  sleeve: 'Bilateral projected shoulder-to-wrist path via the elbow',
  torso: 'Vertical shoulder-to-hip landmark distance',
  outseam:
    'Average bilateral hip-to-ankle landmark path via the knee, an outseam proxy',
};

type Geometry = {
  cm: number | null;
  relative: boolean;
  sides?: { left: number; right: number };
  stable: boolean;
  metric: boolean;
  errorProxy: number | null;
  views: ViewEvidence[];
  coverage: number;
  angularDiversity: number;
};

function goodViews(views: readonly ViewEvidence[]) {
  return views.filter(
    ({ count, spread }) =>
      count >= c.minimumFrames && spread <= c.repeatability,
  );
}

function countFrames(views: readonly ViewEvidence[]) {
  return views.reduce((total, { count }) => total + count, 0);
}

function emptyGeometry(views: ViewEvidence[]): Geometry {
  return {
    cm: null,
    relative: false,
    stable: false,
    metric: false,
    views,
    coverage: 0,
    angularDiversity: 0,
    errorProxy: null,
  };
}

export class MultiViewScan {
  private readonly references = {
    torso: new Keyframes(),
    thigh: new Keyframes(),
  };
  private readonly measurements = {
    torso: new Map<EvidenceKey, Keyframes>(),
    thigh: new Map<EvidenceKey, Keyframes>(),
  };
  private lastFrame: FrameObservation = {
    timestamp: -1,
    yaw: null,
    regions: [],
  };
  private lastYaw: FrameObservation | null = null;
  private latest: MultiViewSnapshot;

  constructor(
    private readonly calibration: Calibration,
    private readonly priorHeightCm = calibration.heightCm,
    private readonly options: {
      fullBodyOnly?: boolean;
      displayPriors?: boolean;
      frontSideOnly?: boolean;
    } = {},
  ) {
    this.latest = this.build(false);
  }

  snapshot() {
    return this.latest;
  }

  update(frame: FrameObservation) {
    if (this.latest.complete || frame.timestamp <= this.lastFrame.timestamp)
      return this.latest;
    this.lastFrame = frame;
    const { yaw } = frame;
    if (yaw !== null) {
      const prior = this.lastYaw;
      this.lastYaw = frame;
      const motion =
        prior?.yaw === null || !prior ? 0 : Math.abs(yaw - prior.yaw);
      const turning =
        prior &&
        frame.timestamp - prior.timestamp < c.keyframeIntervalMs * 2 &&
        Math.min(motion, 360 - motion) > c.fastTurnDegrees;
      if (!turning) {
        for (const region of frame.regions)
          this.collect(yaw, region, frame.timestamp);
      }
    }
    this.latest = this.build(false);
    return this.latest;
  }

  finish() {
    this.latest = this.build(true);
    return this.latest;
  }

  private collect(angle: number, region: RegionObservation, timestamp: number) {
    if (this.options.fullBodyOnly && !region.statureRatio) return;
    if (this.options.frontSideOnly) {
      const weight = angularCoefficient(angle);
      if (weight < 0.95 && weight > 0.05) return;
    }
    const { anchor, quality, statureRatio } = region;
    if (statureRatio)
      this.references[anchor].add(angle, {
        values: [statureRatio],
        quality,
        timestamp,
      });

    for (const key of [...sections, ...paths]) {
      const width = region.widths[key as Section];
      const values = width
        ? [width]
        : region.paths[key as keyof typeof region.paths];
      if (!values?.length) continue;
      const byKey = this.measurements[anchor];
      let keyframes = byKey.get(key);
      if (!keyframes) {
        keyframes = new Keyframes();
        byKey.set(key, keyframes);
      }
      keyframes.add(angle, { values, quality, timestamp });
    }
  }

  private build(finished: boolean): MultiViewSnapshot {
    const metric = Object.fromEntries(
      anchors.map((anchor) => {
        const manual = this.calibration.anchorCm?.[anchor];
        const views = this.references[anchor].summarize();
        const fit = robustPaths(views);
        return [
          anchor,
          manual ??
            (fit?.acquired ? fit.values[0] * this.calibration.heightCm : null),
        ];
      }),
    ) as Record<Anchor, number | null>;
    const widthDimensions: Partial<
      Record<Section, { width: number; depth: number }>
    > = {};
    const sectionAngles: Partial<
      Record<Section, { front: number; side: number }>
    > = {};
    const measurements = new Map<EvidenceKey, Geometry>();
    const status: EvidenceStatus[] = [];

    const entries = (key: EvidenceKey, anchor: Anchor) =>
      this.measurements[anchor].get(key)?.summarize() ?? [];
    const add = (key: EvidenceKey, geometry: Geometry) => {
      measurements.set(key, geometry);
      status.push({
        key,
        acquired: geometry.cm !== null && geometry.stable,
        visible: this.lastFrame.regions.some(
          (region) =>
            region.widths[key as Section] !== undefined ||
            region.paths[key as keyof typeof region.paths] !== undefined,
        ),
        metric: geometry.metric,
        informativeFrames: countFrames(geometry.views),
        angleBuckets: geometry.views.length,
        coverage: geometry.coverage,
        angularDiversity: geometry.angularDiversity,
        repeatability: geometry.errorProxy,
        observed: geometry.views.length > 0,
      });
    };

    for (const section of sections) {
      const measurementsByAnchor = anchors.map((anchor) => ({
        anchor,
        views: entries(section, anchor),
      }));
      const fits = measurementsByAnchor.flatMap(({ anchor, views }) => {
        const fit = fitSection(views);
        return fit ? [{ ...fit, anchor }] : [];
      });
      const rank = (fit: WidthFit) =>
        (metric[fit.anchor] ? 4 : 0) +
        Number(fit.acquired) * 2 +
        fit.angularSpan +
        fit.views.length * 0.01;
      const fit = fits.sort((a, b) => rank(b) - rank(a))[0];
      const available = measurementsByAnchor.reduce((best, item) =>
        item.views.length > best.views.length ? item : best,
      );
      const views = fit?.views ?? available.views;
      const anchorCm = metric[fit?.anchor ?? available.anchor];
      const coverage = (view: ViewEvidence) =>
        Math.min(1, view.count / c.minimumFrames) *
        (view.spread <= c.repeatability ? 1 : 0.3);
      const front = Math.max(
        0,
        ...views.map((view) => coverage(view) * angularCoefficient(view.angle)),
      );
      const side = Math.max(
        0,
        ...views.map(
          (view) => coverage(view) * (1 - angularCoefficient(view.angle)),
        ),
      );
      sectionAngles[section] = { front, side };
      const circumference =
        fit &&
        anchorCm &&
        ellipseCircumference(fit.width * anchorCm, fit.depth * anchorCm);
      const cm =
        circumference && circumference <= c.maximumWorkingDimensionCm
          ? circumference
          : null;
      if (fit && anchorCm && cm)
        widthDimensions[section] = {
          width: fit.width * anchorCm,
          depth: fit.depth * anchorCm,
        };
      add(section, {
        cm,
        relative: !!fit && !anchorCm,
        stable: !!fit?.acquired,
        metric: anchorCm !== null,
        views,
        errorProxy: fit?.repeatability ?? null,
        coverage: Math.min(1, (front + side) / 2),
        angularDiversity: fit?.angularSpan ?? 0,
      });
    }

    for (const key of paths) {
      const anchor = key === 'outseam' ? 'thigh' : 'torso';
      const views = entries(key, anchor);
      const fit = robustPaths(views);
      const anchorCm = metric[anchor];
      if (!fit) {
        add(key, { ...emptyGeometry(views), metric: anchorCm !== null });
        continue;
      }
      const values = anchorCm
        ? fit.values.map((value) => value * anchorCm)
        : [];
      const sides =
        values.length === 2 && key !== 'outseam'
          ? { left: values[0], right: values[1] }
          : undefined;
      const mean = values.reduce(
        (sum, value) => sum + value / values.length,
        0,
      );
      add(key, {
        cm: mean > 0 && mean <= c.maximumWorkingDimensionCm ? mean : null,
        relative: !anchorCm,
        stable: fit.acquired,
        metric: anchorCm !== null,
        sides,
        views: fit.views,
        errorProxy: fit.repeatability,
        coverage: goodViews(fit.views).length
          ? 1
          : Math.min(
              1,
              Math.max(...fit.views.map(({ count }) => count)) /
                c.minimumFrames,
            ),
        angularDiversity: 0,
      });
    }

    const report: MeasurementReport = {
      source: 'progressive-video',
      estimates: [],
      missing: {},
    };
    for (const key of supportedMeasurements) {
      const measurement = measurements.get(key)!;
      if (!measurement.stable || measurement.cm === null) {
        report.missing[key] =
          'Camera evidence was insufficient. Enter this measurement manually.';
        continue;
      }
      const estimate: MeasurementEstimate = {
        key,
        valueCm: measurement.cm,
        ...(measurement.sides && { sidesCm: measurement.sides }),
        method: `${descriptions[key]} · ${this.calibration.kind === 'reference' ? 'known-size reference or stature anchor' : 'stature anchor'}`,
        confidence: 'low',
        uncertaintyCm: null,
        warnings: [
          'Experimental geometry. Confirm with a tape before garment production.',
        ],
      };
      report.estimates.push(estimate);
    }

    const complete =
      finished || report.estimates.length === supportedMeasurements.length;
    const progressive: MultiViewEstimate[] = multiViewKeys.map((key) => {
      const evidence = status.find((item) => item.key === key);
      const measurement = key === 'inseam' ? undefined : measurements.get(key);
      const cameraValue = measurement?.cm ?? null;
      const prior =
        this.options.displayPriors !== false &&
        !complete &&
        key !== 'outseam' &&
        cameraValue === null
          ? anthropometricPrior(key, this.priorHeightCm)
          : null;
      const cameraCount = evidence?.informativeFrames ?? 0;
      const recent =
        measurement?.views.filter(
          ({ recentCount }) =>
            (recentCount ?? 0) >= liveConfig.precision.stableObservations,
        ) ?? [];
      const coefficients = recent.map(({ angle }) => angularCoefficient(angle));
      const enoughRecent = sections.some((section) => section === key)
        ? coefficients.length >= 2 &&
          Math.max(...coefficients) - Math.min(...coefficients) >=
            c.minimumAngularSpan
        : recent.length > 0;
      const cameraPrecision =
        cameraValue !== null &&
        measurement?.errorProxy != null &&
        measurement.views.every(({ count }) => count >= 2)
          ? {
              uncertaintyCm:
                cameraValue *
                Math.max(
                  0.02,
                  measurement.errorProxy,
                  ...measurement.views.map(
                    ({ recentSpread }) => recentSpread ?? 0,
                  ),
                ),
              stable: measurement.stable && enoughRecent,
            }
          : undefined;

      return {
        key,
        ...(cameraPrecision && { cameraPrecision }),
        status:
          key !== 'torso' && precisionProgress(cameraPrecision)?.acquired
            ? 'Acquired'
            : (complete && cameraValue === null) || key === 'inseam'
              ? 'Insufficient Data'
              : cameraValue !== null || measurement?.relative || cameraCount > 0
                ? 'Refining'
                : 'Estimating',
        valueCm: cameraValue ?? prior?.valueCm ?? null,
        ...(cameraValue !== null && { cameraValueCm: cameraValue }),
        ...(prior && { priorValueCm: prior.valueCm }),
        priorWeight: prior ? 1 : 0,
        rangeHalfWidthCm:
          cameraValue !== null && measurement?.errorProxy != null
            ? cameraValue * Math.max(0.02, measurement.errorProxy)
            : (prior?.range95HalfWidthCm ?? null),
        source:
          cameraValue !== null ? 'camera' : prior ? 'prior' : 'unavailable',
        quality:
          median(measurement?.views.map(({ quality }) => quality) ?? []) ?? 0,
        viewCoverage: evidence?.coverage ?? 0,
        observedViews: evidence?.angleBuckets ?? 0,
        requiredViews: sections.some((section) => section === key)
          ? 2
          : key === 'inseam'
            ? 0
            : 1,
        sampleCount: cameraCount,
      };
    });

    for (const key of sections)
      if (status.find((item) => item.key === key)?.acquired)
        delete sectionAngles[key];
    const calibrated = Object.values(metric).some((value) => value !== null);
    const plan = planNextObservation(
      this.lastFrame,
      status,
      sectionAngles,
      calibrated,
    );
    return {
      ...plan,
      message: complete ? 'Measurement acquisition complete.' : plan.message,
      calibrated,
      evidence: status,
      index: report.estimates.length,
      complete,
      held: !complete && this.lastFrame.regions.length > 0,
      provisional: null,
      report,
      progressive,
      mesh: metric.torso ? torsoMesh(metric.torso, widthDimensions) : undefined,
    };
  }
}
