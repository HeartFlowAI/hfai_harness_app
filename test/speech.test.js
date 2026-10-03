const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createSegmenter,pcmWave}=require('../src/audio-segmenter');const {createCloudRecognizer,classify}=require('../src/cloud-recognizer');const {createScribe,transcribeFish}=require('../src/speech-provider');const {greetingPicker}=require('../src/voice-greetings');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(2);}throw Error('Speech test timed out');}
function chunk(amplitude=0){const pcm=Buffer.alloc(3200);for(let i=0;i<pcm.length;i+=2)pcm.writeInt16LE(i%4?amplitude:-amplitude,i);return pcm;}
test('silence ends a complete utterance once; silent input and short noise never become a request',()=>{
 const ends=[],chunks=[];let starts=0;const segmenter=createSegmenter({onStart:()=>starts++,onChunk:pcm=>chunks.push(pcm),onEnd:value=>ends.push(value)});
 for(let i=0;i<20;i++)segmenter.push(chunk());assert.equal(starts,0);
 for(let i=0;i<5;i++)segmenter.push(chunk(5000));for(let i=0;i<10;i++)segmenter.push(chunk());
 assert.equal(starts,1);assert.equal(ends.length,1);assert.equal(ends[0].valid,true);assert.equal(segmenter.active,false);assert.ok(chunks.length>=15);
 for(let i=0;i<10;i++)segmenter.push(chunk());assert.equal(ends.length,1);
});
test('continuous noise has a hard recording limit and manual finish works without a recognizer final event',()=>{
 const ends=[];const s=createSegmenter({maxMs:1000,onStart:()=>{},onChunk:()=>{},onEnd:e=>ends.push(e)});for(let i=0;i<10;i++)s.push(chunk(5000));assert.equal(ends.length,1);assert.equal(ends[0].durationMs,1000);
 s.push(chunk(5000));s.push(chunk(5000));assert.equal(s.finish(),true);assert.equal(s.finish(),false);assert.equal(ends.length,2);assert.equal(ends[1].valid,true);
 assert.equal(pcmWave(chunk()).readUInt32LE(24),16000);
});
test('cloud recognition releases the microphone on silence before a committed transcript and ignores late results after stopping',async()=>{
 let pcm;const calls=[],events=[],streams=[];const r=createCloudRecognizer({provider:'elevenlabs',key:'fixture',onEvent:e=>events.push(e),captureFactory:callbacks=>{pcm=callbacks.onPCM;return {start:async()=>{},record:async enabled=>calls.push(enabled),stop:()=>calls.push('stop')};},scribeFactory:options=>{const stream={...options,feed:()=>{},commit:()=>calls.push('commit'),abort:()=>calls.push('abort')};streams.push(stream);return stream;}});
 await r.start();await r.mode('wake');pcm(chunk(5000));pcm(chunk(5000));for(let i=0;i<10;i++)pcm(chunk());await until(()=>calls.includes('commit'));assert.ok(calls.indexOf(false)<calls.indexOf('commit'));
 streams[0].onFinal('Hey Aurora!');assert.equal(events.at(-1).type,'wake');assert.equal(events.at(-1).text,'');
 await r.mode('listen');pcm(chunk(5000));pcm(chunk(5000));streams[1].onPartial('find my');assert.equal(events.at(-1).type,'partial');
 await r.finish();await until(()=>calls.filter(x=>x==='commit').length===2);r.stop();const length=events.length;streams[1].onFinal('late task');assert.equal(events.length,length);assert.equal(calls.at(-1),'stop');
});
test('Fish transcription submits a completed recording automatically; mode changes discard a pending result',async()=>{
 let pcm,resolve;const events=[],calls=[];const r=createCloudRecognizer({provider:'fish',key:'fixture',onEvent:e=>events.push(e),captureFactory:cb=>{pcm=cb.onPCM;return {start:async()=>{},record:async v=>calls.push(v),stop:()=>{}};},fishTranscribe:()=>new Promise(r=>resolve=r)});
 await r.start();await r.mode('listen');pcm(chunk(5000));pcm(chunk(5000));for(let i=0;i<10;i++)pcm(chunk());await until(()=>resolve);assert.equal(calls.at(-1),false);assert.equal(events.at(-1).type,'speech-end');
 await r.mode('paused');resolve('Wrong old reply');await wait(5);assert.ok(!events.some(e=>e.type==='text'));r.stop();
});
test('wake words accept an attached task, while controls and approvals stay exact and scoped',()=>{
 assert.deepEqual(classify('Hey Aurora, find my file!','wake',''),{type:'wake',text:'find my file!'});
 assert.equal(classify('I saw an aurora yesterday','wake',''),null);
 assert.equal(classify('yes','approval','id'),null);assert.equal(classify('please approve action','approval','id'),null);
 assert.deepEqual(classify('Approve action.','approval','id'),{type:'approval',text:'approve action',scope:'id'});
 assert.deepEqual(classify('Stop task!','control',''),{type:'control',text:'stop task'});
});
test('Scribe authenticates in headers, streams interim words, and explicitly commits once without double submitting',async()=>{
 let socket,url,options;class Socket extends EventEmitter{constructor(u,o){super();socket=this;url=u;options=o;this.sent=[];}send(value){this.sent.push(JSON.parse(value));}terminate(){this.closed=true;}}
 const partial=[],final=[],errors=[];const stream=createScribe({key:'secret',Socket,onPartial:t=>partial.push(t),onFinal:t=>final.push(t),onError:e=>errors.push(e)});
 stream.feed(chunk(5000));stream.commit();socket.emit('message',JSON.stringify({message_type:'session_started'}));assert.equal(options.headers['xi-api-key'],'secret');assert.ok(!url.includes('secret'));assert.ok(url.includes('commit_strategy=manual'));
 assert.equal(socket.sent.filter(m=>m.commit).length,1);socket.emit('message',JSON.stringify({message_type:'partial_transcript',text:'find my'}));socket.emit('message',JSON.stringify({message_type:'committed_transcript',text:'find my file'}));socket.emit('message',JSON.stringify({message_type:'committed_transcript',text:'duplicate'}));
 assert.deepEqual(partial,['find my']);assert.deepEqual(final,['find my file']);assert.equal(socket.closed,true);assert.deepEqual(errors,[]);
});
test('Fish uploads WAV with the selected model, strips speaker tags, and reports errors without key leakage',async()=>{
 let request;const text=await transcribeFish({pcm:chunk(5000),key:'secret',fetchImpl:async(url,options)=>{request={url,...options};return new Response(JSON.stringify({text:'<|speaker:0|> Find my file.'}),{headers:{'Content-Type':'application/json'}});}});
 assert.equal(text,'Find my file.');assert.equal(request.headers.model,'transcribe-1-pro');assert.equal(request.headers.Authorization,'Bearer secret');assert.equal(request.body.get('audio').type,'audio/wav');assert.equal(request.body.get('tag_audio_events'),'false');assert.ok(!request.url.includes('secret'));
 await assert.rejects(transcribeFish({pcm:chunk(),key:'secret',fetchImpl:async()=>new Response('secret',{status:401})}),/401/);
});
test('greetings change without immediate repeats',()=>{const pick=greetingPicker(()=>0);let previous=pick();for(let i=0;i<15;i++){const next=pick();assert.notEqual(next,previous);previous=next;}});
