import type {Capture} from '@/lib/vision/types';
import {maskBounds} from '@/lib/vision/segmentation';
import {config} from './config';
import {pixelScale} from './scale';
import {ellipseCircumference} from './circumference';
import {landmarkPath,samplingLevels,usable} from './landmarks';
import {robustWidth,crotchRow,median} from './silhouette';
import {uncertainty} from './uncertainty';
import {measurementKeys,type MeasurementKey,type MeasurementReport} from './types';
function scaleFor(capture:Capture,height:number){const mask=capture.mask,bounds=maskBounds(mask);if(!mask||!bounds||capture.poseCount!==1||![0,27,28,31,32].every(i=>usable(capture.landmarks[i])))return null;if(bounds.top/mask.height<=config.frameMargin||bounds.bottom/mask.height>=1-config.frameMargin)return null;return pixelScale(height,bounds.height*capture.height/mask.height);}
/** Pure typed boundary: takes copied, unmirrored vision evidence, never DOM or photos. */
export function estimateMeasurements(height:number,front:Capture,side:Capture):MeasurementReport{const report:MeasurementReport={estimates:[],missing:{}};const fs=scaleFor(front,height),ss=scaleFor(side,height);const difference=fs&&ss?Math.abs(fs-ss)/Math.max(fs,ss):1;
function add(key:MeasurementKey,value:number|null,method:string,views:Capture[]=[front]){if(value===null||!Number.isFinite(value)||value<=0){report.missing[key]='Required landmarks or a reliable silhouette were missing. Enter a tape measurement.';return;}report.estimates.push({key,valueCm:value,method,...uncertainty(key,views.map(v=>v.quality),views.length>1?difference:0)});}
add('height',pixelScale(height,100)?height:null,'Height supplied by you',[]);
function path(indices:number[]){const pixels=landmarkPath(indices.map(i=>front.landmarks[i]),front.width,front.height);return fs&&pixels?pixels*fs:null;}
add('shoulder',path([11,12]),'Front-view shoulder landmark distance');
const fl=samplingLevels(front),sl=samplingLevels(side);
for(const key of ['chest','waist','hip'] as const){let value:number|null=null;if(fs&&ss&&fl&&sl&&front.mask&&side.mask){const fw=robustWidth(front.mask,fl[key]*front.mask.height,fl.centerX*front.mask.width),sw=robustWidth(side.mask,sl[key]*side.mask.height,sl.centerX*side.mask.width);if(fw&&sw)value=ellipseCircumference(fw*front.width/front.mask.width*fs,sw*side.width/side.mask.width*ss);}add(key,value,'Ellipse from median front width and side depth at landmark-relative sampling levels',[front,side]);}
const limb=(paths:number[][])=>{const values=paths.map(path).filter((v):v is number=>v!==null);return median(values);};
add('sleeve',limb([[11,13,15],[12,14,16]]),'Shoulder → elbow → wrist, median of available sides');
add('outseam',limb([[23,25,27],[24,26,28]]),'Hip → knee → ankle path; confirm waist-to-floor convention with your tailor');
let inseam:number|null=null;const p=front.landmarks;if(fs&&front.mask&&fl&&[25,26,27,28].every(i=>usable(p[i]))){const ankle=(p[27].y+p[28].y)/2,row=crotchRow(front.mask,fl.hip*front.mask.height,p[25].x*front.mask.width,p[26].x*front.mask.width,ankle*front.mask.height);if(row!==null)inseam=(ankle-row/front.mask.height)*front.height*fs;}add('inseam',inseam,'Constrained front silhouette leg-gap to ankle; low confidence');
report.estimates.sort((a,b)=>measurementKeys.indexOf(a.key)-measurementKeys.indexOf(b.key));return report;}
