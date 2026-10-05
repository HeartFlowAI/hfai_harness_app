// Real Electron settings, DPAPI migration, colour palettes and voice notch.
// Uses isolated fake credentials; no microphone, network or real computer input.
const {app,BrowserWindow,safeStorage}=require('electron');
app.disableHardwareAcceleration();
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('test-output',`settings-${Date.now()}`),profile=path.join(output,'profile');
const sourceRoot=process.env.AURORA_SMOKE_SOURCE || path.resolve('src');
app.setPath('userData',profile);
let recognized,connection;
require(path.join(sourceRoot,'voice-recognizer')).createRecognizer=({onEvent})=>{recognized=onEvent;return {start:async()=>({type:'ready'}),mode:async()=>{},stop(){}};};
require(path.join(sourceRoot,'voice-provider')).synthesize=async()=>{const audio=Buffer.alloc(44+3200);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(16000,24);audio.writeUInt32LE(32000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(3200,40);return {audio,mime:'audio/wav'};};
require(path.join(sourceRoot,'provider')).listModels=async(key,_signal,options)=>{connection={key,...options};return ['fixture-tools-model'];};
require(path.join(sourceRoot,'provider')).chat=async options=>{connection=options;options.onText?.('Hello from your model.');return {role:'assistant',content:'Hello from your model.'};};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await pause(50);}throw Error('Settings smoke timed out');}
app.whenReady().then(async()=>{
 try{
  await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'aurora.json'),JSON.stringify({appearance:'mint',model:'legacy-model',encryptedKey:safeStorage.encryptString('legacy-fixture-key').toString('base64'),computerEnabled:false,currentId:'legacy',chats:[{id:'legacy',title:'Keep my chat',messages:[{role:'user',content:'Keep this conversation'}]}]}));
  const disable=app.disableHardwareAcceleration;app.disableHardwareAcceleration=()=>{};
  require(path.join(sourceRoot,'main'));app.disableHardwareAcceleration=disable;let win;
  await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  const js=code=>win.webContents.executeJavaScript(code),load=async()=>(await js('window.aurora.load()')).value;
  await until(()=>js('typeof view!=="undefined"'));let value=await load();assert.equal(value.provider,'ollama-cloud');assert.equal(value.model,'legacy-model');assert.equal(value.messages[0].content,'Keep this conversation');assert.equal(value.hasKey,true);assert.equal(value.appearance,'classic');
  const errors=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
  assert.equal(await js('document.querySelectorAll(".sidebar-bottom [data-settings-section]").length'),0);
  assert.equal(await js('document.getElementById("update-download").closest(".sidebar-footer")!==null'),true);
  await js('document.getElementById("preferences-open").click()');assert.equal(await js('document.getElementById("preferences-dialog").open'),true);
  await pause(150);await fs.writeFile(path.join(output,'settings-menu.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.getElementById("settings-open").click()');assert.equal(await js('document.getElementById("preferences-dialog").open'),false);assert.equal(await js('document.getElementById("settings-dialog").open'),true);
  await js('document.getElementById("llm-provider").value="openai";document.getElementById("llm-provider").dispatchEvent(new Event("change"))');
  assert.equal(await js('document.getElementById("api-key").value'),'');
  await js('document.getElementById("api-key").value="openai-fixture-key";document.getElementById("fetch-models").click()');
  await until(()=>js('document.getElementById("models").options.length===1'));assert.equal(connection.provider,'openai');assert.equal(connection.key,'openai-fixture-key');
  await js('document.getElementById("model").value="fixture-tools-model";document.getElementById("settings-form").requestSubmit()');await until(async()=>(await load()).provider==='openai');
  await js('window.aurora.send("Say hello")');assert.equal(connection.provider,'openai');assert.equal(connection.key,'openai-fixture-key');
  value=await load();assert.ok(!JSON.stringify(value).includes('fixture-key'));assert.equal(value.connections['ollama-cloud'].model,'legacy-model');
  await js('document.getElementById("settings-open").click();document.getElementById("llm-provider").value="ollama-local";document.getElementById("llm-provider").dispatchEvent(new Event("change"))');
  assert.equal(await js('document.getElementById("api-key").hidden'),true);assert.equal(await js('document.getElementById("local-url").hidden'),false);
  await js('document.getElementById("model").value="local-tools-model";document.getElementById("settings-form").requestSubmit()');await until(async()=>(await load()).provider==='ollama-local');assert.equal((await load()).hasKey,true);
  assert.equal((await js('window.aurora.send("Say hello locally")')).ok,true);assert.equal(connection.key,'');assert.equal(connection.provider,'ollama-local');
  await js('document.getElementById("appearance-open").click()');assert.equal(await js('document.querySelectorAll(".appearance-card").length'),6);
  for(const id of ['cyber','dark','cozy']){
    assert.equal(await js(`document.querySelector('.skin-preview[data-appearance="${id}"]').parentElement.querySelector('.appearance-credit').textContent`),'Created by Jaymie');
    await js(`document.querySelector('.skin-preview[data-appearance="${id}"]').parentElement.click()`);
    await until(()=>js(`document.getElementById('pet-host').dataset.appearance==='${id}'&&document.getElementById('pet-host').classList.contains('community-art')`));
    assert.equal((await load()).appearance,id);
    for(const state of ['idle','thinking','waiting','coding','browsing','walking','climbing','teleporting','celebrating','pointing','error']){
      await js(`document.getElementById('pet-host').dataset.state='${state}'`);await pause(80);
      await until(()=>js(`(()=>{const canvas=document.querySelector('#pet-host canvas');const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;return data.some((value,index)=>index%4===3&&value>0);})()`));
      assert.equal(await js('getComputedStyle(document.querySelector("#pet-host .aurora-reference")).display'),'none');
    }
    await fs.writeFile(path.join(output,id+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  await js('document.getElementById("pet-host").dataset.state="idle"');
  await js('document.querySelectorAll(".appearance-card")[1].click()');await until(()=>js('document.getElementById("pet-host").dataset.appearance==="moonlight"'));assert.equal((await load()).appearance,'moonlight');
  assert.match(await js('getComputedStyle(document.querySelector(".aurora-art")).filter'),/hue-rotate/);
  win.showInactive();await pause(200);await fs.writeFile(path.join(output,'appearance.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector(".skin-preview[data-appearance=cozy]").parentElement.click();document.querySelector(".skin-preview[data-appearance=cozy]").scrollIntoView({block:"end"})');
  await until(()=>js('document.getElementById("pet-host").dataset.appearance==="cozy"'));await pause(200);
  await fs.writeFile(path.join(output,'community-picker.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.getElementById("appearance-close").click();window.aurora.pet("detach")');let pet;
  await until(()=>{pet=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('pet.html'));return pet&&!pet.webContents.isLoading();});
  await until(()=>pet.webContents.executeJavaScript('document.querySelector(".pet-host").dataset.appearance==="cozy"&&document.querySelector(".pet-host").classList.contains("community-art")'));await js('window.aurora.pet("dock")');await until(()=>pet.isDestroyed());
  await js('window.aurora.voiceSettings({provider:"elevenlabs",key:"voice-fixture-key",voiceId:"voice123",recognizerId:"",fishModel:"s2.1-pro"})');
  await js('(()=>{const Original=window.Audio;window.Audio=function(url){const audio=new Original(url);audio.muted=true;return audio;};return true;})()');
  await js('window.aurora.voiceToggle(true)');win.minimize();recognized({type:'wake'});
  let notch;await until(()=>{notch=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('notch.html'));return notch?.isVisible();});
  await until(()=>notch.webContents.executeJavaScript('document.getElementById("pet-host").dataset.appearance==="cozy"&&document.getElementById("pet-host").classList.contains("community-art")'));await js('window.aurora.voiceToggle(false)');
  const bad=await js('window.aurora.appearance("unknown")');assert.equal(bad.ok,false);
  win.restore();await js('document.getElementById("updates-open").click()');assert.equal(await js('document.getElementById("update-primary").disabled'),true);await js('document.getElementById("updates-close").click()');
  win.setSize(950,680);await pause(150);const fits=await js('document.querySelector(".sidebar-bottom").getBoundingClientRect().bottom<=innerHeight');assert.ok(fits);assert.deepEqual(errors,[]);
  const chatHeight=await js('document.getElementById("chats").getBoundingClientRect().height');assert.ok(chatHeight>=150,`Session area only ${chatHeight}px: ${output}`);
  assert.ok(await js('document.getElementById("session-menu").getBoundingClientRect().right<=innerWidth'));
  await js('document.getElementById("toast").hidden=true');await fs.writeFile(path.join(output,'clean-sidebar.png'),(await win.webContents.capturePage()).toPNG());
  const saved=await fs.readFile(path.join(profile,'aurora.json'),'utf8');assert.ok(!saved.includes('fixture-key'));assert.equal(JSON.parse(saved).appearance,'cozy');
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,legacyMigration:true,encryptedKeys:true,providerSwitching:true,localChat:true,appearanceMainPetNotch:true,compactLayout:true}));console.log('Settings smoke passed: '+output);app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});
