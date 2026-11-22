// Known-print recognition: ORB descriptors + ratio test + RANSAC homography.
// All image processing runs locally. No camera frame is sent to a server.
export const targetObjects=[
 {id:'fire-truck',name:'Fire Truck',x:.108,y:.499,w:.35,h:.284},
 {id:'blocks',name:'Blocks',x:.598,y:.512,w:.278,h:.245},
 {id:'teddy-bear',name:'Teddy Bear',x:.362,y:.139,w:.278,h:.325}
];
export function project(H,x,y){const z=H[6]*x+H[7]*y+H[8];return[(H[0]*x+H[1]*y+H[2])/z,(H[3]*x+H[4]*y+H[5])/z];}
export class PrintMatcher{
 constructor(cv,rgba){this.cv=cv;this.size=640;this.orb=new cv.ORB(1800,1.2,8,24,0,2,cv.ORB_HARRIS_SCORE,31,12);this.matcher=new cv.BFMatcher(cv.NORM_HAMMING,false);this.keypoints=new cv.KeyPointVector();this.descriptors=new cv.Mat();const gray=new cv.Mat(),scaled=new cv.Mat(),mask=new cv.Mat();cv.cvtColor(rgba,gray,cv.COLOR_RGBA2GRAY);cv.resize(gray,scaled,new cv.Size(this.size,this.size));this.orb.detectAndCompute(scaled,mask,this.keypoints,this.descriptors);gray.delete();scaled.delete();mask.delete();}
 detect(rgba){
 const cv=this.cv,gray=new cv.Mat(),kp=new cv.KeyPointVector(),des=new cv.Mat(),mask=new cv.Mat(),matches=new cv.DMatchVectorVector();let src,dst,inliers,H;
 try{
  cv.cvtColor(rgba,gray,cv.COLOR_RGBA2GRAY);this.orb.detectAndCompute(gray,mask,kp,des);if(des.empty()||des.rows<2||this.descriptors.empty())return null;
  this.matcher.knnMatch(this.descriptors,des,matches,2);const pairs=[],seen=new Set();
  for(let i=0;i<matches.size();i++){const row=matches.get(i);try{if(row.size()<2)continue;const a=row.get(0),b=row.get(1);if(a.distance<.76*b.distance&&a.distance<72&&!seen.has(a.trainIdx)){seen.add(a.trainIdx);pairs.push([this.keypoints.get(a.queryIdx).pt,kp.get(a.trainIdx).pt]);}}finally{row.delete();}}
  if(pairs.length<14)return null;
  src=cv.matFromArray(pairs.length,1,cv.CV_32FC2,pairs.flatMap(p=>[p[0].x,p[0].y]));dst=cv.matFromArray(pairs.length,1,cv.CV_32FC2,pairs.flatMap(p=>[p[1].x,p[1].y]));inliers=new cv.Mat();H=cv.findHomography(src,dst,cv.RANSAC,4,inliers,1800,.995);
  if(H.empty())return null;const count=Array.from(inliers.data).reduce((a,b)=>a+(b?1:0),0);if(count<12||count/pairs.length<.38)return null;
  const h=Array.from(H.data64F),corners=[[0,0],[640,0],[640,640],[0,640]].map(p=>project(h,...p));
  if(corners.some(p=>!p.every(Number.isFinite)))return null;
  const cross=corners.map((p,i)=>{const q=corners[(i+1)%4],r=corners[(i+2)%4];return(q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]);});if(cross.some(c=>c<=0))return null;
  const area=Math.abs(corners.reduce((s,p,i)=>{const q=corners[(i+1)%4];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
  if(area<rgba.cols*rgba.rows*.025||area>rgba.cols*rgba.rows*5)return null;
  const points=pairs.filter((_,i)=>inliers.data[i]);const spanX=Math.max(...points.map(p=>p[0].x))-Math.min(...points.map(p=>p[0].x));const spanY=Math.max(...points.map(p=>p[0].y))-Math.min(...points.map(p=>p[0].y));if(spanX<130||spanY<130)return null;
  return{inliers:count,matches:pairs.length,corners:corners.map(p=>[p[0]/rgba.cols,p[1]/rgba.rows]),objects:targetObjects.map(o=>({...o,quad:[[o.x,o.y],[o.x+o.w,o.y],[o.x+o.w,o.y+o.h],[o.x,o.y+o.h]].map(p=>project(h,p[0]*640,p[1]*640)).map(p=>[p[0]/rgba.cols,p[1]/rgba.rows])}))};
 }finally{[gray,kp,des,mask,matches,src,dst,inliers,H].forEach(o=>o?.delete());}
 }
 delete(){this.orb.delete();this.matcher.delete();this.keypoints.delete();this.descriptors.delete();}
}
// Convert a square's four projected corners to a CSS perspective matrix.
export function quadMatrix(quad,size=157){
 const xy=[[0,0],[size,0],[size,size],[0,size]],a=[];
 xy.forEach(([x,y],i)=>{const[u,v]=quad[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
 for(let i=0;i<8;i++){let p=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;[a[i],a[p]]=[a[p],a[i]];if(Math.abs(a[i][i])<1e-10)return null;const d=a[i][i];for(let k=i;k<9;k++)a[i][k]/=d;for(let j=0;j<8;j++){if(j===i)continue;const m=a[j][i];for(let k=i;k<9;k++)a[j][k]-=m*a[i][k];}}
 const h=a.map(r=>r[8]);return[h[0],h[3],0,h[6],h[1],h[4],0,h[7],0,0,1,0,h[2],h[5],0,1];
}
