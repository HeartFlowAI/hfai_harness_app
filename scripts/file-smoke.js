// Real Explorer + UI Automation, isolated settings and files, no cloud calls.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const output=path.resolve('test-output',`file-smoke-${Date.now()}`);
const folder=path.join(output,'files');
app.setPath('userData',path.join(output,'profile'));
for(const name of ['desktop','documents','downloads'])app.setPath(name,folder);
delete process.env.OneDrive;delete process.env.OneDriveConsumer;
let step=0;
const sourceRoot=process.env.AURORA_SMOKE_SOURCE || path.resolve('src');
const provider=require(path.join(sourceRoot,'provider'));
provider.chat=async({messages,onText})=>{
  if(step++===0)return {role:'assistant',content:'',tool_calls:[{function:{name:'find_files',arguments:{query:'aurora-fixture'}}}]};
  if(step===2){const result=JSON.parse(messages.at(-1).content);assert.equal(result.matches.length,1);return {role:'assistant',content:'',tool_calls:[{function:{name:'reveal_file',arguments:{file_id:result.matches[0].id}}}]};}
  const result=JSON.parse(messages.at(-1).content);onText(result.highlighted?'Found it and highlighted it.':'Asked Explorer to select it.');
  return {role:'assistant',content:'File search finished.'};
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<120;i++){if(await fn())return;await pause(100);}throw Error('Timed out');}
// Record existing Explorer windows so cleanup never closes a user's existing window.
const inventory='@( (New-Object -ComObject Shell.Application).Windows() | ForEach-Object { [string]$_.HWND } ) | ConvertTo-Json -Compress';
const before=spawnSync('powershell.exe',['-NoProfile','-Command',inventory],{encoding:'utf8',windowsHide:true}).stdout.trim();
const trace=[];
const presentations=require(path.join(sourceRoot,'file-presentation'));
const original=presentations.createFilePresentation;
presentations.createFilePresentation=options=>original({...options,onNative:result=>trace.push({native:result,time:Date.now()}),point:(...args)=>{trace.push({point:args[0],time:Date.now()});options.point(...args);},finish:()=>{trace.push({finish:true,time:Date.now()});options.finish();}});
require(path.join(sourceRoot,'main'));
app.whenReady().then(async()=>{
 try{
  await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'aurora-fixture.txt'),'test only');
  let win;await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  const js=s=>win.webContents.executeJavaScript(s);
  await js('window.aurora.saveSettings({key:"fake-file-test-key",model:"test"})');
  assert.equal((await js('window.aurora.load()')).value.workspace,'');
  assert.equal((await js('window.aurora.send("Find aurora-fixture on my PC")')).ok,true);
  const snapshot=(await js('window.aurora.load()')).value;
  const search=JSON.parse(snapshot.messages.find(m=>m.tool_name==='find_files').content);
  const reveal=JSON.parse(snapshot.messages.find(m=>m.tool_name==='reveal_file').content);
  assert.equal(search.matches.length,1);
  if (!reveal.highlighted) {
    assert.equal(reveal.selectedInExplorer,true,JSON.stringify(reveal));
    assert.ok(trace.some(e=>e.native?.reason==='Explorer is not foreground'),'fallback must be explained by Explorer visibility');
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,mode:'foreground-unavailable fallback',reveal}));
    console.log('Explorer selection and visibility fallback passed: '+output);
    return;
  }
  let pet;await until(()=>{pet=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('pet.html'));return pet&&!pet.webContents.isLoading();});
  await until(()=>pet.webContents.executeJavaScript('document.querySelector(".pet-host").dataset.state==="pointing"'));
  assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-host").classList.contains("has-point")'),true);
  await fs.writeFile(path.join(output,'pointing.png'),(await pet.webContents.capturePage()).toPNG());
  const overlay=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('highlight.html'));
  assert.ok(overlay?.isVisible());
  await fs.writeFile(path.join(output,'highlight.png'),(await overlay.webContents.capturePage()).toPNG());
  const bounds=overlay.getBounds();assert.ok(bounds.width>8&&bounds.height>8);
  await until(()=>!BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('highlight.html')));
  assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-host").dataset.state'), 'idle');
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,reveal,bounds}));
  console.log('Real Explorer smoke passed: '+output);
 }catch(error){await fs.mkdir(output,{recursive:true});const pets=BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('pet.html'));const states=await Promise.all(pets.map(w=>w.webContents.executeJavaScript('({state:document.querySelector(".pet-host").dataset.state,phase:document.querySelector(".pet-host").dataset.phase})')));await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack,trace,states}));console.error(error);}
 finally{
  // Only close new Explorer windows displaying this exact test folder.
  const initial=JSON.parse(before||'[]');const ids=Array.isArray(initial)?initial:[initial];
  const cleanup=path.join(output,'close-test-explorer.ps1');
  await fs.writeFile(cleanup,`param([string]$Folder)\n$keep=@(${ids.map(id=>`'${String(id).replace(/'/g,"''")}'`).join(',')})\nforeach($w in (New-Object -ComObject Shell.Application).Windows()){try{if($keep -notcontains [string]$w.HWND -and $w.Document.Folder.Self.Path -ieq $Folder){$w.Quit()}}catch{}}`);
  spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',cleanup,'-Folder',folder],{windowsHide:true});
  app.exit(0);
 }
});
