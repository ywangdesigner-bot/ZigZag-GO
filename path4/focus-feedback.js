// Browser cameras do not expose a dependable AF-busy event.
// This estimates refocusing from relative image sharpness, never claims lens telemetry.
export function frameSharpness({data,width,height}){
 const gray=(x,y)=>{const i=(y*width+x)*4;return data[i]*.299+data[i+1]*.587+data[i+2]*.114;};
 let sum=0,sum2=0,count=0;
 for(let y=Math.max(1,Math.floor(height*.2));y<height*.8-1;y+=3){for(let x=Math.max(1,Math.floor(width*.2));x<width*.8-1;x+=3){const v=4*gray(x,y)-gray(x-1,y)-gray(x+1,y)-gray(x,y-1)-gray(x,y+1);sum+=v;sum2+=v*v;count++;}}
 return count?Math.max(0,sum2/count-(sum/count)**2):0;
}
export class FocusFeedback{
 constructor(onChange=()=>{}){this.onChange=onChange;this.reset();}
 reset(){this.active=false;this.baseline=0;this.low=0;this.clearSince=null;this.started=0;this.cooldown=0;}
 observe(sharpness,targetFound,now,canStart=true){
  if(!Number.isFinite(sharpness))return;
  if(this.active){
   if(sharpness>=this.baseline*.68){if(this.clearSince===null)this.clearSince=now;}else this.clearSince=null;
   if((this.clearSince!==null&&now-this.clearSince>=350)||now-this.started>=3500){this.active=false;this.low=0;this.cooldown=now+1200;this.baseline=sharpness;this.onChange(false);}
   return;
  }
  if(this.baseline>8&&sharpness<this.baseline*.48&&canStart&&now>=this.cooldown){this.low++;if(this.low>=2){this.active=true;this.started=now;this.clearSince=null;this.onChange(true);}return;}
  this.low=0;if(targetFound||canStart)this.baseline=this.baseline?Math.max(this.baseline*.99,sharpness):sharpness;
 }
}
