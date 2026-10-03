// Real UI, IPC, encrypted storage and silent audio playback. No microphone/cloud use.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const output=path.resolve('test-output',`voice-smoke-${Date.now()}`);
app.setPath('userData',path.join(output,'profile'));
const sourceRoot=process.env.AURORA_SMOKE_SOURCE || path.resolve('src');
let recognized,started=0,stopped=0,step=0,searches=0,spoken=[];const modes=[];
const recognition=require(path.join(sourceRoot,'voice-recognizer'));
recognition.createRecognizer=({onEvent})=>{recognized=onEvent;return {start:async()=>{started++;return {type:'ready'};},mode:async value=>modes.push(value),stop:()=>stopped++};};
function wav(seconds=.12){const rate=16000,size=Math.round(rate*seconds)*2,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(36+size,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;}
require(path.join(sourceRoot,'voice-provider')).synthesize=async options=>{spoken.push({provider:options.provider,text:options.text});return {audio:wav(options.provider==='fish'?2:.12),mime:'audio/wav'};};
const provider=require(path.join(sourceRoot,'provider'));
provider.chat=async({messages,onText})=>{
 if(step++===0)return {role:'assistant',content:'',tool_calls:[{function:{name:'ask_user_question',arguments:{question:'Which topic should I search for?'}}}]};
 if(step===2){assert.equal(JSON.parse(messages.at(-1).content).answer,'Heartflow AI');return {role:'assistant',content:'',tool_calls:[{function:{name:'web_search',arguments:{query:'Heartflow AI'}}}]};}
 assert.equal(messages.at(-1).tool_name,'web_search');onText('I found information about Heartflow AI.');return {role:'assistant',content:'I found information about Heartflow AI.'};
};
provider.webSearch=async()=>{searches++;return {results:[{title:'Fixture',url:'https://example.com',content:'Test result'}]};};
require(path.join(sourceRoot,'main'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){if(await fn())return;await pause(50);}throw Error('Voice smoke timed out');}
app.whenReady().then(async()=>{
 try{
  await fs.mkdir(output,{recursive:true});let win;
  await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  const js=s=>win.webContents.executeJavaScript(s);win.webContents.setBackgroundThrottling(false);
  // Wake popup is shown without taking focus from the user's other applications in this test.
  win.show=()=>win.showInactive();let focused=0;win.focus=()=>focused++;
  await js(`(()=>{const RealAudio=window.Audio;window._testAudio=[];window.Audio=function(url){const audio=new RealAudio(url);audio.muted=true;window._testAudio.push(audio);return audio;};return true;})()`);
  const initial=(await js('window.aurora.load()')).value;assert.equal(initial.voice.enabled,false);assert.equal(started,0);
  await js('window.aurora.saveSettings({key:"fake-ollama-key",model:"test"}).then(r=>render(r.value))');
  win.showInactive();
  await js('document.getElementById("voice-open").click()');await until(()=>js('document.getElementById("recognizer").options.length>0'));
  await js('document.getElementById("voice-key").value="fake-elevenlabs-key";document.getElementById("voice-id").value="voice123";document.getElementById("speech-engine").value="cloud";document.getElementById("speech-engine").dispatchEvent(new Event("change"));document.getElementById("voice-form").requestSubmit()');
  await until(async()=>(await js('window.aurora.load()')).value.voice.elevenlabs.hasKey);
  assert.equal((await js('window.aurora.load()')).value.voice.recognitionEngine,'cloud');await pause(200);await fs.writeFile(path.join(output,'voice-settings.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.getElementById("voice-dialog-toggle").click()');await until(async()=>(await js('window.aurora.load()')).value.voice.status==='wake');
  assert.equal(started,1);assert.equal(modes.at(-1),'wake');recognized({type:'wake'});
  await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');assert.ok(require(path.join(sourceRoot,'voice-greetings')).greetings.includes(spoken[0].text));assert.ok(focused>0);assert.ok(win.isVisible());
  recognized({type:'text',text:'Search for an idea'});
  await until(()=>step===1);assert.equal(searches,0,'must not act before clarification');
  await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');
  assert.equal(await js('!!document.getElementById("question-form")'),true);
  await pause(200);await fs.writeFile(path.join(output,'follow-up.png'),(await win.webContents.capturePage()).toPNG());
  recognized({type:'text',text:'Heartflow AI'});
  await until(async()=>(await js('window.aurora.load()')).value.voice.status==='listening');
  assert.equal(searches,1);assert.equal(spoken.length,3);assert.equal(spoken[1].text,'Which topic should I search for?');assert.equal(modes.at(-1),'listen');
  assert.equal(await js('!!document.getElementById("question-form")'),false);
  assert.ok(await js('document.getElementById("messages").textContent.includes("Heartflow AI")'));
  let snapshot=(await js('window.aurora.load()')).value;assert.ok(snapshot.messages.some(m=>m.tool_name==='ask_user_question'&&JSON.parse(m.content).answer==='Heartflow AI'));
  assert.ok(!JSON.stringify(snapshot).includes('fake-elevenlabs-key'));
  assert.equal((await js('window.aurora.voiceSettings({provider:"fish",key:"fake-fish-key",voiceId:"reference123",recognizerId:"",fishModel:"s2.1-pro-free"})')).ok,true);
  assert.equal((await js('window.aurora.voiceToggle(true)')).ok,true);recognized({type:'wake'});
  await until(()=>spoken.some(s=>s.provider==='fish'));await until(()=>js('window._testAudio.length===4'));
  await js('window.aurora.voiceToggle(false)');await pause(500);assert.equal((await js('window.aurora.load()')).value.voice.enabled,false);
  assert.equal(await js('window._testAudio.at(-1).paused'),true);
  assert.ok(stopped>=2);
  const saved=await fs.readFile(path.join(output,'profile','aurora.json'),'utf8');assert.ok(!saved.includes('fake-elevenlabs-key'));assert.ok(!saved.includes('fake-fish-key'));
  assert.ok(JSON.parse(saved).voice.elevenlabs.encryptedKey);assert.ok(JSON.parse(saved).voice.fish.encryptedKey);
  assert.equal((await js('window.aurora.voiceSettings({provider:"fish",key:"",voiceId:"../bad",recognizerId:"",fishModel:"s2.1-pro"})')).ok,false);
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,spoken,modes,searches,started,stopped}));console.log('Voice smoke passed: '+output);app.exit(0);
 }catch(error){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack,spoken,modes,started,stopped,step}));console.error(error);app.exit(1);}
});
