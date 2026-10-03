const {BrowserWindow,screen,ipcMain}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {keepOverlayOnTop}=require('./overlay-window');

function notchBounds(area,expanded,approval=false){
  const width=Math.min(expanded?660:292,Math.max(200,area.width-24));
  const height=Math.min(expanded?(approval?410:320):82,area.height-16);
  return {x:Math.round(area.x+(area.width-width)/2),y:area.y+8,width,height};
}
function createVoiceNotch({getMain,onAction}){
  let disposed=false,hideTimer,errorTimer,errorUntil=0;
  const model={voice:{enabled:false,status:'off'},state:'idle',reply:'',transcript:'',partial:'',approval:null,question:null,error:''};
  const win=new BrowserWindow({width:660,height:320,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,hasShadow:false,focusable:true,show:false,
    webPreferences:{preload:path.join(__dirname,'notch-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  const layer=keepOverlayOnTop(win);
  const expanded=()=>!['off','wake','starting'].includes(model.voice.status)||!!model.approval||Date.now()<errorUntil;
  function sync(){
    const main=getMain();if(disposed||win.isDestroyed()||!main||main.isDestroyed())return;
    const visible=!model.away&&!model.computerActive&&main.isMinimized()&&((model.voice.enabled&&!['off','wake','starting'].includes(model.voice.status))||Date.now()<errorUntil);
    if(visible){
      clearTimeout(hideTimer);hideTimer=null;
      const area=screen.getDisplayMatching(main.getNormalBounds()).workArea;
      const next=notchBounds(area,expanded(),!!model.approval),previous=win.getBounds();
      if(Object.keys(next).some(key=>next[key]!==previous[key]))win.setBounds(next);
      if(!win.webContents.isLoading()){if(!win.isVisible())win.showInactive();win.webContents.send('notch-event',{...model,expanded:expanded(),visible:true});layer.raise();}
    }else if(win.isVisible()&&!hideTimer){win.webContents.send('notch-visibility',false);hideTimer=setTimeout(()=>{hideTimer=null;if(!win.isDestroyed())win.hide();},280);}
  }
  function event(value){
    if(!['voice-state','state','voice-partial','voice-transcript','question','question-closed','approval','approval-closed','error','pet','computer-activity','voice-expression'].includes(value.type))return;
    if(value.type==='voice-expression')model.speechPose=value.active?value.pose:null;
    if(value.type==='voice-state'){
      model.voice={enabled:value.voice.enabled,status:value.voice.status,detail:value.voice.detail};
      if(value.voice.status==='speaking')model.reply=value.voice.detail;
      if(value.voice.status==='waking'){model.reply='';model.transcript='';model.partial='';model.error='';errorUntil=0;}
      if(['wake','off'].includes(value.voice.status))model.partial='';
    }
    if(value.type==='computer-activity')model.computerActive=value.active;
    if(value.type==='pet')model.away=value.detached;
    if(value.type==='state'){model.state=value.state;model.activity=value.detail;}
    if(value.type==='voice-partial')model.partial=value.text;
    if(value.type==='voice-transcript'){model.transcript=value.text;model.partial='';model.error='';}
    if(value.type==='question')model.question={id:value.id,question:value.question,choices:value.choices};
    if(value.type==='question-closed')model.question=null;
    if(value.type==='approval')model.approval={id:value.id,name:value.name,args:value.args};
    if(value.type==='approval-closed')model.approval=null;
    if(value.type==='error'){model.error=value.message;if(win.isVisible()&&!model.voice.enabled){errorUntil=Date.now()+6000;clearTimeout(errorTimer);errorTimer=setTimeout(sync,6010);}}
    sync();
  }
  const expected=pathToFileURL(path.join(__dirname,'notch.html')).href;
  const handler=async(event,value)=>{
    if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==expected)throw Error('Untrusted notch sender.');
    try{return {ok:true,value:await onAction(value)};}catch(error){return {ok:false,error:error.message};}
  };
  ipcMain.handle('notch-action',handler);
  const changed=()=>sync();screen.on('display-metrics-changed',changed);screen.on('display-removed',changed);screen.on('display-added',changed);
  win.webContents.once('did-finish-load',sync);win.loadFile(path.join(__dirname,'notch.html'));
  function dispose(){if(disposed)return;disposed=true;clearTimeout(hideTimer);clearTimeout(errorTimer);layer.dispose();ipcMain.removeHandler('notch-action');screen.removeListener('display-metrics-changed',changed);screen.removeListener('display-removed',changed);screen.removeListener('display-added',changed);if(!win.isDestroyed())win.destroy();}
  return {sync,event,dispose,window:win};
}
module.exports={createVoiceNotch,notchBounds};
