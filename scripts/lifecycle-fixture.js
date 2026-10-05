// Child for lifecycle-smoke.js. Isolated profile, real Electron lock/windows,
// synthetic model and native helpers; no microphone, cloud or physical input.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
const profile=process.argv[process.argv.indexOf('--profile')+1];
if(!profile||!process.argv.includes('--single-instance-smoke'))throw Error('Use the lifecycle test runner.');
app.setPath('userData',profile);fs.mkdirSync(profile,{recursive:true});
const source=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');
if(!fs.existsSync(path.join(profile,'aurora.json')))fs.writeFileSync(path.join(profile,'aurora.json'),JSON.stringify({computerEnabled:false,chats:[]}));
let overlay,aborted=false,cursorDisposed=false,computerCancelled=false,working=false,commandTimer;
require(path.join(source,'agent-cursor')).createAgentCursor=()=>({prepare:async()=>{},activate:async()=>{},restore(){},dispose(){cursorDisposed=true;}});
const realOverlay=require(path.join(source,'input-overlay')).createInputOverlay;
require(path.join(source,'input-overlay')).createInputOverlay=()=>overlay=realOverlay();
require(path.join(source,'computer-control')).createComputerControl=()=>({prepare:async()=>{},cancel(){computerCancelled=true;}});
require(path.join(source,'provider')).chat=({signal})=>new Promise((_resolve,reject)=>{working=true;signal.addEventListener('abort',()=>{aborted=true;reject(Error('Fixture task stopped.'));},{once:true});});
const write=value=>process.stdout.write('AURORA_LIFECYCLE '+JSON.stringify(value)+'\n');
app.on('quit',()=>{clearInterval(commandTimer);fs.writeFileSync(path.join(profile,`exit-${process.pid}.json`),JSON.stringify({aborted,cursorDisposed,computerCancelled,windows:BrowserWindow.getAllWindows().length}));});
require(path.join(source,'main'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await pause(30);}throw Error('Lifecycle fixture timed out');}
app.whenReady().then(async()=>{
  let win;await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  const js=code=>win.webContents.executeJavaScript(code);
  await until(()=>js('typeof view!=="undefined"'));
  let commandId;
  commandTimer=setInterval(()=>{let record;try{record=JSON.parse(fs.readFileSync(path.join(profile,`command-${process.pid}.json`),'utf8'));}catch{return;}if(record.id===commandId)return;commandId=record.id;const command=record.value;Promise.resolve().then(async()=>{
    if(command==='minimize'){win.showInactive();win.minimize();await until(()=>win.isMinimized());write({type:'minimized',minimized:win.isMinimized()});}
    if(command==='inspect')write({type:'inspect',visible:win.isVisible(),minimized:win.isMinimized(),windows:BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('index.html')).length});
    if(command==='exercise'){
      await js('window.aurora.saveSettings({key:"lifecycle-fixture-key",model:"fixture-model",computerEnabled:false})');
      await overlay.activity({action:'keys',keys:'CTRL+L'});overlay.hide();
      await js('window.aurora.pet("detach")');
      const recorder=new BrowserWindow({show:false,width:10,height:10,webPreferences:{sandbox:true,nodeIntegration:false}});recorder.loadURL('about:blank');
      js('window.aurora.send("Lifecycle fixture task")').catch(()=>{});await until(()=>working);
      write({type:'exercise',windows:BrowserWindow.getAllWindows().length});
    }
    if(command==='close')win.close();
  }).catch(error=>{write({type:'error',message:error.message});app.exit(1);});},25);commandTimer.unref();
  write({type:'ready',pid:process.pid});
}).catch(error=>{write({type:'error',message:error.message});app.exit(1);});
