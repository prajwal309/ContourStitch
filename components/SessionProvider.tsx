'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MeasurementReport, Unit } from '@/lib/measurement/types';

const SessionContext = createContext<{
  report: MeasurementReport | null;
  setReport: (report: MeasurementReport | null) => void;
  unit: Unit;
  setUnit: (unit: Unit) => void;
}>({ report: null, setReport: () => {}, unit: 'cm', setUnit: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<MeasurementReport | null>(null);
  const [unit, setUnit] = useState<Unit>('cm');
  return (
    <SessionContext.Provider value={{ report, setReport, unit, setUnit }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
