import {validHeight} from './units';
export function pixelScale(heightCm:number,heightPixels:number):number|null{return validHeight(heightCm)&&Number.isFinite(heightPixels)&&heightPixels>1?heightCm/heightPixels:null;}
