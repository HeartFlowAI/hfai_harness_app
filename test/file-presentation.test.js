const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createFilePresentation}=require('../src/file-presentation');
function setup(){
 const windows=[],points=[],revealed=[];let child;
 class Window extends EventEmitter{
  constructor(options){super();this.options=options;this.webContents=new EventEmitter();windows.push(this);}
  setContentProtection(){}
  setAlwaysOnTop(){}
  moveTop(){}
  isVisible(){return !!this.visible;}
  isMinimized(){return false;}
  loadFile(){setImmediate(()=>this.webContents.emit('did-finish-load'));}
  setIgnoreMouseEvents(value){this.clickThrough=value;}
  setBounds(bounds){this.bounds=bounds;}
  showInactive(){this.visible=true;}
  hide(){this.visible=false;}
  isDestroyed(){return !!this.destroyed;}
  close(){this.visible=false;this.destroyed=true;}
 }
 const runtime={BrowserWindow:Window,screen:{screenToDipRect:(_,r)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v/2]))},shell:{showItemInFolder:p=>revealed.push(p)},fs:{stat:async()=>({isFile:()=>true})},spawn:()=>{child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{child.killed=true;child.emit('close');};return child;}};
 const presentation=createFilePresentation({runtime,point:r=>points.push(r),finish:()=>{},fallbackMs:250,maxMs:700,highlightMs:60});
 return {windows,points,revealed,presentation,get child(){return child;},emit:value=>child.stdout.emit('data',Buffer.from(JSON.stringify(value)+'\n'))};
}
async function loaded(env){for(let i=0;i<100;i++){if(env.child)return;await new Promise(resolve=>setTimeout(resolve,2));}throw Error('Test helper did not start');}
test('highlight follows verified bounds, converts DPI, ignores clicks, hides when location is lost and expires',async()=>{
 const env=setup();const result=env.presentation.reveal('C:\\fixture.txt');await loaded(env);
 env.emit({visible:true,selected:true,x:100,y:200,width:300,height:40});
 assert.equal((await result).highlighted,true);
 assert.deepEqual(env.windows[0].bounds,{x:46,y:96,width:158,height:28});
 assert.equal(env.windows[0].clickThrough,true);assert.equal(env.windows[0].options.focusable,false);
 env.emit({visible:true,selected:true,x:120,y:240,width:300,height:40});assert.equal(env.points.at(-1).y,120);
 env.emit({visible:false,selected:true});assert.equal(env.windows[0].visible,false);
 env.emit({visible:true,selected:true,x:120,y:240,width:300,height:40});assert.equal(env.windows[0].visible,true);
 await new Promise(resolve=>setTimeout(resolve,80));assert.equal(env.windows[0].destroyed,true);assert.equal(env.child.killed,true);
});
test('unverified locations never draw a border, and cancel clears the helper',async()=>{
 const env=setup();const result=env.presentation.reveal('C:\\fixture.txt');await loaded(env);env.emit({visible:false,selected:true});
 assert.equal((await result).highlighted,false);assert.equal(env.points.length,0);assert.ok(!env.windows[0].visible);
 env.presentation.cancel();assert.equal(env.child.killed,true);
});
