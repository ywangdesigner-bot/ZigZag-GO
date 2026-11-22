import {Playback} from './playback.js';
const playback=new Playback();
import {HoldEnergy} from './energy.js';
import {DiscoveryFlow} from './flow.js';
import {FocusFeedback,frameSharpness} from './focus-feedback.js';
import {targetObjects} from './target-matcher.js?case=toys-v1';
const $=selector=>document.querySelector(selector);
const device=$('.device'),screen=$('.screen'),video=$('video'),demo=$('.demo-scene'),focus=$('.focus'),objects=$('.object-list'),status=$('.status'),freeze=$('.freeze'),still=freeze.querySelector('canvas'),card=$('.caught'),subject=card.querySelector('canvas'),flash=$('.capture-flash');
const sound={wheelSelect:new Audio('assets/wheel-select.wav'),wheelPress:new Audio('assets/38_PressWheel.WAV'),af:new Audio('assets/4_AF.WAV'),ready:new Audio('assets/5_AFready.WAV'),shutter:new Audio('assets/3_Shutter.WAV')};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let candidates=targetObjects.map(o=>({...o}));
let selected=0,source='demo',cameraStream,sourceToken=0,started=false,lastCapture=null,motionQuietTimer;
function play(audio){audio.currentTime=0;audio.play().catch(()=>{});}
function stopSounds(){Object.values(sound).forEach(audio=>audio.pause());sound.af.loop=false;}
function renderSelection(){[...objects.children].forEach((box,i)=>{box.setAttribute('aria-current',String(i===selected));box.setAttribute('aria-label',candidates[i].name+(i===selected?'，已选中':''));});}
for(const candidate of candidates){const box=document.createElement('div');box.className='object-box';box.style.cssText=`left:${candidate.x*100}%;top:${candidate.y*100}%;width:${candidate.w*100}%;height:${candidate.h*100}%`;box.innerHTML=`<svg class="recognition-corners" aria-hidden="true"><path class="corner-path"/></svg><span>${candidate.name}</span><i class="selection-sparkles" aria-hidden="true"><img src="assets/universal-star.svg" alt=""><img src="assets/universal-star.svg" alt=""><img src="assets/universal-star.svg" alt=""></i>`;objects.append(box);}
renderSelection();
const recognitionUI={labelsEnabled:true};
screen.dataset.labelsEnabled='true';
const flow=new DiscoveryFlow({schedule:playback.schedule,cancel:playback.cancel,onState(phase){screen.dataset.phase=phase;focus.hidden=!['af','stable','ready'].includes(phase);objects.hidden=phase!=='selection';screen.setAttribute('aria-label',({idle:'P2-1 实时取景',af:'P2-1 模拟自动对焦',stable:'P2-1 稳定确认',ready:'P2-1 实时取景',unrecognized:'P2-3 未匹配到对象',selection:'P2-4 静态照片对象选择',fishing:'转动滚轮钓回消防车','fishing-success':'消防车拉回成功','fire-intro':'P2-5 消防车居中与Zig出现','fire-question':'P2-6 声音模仿提示','fire-wait':'P2-6 等待说话键','fire-listening':'P2-6 正在模仿声音','fire-replay':'P2-6 模仿声音回放','fire-processing':'P2-6 AI处理回答','fire-happy':'P2-6 Zig开心回应','fire-reaction':'P2-6 警笛回应','fire-praise':'P2-6 Hana鼓励','fire-complete':'P2-7 继续探索',confirmed:'P2-5 对象已确认',capturing:'P2-2 全屏拍摄',caught:'P2-2 全屏拍摄完成',processing:'识别处理中',reveal:'P1-6 发现物体','energy-success':'P1-7 充能成功',energy:'P1-7 给Zig能量',narration:'P1-8 小知识',complete:'P1-8 继续探索'})[phase]);if(phase==='af'){play(sound.af);status.textContent='对焦中…';}if(phase==='stable'){sound.af.pause();status.textContent='保持稳定 0.5 秒…';}},onReady(){sound.af.pause();focus.hidden=false;objects.hidden=true;status.textContent='短按拍照键，拍下眼前的整个场景';}});

