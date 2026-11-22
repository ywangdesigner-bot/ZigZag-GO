// Shared task rhythm, configured per round.
const roundConfigs = [
 {number:1, photo:'red-apple-photo.png', label:'Red Apple', progress:'Bar3_2.gif', success:'Bar3_3.gif', found:'found-apple-hana.mp3', reward:'apple-saved-hana.mp3', teaching:'shake-teaching-hana.mp3', action:'左摇右摇'},
 {number:2, photo:'red-toy-car.png', label:'Red Toy Car', progress:'Bar3_4.gif', success:'Bar3_5.gif', found:'found-car-hana.mp3', reward:'car-saved-hana.mp3', teaching:'blow-teaching-hana.mp3', action:'吹气（麦克风）'},
 {number:3, photo:'red-tshirt-photo.png', label:'Red T-shirt', progress:'Bar3_6.gif', success:'Bar3_7.gif', found:'found-shirt-hana.mp3', reward:'shirt-saved-hana.mp3', teaching:'wheel-teaching-hana.mp3', action:'滚动右侧滚轮'}
];
let roundConfig=roundConfigs[0];
const round = document.createElement('div');
round.className = 'round-one';
round.hidden = true;
round.innerHTML = `
  <video autoplay muted playsinline hidden></video>
  <img class="round-particles" src="round-particles.gif" alt="" hidden>
  <img class="recognition-processing" alt="" hidden>
  <div class="round-photo" hidden>
    <img class="round-photo-color" alt="拍摄的物品">
    <img class="round-photo-gray" alt="" hidden>
  </div>
  <img class="round-focus" src="round-focus.svg" alt="">
  <img class="round-target" src="round-target.svg" alt="">
  <img class="round-bar" alt="">
  <p class="round-label" hidden>Red Apple</p>
  <div class="round-trail"></div>
  <div class="round-thief" hidden></div>
  <div class="shake-demo" hidden>
    <div class="scroll-demo"><img class="scroll-demo-wheel" src="demo-wheel.svg" alt="滚动滚轮"><img class="scroll-demo-device" src="scroll-device.svg" alt="设备示意"><svg class="scroll-demo-arrow" preserveAspectRatio="none" overflow="visible" style="display: block;" width="81.9002" height="59.3633" viewBox="0 0 81.9002 59.3633" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="Scroll arrow">
<path id="Ellipse 2899" d="M73.9427 32.1883C70.7863 26.252 66.0498 21.3042 60.2569 17.8919C54.464 14.4796 47.8402 12.7357 41.118 12.8531C34.3958 12.9704 27.837 14.9444 22.1666 18.5568C16.4963 22.1692 11.9354 27.2793 8.9881 33.3221" stroke-width="6.5" stroke-linecap="round" stroke="white"/>
<circle class="scroll-dot-moving" id="Ellipse 2904" cx="0" cy="0" r="8.45" fill="white"/>
<circle class="scroll-dot-fixed" id="Ellipse 2905" cx="73.4502" cy="33.7949" r="8.45" fill="white"/>
</g>
</svg>
</div>
    <img class="shake-demo-arrows" src="shake-arrows.svg" alt="">
    <div class="demo-device-scene"><div class="demo-device-solid">
      <img class="demo-device-front" src="blow-device-front.svg" alt="设备向后倾倒">
      <div class="demo-device-bottom"><i></i><i></i></div>
    </div></div>
    <img class="blow-demo-arrow blow-one" src="blow-arrow.svg" alt="">
    <img class="blow-demo-arrow blow-two" src="blow-arrow.svg" alt="">
    <img class="blow-demo-arrow blow-three" src="blow-arrow.svg" alt="">
    <img class="shake-demo-device" src="shake-device.svg" alt="">
  </div>
  <img class="round-fan" src="fan.svg" alt="吹气风扇" hidden>
  <img class="round-sparkle" alt="" hidden>
  <img class="round-success" alt="" hidden>
`;
screen.append(round);
const shakeAction = document.createElement('button');
shakeAction.className = 'shake-action';
shakeAction.textContent = '左摇右摇';
shakeAction.hidden = true;
document.body.append(shakeAction);
const roundVideo = round.querySelector('video');
const photoBox = round.querySelector('.round-photo');
const colorPhoto = round.querySelector('.round-photo-color');
const grayPhoto = round.querySelector('.round-photo-gray');
const roundBar = round.querySelector('.round-bar');
const roundThief = round.querySelector('.round-thief');
const roundTrail = round.querySelector('.round-trail');
const roundLabel = round.querySelector('.round-label');
const roundParticles = round.querySelector('.round-particles');
const recognitionProcessing = round.querySelector('.recognition-processing');
const demo = round.querySelector('.shake-demo');
const demoDevice = round.querySelector('.shake-demo-device');
const shakeVoice = new Audio('shake-teaching-hana.mp3');
shakeVoice.preload = 'auto';
const afSound = new Audio('4_AF.mp3');
const processingSound = new Audio('6_ai_processing.mp3');
const shutterSound = new Audio('3_Shutter.mp3');
const labelSound = new Audio('7_ShortBeep.mp3');
const celebrationSound = new Audio('16_SmallCelebrate.mp3');
const rewardVoice = new Audio();
const roundThreeTheft=new Audio('thief-magic-round3.wav');
const wheelSounds=[1,2,3,4].map(n=>new Audio('wheel-step-'+n+'.wav'));
let wheelReadyAt=0;
const roundFan=round.querySelector('.round-fan');
const blowAir=new Audio('blow-air.wav');blowAir.loop=true;
const blowComplete=new Audio('blow-complete.wav');
let fanAngle=0,fanTarget=0,fanSpeed=0,fanFrame,fanLast=0;
let fanWaiters=[];
const rustle = new Audio('shake-rustle.wav');
let successZigTimer;
const tension = new Audio('recovery-tension.wav');
tension.loop = true;
tension.volume = .65;
let afTimer;
function stopAF() {
  clearInterval(afTimer);
  afSound.pause();
  afSound.currentTime = 0;
}
const pendingClips=new Set();
function playClip(player, src) {
  return new Promise(resolve => {
    let settled = false;
    const done = () => {
      if(settled)return;
      settled=true;clearTimeout(timeout);pendingClips.delete(done);
      player.onended=null;player.onerror=null;
      player.pause();resolve();
    };
    pendingClips.add(done);
    const timeout=setTimeout(done,20000);
    if(src)player.src=src;
    player.onended=done;player.onerror=done;
    player.currentTime=0;
    player.play().catch(done);
  });
}
function beginRecovery() {
  phase('recover');
  roundLabel.hidden=true;
  roundFan.hidden=roundConfig.number!==2;
  shakeAction.hidden=roundConfig.number===3;
  tension.currentTime=0;
  tension.play().catch(()=>{});
}
let roundStream;
let roundPhase = '';
let roundToken = 0;
let photoUrl;
let roundFrame;
let recovery = 0;
let shakeAnimation;
let demonstrating;

