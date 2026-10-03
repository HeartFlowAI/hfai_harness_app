// Real chooser/IPC with fake provider and fake Explorer presentation.
const {app,BrowserWindow,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const output=path.resolve('test-output',`choice-smoke-${Date.now()}`),folder=path.join(output,'files');
app.setPath('userData',path.join(output,'profile'));
for(const name of ['desktop','documents','downloads'])app.setPath(name,folder);
delete process.env.OneDrive;delete process.env.OneDriveConsumer;
const sourceRoot=process.env.AURORA_SMOKE_SOURCE || path.resolve('src');
let shown,step=0;
require(path.join(sourceRoot,'file-presentation')).createFilePresentation=()=>({cancel(){},async reveal(filename){shown=filename;return {selectedInExplorer:true,highlighted:false,message:'Selected in Explorer.'};}});
require(path.join(sourceRoot,'provider')).chat=async({messages})=>{
 if(step++===0)return {role:'assistant',content:'',tool_calls:[{function:{name:'find_files',arguments:{query:'confirmation'}}}]};
 if(step===2){const result=JSON.parse(messages.at(-1).content);return {role:'assistant',content:'',tool_calls:[{function:{name:'reveal_file',arguments:{file_id:result.matches[0].id}}}]};}
 assert.match(messages.at(-1).content,/Several files match/);
 return {role:'assistant',content:'Choose your file using Show in Explorer.'};
};
const extra=path.join(output,'extra-folder');
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[extra]});
require(path.join(sourceRoot,'main'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await pause(50);}throw Error('Timed out');}
app.whenReady().then(async()=>{
 try{
  await fs.mkdir(folder,{recursive:true});await fs.mkdir(extra);await fs.writeFile(path.join(folder,'confirmation-one.pdf'),'one');await fs.writeFile(path.join(folder,'confirmation-two.pdf'),'two');
  let win;await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  win.webContents.setBackgroundThrottling(false);
  const js=s=>win.webContents.executeJavaScript(s);
  await js('window.aurora.saveSettings({key:"fake-choice-key",model:"test"}).then(result=>render(result.value))');
  await js('document.getElementById("settings-open").click();document.getElementById("search-folder-add").click()');
  await until(()=>js('document.getElementById("search-folders").textContent.includes("extra-folder")'));
  assert.ok((await js('window.aurora.load()')).value.searchFolders.includes(extra));
  await pause(250);await fs.writeFile(path.join(output,'settings.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector("#search-folders button").click()');await until(async()=>!(await js('window.aurora.load()')).value.searchFolders.includes(extra));
  await js('document.getElementById("settings-close").click()');
  assert.equal(await js('document.getElementById("settings-dialog").open'),false);
  assert.equal((await js('window.aurora.send("Find my confirmation")')).ok,true);
  assert.equal(shown,undefined,'model must not pick an ambiguous result');
  assert.equal((await js('window.aurora.load()')).value.state,'waiting');
  await until(()=>js('document.getElementById("file-results-dialog").open'));
  assert.equal(await js('document.querySelectorAll("#file-results button").length'),2);
  win.showInactive();
  await pause(250);
  await fs.writeFile(path.join(output,'chooser.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal((await js('window.aurora.revealFile("C:/Windows/guessed-path")')).ok,false);
  await js('document.querySelectorAll("#file-results button")[1].click()');await until(()=>!!shown);
  assert.equal(shown,path.join(folder,'confirmation-two.pdf'));
  assert.equal(await js('document.getElementById("file-results-dialog").open'),false);
  await js('document.getElementById("new-chat").click()');await until(()=>js('document.getElementById("file-results-open").hidden'));
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,chosen:shown}));console.log('Chooser smoke passed: '+output);app.exit(0);
 }catch(error){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack}));console.error(error);app.exit(1);}
});
