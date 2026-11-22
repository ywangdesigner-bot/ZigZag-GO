// Final challenge: cover the light sensor, hold, then shake the thief out.
const captureStage=document.createElement('div');
captureStage.className='capture-stage';captureStage.hidden=true;
captureStage.innerHTML=`<video class="capture-camera" autoplay muted playsinline></video><video class="capture-color" autoplay muted playsinline></video><div class="capture-thief"></div><div class="capture-night"></div><div class="capture-demo" hidden><img class="capture-wheel" src="demo-wheel.svg" alt=""><img class="capture-device" src="scroll-device.svg" alt=""><img class="capture-sensor" src="capture-sensor.svg" alt=""><img class="capture-palm" src="capture-palm.png" alt="手掌遮住感光孔"></div><img class="capture-zig" alt="" hidden><p class="capture-pill" hidden>Great Job!</p>`;
screen.append(captureStage);
const captureThief=captureStage.querySelector('.capture-thief');
captureThief.append(thief.querySelector('svg').cloneNode(true));
const captureSvg=captureThief.querySelector('svg');captureSvg.setAttribute('viewBox','92 0 100 100');
const captureVideo=captureStage.querySelector('.capture-camera'),captureColor=captureStage.querySelector('.capture-color'),captureNight=captureStage.querySelector('.capture-night'),captureDemo=captureStage.querySelector('.capture-demo'),captureZig=captureStage.querySelector('.capture-zig'),capturePill=captureStage.querySelector('.capture-pill');
const captureVoice=new Audio(),captureTaunt=new Audio('capture-taunt-hana.mp3'),captureScore=new Audio('capture-villain.wav'),captureSuspense=new Audio('recovery-tension.wav'),captureCelebrate=new Audio('17_BigCelebrate.mp3'),captureZigSound=new Audio('25_2_B4_Zig.mp3');
captureScore.loop=true;captureScore.volume=.35;captureSuspense.loop=true;captureSuspense.volume=.6;
let captureToken=0,capturePhase='',captureFrame,captureStream,captureCovered=false,capturePos={x:343,y:140},captureAnim;
const captureShake=document.createElement('button');captureShake.className='shake-action';captureShake.textContent='晃动机身';captureShake.hidden=true;document.body.append(captureShake);
function stopCaptureStage(){
 captureToken++;capturePhase='';cancelAnimationFrame(captureFrame);captureAnim?.cancel();
 captureStream?.getTracks().forEach(t=>t.stop());captureStream=null;
 for(const p of [captureVoice,captureTaunt,captureScore,captureSuspense,captureCelebrate,captureZigSound])p.pause();
 captureStage.getAnimations({subtree:true}).forEach(a=>a.cancel());captureStage.hidden=true;captureShake.hidden=true;
}
function captureState(name){capturePhase=name;currentScreen='capture-'+name;captureStage.dataset.phase=name;}
async function captureSay(file,token){await playClip(captureVoice,file+'-hana.mp3');return token===captureToken&&active;}
async function enterCaptureStage(){
 jumpToRound(2);roundToken++;stopRoundCamera();stopAF();round.hidden=true;
 const token=++captureToken;captureState('intro');captureStage.hidden=false;captureCovered=false;
 captureVideo.srcObject=null;captureColor.srcObject=null;captureColor.style.clipPath='circle(0% at 50% 50%)';
 captureNight.style.background='transparent';captureNight.style.opacity='1';captureThief.hidden=true;captureThief.style.transform='';captureThief.style.opacity='1';captureDemo.hidden=true;capturePill.hidden=true;captureZig.hidden=true;
 capturePos={x:343,y:140};placeCaptureThief();
 screen.setAttribute('aria-label','抓住颜色小偷');
 try{const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});if(token!==captureToken){stream.getTracks().forEach(t=>t.stop());return;}captureStream=stream;captureVideo.srcObject=captureColor.srcObject=stream;await Promise.all([captureVideo.play(),captureColor.play()]);cameraNotice.hidden=true;}catch{cameraNotice.hidden=false;cameraNotice.textContent='请允许摄像头权限，仍可使用感光孔体验交互。';}
 if(token!==captureToken)return;
 captureZig.src='B1.gif';captureZig.hidden=false;
 if(!await captureSay('capture-intro',token))return;
 captureZig.hidden=true;
 captureThief.hidden=false;captureState('bounce');startCaptureBounce();
 captureScore.currentTime=0;captureScore.play().catch(()=>{});
 await playClip(captureTaunt);
 if(token!==captureToken)return;
 captureState('demo');captureDemo.hidden=false;
 if(!await captureSay('capture-teaching',token))return;
 captureDemo.classList.add('capture-demo-leaving');await sleep(450);
 if(token!==captureToken)return;
 captureDemo.hidden=true;captureDemo.classList.remove('capture-demo-leaving');captureState('wait');
 if(lightSensor.matches(':hover')){captureCovered=true;focusCapture();}
}
function placeCaptureThief(){captureThief.style.left=capturePos.x/480*100+'%';captureThief.style.top=capturePos.y/480*100+'%';}
function startCaptureBounce(){
 cancelAnimationFrame(captureFrame);let last=performance.now(),target=randomTarget(),vx=0,vy=0;
 function randomTarget(){const a=Math.random()*Math.PI*2,r=70+Math.random()*112;return{x:190+Math.cos(a)*r,y:190+Math.sin(a)*r};}
 function frame(now){if(!['bounce','demo','wait'].includes(capturePhase))return;const dt=Math.min(.04,(now-last)/1000);last=now;
 let dx=target.x-capturePos.x,dy=target.y-capturePos.y;if(Math.hypot(dx,dy)<22){target=randomTarget();dx=target.x-capturePos.x;dy=target.y-capturePos.y;}
 const d=Math.hypot(dx,dy)||1;vx+=(dx/d*250-vx)*Math.min(1,dt*9);vy+=(dy/d*250-vy)*Math.min(1,dt*9);capturePos.x+=vx*dt;capturePos.y+=vy*dt;placeCaptureThief();captureThief.style.transform='rotate('+Math.max(-14,Math.min(14,vx*.05))+'deg) scale('+(1+Math.sin(now/130)*.045)+')';captureFrame=requestAnimationFrame(frame);
 }captureFrame=requestAnimationFrame(frame);
}
async function focusCapture(){
 if(capturePhase!=='wait')return;const token=captureToken;captureState('focus');cancelAnimationFrame(captureFrame);captureScore.pause();captureSuspense.currentTime=0;captureSuspense.play().catch(()=>{});
 const origin={...capturePos},started=performance.now();
 function frame(now){if(capturePhase!=='focus'||token!==captureToken)return;const t=Math.min(1,(now-started)/3200),e=t*t*(3-2*t);capturePos.x=origin.x+(190-origin.x)*Math.min(1,e*3);capturePos.y=origin.y+(190-origin.y)*Math.min(1,e*3);placeCaptureThief();captureThief.style.transform='';
 const radius=(340+(75-340)*e)*captureStage.clientWidth/480;captureNight.style.background='radial-gradient(circle at center, transparent '+radius+'px, rgba(0,12,3,.9) '+(radius+12*captureStage.clientWidth/480)+'px)';
 if(t<1)captureFrame=requestAnimationFrame(frame);else caughtCapture(token);
 }captureFrame=requestAnimationFrame(frame);await captureSay('capture-hold',token);
}
async function caughtCapture(token){
 if(token!==captureToken||capturePhase!=='focus')return;captureState('caught');captureSuspense.pause();
 if(!await captureSay('capture-caught',token))return;captureShake.hidden=false;
}
device.addEventListener('light-sensor-enter',()=>{captureCovered=true;if(capturePhase==='wait')focusCapture();});
device.addEventListener('light-sensor-leave',()=>{captureCovered=false;if(capturePhase==='focus'){cancelAnimationFrame(captureFrame);pendingClips.forEach(stop=>stop());captureVoice.pause();captureSuspense.pause();captureNight.style.background='transparent';captureState('wait');captureScore.play().catch(()=>{});startCaptureBounce();}});
captureShake.addEventListener('click',async()=>{
 if(capturePhase!=='caught')return;const token=captureToken;captureState('eject');captureShake.hidden=true;
 if(!reducedMotion){captureAnim=device.animate([{transform:'rotate(0)'},{transform:'rotate(-9deg)'},{transform:'rotate(9deg)'},{transform:'rotate(-6deg)'},{transform:'rotate(5deg)'},{transform:'rotate(0)'}],{duration:650});}
 const exit=captureThief.animate([{transform:'translate(0,0) scale(1)'},{transform:'translate(-10px,15px) scale(1.1,.8)',offset:.2},{transform:'translate(30px,-90px) rotate(30deg)',offset:.55},{transform:'translate(110px,-360px) rotate(90deg)',opacity:0}],{duration:950,fill:'forwards',easing:'ease-in'});
 try{await exit.finished;}catch{return;}if(token!==captureToken)return;captureThief.hidden=true;
 const started=performance.now();function close(now){if(token!==captureToken)return;const t=Math.min(1,(now-started)/650),r=75*(1-t)*captureStage.clientWidth/480;captureNight.style.background='radial-gradient(circle, transparent '+r+'px, rgba(0,12,3,1) '+(r+5*(1-t))+'px)';if(t<1)captureFrame=requestAnimationFrame(close);else celebrateCapture(token);}captureFrame=requestAnimationFrame(close);
});
async function celebrateCapture(token){
 captureState('victory');captureNight.style.background='#000';captureCelebrate.currentTime=0;captureCelebrate.play().catch(()=>{});
 const started=performance.now();function restore(now){if(token!==captureToken)return;const t=Math.min(1,(now-started)/2600);captureNight.style.opacity=1-t;captureColor.style.clipPath='circle('+(t*72)+'% at 50% 50%)';if(t<1)captureFrame=requestAnimationFrame(restore);}captureFrame=requestAnimationFrame(restore);
 capturePill.hidden=false;captureZig.hidden=false;captureZig.src='B4_once.gif';
 await Promise.all([playClip(captureZigSound),sleep(2520)]);if(token!==captureToken)return;
 captureZig.src='B1.gif';if(!await captureSay('capture-victory',token))return;
 captureZig.src='A7_loop.gif';captureState('complete');
 await sleep(3000);
 if(token===captureToken&&capturePhase==='complete')returnToScreenOne();
}
const captureJump=document.createElement('button');captureJump.type='button';captureJump.textContent='抓住小偷';captureJump.addEventListener('click',enterCaptureStage);roundNavigation.append(captureJump);
device.addEventListener('round-three-complete',()=>setTimeout(()=>{if(roundConfig.number===3&&roundPhase==='success')enterCaptureStage();},1600));
window.addEventListener('pagehide',stopCaptureStage);

