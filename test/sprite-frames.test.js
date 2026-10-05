const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolatePixels,pointingLayout}=require('../src/sprite-frames');
test('isolating poses removes corner fragments while preserving the body and substantial interior props',()=>{
  const w=80,h=80,data=new Uint8ClampedArray(w*h*4);
  const fill=(x,y,width,height)=>{for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++)data[(row*w+col)*4+3]=255;};
  fill(20,20,25,50);fill(50,22,12,12);fill(0,0,15,4);fill(75,75,5,5);fill(65,5,2,2);
  const result=isolatePixels(data,w,h);
  assert.equal(result.pixels[(30*w+30)*4+3],255);assert.equal(result.pixels[(25*w+55)*4+3],255);
  assert.equal(result.pixels[3],0);assert.equal(result.pixels[(78*w+78)*4+3],0);assert.equal(result.pixels[(5*w+65)*4+3],0);
  assert.deepEqual(result.bounds,[20,20,42,50]);assert.ok(result.removed>0);
});
test('a body touching the crop edge is retained instead of disappearing',()=>{
  const data=new Uint8ClampedArray(12*12*4);for(let row=0;row<12;row++)for(let col=0;col<8;col++)data[(row*12+col)*4+3]=255;
  assert.equal(isolatePixels(data,12,12).pixels[3],255);
});
test('all pointing images align the fingertip to the target anchor at either DPI',()=>{
  for(const ratio of [1,1.5,2])for(const [bounds,finger] of [[[20,10,900,1200],{x:918,y:290}],[[8,8,950,1100],{x:956,y:330}]]){
    const width=280*ratio,height=280*ratio,layout=pointingLayout(bounds,finger,width,height),scale=layout.width/bounds[2];
    assert.ok(Math.abs(layout.x+(finger.x-bounds[0])*scale-216*ratio)<.001);
    assert.ok(Math.abs(layout.y+(finger.y-bounds[1])*scale-82*ratio)<.001);
    assert.ok(Math.abs(width-layout.anchor.x-64*ratio)<.001);assert.ok(layout.x>=0&&layout.y>=0);
    assert.ok(layout.x+layout.width<=width&&layout.y+layout.height<=height);
  }
});