let preferredCameraId='',trackerWorker=null,trackerLoaded=false,trackerBusy=false,trackerTimer,trackingDetection=null,trackingAt=0,trackingStableSince=0,trackingPrevious=null,trackingReadySound=false,trackingGeneration=0,trackingFailures=0,trackingMotion=0;
const focusFeedback=new FocusFeedback(active=>{
 screen.dataset.lensAf=String(active);
 if(active){focus.hidden=false;objects.hidden=true;sound.af.loop=true;play(sound.af);trackingReadySound=false;status.textContent='镜头重新对焦中…';}
 else{sound.af.pause();sound.af.loop=false;focus.hidden=!['af','stable','ready'].includes(flow.phase);trackingStableSince=performance.now();updateTrackingUI();}
});
const trackingCanvas=document.createElement('canvas'),trackingContext=trackingCanvas.getContext('2d',{willReadFrequently:true});
function resetBoxPositions(){[...objects.children].forEach((box,i)=>{box.classList.remove('tracking-box');box.hidden=false;box.style.transform='';box.style.cssText=`left:${candidates[i].x*100}%;top:${candidates[i].y*100}%;width:${candidates[i].w*100}%;height:${candidates[i].h*100}%`;});}
async function openKiyoCamera(){
 const devices=await navigator.mediaDevices.enumerateDevices();
 let target=devices.find(d=>d.kind==='videoinput'&&(preferredCameraId?d.deviceId===preferredCameraId:/kiyo/i.test(d.label))),bootstrap;
 try{
  let cameras=devices.filter(d=>d.kind==='videoinput');
  if(!target){bootstrap=await navigator.mediaDevices.getUserMedia({video:true,audio:false});cameras=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');target=cameras.find(d=>preferredCameraId?d.deviceId===preferredCameraId:/kiyo/i.test(d.label));}
  const select=$('#camera-device');select.replaceChildren();for(const camera of cameras){const option=document.createElement('option');option.value=camera.deviceId;option.textContent=camera.label||'摄像头';select.append(option);}
  if(!target)throw Error('没有找到 Razer Kiyo，请连接摄像头后重试；不会自动使用内置摄像头。');
  select.value=target.deviceId;preferredCameraId=target.deviceId;
  if(bootstrap?.getVideoTracks()[0].getSettings().deviceId===target.deviceId)return bootstrap;
  bootstrap?.getTracks().forEach(t=>t.stop());bootstrap=null;
  return await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:target.deviceId},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false});
 }catch(error){bootstrap?.getTracks().forEach(t=>t.stop());throw error;}
}
function trackingCanSelect(){return !focusFeedback.active&&!!trackingDetection&&performance.now()-trackingAt<450&&performance.now()-trackingStableSince>=500;}
function stopTracking(clear=true){trackingGeneration++;playback.cancel(trackerTimer);trackerBusy=false;if(clear){focusFeedback.reset();screen.dataset.lensAf='false';sound.af.loop=false;trackingDetection=null;trackingPrevious=null;trackingReadySound=false;objects.hidden=true;}}
function ensureTracker(){
 if(trackerWorker)return;
 trackerWorker=new Worker('tracker-worker.js?case=toys-v1');
 trackerWorker.onerror=event=>{trackerBusy=false;status.textContent='图卡识别加载失败，请刷新重试。';console.error(event.message);};
 trackerWorker.onmessage=({data})=>{
  if(data.type==='ready'){trackerLoaded=true;return;}
  if(data.type==='error'){trackerBusy=false;status.textContent='图卡识别暂不可用：'+data.message;return;}
  if(data.type==='result'&&staticRecognition&&data.generation===staticRecognition.generation){const pending=staticRecognition;staticRecognition=null;trackerBusy=false;pending.resolve(data.result);return;}
  if(data.type!=='result'||data.generation!==trackingGeneration)return;
  trackerBusy=false;if(source!=='camera'||!['af','stable','ready'].includes(flow.phase))return;
  focusFeedback.observe(data.sharpness,!!data.result,performance.now(),flow.phase==='ready');
  handleTrackingResult(data.result);
 };
}
function startTracking(token){
 stopTracking();ensureTracker();trackingStableSince=performance.now();
 function tick(){
  if(token!==sourceToken||source!=='camera'||['capturing','caught','idle'].includes(flow.phase)){trackerTimer=playback.schedule(tick,100);if(token!==sourceToken||source!=='camera')playback.cancel(trackerTimer);return;}
  if(trackerLoaded&&!trackerBusy&&video.readyState>=2){
   const width=Math.min(800,video.videoWidth),height=Math.round(video.videoHeight*width/video.videoWidth);trackingCanvas.width=width;trackingCanvas.height=height;trackingContext.drawImage(video,0,0,width,height);const pixels=trackingContext.getImageData(0,0,width,height),sharpness=frameSharpness(pixels);trackerBusy=true;trackerWorker.postMessage({type:'frame',generation:trackingGeneration,width,height,sharpness,buffer:pixels.data.buffer},[pixels.data.buffer]);
  }
  trackerTimer=playback.schedule(tick,100);
 }
 trackerTimer=playback.schedule(tick,0);
}
function updateTrackingUI(){
 if(source!=='camera'||flow.phase!=='ready')return;
 if(focusFeedback.active){focus.hidden=false;objects.hidden=true;status.textContent='镜头重新对焦中…';return;}
 const valid=trackingCanSelect();focus.hidden=false;objects.hidden=true;
 if(!trackingReadySound&&valid){play(sound.ready);trackingReadySound=true;}status.textContent='短按拍照键，拍下眼前的整个场景';
}
function handleTrackingResult(result){
 const now=performance.now();
 if(!result){trackingFailures++;if(trackingFailures>=3){trackingDetection=null;trackingPrevious=null;trackingStableSince=now;trackingReadySound=false;objects.hidden=true;}updateTrackingUI();return;}
 trackingFailures=0;
 const rawMarkers=result.objects.map(o=>o.quad.reduce((c,p)=>[c[0]+p[0]/4,c[1]+p[1]/4],[0,0]));
 const markers=trackingPrevious?rawMarkers.map((p,i)=>[p[0]*.25+trackingPrevious[i][0]*.75,p[1]*.25+trackingPrevious[i][1]*.75]):rawMarkers;
 const movement=trackingPrevious?markers.reduce((sum,p,i)=>sum+Math.hypot(p[0]-trackingPrevious[i][0],p[1]-trackingPrevious[i][1]),0)/markers.length:0;
 if(!trackingPrevious){trackingStableSince=now;trackingMotion=0;}
 trackingMotion=trackingMotion*.65+movement*.35;
 if(trackingMotion>.018){trackingStableSince=now;trackingReadySound=false;objects.hidden=true;}
 if(trackingDetection){result.objects.forEach((o,i)=>{o.quad=o.quad.map((p,j)=>[p[0]*.4+trackingDetection.objects[i].quad[j][0]*.6,p[1]*.4+trackingDetection.objects[i].quad[j][1]*.6]);});}
 trackingPrevious=markers;trackingDetection=result;trackingAt=now;
 const side=Math.min(video.videoWidth,video.videoHeight),offsetX=(video.videoWidth-side)/2,offsetY=(video.videoHeight-side)/2,px=screen.clientWidth;
 candidates=result.objects.map(object=>{
  const quad=object.quad.map(p=>[(p[0]*video.videoWidth-offsetX)/side,(p[1]*video.videoHeight-offsetY)/side]);
  const x=Math.max(0,Math.min(...quad.map(p=>p[0]))),y=Math.max(0,Math.min(...quad.map(p=>p[1]))),right=Math.min(1,Math.max(...quad.map(p=>p[0]))),bottom=Math.min(1,Math.max(...quad.map(p=>p[1])));
  return {...object,quad,x,y,w:Math.max(0,right-x),h:Math.max(0,bottom-y)};
 });
 [...objects.children].forEach((box,i)=>{
  const o=candidates[i];box.classList.add('tracking-box');
  box.style.left=o.x*100+'%';box.style.top=o.y*100+'%';
  box.style.width=o.w*100+'%';box.style.height=o.h*100+'%';box.style.transform='none';
  box.hidden=o.w<.025||o.h<.025;
 });
 renderSelection();updateTrackingUI();
}
function disposeCamera(){
 stopTracking();cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;video.srcObject=null;}
