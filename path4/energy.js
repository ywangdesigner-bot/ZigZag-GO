export class HoldEnergy{
 constructor({duration=3000,onChange=()=>{},onComplete=()=>{},now=()=>performance.now(),frame=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id)}={}){Object.assign(this,{duration,onChange,onComplete,now,frame,cancel});this.value=0;this.held=false;this.last=0;this.frameId=0;}
 start(){if(this.held||this.value>=1)return;this.held=true;this.last=this.now();const tick=now=>{if(!this.held)return;this.value=Math.min(1,this.value+Math.max(0,Math.min(100,now-this.last))/this.duration);this.last=now;this.onChange(this.value);if(this.value>=1){this.held=false;this.frameId=0;this.onComplete();}else this.frameId=this.frame(tick);};this.frameId=this.frame(tick);}
 stop(){this.held=false;this.cancel(this.frameId);this.frameId=0;}
 reset(){this.stop();this.value=0;this.onChange(0);}
}
