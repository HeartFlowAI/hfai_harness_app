// Minimized character handoff, separate voice summary, cached/streamed audio.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('test-output',`handoff-smoke-${Date.now()}`),folder=path.join(output,'files');
app.setPath('userData',path.join(output,'profile'));for(const name of ['desktop','documents','downloads'])app.setPath(name,folder);
delete process.env.OneDrive;delete process.env.OneDriveConsumer;
const root=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');let recognized,step=0,calls=0,pointTimer,endTimes=[],chunksTimes=[];const spoken=[];
require(path.join(root,'voice-recognizer')).createRecognizer=({onEvent})=>{recognized=onEvent;return {start:async()=>{},mode:async()=>{},stop(){}};};
const speech=require(path.join(root,'voice-provider')),original=speech.synthesize;
speech.synthesize=options=>{calls++;spoken.push(options.text);return original({...options,fetchImpl:async()=>new Response(new ReadableStream({start(controller){let count=0;const push=()=>{if(options.signal.aborted){controller.error(Error('aborted'));return;}controller.enqueue(new Uint8Array(4800));chunksTimes.push(Date.now());if(++count===4){endTimes.push(Date.now());controller.close();}else setTimeout(push,70);};push();}}),{headers:{'content-type':'audio/pcm'}})});};
require(path.join(root,'file-presentation')).createFilePresentation=options=>({cancel(){clearInterval(pointTimer);pointTimer=null;options.finish();},async reveal(filename){pointTimer=setInterval(()=>options.point({x:560,y:330,width:150,height:36},filename),60);return {selectedInExplorer:true,highlighted:true,path:filename};}});
const provider=require(path.join(root,'provider')),tool=(name,args)=>({role:'assistant',content:'',tool_calls:[{function:{name,arguments:args}}]});
provider.chat=async({messages})=>{if(step++===0)return tool('find_files',{query:'handoff-fixture'});if(step===2)return tool('reveal_file',{file_id:JSON.parse(messages.at(-1).content).matches[0].id});return tool('voice_reply',{spoken:'Ah, found it—right here.',written:'I selected handoff-fixture.txt in Explorer. Full details stay in the written chat rather than being read aloud.'});};
require(path.join(root,'main'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await wait(40);}throw Error('Handoff timed out at '+step);}
app.whenReady().then(async()=>{try{
 await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'handoff-fixture.txt'),'Isolated fixture.');let win,notch;
 await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));notch=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('notch.html'));return win&&notch&&!win.webContents.isLoading();});const js=s=>win.webContents.executeJavaScript(s);
 await js(`(()=>{window.pcmStarts=[];const push=window.AuroraPcmPlayer.prototype.push;window.AuroraPcmPlayer.prototype.push=function(b){this.context.destination.channelCount=1;window.pcmStarts.push(Date.now());return push.call(this,b);};return true;})()`);
 await js('window.aurora.saveSettings({key:"fixture-ollama",model:"fixture"})');await js('window.aurora.voiceSettings({provider:"fish",key:"fixture-fish",voiceId:"fixture",recognizerId:"",fishModel:"s2.1-pro"})');await js('window.aurora.voiceToggle(true)');win.showInactive();win.minimize();
 recognized({type:'wake'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');assert.ok(notch.isVisible());
 const starts=await js('window.pcmStarts');assert.ok(starts[0]+60<endTimes[0],'first scheduled audio must begin before generation completes');
 recognized({type:'text',text:'Find my handoff fixture'});await until(()=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('pet.html')&&w.isVisible()));assert.equal(notch.isVisible(),false,'notch must be hidden while desktop Aurora is visible');assert.ok(win.isMinimized());
 await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');assert.equal(spoken.at(-1),'Ah, found it—right here.');
 assert.ok((await js('window.aurora.load()')).value.messages.some(m=>m.role==='assistant'&&m.content.includes('Full details')));
 await fs.writeFile(path.join(output,'desktop-pet.png'),(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('pet.html')).webContents.capturePage()).toPNG());
 await js('window.aurora.stop()');await until(()=>notch.isVisible());assert.equal(BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('pet.html')).length,0);assert.ok(win.isMinimized());
 // Same clarification twice must synthesize only once, including PCM cache playback.
 provider.chat=async()=>tool('ask_user_question',{question:'Which one did you have in mind?',choices:'["First", "Second"]'});
 recognized({type:'text',text:'Choose something'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');const before=calls;
 recognized({type:'text',text:'unclear'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');const after=calls;
 recognized({type:'text',text:'still unclear'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');assert.equal(calls,after);assert.equal(after,before+1);
 await js('window.aurora.voiceToggle(false)');await js('window.aurora.stop()');
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,oneAurora:true,notchReturns:true,mainStaysMinimized:true,voiceSummary:true,streamStartsBeforeCompletion:true,repeatedSpeechCached:true}));console.log('Handoff smoke passed: '+output);app.exit(0);
}catch(error){clearInterval(pointTimer);await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack,step,spoken,calls}));console.error(error);app.exit(1);}});
