// Real canvas audit: all activity frames, clean alpha, and both pointing directions.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
app.disableHardwareAcceleration();
const source=process.env.AURORA_SMOKE_SOURCE||path.resolve('src'),output=path.resolve('test-output',`animation-audit-${Date.now()}`);
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1100,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  try{
    await fs.mkdir(output,{recursive:true});await win.loadFile(path.join(source,'animation-preview.html'));
    const errors=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
    const reports=[];
    await win.webContents.executeJavaScript(`window.pointingContact=document.createElement('canvas');pointingContact.width=800;pointingContact.height=1280;const contactCtx=pointingContact.getContext('2d');contactCtx.fillStyle='#17131f';contactCtx.fillRect(0,0,800,1280);`);
    for(const id of ['classic','cyber','dark','cozy']){
      const audit=await win.webContents.executeJavaScript(`(async()=>{
        const skin=AuroraAppearances.list.find(s=>s.id===${JSON.stringify(id)}),load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Missing '+src));img.src=src;});
        const atlas=await load(skin.atlas||'assets/aurora/activity-atlas.png'),point=await load(skin.atlas?'assets/aurora/skins/'+skin.id+'-pointing.png':'assets/aurora/pointing.png');
        const canvas=document.createElement('canvas');canvas.width=1040;canvas.height=skin.atlas?1500:1800;const ctx=canvas.getContext('2d');ctx.fillStyle='#17131f';ctx.fillRect(0,0,1040,canvas.height);ctx.imageSmoothingEnabled=false;
        const frames=[],walkFrames=[];let removed=0;
        for(let index=0;index<16;index++){
          const frame=AuroraSpriteFrames.prepareFrame(atlas,skin.atlas?AuroraAppearances.frameRect(skin,index,atlas.naturalWidth,atlas.naturalHeight):auroraFrameRects[index===12?13:index]);
          const [x,y,w,h]=frame.bounds,left=index%4*260,top=Math.floor(index/4)*300,scale=Math.min(236/w,258/h);ctx.drawImage(frame.canvas,x,y,w,h,left+(260-w*scale)/2,top+270-h*scale,w*scale,h*scale);
          ctx.fillStyle='#e9c8ff';ctx.font='14px Segoe UI';ctx.fillText(skin.name+' · frame '+index,left+18,top+290);removed+=frame.removed;frames.push({index,bounds:frame.bounds,removed:frame.removed});
        }
        const pointing=AuroraSpriteFrames.preparePointing(point),layout=AuroraSpriteFrames.pointingLayout(pointing.bounds,pointing.finger,280,280),[px,py,pw,ph]=pointing.bounds;
        for(const [index,leftward] of [false,true].entries()){
          ctx.save();ctx.translate(index*280,1200);if(leftward){ctx.translate(280,0);ctx.scale(-1,1);}ctx.drawImage(pointing.canvas,px,py,pw,ph,layout.x,layout.y,layout.width,layout.height);ctx.restore();ctx.fillStyle='#e9c8ff';ctx.fillText(leftward?'Pointing left':'Pointing right',index*280+18,1490);
        }
        if(!skin.atlas){const walk=await load('assets/aurora/walk-cycle.png');for(let index=0;index<4;index++){const frame=AuroraSpriteFrames.prepareFrame(walk,auroraWalkRects[index]),[x,y,w,h]=frame.bounds,left=index*260,scale=Math.min(236/w,258/h);ctx.drawImage(frame.canvas,x,y,w,h,left+(260-w*scale)/2,1770-h*scale,w*scale,h*scale);ctx.fillStyle='#e9c8ff';ctx.fillText('Archived walk '+index,left+18,1790);walkFrames.push({index,bounds:frame.bounds,removed:frame.removed});removed+=frame.removed;}}
        return {image:canvas.toDataURL('image/png'),frames,walkFrames,removed,pointBounds:pointing.bounds,finger:pointing.finger,layout};
      })()`);
      assert.equal(audit.frames.length,16);assert.ok(audit.frames.every(f=>f.bounds[2]>0&&f.bounds[3]>0));
      await fs.writeFile(path.join(output,id+'.png'),Buffer.from(audit.image.split(',')[1],'base64'));delete audit.image;
      // Exercise the actual shared pet renderer rather than just the audit canvas.
      await win.webContents.executeJavaScript(`document.querySelectorAll('.pet-host').forEach(h=>h.dataset.appearance=${JSON.stringify(id)});`);
      const host="document.querySelector('[data-state=pointing]')";
      await win.webContents.executeJavaScript(`${host}.dataset.facing='right'`);
      let anchors;
      for(let attempt=0;attempt<100;attempt++){await new Promise(r=>setTimeout(r,30));anchors=await win.webContents.executeJavaScript(`({x:Number(${host}.dataset.pointX),y:Number(${host}.dataset.pointY),appearance:${host}.dataset.pointAppearance,width:${host}.clientWidth,height:${host}.clientHeight})`);if(anchors.appearance===id&&Math.abs(anchors.x-anchors.width*216/280)<.1)break;}
      assert.equal(anchors.appearance,id);
      assert.ok(Math.abs(anchors.x-anchors.width*216/280)<.1);assert.ok(Math.abs(anchors.y-anchors.height*82/280)<.1);
      const row=reports.length;
      await win.webContents.executeJavaScript(`(()=>{const ctx=pointingContact.getContext('2d'),top=${row}*320;ctx.imageSmoothingEnabled=false;ctx.drawImage(${host}.querySelector('canvas'),20,top+25,280,280);ctx.strokeStyle='#f4a9dc';ctx.strokeRect(244,top+95,100,24);ctx.fillStyle='#eee0f3';ctx.font='13px Segoe UI';ctx.fillText('Selected file',250,top+112);ctx.fillText(${JSON.stringify(id+' · pointing right')},20,top+18);})()`);
      await win.webContents.executeJavaScript(`${host}.dataset.facing='left'`);let leftX;
      for(let attempt=0;attempt<100;attempt++){await new Promise(r=>setTimeout(r,30));leftX=await win.webContents.executeJavaScript(`Number(${host}.dataset.pointX)`);if(Math.abs(leftX-anchors.width*64/280)<.1)break;}
      assert.ok(Math.abs(leftX-anchors.width*64/280)<.1);
      await win.webContents.executeJavaScript(`(()=>{const ctx=pointingContact.getContext('2d'),top=${row}*320;ctx.drawImage(${host}.querySelector('canvas'),440,top+25,280,280);ctx.strokeStyle='#f4a9dc';ctx.strokeRect(396,top+95,100,24);ctx.fillStyle='#eee0f3';ctx.font='13px Segoe UI';ctx.fillText('Selected file',402,top+112);ctx.fillText(${JSON.stringify(id+' · pointing left')},440,top+18);})()`);
      reports.push({id,...audit,rendererAnchors:true});
    }
    const contact=await win.webContents.executeJavaScript('pointingContact.toDataURL("image/png")');await fs.writeFile(path.join(output,'pointing-check.png'),Buffer.from(contact.split(',')[1],'base64'));
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,reports},null,2));console.log('Animation audit passed: '+output);app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
