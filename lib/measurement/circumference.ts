/** Ramanujan's first ellipse perimeter approximation, as specified in AGENTS.md.
 * https://mathworld.wolfram.com/Ellipse.html (ellipse perimeter approximations).
 */
export function ellipseCircumference(width:number,depth:number):number|null{if(!Number.isFinite(width)||!Number.isFinite(depth)||width<=0||depth<=0)return null;const a=width/2,b=depth/2;return Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)));}
