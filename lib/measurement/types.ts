export const measurementKeys = ['height','shoulder','chest','waist','hip','sleeve','inseam','outseam'] as const;
export type MeasurementKey = typeof measurementKeys[number];
export type MeasurementEstimate = {key:MeasurementKey;valueCm:number;uncertaintyCm:number;confidence:'high'|'medium'|'low';method:string;warnings:string[]};
export type MeasurementReport = {estimates:MeasurementEstimate[];missing:Partial<Record<MeasurementKey,string>>};
export const labels:Record<MeasurementKey,string> = {height:'Height',shoulder:'Shoulder breadth',chest:'Chest circumference',waist:'Waist circumference',hip:'Hip circumference',sleeve:'Sleeve length',inseam:'Inseam',outseam:'Outseam'};
export type Unit = 'cm'|'in';
