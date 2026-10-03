const {BrowserWindow,ipcMain}=require('electron');const path=require('node:path');const {pathToFileURL}=require('node:url');const {randomUUID}=require('node:crypto');
function createAudioCapture({onPCM,onError,deviceId=''}){
  let win,loaded,enabled=false;const channel='aurora-microphone-'+randomUUID(),pending=new Map();
  function trusted(event){return win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url===pathToFileURL(path.join(__dirname,'microphone.html')).href;}
  function receive(event,value){
    if(!trusted(event)||!value||typeof value!=='object')return;
    if(value.type==='pcm'&&enabled&&value.data instanceof Uint8Array&&value.data.byteLength<=6400)onPCM(Buffer.from(value.data));
    if(value.type==='ack'){const item=pending.get(value.id);if(item){clearTimeout(item.timer);pending.delete(value.id);value.error?item.reject(Error(value.error)):item.resolve();}}
    if(value.type==='error')onError(Error(value.message||'Microphone capture failed.'));
  }
  async function start(){
    win=new BrowserWindow({show:false,width:100,height:100,webPreferences:{preload:path.join(__dirname,'microphone-preload.js'),additionalArguments:[channel],partition:channel,contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
    const url=pathToFileURL(path.join(__dirname,'microphone.html')).href;
    win.webContents.session.setPermissionCheckHandler((contents,permission,origin,details)=>contents===win.webContents&&permission==='media'&&enabled&&(details.mediaType==='audio'||details.mediaType==='unknown')&&win.webContents.getURL()===url);
    win.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win.webContents&&permission==='media'&&enabled&&details.mediaTypes?.length===1&&details.mediaTypes[0]==='audio'&&win.webContents.getURL()===url));
    ipcMain.on(channel,receive);loaded=win.loadFile(path.join(__dirname,'microphone.html'));await loaded;
  }
  async function record(value){
    enabled=value;await loaded;if(!win||win.isDestroyed())throw Error('Microphone is closed.');
    return new Promise((resolve,reject)=>{const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('Microphone did not respond. Check Windows microphone permissions.'));},10000);pending.set(id,{resolve,reject,timer});win.webContents.send('microphone-command',{id,record:value,deviceId});});
  }
  function stop(){enabled=false;ipcMain.removeListener(channel,receive);for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Microphone stopped.'));}pending.clear();if(win&&!win.isDestroyed())win.destroy();win=null;}
  return {start,record,stop};
}
module.exports={createAudioCapture};
