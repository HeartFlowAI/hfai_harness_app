const test=require('node:test');
const assert=require('node:assert/strict');
const {createVoiceSession}=require('../src/voice-session');
const {synthesize,spokenText}=require('../src/voice-provider');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(2);}throw Error('Voice test timed out');}
function fixture(execute=async()=>({content:'Done.'}),options={}){
 const modes=[],speech=[],errors=[],states=[];let event,started=0,stopped=0,shown=0;
 const session=createVoiceSession({createListener:callback=>{event=callback;return {start:async()=>{started++;},mode:async mode=>modes.push(mode),stop:()=>stopped++};},speak:(text,signal)=>new Promise((resolve,reject)=>{speech.push({text,resolve});signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});}),execute,show:()=>shown++,onState:s=>states.push(s),onError:e=>errors.push(e),echoMs:0,getGreeting:()=> 'What do you need?',...options});
 return {session,modes,speech,errors,states,event:e=>event(e),get started(){return started;},get stopped(){return stopped;},get shown(){return shown;}};
}
test('wake greeting pauses input; requests and completion speech never capture their own output',async()=>{
 const requests=[];const f=fixture(async text=>{requests.push(text);return {content:'Found it.'};});
 assert.equal(f.started,0);assert.equal(f.session.active,false);
 await f.session.start();assert.deepEqual(f.modes,['wake']);
 f.event({type:'wake'});await until(()=>f.speech.length===1);
 assert.equal(f.modes.at(-1),'paused');assert.equal(f.speech[0].text,'What do you need?');assert.equal(f.shown,1);
 f.event({type:'text',text:'speaker echo'});assert.equal(requests.length,0);
 f.speech[0].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'text',text:'Find my file'});await until(()=>f.speech.length===2);
 assert.deepEqual(requests,['Find my file']);assert.equal(f.modes.at(-1),'paused');
 f.event({type:'wake'});assert.equal(f.speech.length,2);
 f.speech[1].resolve();await until(()=>f.session.status==='listening');f.session.stop();assert.equal(f.stopped,1);assert.deepEqual(f.errors,[]);
});
test('verified music sign-off returns to wake mode after playback rather than reopening conversation',async()=>{const f=fixture(async()=>({content:'Enjoy the music.',emotion:'calm',sleepAfterReply:true}));await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);f.speech[0].resolve();await until(()=>f.session.status==='listening');f.event({type:'text',text:'Play music'});await until(()=>f.speech.length===2);assert.equal(f.session.status,'speaking');f.speech[1].resolve();await until(()=>f.session.status==='wake');assert.equal(f.session.active,true);assert.equal(f.modes.at(-1),'wake');f.event({type:'wake'});await until(()=>f.speech.length===3);f.speech[2].resolve();await until(()=>f.session.status==='listening');f.session.stop();assert.deepEqual(f.errors,[]);});
test('follow-up answer continues the pending task and final reply leaves conversation open',async()=>{
 let finish;const requests=[];const f=fixture(async text=>{requests.push(text);if(requests.length===1)return new Promise(resolve=>{finish=resolve;});return {continuing:true};});
 await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);f.speech[0].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'text',text:'Search for something'});await until(()=>!!finish);
 const asking=f.session.ask('Which file?');await until(()=>f.speech.length===2);f.speech[1].resolve();await asking;
 f.event({type:'text',text:'The invoice'});await until(()=>requests.length===2);assert.equal(f.session.status,'working');
 finish({content:'Here is your invoice.'});await until(()=>f.speech.length===3);f.speech[2].resolve();await until(()=>f.session.status==='listening');f.session.stop();
 assert.deepEqual(requests,['Search for something','The invoice']);assert.deepEqual(f.errors,[]);
});
test('turning listening off aborts speech and never reopens the microphone after a late completion',async()=>{
 const f=fixture();await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);
 f.session.stop();f.speech[0].resolve();await wait(10);assert.equal(f.session.status,'off');assert.equal(f.modes.includes('listen'),false);assert.deepEqual(f.errors,[]);
});
test('a silent activation expires instead of submitting ambient audio as a request',async()=>{
 let requests=0;const f=fixture(async()=>{requests++;},{listenMs:20});await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);f.speech[0].resolve();await until(()=>f.session.status==='listening');await until(()=>f.session.status==='wake');assert.equal(requests,0);f.session.stop();
});
test('typing during the wake greeting pauses speech without turning active listening off',async()=>{
 const f=fixture();await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);
 await f.session.pause();await wait(10);assert.equal(f.session.active,true);assert.equal(f.session.status,'working');assert.deepEqual(f.errors,[]);
 await f.session.resume();assert.equal(f.session.status,'wake');f.session.stop();
});
test('both voice providers use authenticated fixed endpoints and never put the key in a URL',async()=>{
 const requests=[];const fetchImpl=async(url,options)=>{requests.push({url,...options});return new Response(Buffer.from([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}});};
 for(const provider of ['elevenlabs','fish']){const result=await synthesize({provider,key:'secret-voice-key',voiceId:'voice123',text:'**Hello**',fetchImpl});assert.equal(result.audio.length,3);}
 assert.equal(requests[0].headers['xi-api-key'],'secret-voice-key');assert.equal(requests[1].headers.Authorization,'Bearer secret-voice-key');assert.equal(requests[1].headers.model,'s2.1-pro');assert.equal(JSON.parse(requests[1].body).reference_id,'voice123');assert.ok(requests.every(r=>!r.url.includes('secret-voice-key')));
 await assert.rejects(synthesize({provider:'fish',key:'secret',voiceId:'../other',text:'hi',fetchImpl}),/voice ID/);
 await assert.rejects(synthesize({provider:'fish',key:'secret',voiceId:'voice',text:'hi',fetchImpl:async()=>new Response('secret',{status:401})}),/401/);
 await assert.rejects(synthesize({provider:'fish',key:'secret',voiceId:'voice',text:'hi',fetchImpl:async()=>new Response('{}',{headers:{'Content-Type':'application/json'}})}),/playable audio/);
 const controller=new AbortController();controller.abort();let fetched=false;
 await assert.rejects(synthesize({provider:'fish',key:'secret',voiceId:'voice',text:'hi',signal:controller.signal,fetchImpl:async()=>{fetched=true;}}));assert.equal(fetched,false);
 assert.equal(spokenText('Hello [world](https://example.com).\n```js\nsecret code\n```'),'Hello world. See the code in our chat.');
});

