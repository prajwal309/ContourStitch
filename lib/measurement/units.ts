export const inchesToCm = (inches:number) => inches * 2.54;
export const cmToInches = (cm:number) => cm / 2.54;
export const validHeight = (cm:number) => Number.isFinite(cm) && cm >= 100 && cm <= 230;
export const displayValue = (cm:number,unit:'cm'|'in') => unit === 'cm' ? Math.round(cm) : Math.round(cmToInches(cm)*2)/2;