function clearCapture(){
 resetDiscovery();device.getAnimations().forEach(a=>a.cancel());card.getAnimations().forEach(a=>a.cancel());card.hidden=true;freeze.hidden=true;flash.hidden=true;lastCapture=null;}
async function useSource(next){
 const token=++sourceToken;flow.reset();stopSounds();playback.cancel(motionQuietTimer);disposeCamera();clearCapture();selected=0;candidates=targetObjects.map(o=>({...o}));resetBoxPositions();renderSelection();started=true;$('.start-camera').hidden=true;
 source=next;video.hidden=next!=='camera';demo.hidden=next==='camera';
 for(const [id,mode] of [['#use-camera','camera'],['#use-demo','demo']])$(id).setAttribute('aria-pressed',String(mode===next));
 if(next==='camera'){
  status.textContent='正在打开摄像头…';
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera unavailable');
   const stream=await openKiyoCamera();
   if(token!==sourceToken){stream.getTracks().forEach(t=>t.stop());return;}
   cameraStream=stream;video.srcObject=stream;await video.play();if(token!==sourceToken)return;
   $('.camera-name').textContent=stream.getVideoTracks()[0].label;startTracking(token);
  }catch(error){
   if(token!==sourceToken)return;disposeCamera();video.hidden=true;demo.hidden=true;flow.reset();$('.camera-name').textContent='未连接 Razer Kiyo';status.textContent=error.name==='NotAllowedError'?'请允许摄像头权限，再点「Razer Kiyo」。':error.message;$('.start-camera').hidden=false;return;
  }
 }else {await demo.decode().catch(()=>{});candidates=candidates.map(o=>({...o,x:(o.x-.5)*1.025+.5,y:(o.y-.5)*1.025+.5,w:o.w*1.025,h:o.h*1.025}));resetBoxPositions();renderSelection();}
 if(token===sourceToken)flow.focus();
}
function moveDevice(){if(!started||!['af','stable','ready'].includes(flow.phase))return;flow.focus();}
// IMU packets interrupt the simulated gates. Desktop testing uses the movement button.
window.addEventListener('devicemotion',event=>{const r=event.rotationRate;if(!r||!started||!['af','stable','ready'].includes(flow.phase))return;if(Math.max(Math.abs(r.alpha||0),Math.abs(r.beta||0),Math.abs(r.gamma||0))<8)return;flow.clear();flow.set('af');playback.cancel(motionQuietTimer);motionQuietTimer=playback.schedule(()=>flow.focus(),140);});
function turn(direction){if(playback.paused)return;if(flow.phase==='fishing'){reelFishing(direction);return;}if(flow.phase!=='selection')return;selected=(selected+direction+candidates.length)%candidates.length;renderSelection();play(sound.wheelSelect);playWheelFeedback(direction);status.textContent=`${candidates[selected].name} · 按下滚轮确认对象`;}
function playWheelFeedback(direction){if(!reduced)$('.wheel').animate([{translate:'0 '+direction*1.5+'%',filter:'brightness(1.15)'},{translate:'0 0',filter:'brightness(1)'}],{duration:140});}
function cropViewport(ctx,image,iw,ih){const side=Math.min(iw,ih)/(source==='demo'?1.025:1);ctx.drawImage(image,(iw-side)/2,(ih-side)/2,side,side,0,0,480,480);}
let staticRecognition=null;
async function recognizeFrozen(original,token){
 if(source==='demo')return {demo:true};
 ensureTracker();
 for(let i=0;i<100&&!trackerLoaded;i++){await playback.delay(50);if(token!==sourceToken)return null;}
 if(!trackerLoaded)return null;
 const width=Math.min(800,original.width),height=Math.round(original.height*width/original.width);trackingCanvas.width=width;trackingCanvas.height=height;trackingContext.drawImage(original,0,0,width,height);const pixels=trackingContext.getImageData(0,0,width,height);
 return new Promise(resolve=>{const generation=trackingGeneration;staticRecognition={resolve,generation};trackerWorker.postMessage({type:'frame',generation,width,height,sharpness:frameSharpness(pixels),buffer:pixels.data.buffer},[pixels.data.buffer]);playback.schedule(()=>{if(staticRecognition?.resolve===resolve){staticRecognition=null;resolve(null)}},5000);});
}
async function capture(via){
 if (via === 'shutter' && embeddedHome && embeddedHome.screen.dataset.page === 'camera') {
  embeddedHome.setPage('photo-play');
  return;
 }
 if(playback.paused)return;
 if(['confirmed','fire-complete'].includes(flow.phase)&&via==='shutter'){useSource(source);return;}
 if(flow.phase==='selection'){
  if(via!=='wheel')return;
  if(candidates[selected].id==='fire-truck'){beginFireTruck(sourceToken,{...candidates[selected]});return;}
  discoveryVoiceCancel?.();flow.set('confirmed');objects.hidden=false;status.textContent='已确认 '+candidates[selected].name+' · 后续互动接口已预留';
  device.dispatchEvent(new CustomEvent('discovery-object-confirmed',{bubbles:true,detail:{...lastCapture,objectId:candidates[selected].id,name:candidates[selected].name,bounds:candidates[selected]}}));return;
 }
 if(via!=='shutter'||flow.phase!=='ready')return;
 const image=source==='camera'?video:demo,iw=source==='camera'?video.videoWidth:demo.naturalWidth,ih=source==='camera'?video.videoHeight:demo.naturalHeight;
 if(!iw||!ih)return;
 if (embeddedHome) embeddedHome.setPage('camera', true);
 flow.capture();stopTracking(false);const token=sourceToken;
 const original=document.createElement('canvas');original.width=iw;original.height=ih;original.getContext('2d').drawImage(image,0,0,iw,ih);
 still.width=still.height=480;cropViewport(still.getContext('2d'),original,iw,ih);
 lastCapture=Object.freeze({source,width:iw,height:ih,capturedAt:Date.now(),original:original.toDataURL('image/png')});
 freeze.hidden=false;objects.hidden=true;focus.hidden=true;sound.af.pause();play(sound.shutter);flash.hidden=false;
 if(!reduced){try{await flash.animate([{opacity:.85},{opacity:0}],{duration:180,fill:'forwards'}).finished;}catch{return;}}
 flash.hidden=true;flash.getAnimations().forEach(a=>a.cancel());if(token!==sourceToken)return;
 flow.set('processing');processingLayer.hidden=false;processingImage.src='assets/processing.gif';$('.processing-stars').src='assets/star-sparkle.gif';processingSound.loop=true;play(processingSound);status.textContent='正在识别照片中的对象…';
 const [result]=await Promise.all([recognizeFrozen(original,token),playback.delay(3000)]);
 if(token!==sourceToken)return;processingSound.pause();processingLayer.hidden=true;processingImage.removeAttribute('src');$('.processing-stars').removeAttribute('src');
 if(!result){flow.set('unrecognized');status.textContent='这张照片里没有匹配到消防车、积木和小熊图卡，请按菜单键重新拍摄。';return;}
 if(!result.demo)handleTrackingResult(result);
 selected=0;resetBoxPositions();renderSelection();flow.set('selection');play(recognitionBeep);status.textContent='转动滚轮选择照片中的对象 · 按下滚轮确认';
 speakDiscovery('assets/select-toys-hana.mp3');
 for(const [i,box] of [...objects.children].entries())if(!reduced)box.animate([{opacity:0},{opacity:1}],{duration:400,delay:i*180,fill:'backwards'});
 device.dispatchEvent(new CustomEvent('discovery-photo-recognized',{bubbles:true,detail:{...lastCapture,objects:candidates}}));
}

