'use client';
import { createContext,useContext,useState,type ReactNode } from 'react';
import type { MeasurementReport } from '@/lib/measurement/types';
const SessionContext=createContext<{report:MeasurementReport|null;setReport:(r:MeasurementReport|null)=>void}>({report:null,setReport:()=>{}});
export function SessionProvider({children}:{children:ReactNode}) {const [report,setReport]=useState<MeasurementReport|null>(null);return <SessionContext.Provider value={{report,setReport}}>{children}</SessionContext.Provider>;}
export const useSession=()=>useContext(SessionContext);
