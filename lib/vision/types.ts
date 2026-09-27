export type Landmark={x:number;y:number;z:number;visibility:number};
export type PersonMask={width:number;height:number;data:Float32Array};
export type View='front'|'side';
export type Check={key:string;label:string;passed:boolean};
export type Quality={checks:Check[];tiltDegrees:number;landmarkConfidence:number;segmentationInstability:number;override:boolean};
export type VisionFrame={landmarks:Landmark[];mask:PersonMask|null;width:number;height:number;brightness:number;sharpness:number;timestamp:number;poseCount:number};
export type Capture=VisionFrame & {quality:Quality;view:View};
export interface VisionEngine{infer(video:HTMLVideoElement):Promise<VisionFrame>;close():void;}
