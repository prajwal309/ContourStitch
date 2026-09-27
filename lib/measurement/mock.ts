import { measurementKeys, type MeasurementReport } from './types';
// Deterministic development fixture. Never selected by the production flow.
export function mockReport(height=170):MeasurementReport {const values=[height,40,94,78,98,58,77,99];return {estimates:measurementKeys.map((key,i)=>({key,valueCm:values[i],uncertaintyCm:i===0?1:6,confidence:'low',method:'Development fixture',warnings:['Confirm with a tape before garment production.']})),missing:{}};}
