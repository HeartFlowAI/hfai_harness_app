const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve('test-output', `animations-${Date.now()}`);
app.setPath('userData', path.join(output, 'profile'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for(let i=0;i<100;i++){ if(await fn())return; await pause(50); } throw new Error('Animation verification timed out'); }
app.whenReady().then(async () => {
  try {
    await fs.mkdir(output, {recursive:true});
    const win = new BrowserWindow({width:860,height:1320,show:false,backgroundColor:'#11121b',webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false,sandbox:true}});
    const errors=[];
    win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
    await win.loadFile(path.resolve('src/animation-preview.html'));
    const js = code => win.webContents.executeJavaScript(code);
    await until(()=>js('document.querySelectorAll(".has-atlas").length === 10'));
    await until(()=>js('document.querySelectorAll(".has-walk").length === 10'));
    await until(()=>js('document.querySelectorAll(".has-point").length === 10'));
    await until(()=>js('[...document.querySelectorAll(".aurora-sprite")].every(c => c.width > 0 && c.getContext("2d").getImageData(0,0,c.width,c.height).data.some((value,index) => index%4===3 && value>0))'));
    const initial = await js('document.querySelector("[data-state=coding] canvas").className');
    await until(async()=>initial!==await js('document.querySelector("[data-state=coding] canvas").className'));
    const walkFrames=new Set();
    for(let i=0;i<18;i++){walkFrames.add(await js('document.querySelector("[data-state=walking] canvas").className'));await pause(70);}
    assert.equal(walkFrames.size,4,'all four gait keyframes must play');
    const bounds=await js('[...document.querySelectorAll(".aurora-sprite")].map(c=>({state:c.parentElement.dataset.state,frame:c.className,size:[c.width,c.height]}))');
    const atlas=nativeImage.createFromPath(path.resolve('src/assets/aurora/activity-atlas.png'));
    assert.equal(atlas.getBitmap()[3],0,'atlas backdrop must be transparent');
    assert.deepEqual(errors,[]);
    await pause(500);
    await fs.writeFile(path.join(output,'animation-gallery.png'),(await win.webContents.capturePage()).toPNG());
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,states:bounds,errors},null,2));
    app.exit(0);
  }catch(error){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack}));app.exit(1);}
});
