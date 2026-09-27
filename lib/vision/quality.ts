import {config} from '@/lib/measurement/config';
import {maskBounds} from './segmentation';
import type {VisionFrame,View,Quality,Landmark} from './types';
const visible=(p:Landmark|undefined)=>!!p&&p.visibility>=config.minVisibility&&p.x>config.frameMargin&&p.x<1-config.frameMargin&&p.y>config.frameMargin&&p.y<1-config.frameMargin;
export function assessQuality(frame:VisionFrame,view:View):Quality{const p=frame.landmarks;const bounds=maskBounds(frame.mask);const bodyHeight=bounds&&frame.mask?bounds.height/frame.mask.height:0;const confidence=p.length?Math.min(...[0,11,12,23,24,27,28,31,32].map(i=>p[i]?.visibility??0)):0;const shoulder=p[11]&&p[12]?Math.abs(p[11].x-p[12].x)*frame.width/frame.height/Math.max(bodyHeight,.01):0;const tilt=p[11]&&p[12]?Math.atan2(Math.abs(p[11].y-p[12].y)*frame.height,Math.abs(p[11].x-p[12].x)*frame.width)*180/Math.PI:90;const torsoTilt=p[11]&&p[23]?Math.atan2(Math.abs((p[11].x+(p[12]?.x??p[11].x))/2-(p[23].x+(p[24]?.x??p[23].x))/2)*frame.width,Math.abs(p[23].y-p[11].y)*frame.height)*180/Math.PI:90;
const armAngle=(s:number,e:number)=>p[s]&&p[e]?Math.atan2(Math.abs(p[e].x-p[s].x)*frame.width,(p[e].y-p[s].y)*frame.height)*180/Math.PI:0;
const feet=p[31]&&p[32]?Math.abs(p[31].x-p[32].x)*frame.width/frame.height/Math.max(bodyHeight,.01):0;
const arms=view==='front'?[armAngle(11,13),armAngle(12,14)].every(a=>a>=config.minArmAngle&&a<=config.maxArmAngle):[15,16].some(i=>visible(p[i])&&p[23]&&p[24]&&Math.abs(p[i].x-(p[23].x+p[24].x)/2)>.08);
const framing=!!bounds&&!!frame.mask&&bounds.top/frame.mask.height>config.frameMargin&&bounds.bottom/frame.mask.height<1-config.frameMargin&&bounds.left/frame.mask.width>config.frameMargin&&bounds.right/frame.mask.width<1-config.frameMargin&&bodyHeight>=config.minBodyHeight&&bodyHeight<=config.maxBodyHeight;
return {tiltDegrees:view==='front'?tilt:torsoTilt,landmarkConfidence:confidence,segmentationInstability:bounds?.instability??1,override:false,checks:[
{key:'person',label:'One person in the frame',passed:frame.poseCount===1},
{key:'landmarks',label:'Head and both feet clearly visible',passed:[0,27,28,31,32].every(i=>visible(p[i]))},
{key:'framing',label:'Whole body inside the guide, with space above and below',passed:framing},
{key:'orientation',label:view==='front'?'Face the camera squarely':'Turn to a near-profile position',passed:shoulder>0&&(view==='front'?shoulder>=config.frontShoulderRatio:shoulder<=config.sideShoulderRatio)},
{key:'level',label:view==='front'?'Keep shoulders level':'Stand upright without leaning',passed:(view==='front'?tilt:torsoTilt)<=config.maxTiltDegrees},
{key:'arms',label:view==='front'?'Hold arms 15–25° away from your torso':'Move arms slightly forward, clear of your torso',passed:arms},
{key:'feet',label:view==='front'?'Keep feet slightly apart':'Keep feet visible and stand naturally',passed:view==='front'?feet>=config.minFeetRatio&&feet<=config.maxFeetRatio:[31,32].every(i=>visible(p[i]))},
{key:'light',label:'Use bright, even lighting',passed:frame.brightness>=config.minBrightness},
{key:'blur',label:'Hold still for a sharp photo',passed:frame.sharpness>=config.minSharpness},
{key:'mask',label:'Body outline is clear and stable',passed:!!bounds&&bounds.instability<=config.maxMaskInstability},
]};}
export function imageQuality(data:Uint8ClampedArray,width:number,height:number){const gray=new Float32Array(width*height);let sum=0;for(let i=0;i<gray.length;i++){gray[i]=.2126*data[i*4]+.7152*data[i*4+1]+.0722*data[i*4+2];sum+=gray[i];}let lap=0,lap2=0,n=0;for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x,v=gray[i-1]+gray[i+1]+gray[i-width]+gray[i+width]-4*gray[i];lap+=v;lap2+=v*v;n++;}return {brightness:sum/Math.max(1,gray.length),sharpness:n?lap2/n-(lap/n)**2:0};}