const processingLayer=$('.processing-stage'),processingImage=processingLayer.querySelector('img'),energyLayer=$('.energy'),energyCursor=$('.energy-cursor'),zigSpeaking=$('.zig-speaking');
const processingSound=new Audio('assets/6_ai_processing.mp3'),recognitionBeep=new Audio('assets/7_ShortBeep.mp3'),discoveryVoice=new Audio();
let discoveryVoiceCancel=null;
const delay=playback.delay;
function speakDiscovery(src,onStart,rate=1){discoveryVoiceCancel?.();return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;playback.cancel(timer);discoveryVoice.onended=discoveryVoice.onerror=discoveryVoice.onplaying=null;discoveryVoice.pause();discoveryVoiceCancel=null;resolve();};const timer=playback.schedule(finish,30000);discoveryVoiceCancel=finish;discoveryVoice.onended=finish;discoveryVoice.onerror=finish;discoveryVoice.onplaying=()=>{onStart?.();onStart=null;};discoveryVoice.src=src;discoveryVoice.playbackRate=rate;discoveryVoice.preservesPitch=true;discoveryVoice.currentTime=0;discoveryVoice.play().catch(finish);});}
const energyCharge=new HoldEnergy({duration:3000,onChange:value=>{
 const angle=value*360;energyLayer.style.setProperty('--energy-angle',angle+'deg');
 const radians=Math.PI+value*2*Math.PI;energyCursor.style.left=(50+190/480*100*Math.cos(radians))+'%';energyCursor.style.top=(50+190/480*100*Math.sin(radians))+'%';
 
 energyLayer.setAttribute('aria-label','Zig能量 '+Math.round(value*100)+'%');
 if(flow.phase==='energy')status.textContent='按住滚轮键给Zig能量 · '+Math.round(value*100)+'%';
},onComplete:()=>finishEnergy(sourceToken)});
function resetDiscovery(){resetFishing();resetFireInteraction();$('.capture-blur').hidden=true;energyCharge.reset();stopEnergyMusic();zigCelebrate.pause();$('.result-stage').hidden=true;$('.result-label').hidden=true;$('.cursor-orbit').classList.remove('celebrate');discoveryVoiceCancel?.();discoveryVoice.pause();processingSound.pause();recognitionBeep.pause();processingLayer.hidden=true;energyLayer.hidden=true;zigSpeaking.hidden=true;processingImage.removeAttribute('src');zigSpeaking.removeAttribute('src');}
async function beginDiscovery(token,chosen){
 if(token!==sourceToken)return;flow.set('processing');objects.hidden=true;focus.hidden=true;
 processingLayer.hidden=false;processingImage.src='assets/processing.gif';processingSound.loop=true;play(processingSound);
 status.textContent='识别中…';
 // Begin with the centered 250px photo, then pulse without moving its center.
 if(!reduced){
  processingLayer.animate([{opacity:0},{opacity:1}],{duration:400,easing:'ease-out'});
  try{await card.animate([{width:'52.083333%'},{width:'58.333333%',offset:1/6},{width:'52.083333%',offset:2/6},{width:'58.333333%',offset:3/6},{width:'52.083333%',offset:4/6},{width:'58.333333%',offset:5/6},{width:'52.083333%'}],{duration:3000,easing:'ease-in-out'}).finished;}catch{return;}
 }else await delay(3000);
 if(token!==sourceToken)return;processingSound.pause();processingLayer.hidden=true;processingImage.removeAttribute('src');
 flow.set('reveal');$('.result-stage').hidden=false;$('.result-label').textContent=chosen.name;$('.result-label').hidden=false;play(recognitionBeep);status.textContent='你找到了'+chosen.name+' · 听听Zig的提示';
 await delay(400);if(token!==sourceToken)return;
 await speakDiscovery('assets/found-'+chosen.id+'-intro-hana.mp3',undefined,.85);if(token!==sourceToken)return;
 await delay(500);if(token!==sourceToken)return;
 await speakDiscovery('assets/wheel-energy-cue-hana.mp3',()=>{
  if(token!==sourceToken)return;
  flow.set('energy');$('.result-label').hidden=true;energyCharge.reset();energyLayer.hidden=false;if(!reduced)energyLayer.animate([{opacity:0},{opacity:1}],{duration:400,easing:'ease-out'});setEnergyMusic(false);status.textContent='按住滚轮键给Zig能量 · 松开保留进度';
 });
}
async function finishEnergy(token){
 if(flow.phase!=='energy'||token!==sourceToken)return;flow.set('energy-success');stopEnergyMusic();play(energyMusic.success);status.textContent='充能成功！';
 $('.cursor-orbit').classList.add('celebrate');
 await delay(1000);if(token!==sourceToken)return;
 energyLayer.hidden=true;zigSpeaking.src='assets/zig-b4.gif';zigSpeaking.hidden=false;play(zigCelebrate);
 await delay(zigB4Duration);if(token!==sourceToken)return;
 zigSpeaking.src='assets/zig-a7.gif';energyLayer.hidden=true;
 await delay(400);if(token!==sourceToken)return;
 flow.set('narration');zigSpeaking.src='assets/zig-b1.gif';status.textContent='听听'+lastCapture.name+'的小知识';
 await speakDiscovery('assets/fact-'+lastCapture.objectId+'-hana.mp3');if(token!==sourceToken)return;
 zigSpeaking.src='assets/zig-a7.gif';flow.set('complete');status.textContent='短按拍照键，继续探索';
}
const energyMusic={waiting:new Audio('assets/energy-wait.wav'),charging:new Audio('assets/energy-charge.wav'),success:new Audio('assets/energy-success.wav')};
energyMusic.waiting.loop=energyMusic.charging.loop=true;
Object.values(energyMusic).forEach(a=>a.volume=.6);
function stopEnergyMusic(){Object.values(energyMusic).forEach(a=>a.pause());}
function setEnergyMusic(charging){stopEnergyMusic();const a=charging?energyMusic.charging:energyMusic.waiting;if(!playback.paused)a.play().catch(()=>{});}
const zigB4Duration=2520;
const zigCelebrate=new Audio('assets/25_2_B4_Zig.WAV');
playback.register(...Object.values(sound),processingSound,recognitionBeep,discoveryVoice,zigCelebrate,...Object.values(energyMusic),video);
let pausedMedia=[],pausedAnimations=[],gifSnapshots=[],resumeEnergy=false;
playback.listeners.push(paused=>{
 document.body.classList.toggle('prototype-paused',paused);
 const button=$('.playback-toggle');button.textContent=paused?'▶ 开始':'Ⅱ 暂停';button.setAttribute('aria-label',paused?'继续原型':'暂停原型');button.setAttribute('aria-pressed',String(paused));
 if(paused){
  resumeEnergy=energyCharge.held;energyCharge.stop();
  pausedMedia=[...playback.media].filter(a=>!a.paused&&!a.ended);pausedMedia.forEach(a=>a.pause());
  pausedAnimations=document.getAnimations().filter(a=>a.playState==='running');pausedAnimations.forEach(a=>a.pause());
  gifSnapshots=[...screen.querySelectorAll('img')].filter(img=>img.src.includes('.gif')&&img.getBoundingClientRect().width&&img.complete).map(img=>{const c=document.createElement('canvas'),r=img.getBoundingClientRect(),sr=screen.getBoundingClientRect();c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);c.className='paused-gif';c.style.cssText=`position:absolute;left:${(r.left-sr.left)/sr.width*100}%;top:${(r.top-sr.top)/sr.height*100}%;width:${r.width/sr.width*100}%;height:${r.height/sr.height*100}%;z-index:${getComputedStyle(img).zIndex==='auto'?getComputedStyle(img.parentElement).zIndex:getComputedStyle(img).zIndex};pointer-events:none`;img.style.visibility='hidden';img.parentElement===screen?screen.append(c):img.parentElement.append(c);if(img.parentElement!==screen)c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';return {img,c};});
 }else{
  gifSnapshots.forEach(({img,c})=>{img.style.visibility='';c.remove()});gifSnapshots=[];
  pausedAnimations.forEach(a=>a.play());pausedMedia.forEach(a=>a.play().catch(()=>{}));
  if(resumeEnergy&&$('.wheel').hasAttribute('data-held'))energyCharge.start();else if(flow.phase==='energy')setEnergyMusic(false);
 }
});
$('.playback-toggle').addEventListener('click',()=>playback.toggle());
const fireSiren=new Audio('assets/fire-truck-siren.wav');
const fireHappy=new Audio('assets/26_1_A1_1_Zig.WAV');
let fireHappyCancel=null;
function playHappy(){return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;fireHappy.onended=fireHappy.onerror=null;fireHappy.pause();fireHappyCancel=null;resolve();};fireHappyCancel=finish;fireHappy.onended=fireHappy.onerror=finish;fireHappy.currentTime=0;fireHappy.play().catch(finish);});}
const chooVoice=new Audio();
playback.register(fireSiren,fireHappy,chooVoice);
let chooRecording=null,chooVoiceCancel=null;
fetch('assets/choo-recording.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(info=>{chooRecording=info}).catch(()=>{});
function replayChoo(){return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;chooVoice.onended=chooVoice.onerror=null;chooVoice.pause();chooVoiceCancel=null;resolve()};chooVoiceCancel=finish;chooVoice.onended=chooVoice.onerror=finish;chooVoice.src='assets/'+chooRecording.file+'?v='+chooRecording.savedAt;chooVoice.play().catch(finish);});}

