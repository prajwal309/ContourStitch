import { featureNames, type BodyScanFeatures } from './types';
export const outputNames = [
  'chestCm',
  'waistCm',
  'hipCm',
  'shoulderCm',
  'inseamCm',
  'sleeveCm',
  'torsoCm',
  'neckCm',
] as const;
export type Prediction = Record<(typeof outputNames)[number], number>;
export type ModelMetadata = {
  version: string;
  featureNames: string[];
  outputNames: string[];
  outputUnits: 'cm';
  requiredCalibrationInputs: string[];
  trainingData: 'synthetic' | 'real';
  validated: boolean;
};
export type Preprocessing = {
  mean: number[];
  std: number[];
  targetMean: number[];
  targetStd: number[];
};
export function preprocess(
  features: BodyScanFeatures,
  p: Preprocessing,
): Float32Array {
  if (
    p.mean.length !== featureNames.length ||
    p.std.length !== featureNames.length
  )
    throw new Error('Invalid normalization dimensions');
  return Float32Array.from(
    featureNames.map((name, i) => {
      const value = features[name];
      if (
        value === null ||
        !Number.isFinite(value) ||
        !Number.isFinite(p.mean[i]) ||
        !Number.isFinite(p.std[i]) ||
        p.std[i] <= 0
      )
        throw new Error(`Missing or invalid feature: ${name}`);
      return (value - p.mean[i]) / p.std[i];
    }),
  );
}
export function mapOutputs(
  values: ArrayLike<number>,
  p: Preprocessing,
): Prediction {
  if (
    values.length !== outputNames.length ||
    p.targetMean.length !== outputNames.length ||
    p.targetStd.length !== outputNames.length
  )
    throw new Error('Invalid model output dimensions');
  const result = {} as Prediction;
  outputNames.forEach((name, i) => {
    const value = Number(values[i]) * p.targetStd[i] + p.targetMean[i];
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      !Number.isFinite(p.targetStd[i]) ||
      p.targetStd[i] <= 0
    )
      throw new Error('Invalid measurement prediction');
    result[name] = value;
  });
  return result;
}
/** Lazy, browser-only, same-origin inference. Synthetic weights require explicit development opt-in. */
export class MeasurementModel {
  private constructor(
    private session: import('onnxruntime-web').InferenceSession,
    private runtime: typeof import('onnxruntime-web'),
    private processing: Preprocessing,
  ) {}
  static async load({
    allowSynthetic = false,
  }: { allowSynthetic?: boolean } = {}) {
    const [metadataResponse, processingResponse] = await Promise.all([
      fetch('/models/model-metadata.json'),
      fetch('/models/preprocessing.json'),
    ]);
    if (!metadataResponse.ok || !processingResponse.ok)
      throw new Error(
        'No measurement model is installed. Geometric baseline remains available.',
      );
    const metadata: ModelMetadata = await metadataResponse.json(),
      processing: Preprocessing = await processingResponse.json();
    if (
      JSON.stringify(metadata.featureNames) !== JSON.stringify(featureNames) ||
      JSON.stringify(metadata.outputNames) !== JSON.stringify(outputNames) ||
      metadata.outputUnits !== 'cm' ||
      !metadata.requiredCalibrationInputs.includes('heightCm')
    )
      throw new Error('Incompatible measurement model contract');
    if (
      !metadata.validated &&
      !(allowSynthetic && process.env.NODE_ENV === 'development')
    )
      throw new Error(
        'This model has not been validated on held-out real subjects.',
      );
    if (
      metadata.trainingData === 'synthetic' &&
      !(allowSynthetic && process.env.NODE_ENV === 'development')
    )
      throw new Error('Synthetic weights are for development only.');
    const runtime = await import('onnxruntime-web');
    runtime.env.wasm.wasmPaths = '/models/onnx/';
    runtime.env.wasm.numThreads = 1;
    const session = await runtime.InferenceSession.create(
      '/models/contourstitch-video-measurement.onnx',
      { executionProviders: ['wasm'] },
    );
    if (
      session.inputNames.length !== 1 ||
      session.inputNames[0] !== 'features' ||
      session.outputNames[0] !== 'measurements'
    ) {
      await session.release();
      throw new Error('Unexpected ONNX input/output names');
    }
    return new MeasurementModel(session, runtime, processing);
  }
  async predict(features: BodyScanFeatures): Promise<Prediction> {
    const input = preprocess(features, this.processing);
    const result = await this.session.run({
      features: new this.runtime.Tensor('float32', input, [
        1,
        featureNames.length,
      ]),
    });
    return mapOutputs(
      result.measurements.data as Float32Array,
      this.processing,
    );
  }
  async dispose() {
    await this.session.release();
  }
}