function returnToScreenOne(){
 stopCaptureStage();roundToken++;roundPhase='';roundConfig=roundConfigs[0];
 pendingClips.forEach(stop=>stop());stopRoundCamera();stopAF();resetFan();
 clearTimeout(successZigTimer);clearTimeout(screen4Timer);clearTimeout(countdownTimer);
 cancelAnimationFrame(roundFrame);cancelAnimationFrame(sceneFrame);
 demonstrating?.cancel();shakeAnimation?.cancel();missionAnimation?.cancel();
 for(const audio of [processingSound,shutterSound,labelSound,celebrationSound,rewardVoice,tension,roundThreeTheft,...wheelSounds,rustle,shakeVoice,thiefVoice,zigVoice,missionVoice,countdownSound])audio.pause();
 cameraVideo.srcObject?.getTracks().forEach(track=>track.stop());cameraVideo.srcObject=null;
 for(const layer of [round,countdown,missionTitle,cameraVideo,grayWorld,thiefScene,thiefBubble,screen4Overlay,screen5,cameraNotice,shakeAction])layer.hidden=true;
 screen4Overlay.onload=null;currentScreen=1;
 cover.hidden=false;screen.querySelector('.screen-decoration').hidden=false;
 screen.setAttribute('aria-label','Screen1 · Colour Thief');
 [...roundNavigation.children].forEach(button=>button.setAttribute('aria-pressed','false'));
}