const fireDurations={"b2": 990, "a12": 1680};
function showFireZig(file){zigSpeaking.src='assets/'+file;zigSpeaking.hidden=false;}
function resetFireInteraction(){resetAnswerProcessing();fireHappyCancel?.();fireHappy.pause();chooVoiceCancel?.();chooVoice.pause();fireSiren.pause();$('.voice-choices').hidden=true;$('.speech').removeAttribute('data-held');}
// Active-time fishing model: continuous rapid turns beat the downward pull.
const fishingMeter=$('.fishing-meter');let fishingProgress=0,fishingElapsed=0,fishingLastRoll=-100,fishingTick=null,fishingSoundTimer=null,fishingGeneration=0,fishingChosen=null;
const reelingZig=$('.reeling-zig');
function hideReelingZig(){
 reelingZig.hidden=true;
 reelingZig.classList.remove('first-pull');
}
function resetFishing(){hideReelingZig();hideFishingRod();fishingGeneration++;playback.cancel(fishingTick);playback.cancel(fishingSoundTimer);fishingMeter.hidden=true;card.classList.remove('is-fishing');card.style.removeProperty('left');card.style.removeProperty('top');card.style.removeProperty('width');fishingChosen=null;}
function renderFishing(){const pct=fishingProgress*100;fishingMeter.style.setProperty('--fishing-fill',pct+'%');fishingMeter.setAttribute('aria-valuenow',Math.round(pct));status.textContent='快速转动滚轮，把 '+fishingChosen.name+' 拉回来！ · '+Math.round(pct)+'% · 慢转或停转会下滑';}
function startFishing(token,chosen){
 fishingChosen=chosen;fishingProgress=.08;fishingElapsed=0;fishingLastRoll=0;const generation=++fishingGeneration;
 reelingZig.hidden=false;
 flow.set('fishing');const cx=(chosen.x+chosen.w/2)*480,cy=(chosen.y+chosen.h/2)*480;
 card.classList.add('is-fishing');card.style.left=cx/480*100+'%';card.style.top=cy/480*100+'%';card.style.width='25%';
 const right=cx+83,barX=right>405?cx-83:right,barY=Math.max(90,Math.min(390,cy));fishingMeter.style.left=barX/480*100+'%';fishingMeter.style.top=barY/480*100+'%';fishingMeter.hidden=false;$('.capture-blur').hidden=false;setEnergyMusic(false);renderFishing();
 if(!reduced)card.animate([{scale:.4,opacity:.3},{scale:1.12,opacity:1,offset:.7},{scale:1,opacity:1}],{duration:420,easing:'ease-out'});
 function tick(){if(generation!==fishingGeneration||token!==sourceToken||flow.phase!=='fishing')return;fishingElapsed+=.05;const gap=fishingElapsed-fishingLastRoll;
  if(gap>.25)fishingProgress=Math.max(0,fishingProgress-Math.min(.22,.10+(gap-.25)*.06)*.05);
  fishingMeter.classList.toggle('is-slipping',gap>.4);renderFishing();fishingTick=playback.schedule(tick,50);
 }fishingTick=playback.schedule(tick,50);showFishingRod(null);
 void speakDiscovery('assets/reel-in-hana.mp3');
}
function reelFishing(direction){
 reelingZig.classList.add('first-pull');
 const gap=Math.max(.08,fishingElapsed-fishingLastRoll),boost=.065+Math.min(.04,.012/gap);fishingLastRoll=fishingElapsed;fishingProgress=Math.min(1,fishingProgress+boost);renderFishing();play(sound.wheelSelect);playWheelFeedback(direction);setEnergyMusic(true);playback.cancel(fishingSoundTimer);fishingSoundTimer=playback.schedule(()=>{if(flow.phase==='fishing')setEnergyMusic(false)},260);
 if(!reduced){card.animate([{transform:'translate(0,0) rotate(0deg)',scale:1},{transform:`translate(${direction*5}px,-9px) rotate(${direction*9}deg)`,scale:1.12,offset:.35},{transform:'translate(0,0) rotate(0deg)',scale:1}],{duration:280,easing:'cubic-bezier(.2,.7,.25,1)'});fishingMeter.animate([{scale:1},{scale:1.09,offset:.3},{scale:1}],{duration:220,easing:'ease-out'});}
 if(fishingProgress>=1)finishFishing(sourceToken);
}
const fishingRod=$('.fishing-rod');let rodFrame=null,rodVersion=0;
function hideFishingRod(){rodVersion++;cancelAnimationFrame(rodFrame);fishingRod.setAttribute('hidden','');fishingRod.getAnimations().forEach(a=>a.cancel())}
function drawFishingRod(progress=0){
 const rect=screen.getBoundingClientRect(),photo=card.getBoundingClientRect(),hookX=(photo.left+photo.width/2-rect.left)/rect.width*480,hookY=(photo.top-rect.top)/rect.height*480+4;
 const reeling=flow.phase==='fishing',gap=fishingElapsed-fishingLastRoll,tension=reeling?Math.max(0,Math.min(1,1-(gap-.1)/.65)):1;fishingRod.dataset.tension=tension>.55?'taut':'loose';
 const pull=reeling?tension:Math.sin(Math.min(1,progress/.65)*Math.PI/2),tipX=375-42*pull,tipY=106-34*pull;
 const pole=`M 432 410 Q ${455-24*pull} 210 ${tipX} ${tipY}`;
 fishingRod.querySelector('.rod-shadow').setAttribute('d',pole);fishingRod.querySelector('.rod-pole').setAttribute('d',pole);
 const slack=reeling?(1-tension)*65:(progress<.2?22*(1-progress/.2):8*(1-progress));
 fishingRod.querySelector('.rod-line').setAttribute('d',`M ${tipX} ${tipY} Q ${(tipX+hookX)/2} ${(tipY+hookY)/2+slack} ${hookX} ${hookY}`);
 fishingRod.querySelector('.rod-hook').setAttribute('d',`M ${hookX} ${hookY-3} v 7 q 0 7 -5 7 q -5 0 -5 -5`);
}
function showFishingRod(animation){hideFishingRod();const version=rodVersion;fishingRod.removeAttribute('hidden');drawFishingRod(0);if(!reduced)fishingRod.animate([{opacity:0},{opacity:1}],{duration:100,easing:'ease-out'});
 function follow(){if(version!==rodVersion)return;drawFishingRod(Math.min(1,(animation?.currentTime||0)/1000));rodFrame=requestAnimationFrame(follow)}follow();
}
async function finishFishing(token){
 if(flow.phase!=='fishing')return;flow.set('fishing-success');playback.cancel(fishingTick);playback.cancel(fishingSoundTimer);stopEnergyMusic();play(energyMusic.success);status.textContent='拉回成功！';await delay(180);if(token!==sourceToken)return;
 fishingMeter.hidden=true;const x=card.style.left,y=card.style.top;card.classList.remove('is-fishing');card.getAnimations().forEach(a=>a.cancel());card.style.left='50%';card.style.top='50%';card.style.width='52.083333%';
 if(!reduced){try{const jump=card.animate([{left:x,top:y,width:'25%',offset:0},{left:x,top:y,width:'18.75%',offset:.2,easing:'cubic-bezier(.3,0,.8,.3)'},{left:'50%',top:'50%',width:'59.375%',offset:.62,easing:'ease-out'},{left:'50%',top:'50%',width:'48.958333%',offset:.8},{left:'50%',top:'50%',width:'53.75%',offset:.91},{left:'50%',top:'50%',width:'52.083333%',offset:1}],{duration:1000,easing:'cubic-bezier(.2,.65,.3,1)'});showFishingRod(jump);await jump.finished;}catch{hideFishingRod();return;}}else showFishingRod(null);
 if(token!==sourceToken)return;card.style.removeProperty('left');card.style.removeProperty('top');card.style.removeProperty('width');await delay(160);if(token!==sourceToken)return;if(!reduced){try{await fishingRod.animate([{opacity:1},{opacity:0}],{duration:150,easing:'ease-in'}).finished;}catch{return;}}hideFishingRod();if(token!==sourceToken)return;await showFireTruckIntro(token);
}

