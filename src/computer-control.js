const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const keys=new Set(['CTRL+L','CTRL+A','CTRL+F','ENTER','TAB','SHIFT+TAB','ESC','SPACE','BACKSPACE','ALT+LEFT','ALT+RIGHT']);
function validateNavigation(url){if(typeof url!=='string'||url.length>1500||/[\x00-\x1f]/.test(url))throw Error('Use a complete http or https browser URL.');let parsed;try{parsed=new URL(url);}catch{throw Error('Use a complete http or https browser URL.');}if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Use a complete http or https browser URL without credentials.');return parsed.href;}
function delay(ms,signal){signal.throwIfAborted();return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(Error('Computer control stopped.'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});}
function pageSignature(view){return JSON.stringify([view.title,(view.controls||[]).map(c=>[c.name,c.kind,c.value])]);}
async function observePage(observe,signal,before,timeout=6500){const started=Date.now(),previous=before&&pageSignature(before);let latest;do{await delay(latest?200:300,signal);latest=await observe();if(before?.windowId&&latest.windowId!==before.windowId)throw Error('The foreground window changed while the page was loading. Observe again before acting.');if(latest.controls?.some(c=>['Button','Link','Hyperlink','Edit','Document'].includes(c.kind))&&(!previous||pageSignature(latest)!==previous))return latest;}while(Date.now()-started<timeout);return {...latest,loadingMayContinue:true};}
function validateAction(args){
  if(!['observe','focus','move','click','type','keys','scroll','wait','navigate'].includes(args.action))throw Error('Choose a supported computer action.');
  if(['focus','move','click','type','scroll'].includes(args.action)&&!args.target)throw Error('Use an exact id from the most recent computer observation.');
  if(args.action==='keys'&&!keys.has(args.keys))throw Error('Choose a supported keyboard shortcut.');
  if(args.action==='type'&&(typeof args.text!=='string'||args.text.length>1500||/[\x00-\x1f]/.test(args.text)))throw Error('Type up to 1,500 characters without control characters.');
  if(args.action==='navigate')validateNavigation(args.url);
  if(args.action==='scroll'&&!['up','down'].includes(args.direction))throw Error('Scroll up or down.');
}
async function applicationPath(name,env=process.env,exists=async p=>!!await fs.stat(p).catch(()=>null)){
  const local=env.LOCALAPPDATA||'',pf=env.ProgramFiles||'C:/Program Files',x86=env['ProgramFiles(x86)']||'C:/Program Files (x86)',win=env.WINDIR||'C:/Windows';
  const candidates={opera:[path.join(local,'Programs/Opera/launcher.exe'),path.join(local,'Programs/Opera GX/launcher.exe'),path.join(local,'Opera/launcher.exe'),path.join(pf,'Opera/launcher.exe'),path.join(pf,'Opera GX/launcher.exe'),path.join(x86,'Opera/launcher.exe')],chrome:[path.join(pf,'Google/Chrome/Application/chrome.exe'),path.join(x86,'Google/Chrome/Application/chrome.exe'),path.join(local,'Google/Chrome/Application/chrome.exe')],edge:[path.join(x86,'Microsoft/Edge/Application/msedge.exe'),path.join(pf,'Microsoft/Edge/Application/msedge.exe')],brave:[path.join(pf,'BraveSoftware/Brave-Browser/Application/brave.exe'),path.join(x86,'BraveSoftware/Brave-Browser/Application/brave.exe'),path.join(local,'BraveSoftware/Brave-Browser/Application/brave.exe')],firefox:[path.join(pf,'Mozilla Firefox/firefox.exe')],explorer:[path.join(win,'explorer.exe')],notepad:[path.join(win,'System32/notepad.exe')],calculator:[path.join(win,'System32/calc.exe')]};
  if(!Object.hasOwn(candidates,name))throw Error('Supported apps: Opera, Chrome, Edge, Brave, Firefox, Explorer, Notepad and Calculator.');
  for(const candidate of candidates[name])if(await exists(candidate))return candidate;
  if(env===process.env&&process.platform==='win32'&&['opera','chrome','edge','brave','firefox'].includes(name)){
    const processName=name==='edge'?'msedge':name;
    const output=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`@(Get-Process -Name ${processName} -ErrorAction SilentlyContinue | ForEach-Object {$_.Path}) | ConvertTo-Json -Compress`],{windowsHide:true,timeout:5000}).catch(()=>({stdout:'[]'}));
    let running;try{running=JSON.parse(output.stdout||'[]');}catch{running=[];}
    for(const candidate of [running].flat())if(typeof candidate==='string'&&path.basename(candidate).toLowerCase()===processName+'.exe'&&await exists(candidate))return candidate;
  }
  throw Error(`${name} was not found in its usual Windows installation folders.`);
}
function compactObservation(view){
  if(!view?.controls)return view;
  const base={...view,controls:[]};let size=JSON.stringify(base).length;
  for(const control of view.controls){const item={id:control.id,name:control.name,kind:control.kind,editable:control.editable,provider:control.provider,...(control.value?{value:control.value}:{})};const length=JSON.stringify(item).length+1;if(size+length>26500){base.truncated=true;break;}base.controls.push(item);size+=length;}
  return base;
}
function createComputerControl({onActivity=()=>{},ownPid=process.pid,spawnImpl=spawn}={}){
  let child,starting,readyResolve,readyReject,pending,sequence=0,buffer='',stderr='',queue=Promise.resolve(),lastView;
  function cancel(){const old=child;child=null;starting=null;readyReject?.(Error('Computer control stopped.'));readyResolve=null;readyReject=null;if(pending){clearTimeout(pending.timer);pending.reject(Error('Computer control stopped.'));pending=null;}old?.kill();onActivity({action:'hide'});}
  function start(){
    if(starting)return starting;
    const file=path.join(__dirname,'native/desktop-control.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
    starting=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
    const current=child=spawnImpl('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,'-OwnPid',String(ownPid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});buffer='';stderr='';
    const timer=setTimeout(()=>{readyReject?.(Error('Windows computer control did not start.'));cancel();},10000);
    current.stdout.on('data',chunk=>{if(current!==child)return;buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let event;try{event=JSON.parse(line);}catch{continue;}if(current!==child)continue;
      if(event.pointer){onActivity({action:"pointer",x:event.x,y:event.y});continue;}
      if(event.ready){clearTimeout(timer);readyResolve?.();readyResolve=null;readyReject=null;}
      else if(pending?.id===event.id){const p=pending;pending=null;clearTimeout(p.timer);event.ok?p.resolve(event.result):p.reject(Error(event.error));}
    }});
    current.stderr.on('data',chunk=>{if(current!==child)return;stderr=(stderr+chunk).slice(0,1800);});
    current.on('error',error=>{clearTimeout(timer);if(current===child){readyReject?.(error);cancel();}});
    current.on('close',()=>{clearTimeout(timer);if(current===child){readyReject?.(Error(stderr||'Windows computer control closed.'));cancel();}});
    return starting;
  }
  async function request(args,signal){
    signal.throwIfAborted();await start();signal.throwIfAborted();
    return new Promise((resolve,reject)=>{const id=++sequence;const abort=()=>cancel();signal.addEventListener('abort',abort,{once:true});
      const done=fn=>value=>{signal.removeEventListener('abort',abort);fn(value);};
      const timer=setTimeout(()=>cancel(),9000);pending={id,resolve:done(resolve),reject:done(reject),timer};
      child.stdin.write(JSON.stringify({...args,id})+'\n',error=>{if(error&&pending?.id===id)cancel();});
    });
  }
  function action(args,signal){validateAction(args);const execute=async()=>{
    signal.throwIfAborted();await onActivity(args);signal.throwIfAborted();
    if(args.action==='wait'){await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(Error('Computer control stopped.'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},800);signal.addEventListener('abort',abort,{once:true});});return {waitedMs:800};}
    const before=lastView,result=await request({...args,delta:args.direction==='up'?480:-480},signal);
    if(['focus','click','type','keys','scroll','navigate'].includes(args.action)){
      const expected=args.action==='focus'?args.target:before?.windowId;
      const observe=async()=>{const view=await request({action:'observe'},signal);if(expected&&view.windowId!==expected)throw Error('The foreground window changed. Observe again before acting.');return view;};
      lastView=args.action==='navigate'?await observePage(observe,signal,before):args.action==='click'?await observePage(observe,signal,null):await observe();
      return {...result,observation:compactObservation(lastView)};
    }
    if(args.action==='observe')lastView=result;
    return compactObservation(result);
  };const result=queue.catch(()=>{}).then(execute).catch(error=>{onActivity({action:'hide'});throw error;});queue=result;return result;}
  async function open(name,signal,url){signal.throwIfAborted();const app=name.trim().toLowerCase();const processNames={opera:'opera',chrome:'chrome',edge:'msedge',brave:'brave',firefox:'firefox',explorer:'explorer',notepad:'notepad',calculator:'CalculatorApp'};if(!Object.hasOwn(processNames,app))throw Error('Choose a supported application.');if(url!==undefined){validateNavigation(url);if(!['opera','chrome','edge','brave','firefox'].includes(app))throw Error('URLs require a supported browser.');}
    await onActivity({action:'open',text:`Opening ${app}`});signal.throwIfAborted();
    const existing=(await request({action:'windows'},signal)).windows.filter(w=>w.process.toLowerCase()===processNames[app].toLowerCase());
    if(existing.length){const window=existing.find(w=>w.foreground)||existing[0];await request({action:'focus',target:window.id},signal);
      if(url){const before=await request({action:'observe'},signal);if(before.windowId!==window.id)throw Error('The requested browser lost focus. No navigation was performed.');await onActivity({action:'navigate',url});await request({action:'navigate',url},signal);lastView=await observePage(()=>request({action:'observe'},signal),signal,before);}
      else lastView=await request({action:'observe'},signal);
      return {reused:true,application:app,window,...(url?{navigated:url}:{}),observation:compactObservation(lastView)};}
    const executable=await applicationPath(app);signal.throwIfAborted();await new Promise((resolve,reject)=>{const launched=spawnImpl(executable,['opera','chrome','edge','brave'].includes(app)?['--force-renderer-accessibility','--new-window']:[],{windowsHide:false,detached:true,stdio:'ignore'});launched.once('error',reject);launched.once('spawn',()=>{launched.unref();resolve();});});
    const deadline=Date.now()+7000;while(Date.now()<deadline){await delay(200,signal);const launched=(await request({action:'windows'},signal)).windows.find(w=>w.process.toLowerCase()===processNames[app].toLowerCase());if(!launched)continue;await request({action:'focus',target:launched.id},signal);if(url){await onActivity({action:'navigate',url});await request({action:'navigate',url},signal);lastView=await observePage(async()=>{const view=await request({action:'observe'},signal);if(view.windowId!==launched.id)throw Error('The requested browser lost focus. Observe before acting.');return view;},signal,null);}else lastView=await request({action:'observe'},signal);return {launched:app,...(url?{navigated:url}:{}),observation:compactObservation(lastView)};}
    return {launched:app,message:'The application is still starting. Observe before interacting.'};
  }
  return {action,open,cancel,prepare:start};
}
module.exports={createComputerControl,validateAction,validateNavigation,applicationPath,compactObservation,observePage};
