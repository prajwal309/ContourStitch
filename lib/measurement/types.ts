export const legacyMeasurementKeys = [
  'height',
  'shoulder',
  'chest',
  'waist',
  'hip',
  'sleeve',
  'inseam',
  'outseam',
] as const;
export const measurementKeys = [
  ...legacyMeasurementKeys,
  'arm',
  'neck',
] as const;
export const liveMeasurementKeys = [
  'shoulder',
  'arm',
  'chest',
  'sleeve',
  'neck',
  'waist',
  'hip',
] as const;
export type MeasurementKey = (typeof measurementKeys)[number];
export type MeasurementEstimate = {
  key: MeasurementKey;
  valueCm: number;
  uncertaintyCm: number | null;
  sidesCm?: { left: number; right: number };
  confidence: 'high' | 'medium' | 'low';
  method: string;
  warnings: string[];
};
export type MeasurementReport = {
  source?: 'live-video' | 'progressive-video';
  estimates: MeasurementEstimate[];
  missing: Partial<Record<MeasurementKey, string>>;
  originalEstimates?: MeasurementEstimate[];
};
export const labels: Record<MeasurementKey, string> = {
  height: 'Height',
  shoulder: 'Shoulder breadth',
  chest: 'Chest circumference',
  waist: 'Waist circumference',
  hip: 'Hip circumference',
  sleeve: 'Sleeve length',
  inseam: 'Inseam',
  outseam: 'Outseam',
  arm: 'Arm length',
  neck: 'Neck circumference',
};
export type Unit = 'cm' | 'in';