function beginFireTruck(token,chosen){
 discoveryVoiceCancel?.();
 // Crop the chosen subject from the same frozen photograph; preserve its aspect ratio.
 const side=Math.max(chosen.w,chosen.h)*480,x=Math.max(0,Math.min(480-side,(chosen.x+chosen.w/2)*480-side/2)),y=Math.max(0,Math.min(480-side,(chosen.y+chosen.h/2)*480-side/2));subject.width=subject.height=480;subject.getContext('2d').drawImage(still,x,y,side,side,0,0,480,480);card.hidden=false;
 startFishing(token,chosen);
}
async function showFireTruckIntro(token){
 hideReelingZig();
 flow.set('fire-intro');
 $('.capture-blur').hidden=true;
 $('.result-stage').hidden=false;
 status.textContent='来听听消防车的声音';
 showFireZig('zig-b2.gif');
 const celebration=delay(fireDurations.b2);
 if(!reduced){
  const grow=card.animate([{width:'52.083333%'},{width:'70.833333%'}],{duration:400,easing:'ease-out'});
  try{await grow.finished;}catch{return;}
 }
 await celebration;if(token!==sourceToken)return;
 flow.set('fire-question');showFireZig('zig-b1.gif');status.textContent='We caught a fire truck! What sound does it make? Can you imitate it?';
 await speakDiscovery('assets/caught-fire-truck-question-hana.mp3');if(token!==sourceToken)return;
 flow.set('fire-wait');showFireZig('zig-a7.gif');status.textContent='按下说话键，模仿消防车的声音';
}
function beginFireListening(){
 if(playback.paused||flow.phase!=='fire-wait')return;
 flow.set('fire-listening');showFireZig('zig-a3-1-loop.gif');$('.speech').setAttribute('data-held','');$('.voice-choices').hidden=false;status.textContent='选择你模仿的声音';
}
function resetAnswerProcessing(){const overlay=$('.answer-processing');overlay.hidden=true;overlay.querySelectorAll('img').forEach(img=>img.removeAttribute('src'));}
async function processFireAnswer(token){
 flow.set('fire-processing');zigSpeaking.hidden=true;const overlay=$('.answer-processing');overlay.querySelector('.answer-zig').src='assets/answer-zig-a3-1.gif';overlay.querySelector('.answer-loading').src='assets/answer-loading.gif';overlay.hidden=false;status.textContent='AI正在处理你的回答…';
 await delay(4000);if(token!==sourceToken)return false;resetAnswerProcessing();return true;
}
async function chooseFireSound(){
 if(playback.paused||flow.phase!=='fire-listening')return;
 const token=sourceToken;$('.speech').removeAttribute('data-held');$('.voice-choices').hidden=true;
 if(chooRecording){flow.set('fire-replay');showFireZig('zig-a3-1-loop.gif');status.textContent='Choo-choo!';await replayChoo();if(token!==sourceToken)return;}
 if(!await processFireAnswer(token))return;
 flow.set('fire-happy');showFireZig('zig-a1-1.gif');status.textContent='Zig听到了你的声音！';
 await Promise.all([playHappy(),delay(1980)]);if(token!==sourceToken)return;
 flow.set('fire-reaction');showFireZig('zig-a7.gif');play(fireSiren);status.textContent='听听消防车的警铃';
 await delay(3200);if(token!==sourceToken)return;
 fireSiren.pause();flow.set('fire-praise');showFireZig('zig-b1.gif');status.textContent='听听Zig的回应';
 await speakDiscovery('assets/fire-truck-praise-hana.mp3');if(token!==sourceToken)return;
 flow.set('fire-complete');showFireZig('zig-a7.gif');status.textContent='短按拍照键，继续探索';
}
$('.choo-choice').addEventListener('click',chooseFireSound);
let wheelDelta=0,lastWheelAt=0;
$('.wheel').addEventListener('wheel',event=>{event.preventDefault();const now=performance.now();if(now-lastWheelAt>150)wheelDelta=0;lastWheelAt=now;wheelDelta+=event.deltaY*([1,16,100][event.deltaMode]??1);if(Math.abs(wheelDelta)>=24){turn(Math.sign(wheelDelta));wheelDelta=0;}},{passive:false});
for(const key of ['speech','wheel','shutter','menu']){
 const button=$('.'+key);let down=false,startY=0,dragged=false,downAt=0;
 function hold(){if(down||playback.paused)return;down=true;downAt=performance.now();button.setAttribute('data-held','');if(key==='speech'&&flow.phase==='fire-wait')beginFireListening();if(key==='wheel')play(sound.wheelPress);if(key==='wheel'&&flow.phase==='energy'){energyCharge.start();setEnergyMusic(true);}}
 function release(cancel=false){if(!down)return;if(key==='speech'&&flow.phase==='fire-listening'){down=false;return;}const charging=key==='wheel'&&flow.phase==='energy';if(key==='wheel'){energyCharge.stop();if(charging)setEnergyMusic(false);}down=false;button.removeAttribute('data-held');if(charging||cancel||dragged||performance.now()-downAt>500)return;if(key==='shutter'||key==='wheel')capture(key);else if(key==='menu')backFromSnap();}
 button.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragged=false;startY=event.clientY;button.setPointerCapture(event.pointerId);hold();});
 button.addEventListener('pointermove',event=>{if(key!=='wheel'||!down||playback.paused||flow.phase==='energy')return;const delta=event.clientY-startY;if(Math.abs(delta)<14)return;dragged=true;startY=event.clientY;turn(Math.sign(delta));});
 button.addEventListener('pointerup',()=>release());button.addEventListener('pointercancel',()=>release(true));button.addEventListener('lostpointercapture',()=>release(true));button.addEventListener('blur',()=>release(true));
 button.addEventListener('keydown',event=>{if(key==='wheel'&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();turn(event.key==='ArrowDown'?1:-1);return;}if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();dragged=false;hold();}});
 button.addEventListener('keyup',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();release();}});
 // Accessibility activation without physical pointer or keyboard events.
 button.addEventListener('click',event=>{if(event.detail===0&&!down&&performance.now()-downAt>550){if(key==='wheel'||key==='shutter')capture(key);else if(key==='speech')beginFireListening();else if(key==='menu')backFromSnap();}});
}
$('.start-camera').addEventListener('click',()=>useSource('camera'));$('#use-camera').addEventListener('click',()=>useSource('camera'));$('#use-demo').addEventListener('click',()=>useSource('demo'));$('#restart').addEventListener('click',()=>useSource(source));$('#move-device').addEventListener('click',()=>{trackingStableSince=performance.now();moveDevice();});
$('#camera-device').addEventListener('change',()=>{preferredCameraId=$('#camera-device').value;if(started)useSource('camera');});
window.addEventListener('pagehide',()=>{sourceToken++;flow.reset();resetDiscovery();disposeCamera();stopSounds();});
// Integration points for later real detector / AF / IMU adapters; frames stay browser-local.
window.snapAndReveal=Object.freeze({get lastCapture(){return lastCapture},get phase(){return flow.phase},setLabelsEnabled(enabled){recognitionUI.labelsEnabled=!!enabled;screen.dataset.labelsEnabled=String(!!enabled)},get selectedId(){return candidates[selected].id},simulateMovement:moveDevice});

const cornerObserver=new ResizeObserver(entries=>{for(const {target:box} of entries){const w=box.clientWidth,h=box.clientHeight,r=Math.min(14,w*.12,h*.12),a=Math.min(49,w*.38,h*.38);box.querySelector('.corner-path').setAttribute('d',`M ${a} 2 H ${r+2} Q 2 2 2 ${r+2} V ${a} M ${w-a} ${h-2} H ${w-r-2} Q ${w-2} ${h-2} ${w-2} ${h-r-2} V ${h-a}`);}});objects.querySelectorAll('.object-box').forEach(n=>cornerObserver.observe(n));

const embeddedHome = parent !== window && parent.homeDevice;
function backFromSnap() {
  if (!embeddedHome) return useSource(source);
  const inFinder = embeddedHome.screen.dataset.page === 'photo-play';
  embeddedHome.setPage(inFinder ? 'camera' : 'apps');
}
if (embeddedHome) {
  document.documentElement.classList.add('embedded');
  window.setSnapPage = page => {
    if (page === 'photo-play' || started) useSource(started ? source : 'camera');
  };
  window.setSnapPage(location.hash.slice(1));
}
