const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateAction,applicationPath,compactObservation,observePage,createComputerControl}=require('../src/computer-control');
const {executeTool}=require('../src/tools');
const {synthesize}=require('../src/voice-provider');

test('combined browser navigation forwards the URL in a single tool call',async()=>{
 const calls=[];await executeTool('open_application',{application:'opera',url:'https://www.youtube.com/results?search_query=despacito'},{signal:new AbortController().signal,openApplication:async(...args)=>{calls.push(args);return {reused:true};}});assert.equal(calls.length,1);assert.equal(calls[0][1],'https://www.youtube.com/results?search_query=despacito');
});
test('page readiness ignores unchanged old controls and stops polling once new controls appear',async()=>{
 const signal=new AbortController().signal,old={title:'Old page',controls:[{id:'v1:1',name:'Old link',kind:'Link'}]},fresh={title:'YouTube',controls:[{id:'v3:2',name:'Despacito',kind:'Link'}]};let calls=0;
 const result=await observePage(async()=>++calls===1?{...old,controls:[{...old.controls[0],id:'v2:1'}]}:fresh,signal,old);assert.equal(calls,2);assert.equal(result,fresh);
 const stopped=new AbortController();stopped.abort();await assert.rejects(observePage(async()=>fresh,stopped.signal),/abort/i);
});
test('page readiness stops if another application becomes foreground',async()=>{
 await assert.rejects(observePage(async()=>({windowId:'other',title:'Other browser',controls:[{kind:'Link',name:'Other page'}]}),new AbortController().signal,{windowId:'requested',title:'Opera',controls:[]}),/foreground window changed/);
});
test('computer input returns a fresh observation without requiring another model tool call',async()=>{
 const {EventEmitter}=require('node:events'),calls=[];const spawnImpl=()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};child.stdin={write:line=>{const request=JSON.parse(line);calls.push(request.action);const result=request.action==='observe'?{title:'Fresh page',controls:[{id:'v2:1',name:'Search',kind:'Edit'}]}:{performed:request.action};process.nextTick(()=>child.stdout.emit('data',JSON.stringify({id:request.id,ok:true,result})+'\n'));}};process.nextTick(()=>child.stdout.emit('data','{"ready":true}\n'));return child;};
 const computer=createComputerControl({spawnImpl});try{const result=await computer.action({action:'keys',keys:'CTRL+L'},new AbortController().signal);assert.deepEqual(calls,['keys','observe']);assert.equal(result.observation.controls[0].id,'v2:1');}finally{computer.cancel();}
});

test('browser navigation accepts web URLs and rejects unsafe destinations',()=>{
  assert.doesNotThrow(()=>validateAction({action:'navigate',url:'https://www.youtube.com/results?search_query=despacito'}));
  for(const url of ['javascript:alert(1)','file:///C:/Windows','https://user:password@example.com','not a URL','https://example.com/'+ 'a'.repeat(1500)])assert.throws(()=>validateAction({action:'navigate',url}),/http or https/);
});

