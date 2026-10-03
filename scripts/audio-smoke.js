// Exercise Chromium capture + AudioWorklet + silence detection using synthetic audio.
// getUserMedia is replaced BEFORE record(): no physical microphone or paid API calls.
const {app,BrowserWindow}=require('electron');const path=require('node:path');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
const output=path.resolve('test-output',`audio-smoke-${Date.now()}`);app.setPath('userData',path.join(output,'profile'));
app.on('window-all-closed',()=>{});
const root=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');
assert.equal(typeof require(path.join(root,'..','node_modules','ws')),'function','WebSocket dependency must be included in the app');
const {createAudioCapture}=require(path.join(root,'audio-capture'));const {createCloudRecognizer}=require(path.join(root,'cloud-recognizer'));
const events=[],records=[],errors=[];let captureWindow,bytes=0,transcriptions=0;const levels=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));async function until(fn){for(let i=0;i<200;i++){if(await fn())return;await pause(50);}throw Error('Audio smoke timed out');}
app.whenReady().then(async()=>{
 let listener;
 try{
  listener=createCloudRecognizer({provider:'fish',key:'fixture',onEvent:e=>events.push(e),fishTranscribe:async({pcm})=>{transcriptions++;bytes=pcm.length;assert.equal(await captureWindow.webContents.executeJavaScript('stream===null'),true,'microphone stream must be released before transcription');return 'Find my document.';},captureFactory:callbacks=>{
   const capture=createAudioCapture({...callbacks,onPCM:pcm=>{let peak=0;for(let i=0;i<pcm.length;i+=2)peak=Math.max(peak,Math.abs(pcm.readInt16LE(i)));levels.push(peak);callbacks.onPCM(pcm);}});
   return {start:async()=>{
    await capture.start();captureWindow=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('microphone.html'));
    captureWindow.webContents.on('console-message',(_event,level,message)=>{if(level>=2)errors.push(message);});
    await captureWindow.webContents.executeJavaScript(`(()=>{window._physicalMicrophoneCalls=0;window._synthetic=[];navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.video!==false)throw Error('Unexpected camera request');const ctx=new AudioContext({sampleRate:16000}),destination=ctx.createMediaStreamDestination(),src=ctx.createBufferSource();src.buffer=ctx.createBuffer(1,64000,16000);const data=src.buffer.getChannelData(0);for(let i=0;i<24000;i++)data[i]=.18*Math.sin(i*240*2*Math.PI/16000);src.connect(destination);window._testTone={ctx,src,destination};window._synthetic.push(ctx);await ctx.resume();return destination.stream;};return true;})()`);
   },record:async value=>{records.push(value);return capture.record(value);},stop:()=>capture.stop()};
  }});
  await listener.start();await listener.mode('listen');await captureWindow.webContents.executeJavaScript('window._testTone.src.start()');await until(()=>events.some(e=>e.type==='text'));
  assert.equal(events.find(e=>e.type==='text').text,'Find my document.');assert.equal(transcriptions,1);assert.ok(bytes>=16000);assert.ok(events.some(e=>e.type==='speech-end'));assert.equal(records.at(-1),false);assert.equal(await captureWindow.webContents.executeJavaScript('window._physicalMicrophoneCalls'),0);assert.deepEqual(errors,[]);
  await captureWindow.webContents.executeJavaScript('Promise.all(window._synthetic.map(ctx=>ctx.close()))');listener.stop();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,events,records,bytes,physicalMicrophone:false}));console.log('Audio smoke passed: '+output);app.exit(0);
 }catch(error){let contexts;try{contexts=await captureWindow?.webContents.executeJavaScript('window._synthetic.map(ctx=>({time:ctx.currentTime,state:ctx.state}))');}catch{}listener?.stop();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack,events,records,bytes,errors,levels,contexts}));console.error(error);app.exit(1);}
});
