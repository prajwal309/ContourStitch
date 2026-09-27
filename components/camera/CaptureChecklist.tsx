import {Check,Minus} from 'lucide-react';
import type {Check as QualityCheck} from '@/lib/vision/types';
export function CaptureChecklist({checks}:{checks:QualityCheck[]}){return <ul className="capture-checklist" aria-label="Live capture checklist">{checks.map(check=><li key={check.key}>{check.passed?<Check size={15} aria-label="Ready"/>:<Minus size={15} aria-label="Adjust"/>}<span>{check.label}</span></li>)}</ul>;}