test('large browser observations retain valid JSON and exact control IDs within the tool budget',()=>{
  const controls=Array.from({length:280},(_,i)=>({id:`m4:${i}`,name:'Video '+i+' '+ 'x'.repeat(220),kind:'Link',editable:false,provider:'msaa',value:''}));
  const result=compactObservation({windowId:'123',title:'YouTube',controls,truncated:false});
  const json=JSON.stringify(result);assert.ok(json.length<27000);assert.ok(result.truncated);assert.ok(result.controls.length>0&&result.controls.length<280);assert.equal(JSON.parse(json).controls[0].id,'m4:0');assert.equal(Object.hasOwn(result.controls[0],'value'),false);
  assert.deepEqual(compactObservation({title:'Small',controls:[{id:'v2:1',name:'Search',kind:'Edit',editable:true,provider:'uia',value:'music'}]}).controls[0].value,'music');
});
test('computer input rejects arbitrary shortcuts, raw coordinates, executables and control characters',async()=>{
  assert.throws(()=>validateAction({action:'keys',keys:'WIN+R'}),/shortcut/);
  assert.throws(()=>validateAction({action:'click',x:'1',y:'1'}),/exact id/);
  assert.throws(()=>validateAction({action:'type',target:'v1:1',text:'hello\ncommand'}),/control characters/);
  await assert.rejects(applicationPath('powershell',{},async()=>true),/Supported apps/);
  const calls=[];await executeTool('computer',{action:'observe'},{signal:new AbortController().signal,computer:async args=>calls.push(args)});
  assert.equal(calls[0].action,'observe');
  await assert.rejects(executeTool('computer',{action:'click',x:'1'},{signal:new AbortController().signal}),/Unexpected/);
});
test('voice summaries keep written details separate and cannot send an oversized spoken reply',async()=>{
  const result=await executeTool('voice_reply',{spoken:'Found it—right here.',written:'Long details with a filename and location.'},{signal:new AbortController().signal});
  assert.equal(result.spoken,'Found it—right here.');assert.ok(result.written.includes('filename'));
  await assert.rejects(executeTool('voice_reply',{spoken:'a'.repeat(501),written:'Details'},{signal:new AbortController().signal}),/brief/);
});
test('Fish PCM begins delivering audio before the response finishes and preserves odd chunk boundaries',async()=>{
  const chunks=[],order=[];let body;
  const fetchImpl=async(url,options)=>{body=JSON.parse(options.body);return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([0,1,2]));setTimeout(()=>{controller.enqueue(new Uint8Array([3]));controller.close();},10);}}),{headers:{'content-type':'audio/pcm'}});};
  const result=await synthesize({provider:'fish',key:'fixture',voiceId:'fixture',text:'Hi.',fetchImpl,onStart:()=>order.push('start'),onChunk:b=>{order.push('chunk');chunks.push(Buffer.from(b));}});order.push('done');
  assert.deepEqual(order,['start','chunk','chunk','done']);assert.deepEqual(result.audio,Buffer.concat(chunks));assert.equal(body.format,'pcm');assert.equal(body.sample_rate,24000);assert.equal(result.streamed,true);
});

test('Brave reuses its minimized window, navigates and returns fresh page controls',async()=>{
 const {EventEmitter}=require('node:events'),calls=[];let navigated=false;
 const spawnImpl=()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};child.stdin={write:line=>{const req=JSON.parse(line);calls.push(req);let result={performed:req.action};if(req.action==='windows')result={windows:[{id:'brave-window',process:'brave',minimized:true,title:'Brave'}]};if(req.action==='navigate')navigated=true;if(req.action==='observe')result={windowId:'brave-window',process:'brave',title:navigated?'YouTube':'Brave',controls:navigated?[{id:'fresh:1',name:'Play requested song',kind:'Button'}]:[]};process.nextTick(()=>child.stdout.emit('data',JSON.stringify({id:req.id,ok:true,result})+'\n'));}};process.nextTick(()=>child.stdout.emit('data','{"ready":true}\n'));return child;};
 const computer=createComputerControl({spawnImpl});try{const result=await computer.open('brave',new AbortController().signal,'https://www.youtube.com/results?search_query=despacito');assert.equal(result.reused,true);assert.equal(calls.find(c=>c.action==='focus').target,'brave-window');assert.equal(calls.filter(c=>c.action==='navigate').length,1);assert.equal(result.observation.controls[0].id,'fresh:1');}finally{computer.cancel();}
});
test('Brave resolves both machine-wide and per-user standard installations',async()=>{
 const path=require('node:path'),env={LOCALAPPDATA:'C:/Users/Fixture/AppData/Local',ProgramFiles:'C:/Program Files'};
 for(const base of [env.ProgramFiles,env.LOCALAPPDATA]){const expected=path.join(base,'BraveSoftware/Brave-Browser/Application/brave.exe');assert.equal(await applicationPath('brave',env,async file=>file===expected),expected);}
});