const thiefSvg = thief.querySelector('svg').cloneNode(true);
thiefSvg.setAttribute('viewBox', '92 0 100 100');
thiefSvg.setAttribute('width','100');
thiefSvg.setAttribute('height','100');
roundThief.append(thiefSvg);
const thiefFill = thiefSvg.querySelector('#Vector_2');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function phase(name) {
  roundPhase = name;
  currentScreen = name;
  round.dataset.phase = name;
  screen.setAttribute('aria-label', 'Screen' + String(roundConfig.number+5) + ({camera:'',recognition:'.1',reveal:'.2',steal:'.3',demo:'.4',finishing:roundConfig.number===2?'.5':'.4',recover:roundConfig.number===2?'.5':'.4',success:'.5'}[name]) + ' · 第'+roundConfig.number+'轮');
}
function setThiefColor(amount) {
  const gray = [154,154,154], red = [195,0,0];
  thiefFill.setAttribute('fill', 'rgb(' + gray.map((v,i)=>Math.round(v+(red[i]-v)*amount)).join(',') + ')');
}
function stopRoundCamera() {
  roundStream?.getTracks().forEach(track=>track.stop());
  roundStream = null;
  roundVideo.srcObject = null;
}
async function enterRoundOne() {
  const token = ++roundToken;
  phase('camera');
  clearTimeout(countdownTimer);
  countdownSound.pause();
  missionVoice.pause();
  countdown.hidden = true;
  round.hidden = false;
  roundVideo.hidden = false;
  round.dataset.round=roundConfig.number;
  roundLabel.textContent=roundConfig.label;
  shakeAction.textContent=roundConfig.action;
  shakeAction.hidden=true;
  recovery=0;wheelReadyAt=0;
  resetFan();
  photoBox.hidden=true;grayPhoto.hidden=true;grayPhoto.dataset.restored='0';
  grayPhoto.style.maskImage=grayPhoto.style.webkitMaskImage='';
  round.querySelector('.round-focus').hidden=false;
  round.querySelector('.round-target').hidden=false;
  roundThief.hidden=true;roundThief.getAnimations().forEach(a=>a.cancel());
  roundThief.style.left='71.4583%';roundThief.style.top='29.1667%';
  roundTrail.replaceChildren();
  roundLabel.hidden=true;roundParticles.hidden=true;recognitionProcessing.hidden=true;
  round.querySelector('.round-success').hidden=true;round.querySelector('.round-sparkle').hidden=true;
  demo.hidden=true;setThiefColor(0);
  roundBar.src = roundConfig.progress;
  cameraNotice.hidden = false;
  cameraNotice.textContent = '正在打开摄像头…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    if (token !== roundToken || !active || roundPhase !== 'camera') {
      stream.getTracks().forEach(track=>track.stop());
      return;
    }
    roundStream = stream;
    roundVideo.srcObject = stream;
    await roundVideo.play();
    if (token === roundToken && roundPhase === 'camera') {
      cameraNotice.hidden = true;
      stopAF();
      afSound.play().catch(()=>{});
      afTimer=setInterval(()=>{
        if(roundPhase!=='camera')return;
        afSound.currentTime=0;afSound.play().catch(()=>{});
      },5000);
    }
  } catch {
    if (token !== roundToken || roundPhase !== 'camera') return;
    stopRoundCamera();
    cameraNotice.hidden = false;
    cameraNotice.textContent = '请允许摄像头权限后，按拍照键重试。';
  }
}
device.addEventListener('screen2-countdown-complete', enterRoundOne);
device.addEventListener('shutter-press', () => {
  if (roundPhase !== 'camera') return;
  if (!roundVideo.videoWidth) {
    if (!roundStream) enterRoundOne();
    return;
  }
  captureRoundPhoto();
});
async function captureRoundPhoto() {
  const token = roundToken;
  stopAF();
  shutterSound.currentTime=0;
  shutterSound.play().catch(()=>{});
  colorPhoto.src = grayPhoto.src = roundConfig.photo;
  stopRoundCamera();
  roundVideo.hidden = true;
  round.querySelector('.round-focus').hidden = true;
  round.querySelector('.round-target').hidden = true;
  photoBox.hidden = false;
  recognitionProcessing.src = 'processing.gif';
  recognitionProcessing.hidden = false;
  roundParticles.hidden = true;
  processingSound.loop=true;
  processingSound.currentTime=0;processingSound.play().catch(()=>{});
  phase('recognition');
  await sleep(3000);
  if (token !== roundToken || roundPhase !== 'recognition') return;
  revealPhoto();
}
async function revealPhoto() {
  const token=roundToken;
  processingSound.pause();
  phase('reveal');
  recognitionProcessing.hidden=true;
  roundParticles.src='round-particles.gif';
  roundParticles.hidden=false;
  await sleep(600);
  if(token!==roundToken||roundPhase!=='reveal'||!active)return;
  roundLabel.hidden=false;
  labelSound.currentTime=0;labelSound.play().catch(()=>{});
  await playClip(rewardVoice,roundConfig.found);
  if(token!==roundToken||roundPhase!=='reveal'||!active)return;
  roundThief.hidden=false;
  roundLabel.hidden=true;
  setThiefColor(0);
  await playClip(rewardVoice,roundConfig.number===1?'thief-again-hana.mp3':roundConfig.number===2?'thief-back-round2-hana.mp3':'thief-back-round3-hana.mp3');
  await sleep(1000);
  if(token===roundToken&&roundPhase==='reveal'&&active)startRoundTheft();
}
function startRoundTheft() {
  phase('steal');
  recognitionProcessing.hidden = true;
  roundParticles.hidden = false;
  roundLabel.hidden = true;
  roundThief.hidden = false;
  roundTrail.replaceChildren();
  const theftTrack=roundConfig.number===3?roundThreeTheft:thiefVoice;
  theftTrack.currentTime=0;theftTrack.play().catch(()=>{});
  const started = performance.now(), duration = reducedMotion ? 1 : 4200;
  roundThief.querySelector('svg').style.opacity='1';
  let nextStar = .1;
  function orbit(now) {
    if(roundPhase!=='steal'||!active)return;
    const t = Math.min(1,(now-started)/duration);
    const angle = -Math.PI/4 + (t*t*(3-2*t))*Math.PI*2;
    const x = 240+166*Math.cos(angle), y=240+166*Math.sin(angle);
    roundThief.style.left = (x-50)/480*100+'%';
    roundThief.style.top = (y-50)/480*100+'%';
    roundThief.style.transform = 'scale('+(1+Math.sin(t*Math.PI*7)*.06*(1-t))+')';
    if (t>=nextStar && t<.95) {
      const star = document.createElement('img');
      star.src='trail-star.svg'; star.alt='';
      star.style.left=(x-12)/480*100+'%';star.style.top=(y-12)/480*100+'%';
      roundTrail.append(star);nextStar+=.08;
    }
    if (t<1) roundFrame=requestAnimationFrame(orbit);
    else {
      roundThief.style.left='71.4583%';roundThief.style.top='29.1667%';
      roundThief.style.transform='';
      drainPhoto();
    }
  }
  roundFrame=requestAnimationFrame(orbit);
}
function drainPhoto() {
  grayPhoto.hidden=false;
  const start=performance.now();
  function frame(now) {
    if(roundPhase!=='steal'||!active)return;
    const t=reducedMotion?1:Math.min(1,(now-start)/2600);
    const radius=75*(1-t);
    const mask=t===1?'none':'radial-gradient(circle, transparent '+Math.max(0,radius-9)+'%, black '+radius+'%)';
    grayPhoto.style.maskImage=grayPhoto.style.webkitMaskImage=mask;
    setThiefColor(t);
    if(t<1)roundFrame=requestAnimationFrame(frame);
    else showDemonstration();
  }
  roundFrame=requestAnimationFrame(frame);
}
async function showDemonstration() {
  const token=roundToken;
  phase('demo');
  thiefVoice.pause();roundThreeTheft.pause();
  demo.hidden=false;
  shakeVoice.src=roundConfig.teaching;
  if(!reducedMotion && roundConfig.number===1) demonstrating=demoDevice.animate([
    {transform:'rotate(-13deg)'},{transform:'rotate(13deg)'},{transform:'rotate(-13deg)'}
  ],{duration:650,iterations:Infinity,easing:'ease-in-out'});
  await playClip(shakeVoice);
  if(token!==roundToken||roundPhase!=='demo'||!active)return;
  demonstrating?.cancel();
  demo.hidden=true;
  beginRecovery();
}
function resetFan(){
  cancelAnimationFrame(fanFrame);fanAngle=fanTarget=fanSpeed=fanLast=0;fanFrame=0;
  roundFan.hidden=true;roundFan.style.transform='';
  blowAir.pause();blowAir.currentTime=0;blowComplete.pause();
  fanWaiters.splice(0).forEach(resolve=>resolve());
}
function spinFan(){
  fanTarget+=720;
  blowAir.volume=.15+recovery*.65;
  blowAir.play().catch(()=>{});
  if(fanFrame)return;
  fanLast=performance.now();
  function tick(now){
    const dt=Math.min(.05,Math.max(0,(now-fanLast)/1000));fanLast=now;
    const remaining=fanTarget-fanAngle;
    const speedTarget=Math.min(1600,Math.sqrt(2*850*remaining));
    fanSpeed=Math.min(speedTarget,fanSpeed+5000*dt);
    fanAngle=Math.min(fanTarget,fanAngle+Math.max(12,fanSpeed)*dt);
    roundFan.style.transform='rotate('+fanAngle+'deg)';
    blowAir.volume=Math.min(.9,(.2+recovery*.7)*Math.min(1,fanSpeed/650));
    if(fanTarget-fanAngle>.05){fanFrame=requestAnimationFrame(tick);}
    else{fanAngle=fanTarget;fanSpeed=0;fanFrame=0;blowAir.pause();fanWaiters.splice(0).forEach(resolve=>resolve());}
  }
  fanFrame=requestAnimationFrame(tick);
}
function waitForFan(){return fanFrame?new Promise(resolve=>fanWaiters.push(resolve)):Promise.resolve();}
function restorationMask(value,blinds){
  if(value>=1)return 'linear-gradient(transparent,transparent)';
  if(value<=0)return 'linear-gradient(black,black)';
  if(blinds){
    const stripe=12.5,edge=stripe*(1-value),feather=1.1;
    return 'repeating-linear-gradient(to bottom, black 0%, black '+Math.max(0,edge-feather)+'%, transparent '+Math.min(stripe,edge+feather)+'%, transparent '+stripe+'%)';
  }
  const boundary=100*(1-value);
  return 'linear-gradient(to bottom, black '+Math.max(0,boundary-6)+'%, transparent '+Math.min(100,boundary+6)+'%)';
}
function recoveryAction(){
  if(roundPhase!=='recover'||recovery>=1)return;
  if(roundConfig.number===3){
    if(performance.now()<wheelReadyAt)return;
    wheelReadyAt=performance.now()+650;
  }
  recovery=Math.min(1,recovery+.25);
  if(roundConfig.number===2)spinFan();
  else if(roundConfig.number===1){rustle.currentTime=0;rustle.play().catch(()=>{});}
  else{
    const step=Math.round(recovery*4);
    wheelSounds[step-1].currentTime=0;wheelSounds[step-1].play().catch(()=>{});
    if(!reducedMotion){
      const pulses=step===4?3:1,keyframes=[{transform:'translateX(0)'}];
      for(let i=0;i<pulses;i++)keyframes.push({transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'});
      shakeAnimation?.cancel();shakeAnimation=device.animate(keyframes,{duration:step===4?600:200,easing:'linear'});
    }
  }
  if(roundConfig.number===1)shakeAnimation?.cancel();
  if(!reducedMotion && roundConfig.number===1)shakeAnimation=device.animate([
    {transform:'rotate(0deg)'},{transform:'rotate(-7deg)'},{transform:'rotate(7deg)'},
    {transform:'rotate(-4deg)'},{transform:'rotate(3deg)'},{transform:'rotate(0deg)'}
  ],{duration:550,easing:'ease-in-out'});
  const startValue=Number(grayPhoto.dataset.restored||0);
  cancelAnimationFrame(roundFrame);
  const started=performance.now(),target=recovery;
  function restore(now) {
    const t=reducedMotion?1:Math.min(1,(now-started)/650);
    const value=startValue+(target-startValue)*(t*t*(3-2*t));
    grayPhoto.dataset.restored=value;
    const mask=roundConfig.number===3?'linear-gradient(to right, transparent 0%, transparent '+(value*100)+'%, black '+(value*100)+'%, black 100%)':restorationMask(value,roundConfig.number===2);
    grayPhoto.style.maskImage=grayPhoto.style.webkitMaskImage=mask;
    setThiefColor(1-value);
    if(t<1)roundFrame=requestAnimationFrame(restore);
    else if(target===1)finishRound();
  }
  roundFrame=requestAnimationFrame(restore);
}
shakeAction.addEventListener('click',recoveryAction);
device.addEventListener('wheel-turn',()=>{if(roundConfig.number===3)recoveryAction();});
device.addEventListener('microphone-press',()=>{if(roundConfig.number===2)recoveryAction();});
async function finishRound() {
  const token=roundToken;
  phase('finishing');
  shakeAction.hidden=true;
  if(roundConfig.number===2){
    await waitForFan();
    if(token!==roundToken||!active||roundPhase!=='finishing')return;
    blowComplete.currentTime=0;blowComplete.play().catch(()=>{});
  }
  roundFan.hidden=true;
  phase('success');
  tension.pause();
  shakeAction.hidden=true;
  grayPhoto.hidden=true;
  roundLabel.hidden=true;
  roundParticles.hidden=true;
  roundTrail.replaceChildren();
  const exit=roundThief.animate([
    {transform:'translate(0,0) scale(1)',offset:0},
    {transform:'translate(-4px,12px) scale(1.08,.88)',offset:.18},
    {transform:'translate(14px,-45px) scale(.95,1.08)',offset:.43},
    {transform:'translate(42px,-145px) rotate(12deg)',offset:.72,opacity:1},
    {transform:'translate(80px,-270px) rotate(25deg) scale(.8)',offset:1,opacity:0}
  ],{duration:reducedMotion?1:950,easing:'ease-in',fill:'forwards'});
  try{await exit.finished;}catch{return;}
  if(token!==roundToken||!active)return;
  roundThief.hidden=true;
  roundBar.src=roundConfig.success;
  for(const [selector,src] of [['.round-success','A1_2_once.gif'],['.round-sparkle','star-sparkle.gif']]){
    const img=round.querySelector(selector);img.src=src;img.hidden=false;
  }
  const successZig = round.querySelector('.round-success');
  successZigTimer=setTimeout(()=>{
    if(active && roundPhase==='success')successZig.src='A7_loop.gif';
  },1680);
  await playClip(celebrationSound);
  if(token!==roundToken||roundPhase!=='success'||!active)return;
  clearTimeout(successZigTimer);
  successZig.src='B1.gif';
  await playClip(rewardVoice,roundConfig.reward);
  if(token!==roundToken||!active || roundPhase!=='success')return;
  clearTimeout(successZigTimer);
  successZig.src='A7_loop.gif';
  emit(['round-one-complete','round-two-complete','round-three-complete'][roundConfig.number-1],{recovered:roundConfig.number,total:3});
  if(roundConfig.number<3){
    await sleep(1600);
    if(token===roundToken&&active && roundPhase==='success'){roundConfig=roundConfigs[roundConfig.number];enterRoundOne();}
  }
}
// Designer shortcut follows the same first-round state transitions.
screen.addEventListener('click',()=>{
  if(currentScreen===2){enterRoundOne();return;}
  if(roundPhase==='recognition'){processingSound.pause();revealPhoto();return;}
  if(roundPhase==='demo'){
    shakeVoice.pause();demonstrating?.cancel();demo.hidden=true;
    beginRecovery();
  }
});
window.addEventListener('pagehide',()=>{
  roundToken++;stopAF();stopRoundCamera();resetFan();
  clearTimeout(successZigTimer);rustle.pause();
  for(const player of [processingSound,shutterSound,labelSound,celebrationSound,rewardVoice,tension,roundThreeTheft,...wheelSounds])player.pause();cancelAnimationFrame(roundFrame);
  shakeVoice.pause();demonstrating?.cancel();shakeAnimation?.cancel();
});

// Designer navigation starts each round from its camera stage.
const roundNavigation=document.createElement('nav');
roundNavigation.className='round-navigation';
roundNavigation.setAttribute('aria-label','轮次快速切换');
function jumpToRound(index){
  if(typeof stopCaptureStage==='function')stopCaptureStage();
  roundToken++;
  pendingClips.forEach(stop=>stop());
  clearTimeout(successZigTimer);clearTimeout(screen4Timer);clearTimeout(countdownTimer);
  cancelAnimationFrame(roundFrame);cancelAnimationFrame(sceneFrame);
  stopAF();stopRoundCamera();resetFan();
  demonstrating?.cancel();shakeAnimation?.cancel();missionAnimation?.cancel();
  for(const audio of [processingSound,shutterSound,labelSound,celebrationSound,rewardVoice,tension,roundThreeTheft,...wheelSounds,rustle,shakeVoice,thiefVoice,zigVoice,missionVoice,countdownSound]){audio.pause();audio.currentTime=0;}
  cameraVideo.srcObject?.getTracks().forEach(track=>track.stop());cameraVideo.srcObject=null;
  for(const layer of [cover,countdown,missionTitle,cameraVideo,grayWorld,thiefScene,thiefBubble,screen4Overlay,screen5])layer.hidden=true;
  screen4Overlay.onload=null;
  screen.querySelector('.screen-decoration').hidden=true;
  roundConfig=roundConfigs[index];
  [...roundNavigation.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  enterRoundOne();
}
['第一轮','第二轮','第三轮'].forEach((label,index)=>{
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.addEventListener('click',()=>jumpToRound(index));roundNavigation.append(button);
});
document.body.append(roundNavigation);
