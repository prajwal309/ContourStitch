export type DemoMeasurement = {
  label: string;
  value: number;
};

export const demoMeasurements = [
  { label: 'Shoulder breadth', value: 39, stage: 0 },
  { label: 'Chest circumference', value: 90, stage: 1 },
  { label: 'Waist circumference', value: 73, stage: 1 },
  { label: 'Hip circumference', value: 97, stage: 1 },
  { label: 'Sleeve length', value: 58, stage: 2 },
] as const;

export const measurementsByStage: Record<
  'front' | 'side' | 'review' | 'results',
  DemoMeasurement[]
> = {
  front: [
    demoMeasurements[0],
    demoMeasurements[1],
    demoMeasurements[2],
    { label: 'Inseam', value: 79 },
  ],
  side: [
    { label: 'Chest depth', value: 27 },
    { label: 'Waist depth', value: 22 },
    { label: 'Hip depth', value: 25 },
  ],
  review: [...demoMeasurements.slice(1, 4)],
  results: [{ label: 'Height', value: 180 }, ...demoMeasurements.slice(0, 4)],
};
