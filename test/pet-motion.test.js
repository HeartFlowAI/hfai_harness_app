const test=require('node:test');
const assert=require('node:assert/strict');
const {motionPlan,startPetMotion}=require('../src/pet-motion');
function fakeWindow(x,y){
  const positions=[],events=[];
  return {positions,events,getBounds:()=>({x,y}),isDestroyed:()=>false,setPosition(a,b){x=a;y=b;positions.push({x,y});},emit(e){events.push(e);}};
}
test('vertical movement relocates once while invisible, never walks up or down',async()=>{
  const win=fakeWindow(100,50);
  const motion=startPetMotion(win,{x:100,y:400},{teleportMs:5});
  assert.equal(await motion.done,true);
  assert.deepEqual(win.positions,[{x:100,y:400}]);
  assert.deepEqual(win.events,[{state:'teleporting',phase:'out'},{state:'teleporting',phase:'in'}]);
});
test('diagonal movement teleports directly to the destination in one relocation',async()=>{
  const win=fakeWindow(100,50);
  const motion=startPetMotion(win,{x:94,y:400},{teleportMs:2,frameMs:3});
  assert.equal(await motion.done,true);
  assert.deepEqual(win.events.at(-1),{state:'teleporting',phase:'in'});
  assert.ok(win.positions.every(point=>point.y===400));
  assert.deepEqual(win.positions.at(-1),{x:94,y:400});
  assert.equal(win.positions.length,1);
});
test('cancelling a teleport prevents delayed repositioning and subsequent walk',async()=>{
  const win=fakeWindow(100,50);
  const motion=startPetMotion(win,{x:200,y:400},{teleportMs:100});
  motion.cancel();
  assert.equal(await motion.done,false);
  assert.deepEqual(win.positions,[]);
  assert.equal(win.events.length,1);
});
test('a horizontal move keeps its height; zero movement is a no-op',()=>{
  assert.deepEqual(motionPlan({x:100,y:50},{x:100,y:50}),[]);
  assert.equal(motionPlan({x:100,y:50},{x:140,y:50})[0].type,'teleport');
});