test('partial words are display-only and a second request needs no new wake word',async()=>{
 const heard=[],requests=[];const f=fixture(async text=>{requests.push(text);return {content:'Done.'};},{onPartial:text=>heard.push(text)});
 await f.session.start();f.event({type:'partial',text:'ambient noise'});assert.equal(heard.length,0);
 f.event({type:'wake'});await until(()=>f.speech.length===1);f.speech[0].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'partial',text:'find my'});f.event({type:'partial',text:'find my invoice'});assert.deepEqual(heard,['find my','find my invoice']);assert.equal(requests.length,0);
 f.event({type:'text',text:'Find my invoice'});await until(()=>f.speech.length===2);f.speech[1].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'text',text:'Now search the web'});await until(()=>f.speech.length===3);assert.equal(requests.length,2);f.speech[2].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'text',text:'go to sleep'});await until(()=>f.session.status==='wake');assert.equal(requests.length,2);f.session.stop();
});

test('spoken approval requires the exact confirmation grammar and current action scope',async()=>{
 const decisions=[];const f=fixture(undefined,{onApproval:(id,allow)=>decisions.push({id,allow})});await f.session.start();
 const asking=f.session.askApproval('action-1','Run this command. Say approve action or deny action.');await until(()=>f.speech.length===1);
 f.event({type:'approval',scope:'action-1',text:'approve action'});assert.equal(decisions.length,0,'speaker echo while speaking cannot approve');
 f.speech[0].resolve();await asking;assert.equal(f.session.status,'approval');assert.equal(f.modes.at(-1),'approval');
 f.event({type:'text',text:'yes'});f.event({type:'approval',scope:'old-action',text:'approve action'});f.event({type:'approval',scope:'action-1',text:'yes'});assert.equal(decisions.length,0);
 f.event({type:'approval',scope:'action-1',text:'deny action'});await until(()=>decisions.length===1);assert.deepEqual(decisions,[{id:'action-1',allow:false}]);assert.equal(f.session.status,'working');
 f.event({type:'approval',scope:'action-1',text:'approve action'});assert.equal(decisions.length,1);f.session.stop();
});

test('voice stop cancels a pending task without submitting a command to the model or speaking its late reply',async()=>{
 let finish;const controls=[];const f=fixture(async()=>new Promise(resolve=>finish=resolve),{onControl:command=>controls.push(command)});
 await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);f.speech[0].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'text',text:'Do a task'});await until(()=>!!finish);assert.equal(f.modes.at(-1),'control');
 f.event({type:'control',text:'stop task'});await until(()=>f.session.status==='wake');assert.deepEqual(controls,['stop']);
 finish({content:'Late result'});await wait(10);assert.equal(f.speech.length,1);assert.equal(f.session.status,'wake');f.session.stop();
});

test('going to sleep during work keeps the finished task quiet until the next wake word',async()=>{
 let finish;const f=fixture(async()=>new Promise(resolve=>finish=resolve));await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);f.speech[0].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'text',text:'Search for a file'});await until(()=>!!finish);f.event({type:'control',text:'go to sleep'});await until(()=>f.session.status==='wake');
 finish({content:'Here is the file.'});await wait(10);assert.equal(f.speech.length,1);assert.equal(f.session.status,'wake');
 f.event({type:'wake'});await until(()=>f.speech.length===2);assert.equal(f.speech[1].text,'What do you need?');f.session.stop();
});

test('a completed cloud recording enters transcription, then its final text submits the task once',async()=>{
 const requests=[];const f=fixture(async text=>{requests.push(text);return {content:'Done.'};});await f.session.start();f.event({type:'wake'});await until(()=>f.speech.length===1);f.speech[0].resolve();await until(()=>f.session.status==='listening');
 f.event({type:'speech-start'});f.event({type:'partial',text:'search for'});f.event({type:'speech-end'});assert.equal(f.session.status,'transcribing');assert.equal(requests.length,0);
 f.event({type:'text',text:'Search for Heartflow'});await until(()=>f.speech.length===2);assert.deepEqual(requests,['Search for Heartflow']);f.speech[1].resolve();await until(()=>f.session.status==='listening');f.session.stop();
});

test('a wake utterance containing a task is preserved across the greeting',async()=>{
 const requests=[];const f=fixture(async text=>{requests.push(text);return {content:'Done.'};});await f.session.start();f.event({type:'wake',text:'Find my file'});await until(()=>f.speech.length===1);assert.equal(requests.length,0);f.speech[0].resolve();await until(()=>f.speech.length===2);assert.deepEqual(requests,['Find my file']);f.session.stop();
});
