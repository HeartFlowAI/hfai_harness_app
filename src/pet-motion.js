function motionPlan(from, target) {
  const x = Math.round(target.x), y = Math.round(target.y), segments=[];
  if(Math.abs(y-from.y)>1 || Math.abs(x-from.x)>1)segments.push({type:'teleport',x,y});
  return segments;
}

// Adapter-based movement keeps the trajectory testable without a desktop session.
function startPetMotion(adapter,target,{teleportMs=300}={}) {
  const segments=motionPlan(adapter.getBounds(),target);
  let cancelled=false,timer,cancelWait;
  const wait=ms=>new Promise(resolve=>{
    cancelWait=()=>{clearTimeout(timer);resolve(false);};
    timer=setTimeout(()=>{cancelWait=null;resolve(true);},ms);
  });
  const alive=()=>!cancelled&&!adapter.isDestroyed();
  const done=(async()=>{
    for(const segment of segments){
      if(!alive())return false;
      if(segment.type==='teleport'){
        adapter.emit({state:'teleporting',phase:'out'});
        if(!await wait(teleportMs)||!alive())return false;
        adapter.setPosition(segment.x,segment.y); // Relocate once, while invisible.
        adapter.emit({state:'teleporting',phase:'in'});
        if(!await wait(teleportMs)||!alive())return false;
      }
    }
    return alive();
  })();
  return {done,cancel(){cancelled=true;cancelWait?.();}};
}
module.exports={motionPlan,startPetMotion};
