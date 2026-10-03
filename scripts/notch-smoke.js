// Real minimized windows, audio/IPC and scoped approvals; no microphone or cloud calls.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
const output=path.resolve('test-output',`notch-smoke-${Date.now()}`),workspace=path.join(output,'workspace');
app.setPath('userData',path.join(output,'profile'));
const sourceRoot=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');
let recognized,step=0,searches=0,scope='',focused=0,finished=0,releaseComputer;const spoken=[],modes=[];
require(path.join(sourceRoot,'computer-control')).createComputerControl=()=>({action:async()=>new Promise(resolve=>{releaseComputer=()=>resolve({windowId:'fixture',title:'Browser fixture',controls:[]});}),open:async()=>({launched:'fixture'}),cancel:()=>{releaseComputer?.();}});
require(path.join(sourceRoot,'voice-recognizer')).createRecognizer=({onEvent})=>{recognized=onEvent;return {start:async()=>{},mode:async(mode,id)=>{modes.push(mode);scope=id;},stop:()=>{},finish:async()=>finished++};};
function wav(){const size=6400,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(size+36,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;}
require(path.join(sourceRoot,'voice-provider')).synthesize=async({text})=>{spoken.push(text);return {audio:wav(),mime:'audio/wav'};};
const provider=require(path.join(sourceRoot,'provider'));
const tool=(name,args)=>({role:'assistant',content:'',tool_calls:[{function:{name,arguments:args}}]});
provider.chat=async({messages,onText,signal})=>{
 const value=step++;
 if(value===0)return tool('ask_user_question',{question:'Which topic should I search for?',choices:'["Heartflow","Windows","Ollama"]'});
 if(value===1){assert.equal(JSON.parse(messages.at(-1).content).selected_choice,'Heartflow');return tool('web_search',{query:'Heartflow'});}
 if(value===2){onText('I found your result.');return {role:'assistant',content:'I found your result.'};}
 if(value===3)return tool('write_file',{path:'approved.txt',content:'Voice approval works.'});
 if(value===4){assert.equal(JSON.parse(messages.at(-1).content).written,'approved.txt');return {role:'assistant',content:'I wrote your note.'};}
 if(value===5)return tool('write_file',{path:'declined.txt',content:'Must never be written.'});
 if(value===6){assert.equal(JSON.parse(messages.at(-1).content).denied,true);return {role:'assistant',content:'I declined that action.'};}
 if(value===7)return tool('computer',{action:'observe'});
 if(value===8)return {role:'assistant',content:'The browser check is done.'};
 if(value===9)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Stopped')),{once:true}));
 throw Error('Unexpected model step '+value);
};
provider.webSearch=async()=>{searches++;return {results:[{title:'Fixture',url:'https://example.com'}]};};
require(path.join(sourceRoot,'main'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){if(await fn())return;await pause(50);}throw Error('Notch smoke timed out at step '+step);}
app.whenReady().then(async()=>{
 try{
  await fs.mkdir(workspace,{recursive:true});let win,notch;
  await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));notch=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('notch.html'));return win&&notch&&!win.webContents.isLoading()&&!notch.webContents.isLoading();});
  const js=s=>win.webContents.executeJavaScript(s),nj=s=>notch.webContents.executeJavaScript(s);
  async function click(id){await pause(600);const point=await nj(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);notch.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});notch.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});}
  win.show=()=>win.showInactive();win.focus=()=>focused++;
  await js(`(()=>{const RealAudio=window.Audio;window.Audio=function(url){const audio=new RealAudio(url);audio.muted=true;return audio;};return true;})()`);
  await js('window.aurora.saveSettings({key:"fixture-ollama",model:"fixture"})');
  // Select workspace through the real folder-picker IPC, with the picker stubbed to our fixture.
  require('electron').dialog.showOpenDialog=async()=>({canceled:false,filePaths:[workspace]});await js('window.aurora.workspace()');
  await js('window.aurora.voiceSettings({provider:"elevenlabs",key:"fixture-voice-key",voiceId:"voice123",recognizerId:"",fishModel:"s2.1-pro"})');
  await js('window.aurora.voiceToggle(true)');win.showInactive();win.minimize();
  await until(()=>win.isMinimized());await pause(350);assert.equal(notch.isVisible(),false,'idle minimized app must not show a notch');assert.ok(notch.isAlwaysOnTop());assert.equal(notch.isFocusable(),true);
  recognized({type:'wake'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');assert.ok(win.isMinimized());assert.equal(focused,0);
  await until(()=>notch.isVisible());await click('finish');await until(()=>finished===1);
  recognized({type:'partial',text:'find'});recognized({type:'partial',text:'find something'});
  await until(()=>nj('document.getElementById("heard").textContent.includes("find something")'));assert.equal(step,0,'partial speech must never run a task');
  await pause(250);await fs.writeFile(path.join(output,'listening.png'),(await notch.webContents.capturePage()).toPNG());
  recognized({type:'text',text:'Find something'});await until(()=>step===1);await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');
  assert.equal(searches,0);assert.ok(win.isMinimized());assert.ok(await nj('document.getElementById("reply").textContent.includes("Which one did you have in mind?")'));
  assert.equal(spoken[1],'Which one did you have in mind?');
  assert.ok(await nj('document.getElementById("choices").textContent.includes("2. Windows")'));
  recognized({type:'text',text:'something else'});
  await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');
  assert.equal(step,1,'ambiguous answer must not continue the task');
  assert.equal(spoken.at(-1),'Please say an option number or its name.');
  await pause(250);await fs.writeFile(path.join(output,'follow-up.png'),(await notch.webContents.capturePage()).toPNG());
  recognized({type:'text',text:'the first one'});await until(()=>step===3);await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');assert.equal(searches,1);
  recognized({type:'text',text:'Write me a note'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='approval');assert.ok(scope);
  const actionId=scope;await pause(250);await fs.writeFile(path.join(output,'approval.png'),(await notch.webContents.capturePage()).toPNG());
  recognized({type:'text',text:'yes'});recognized({type:'approval',scope:'stale-id',text:'approve action'});await pause(100);
  await assert.rejects(fs.stat(path.join(workspace,'approved.txt')));
  recognized({type:'approval',scope:actionId,text:'approve action'});await until(()=>step===5);await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');
  assert.equal(await fs.readFile(path.join(workspace,'approved.txt'),'utf8'),'Voice approval works.');assert.ok(spoken.includes('I wrote your note.'));assert.ok(win.isMinimized());
  recognized({type:'text',text:'Write another note'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='approval');
  await click('deny');await until(()=>step===7);await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');await assert.rejects(fs.stat(path.join(workspace,'declined.txt')));
  recognized({type:'text',text:'Check my browser'});await until(()=>releaseComputer&&!notch.isVisible());assert.ok(win.isMinimized(),'computer work must keep main app minimized');releaseComputer();await until(()=>step===9);await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');await until(()=>notch.isVisible());
  recognized({type:'text',text:'Do a slow task'});await until(()=>step===10);assert.equal(modes.at(-1),'control');
  await click('stop');await until(async()=>!(await js('window.aurora.load()')).value.busy);await until(async()=>(await js('window.aurora.load()')).value.voice.status==='wake');await until(()=>!notch.isVisible());
  recognized({type:'wake'});await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');assert.notEqual(spoken.at(-1),spoken[0],'wake greetings should vary');await until(()=>notch.isVisible());
  let raised=0;const original=notch.moveTop.bind(notch);notch.moveTop=()=>{raised++;original();};
  const cover=new BrowserWindow({width:200,height:100,show:false});cover.showInactive();await until(()=>raised>0);assert.ok(notch.isAlwaysOnTop());cover.destroy();
  await click('open');await until(()=>!win.isMinimized()&&!notch.isVisible());assert.ok(focused>0);
  recognized({type:'control',text:'minimize Aurora'});await until(()=>win.isMinimized()&&notch.isVisible());
  await click('mic');await until(async()=>(await js('window.aurora.load()')).value.voice.status==='off');await until(()=>!notch.isVisible());
  assert.equal((await nj('window.notch.action({action:"send",text:"bad"})')).ok,false);
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,spoken,modes,searches,raised}));console.log('Notch smoke passed: '+output);app.exit(0);
 }catch(error){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack,spoken,modes,step,scope}));console.error(error);app.exit(1);}
});
