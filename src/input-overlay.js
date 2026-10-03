const {BrowserWindow,screen}=require('electron');
const path=require('node:path');
const {keepOverlayOnTop}=require('./overlay-window');
const {createAgentCursor}=require('./agent-cursor');
function createInputOverlay(){
  let hud,hudLayer,timer,last;const pointer=createAgentCursor();
  function window(kind){const win=new BrowserWindow({width:440,height:94,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,focusable:false,resizable:false,hasShadow:false,show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});win.setIgnoreMouseEvents(true);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.loadFile(path.join(__dirname,'input-overlay.html'),{query:{kind}});return win;}
  function hide(){pointer.restore();hud?.hide();}
  async function showPointer(){try{await pointer.activate();clearTimeout(timer);timer=setTimeout(hide,1800);}catch(error){hide();console.warn('Aurora pointer unavailable: '+error.message);}}
  function activity(value){
    if(value.action==='hide'){clearTimeout(timer);hide();return;}
    if(['observe','wait'].includes(value.action))return;
    if(!hud){hud=window('hud');hudLayer=keepOverlayOnTop(hud);}
    clearTimeout(timer);timer=setTimeout(hide,1800);
    if(value.action==='pointer'){
      showPointer();return;
    }
    last=value;
    const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;hud.setPosition(Math.round(area.x+(area.width-440)/2),area.y+area.height-110);
    const display=()=>{if(hud.isDestroyed())return;hud.webContents.executeJavaScript(`window.showInput(${JSON.stringify(last)})`).catch(()=>{});hud.showInactive();hudLayer.raise();};
    if(hud.webContents.isLoading())hud.webContents.once('did-finish-load',display);else display();
    // Cursor decoration must not prevent the actual browser action from running.
    return showPointer();
  }
  function dispose(){clearTimeout(timer);pointer.dispose();hudLayer?.dispose();hud?.destroy();}
  return {activity,hide,dispose,prepare:()=>pointer.prepare()};
}
module.exports={createInputOverlay};
