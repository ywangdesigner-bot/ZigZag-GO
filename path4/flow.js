// Deterministic AF + stability gates, reusable with hardware AF/IMU adapters.
export class DiscoveryFlow {
 constructor({schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),onState=()=>{},onReady=()=>{},afMs=1200,stableMs=500}={}){Object.assign(this,{schedule,cancel,onState,onReady,afMs,stableMs});this.phase='idle';this.timers=[];this.token=0;}
 set(phase){this.phase=phase;this.onState(phase);}
 clear(){this.token++;this.timers.forEach(this.cancel);this.timers=[];}
 focus(){if(['capturing','caught'].includes(this.phase))return;this.clear();const token=this.token;this.set('af');this.timers.push(this.schedule(()=>{if(token!==this.token)return;this.set('stable');this.timers.push(this.schedule(()=>{if(token!==this.token)return;this.set('ready');this.onReady();},this.stableMs));},this.afMs));}
 capture(){if(this.phase!=='ready')return false;this.clear();this.set('capturing');return true;}
 complete(){if(this.phase==='capturing')this.set('caught');}
 reset(){this.clear();this.set('idle');}
}
