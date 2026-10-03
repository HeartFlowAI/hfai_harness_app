const { spawn } = require('node:child_process');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const helper = () => path.join(__dirname,'native','voice-recognition.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
function createRecognizer({ onEvent, recognizerId = '', probe = false, engine='windows',...options }) {
  if(engine==='cloud'&&!probe)return require('./cloud-recognizer').createCloudRecognizer({onEvent,...options});
  let child, buffer='', starting, ready, fail, startupTimer;
  const pending=new Map();
  function stop() {
    clearTimeout(startupTimer);
    const previous=child;child=null;
    previous?.stdin.destroy();previous?.kill();
    for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('Listening stopped.'));}pending.clear();
    fail?.(new Error('Listening stopped.'));fail=null;
  }
  function start() {
    starting=new Promise((resolve,reject)=>{ready=resolve;fail=reject;});
    const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper()];
    if(probe)args.push('-Probe');else if(recognizerId)args.push('-RecognizerId',recognizerId);
    child=spawn('powershell.exe',args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
    const process=child;
    startupTimer=setTimeout(()=>{fail?.(new Error('Windows speech recognition took too long to start.'));fail=null;stop();},15000);
    process.stdin.on('error',()=>{});
    process.stdout.on('data',chunk=>{
      buffer+=chunk.toString();let end;
      while((end=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let event;try{event=JSON.parse(line);}catch{continue;}
        if(child!==process)return;
        if(['ready','capabilities'].includes(event.type)){clearTimeout(startupTimer);ready?.(event);ready=null;fail=null;}
        else if(event.type==='mode'){const item=pending.get(event.id);if(item){pending.delete(event.id);clearTimeout(item.timer);item.resolve();}}
        else if(event.type==='error'){clearTimeout(startupTimer);fail?.(new Error(event.message));fail=null;onEvent?.(event);}
        else onEvent?.(event);
      }
    });
    process.on('error',error=>{fail?.(error);fail=null;onEvent?.({type:'error',message:'Could not start Windows speech recognition.'});stop();});
    process.on('close',()=>{if(child!==process)return;fail?.(new Error('Windows speech recognition closed.'));fail=null;if(!probe)onEvent?.({type:'error',message:'Windows speech recognition closed. Turn listening on to retry.'});stop();});
    return starting;
  }
  function mode(value,scope='') {
    if(!child || !['wake','listen','paused','control','approval','finish'].includes(value))return Promise.reject(new Error('Speech recognizer is not ready.'));
    return new Promise((resolve,reject)=>{
      const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(new Error('Speech recognizer did not respond.'));},5000);
      pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,mode:value,scope})+'\n');
    });
  }
  return {start,mode,stop,finish:()=>mode('finish')};
}
async function capabilities(){const recognizer=createRecognizer({probe:true});try{return await recognizer.start();}finally{recognizer.stop();}}
module.exports={createRecognizer,capabilities};
