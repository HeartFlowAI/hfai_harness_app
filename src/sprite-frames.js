// Isolate a pose at render time. Atlas pixels stay untouched on disk.
function isolatePixels(data,width,height) {
  const labels=new Int32Array(width*height),queue=new Int32Array(width*height),parts=[];
  for(let p=0;p<labels.length;p++){
    if(labels[p]||data[p*4+3]<64)continue;
    const id=parts.length+1;let head=0,tail=0,minX=width,minY=height,maxX=0,maxY=0;queue[tail++]=p;labels[p]=id;
    while(head<tail){const at=queue[head++],x=at%width,y=Math.floor(at/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const next=ny*width+nx;if(!labels[next]&&data[next*4+3]>=64){labels[next]=id;queue[tail++]=next;}}
    }
    parts.push({id,size:tail,minX,minY,maxX,maxY,edge:minX===0||minY===0||maxX===width-1||maxY===height-1});
  }
  const largest=parts.reduce((best,part)=>!best||part.size>best.size?part:best,null);
  if(!largest)return {pixels:new Uint8ClampedArray(data.length),bounds:[0,0,width,height],removed:0};
  // Retain substantial interior props, such as a floating browser panel.
  const kept=parts.filter(part=>part===largest||(!part.edge&&part.size>=Math.max(32,largest.size*.01))),ids=new Set(kept.map(part=>part.id));
  const pixels=new Uint8ClampedArray(data.length);let removed=0;
  for(let p=0;p<labels.length;p++){if(ids.has(labels[p]))pixels.set(data.subarray(p*4,p*4+4),p*4);else if(data[p*4+3])removed++;}
  const x=Math.min(...kept.map(p=>p.minX)),y=Math.min(...kept.map(p=>p.minY)),right=Math.max(...kept.map(p=>p.maxX)),bottom=Math.max(...kept.map(p=>p.maxY));
  return {pixels,bounds:[x,y,right-x+1,bottom-y+1],removed};
}
function prepareFrame(image,rect) {
  const [x,y,w,h]=rect.map(Math.round),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(image,x,y,w,h,0,0,w,h);
  const data=ctx.getImageData(0,0,w,h),isolated=isolatePixels(data.data,w,h);data.data.set(isolated.pixels);ctx.putImageData(data,0,0);
  return {canvas,bounds:isolated.bounds,removed:isolated.removed};
}
function pointingLayout(bounds,finger,width,height) {
  const [x,y,w,h]=bounds,anchor={x:width*216/280,y:height*82/280};
  const scale=Math.min((height*.88-anchor.y)/(y+h-finger.y),anchor.x/(finger.x-x),(width-anchor.x)/(x+w-finger.x||1));
  return {x:anchor.x-(finger.x-x)*scale,y:anchor.y-(finger.y-y)*scale,width:w*scale,height:h*scale,anchor};
}
function preparePointing(image){
  const frame=prepareFrame(image,[0,0,image.naturalWidth,image.naturalHeight]),[x,y,w,h]=frame.bounds;
  const ctx=frame.canvas.getContext('2d'),strip=ctx.getImageData(x+w-3,y,3,h).data;let count=0,total=0;
  for(let row=0;row<h;row++)for(let col=0;col<3;col++){if(strip[(row*3+col)*4+3]>=64){total+=row;count++;}}
  frame.finger={x:x+w-1,y:y+(count?total/count:h*.24)};return frame;
}
const api={isolatePixels,prepareFrame,preparePointing,pointingLayout};
if(typeof module!=='undefined')module.exports=api;else window.AuroraSpriteFrames=api;
