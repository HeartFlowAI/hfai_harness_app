// A separate private Opera or Brave window, local fixture only, no user tabs or cloud APIs.
const {spawn,execFileSync}=require('node:child_process'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.AURORA_SMOKE_SOURCE||path.resolve('src'),{createComputerControl,applicationPath}=require(path.join(root,'computer-control'));
const browser=process.env.AURORA_TEST_BROWSER||'opera';if(!['opera','brave'].includes(browser))throw Error('Choose opera or brave for this check.');
const label=`Aurora ${browser} fixture ${Date.now()}`,output=path.resolve('test-output',`${browser}-smoke-${Date.now()}`),controller=new AbortController();
const wav=Buffer.alloc(44+4800);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(4800,40);
const page=`<!doctype html><title>${label}</title><style>body{font:20px Segoe UI;padding:45px;background:#181221;color:#ffe8f3}button,input{font:inherit;padding:12px;margin:10px}button{background:#f9c1d6;border-radius:12px}</style><h1>Aurora browser check</h1><p>Local silent playback fixture</p><input aria-label="Search music" placeholder="Search music"><button aria-label="Play Despacito" id="play">Play Despacito</button><p id="status" role="status">Ready</p><audio id="audio" src="/audio.wav" loop></audio><script>play.onclick=async()=>{await audio.play();play.textContent='Pause Despacito';play.setAttribute('aria-label','Pause Despacito');status.textContent='Playing Despacito';document.title='${label} · Playing';};</script>`;
const server=http.createServer((req,res)=>{if(req.url==='/audio.wav'){res.writeHead(200,{'content-type':'audio/wav'});res.end(wav);}else{res.writeHead(200,{'content-type':'text/html'});res.end(page);}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){const deadline=Date.now()+15000;while(Date.now()<deadline){const result=await fn();if(result)return result;await wait(150);}throw Error('Opera check timed out.');}
(async()=>{const computer=createComputerControl();let stage='start',youtube=false,fixtureId;try{
 await fs.mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
 const executable=await applicationPath(browser);const browserArgs=browser==='brave'?['--user-data-dir='+path.join(output,'browser-profile'),'--no-first-run','--no-default-browser-check','--incognito','--mute-audio','--new-window',url]:['--private','--new-window',url];const child=spawn(executable,browserArgs,{windowsHide:false,detached:true,stdio:'ignore'});await new Promise((resolve,reject)=>{child.once('spawn',()=>{child.unref();resolve();});child.once('error',reject);});
 const action=args=>computer.action(args,controller.signal);let view;
 stage='find fixture';let fixture=await until(async()=>{view=await action({action:'observe'});return view.windows.find(w=>w.title.startsWith(label));});
 fixtureId=fixture.id;stage='minimize';execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/browser-fixture-window.ps1'),'-Label',label,'-ProcessName',browser,'-Action','minimize'],{windowsHide:true,stdio:'pipe'});
 view=await action({action:'observe'});fixture=view.windows.find(w=>w.title.startsWith(label));assert.ok(fixture?.minimized,'minimized Opera must remain discoverable');
 stage='restore and focus';await action({action:'focus',target:fixture.id});
 stage='combined browser restore and navigation';const combined=await computer.open(browser,controller.signal,url+'?combined-check=1');assert.equal(combined.reused,true);assert.equal(combined.window.id,fixtureId);assert.ok(combined.observation.controls.some(c=>c.name==='Play Despacito'));
 stage='read page';view=await until(async()=>{const current=await action({action:'observe'});if(current.windowId!==fixtureId)throw Error('Another window took focus before the fixture click.');return current.title.startsWith(label)&&current.controls.some(c=>c.name==='Play Despacito')?current:null;});
 const control=view.controls.find(c=>c.name==='Play Despacito');assert.ok(control);
 stage='navigate';await action({action:'navigate',url:url+'?navigation-check=1'});await action({action:'wait'});view=await action({action:'observe'});
 const button=view.controls.find(c=>c.name==='Play Despacito');assert.ok(button,'web controls must remain readable after navigation');
 stage='play';await action({action:'click',target:button.id});
 stage='verify playback';view=await until(async()=>{const current=await action({action:'observe'});return current.title.startsWith(label)&&current.title.includes('Playing')&&current.controls.some(c=>c.name==='Pause Despacito')?current:null;});
 if(process.argv.includes('--youtube')||process.argv.includes('--youtube-play')){
  stage='YouTube search labels';await action({action:'navigate',url:'https://www.youtube.com/results?search_query='+encodeURIComponent(process.argv.includes('--youtube-play')?'Modjo Lady Hear Me Tonight official video':'despacito')});await action({action:'wait'});
  const youtubeView=await until(async()=>{const current=await action({action:'observe'});return current.windowId===fixtureId&&/youtube/i.test(current.title)&&current.controls.some(c=>['Button','Link','Hyperlink'].includes(c.kind)&&/despacito|lady|reject all|accept all/i.test(c.name))?current:null;});
  if(process.argv.includes('--youtube-play')){
   stage='YouTube video click';const song=youtubeView.controls.find(c=>['Link','Hyperlink'].includes(c.kind)&&/modjo.*lady.*official/i.test(c.name));assert.ok(song,'Official requested song link must be observed before clicking');
   await action({action:'click',target:song.id});
   stage='YouTube video verification';const playing=await until(async()=>{const current=await action({action:'observe'});return /modjo.*lady/i.test(current.title)&&current.controls.some(c=>/^pause(?:\s|$|\()/i.test(c.name))?current:null;});assert.ok(playing);
  }
  youtube=true;console.log('YouTube page controls readable: '+youtubeView.provider+' ('+youtubeView.controls.length+' controls)');
  // Return to the uniquely titled fixture before closing only its private window.
  await action({action:'navigate',url});await action({action:'wait'});
 }
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,browser,privateFixture:true,minimizedDiscovered:true,restoreFocus:true,pageControls:true,navigation:true,realClick:true,playbackVerified:true,provider:view.provider,youtubeLabels:youtube}));console.log(browser+' smoke passed: '+output);
}catch(error){await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,stage,error:error.stack}));console.error(stage+': '+error.stack);process.exitCode=1;}
finally{computer.cancel();try{execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/browser-fixture-window.ps1'),'-Label',label,'-ProcessName',browser,'-Action','close'],{windowsHide:true,stdio:'pipe'});}catch{}server.closeAllConnections();server.close();if(process.versions.electron&&process.env.ELECTRON_RUN_AS_NODE!=='1')require('electron').app.exit(process.exitCode||0);}})();
