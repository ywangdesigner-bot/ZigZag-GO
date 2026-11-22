// Shared active-time clock: designer pause freezes scheduled transitions too.
export class Playback{
 constructor(){this.paused=false;this.jobs=new Set();this.media=new Set();this.listeners=[];this.last=performance.now();const tick=now=>{const dt=this.paused?0:now-this.last;this.last=now;for(const j of [...this.jobs]){j.left-=dt;if(j.left<=0){this.jobs.delete(j);j.fn();}}requestAnimationFrame(tick)};requestAnimationFrame(tick)}
 schedule=(fn,ms)=>{const j={fn,left:ms};this.jobs.add(j);return j};
 cancel=j=>this.jobs.delete(j);
 delay=ms=>new Promise(r=>this.schedule(r,ms));
 register(...media){media.forEach(m=>this.media.add(m))}
 toggle(){this.paused=!this.paused;this.listeners.forEach(fn=>fn(this.paused));return this.paused}
}
