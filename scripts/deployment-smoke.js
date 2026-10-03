// Reproduce hidden native deployment files without changing any user settings.
const {execFileSync}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');
const native=path.join(root,'native').replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
const output=path.resolve('test-output',`deployment-smoke-${Date.now()}`),folder=path.join(output,'Hidden Aurora/native');
(async()=>{try{
 await fs.mkdir(folder,{recursive:true});await fs.cp(native,folder,{recursive:true});
 const attributes=path.join(output,'hide.ps1');await fs.writeFile(attributes,"param([string]$Folder) Get-ChildItem -LiteralPath $Folder -File -Force | ForEach-Object { $_.Attributes = $_.Attributes -bor [IO.FileAttributes]::Hidden }; (Get-Item -LiteralPath $Folder).Attributes = [IO.FileAttributes]::Directory -bor [IO.FileAttributes]::Hidden");
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',attributes,'-Folder',folder],{windowsHide:true,stdio:'pipe'});
 const run=(name,args,input='')=>execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(folder,name),...args],{windowsHide:true,input,encoding:'utf8',timeout:12000}).trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
 const control=run('desktop-control.ps1',['-OwnPid',String(process.pid)],'{"id":1,"action":"windows"}\n');assert.ok(control.some(e=>e.ready));assert.ok(control.some(e=>e.id===1&&e.ok&&Array.isArray(e.result.windows)));
 const cursor=run('agent-cursor.ps1',['-ParentPid',String(process.pid)],'quit\n');assert.ok(cursor.some(e=>e.ready));
 const voice=run('voice-recognition.ps1',['-Probe']);assert.ok(voice.some(e=>e.type==='capabilities'));
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,hiddenSources:true,desktopControl:true,cursor:true,voiceProbe:true}));console.log('Hidden deployment smoke passed: '+output);
 }catch(error){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack}));console.error(error);process.exitCode=1;}})();
