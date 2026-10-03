const {spawn}=require('node:child_process');
const path=require('node:path');
function createAgentCursor(){
  let child,ready,waiting=[],last=0,disposed=false;
  function start(){if(ready)return ready;
    ready=new Promise((resolve,reject)=>{
      const file=path.join(__dirname,'native/agent-cursor.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
      child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,'-ParentPid',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});let buffer='';
      const timer=setTimeout(()=>{reject(Error('Aurora pointer did not start.'));dispose();},8000);
      child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let value;try{value=JSON.parse(line);}catch{continue;}if(value.ready){clearTimeout(timer);resolve();}if(value.active)for(const done of waiting.splice(0))done();}});
      child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',()=>{clearTimeout(timer);reject(Error('Aurora pointer closed.'));for(const done of waiting.splice(0))done(Error('Aurora pointer closed.'));ready=null;child=null;});
      child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
    });return ready;
  }
  async function activate(){if(disposed)return;await start();if(disposed)return;if(Date.now()-last<200)return;last=Date.now();
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const index=waiting.indexOf(done);if(index>=0)waiting.splice(index,1);reject(Error('Aurora pointer could not be shown.'));},3000);const done=error=>{clearTimeout(timer);error?reject(error):resolve();};waiting.push(done);child.stdin.write('active\n');});
  }
  function restore(){last=0;if(child?.stdin.writable)child.stdin.write('idle\n');}
  function dispose(){if(disposed)return;disposed=true;last=0;if(child?.stdin.writable)child.stdin.end('idle\nquit\n');}
  return {activate,restore,dispose,prepare:start};
}
module.exports={createAgentCursor};
