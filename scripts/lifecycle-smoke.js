const {spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const executable=require('electron'),output=path.resolve('test-output',`lifecycle-${Date.now()}`),profile=path.join(output,'profile'),children=[];
function launch(){
  const child=spawn(executable,[path.resolve('scripts/lifecycle-fixture.js'),'--smoke-test','--single-instance-smoke','--profile',profile],{windowsHide:true,stdio:['pipe','pipe','pipe']});children.push(child);
  const events=[];let pending='',stderr='';child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{pending+=chunk;const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(line.startsWith('AURORA_LIFECYCLE '))events.push(JSON.parse(line.slice(17)));});child.stderr.on('data',chunk=>stderr+=chunk);
  const exited=new Promise(resolve=>{child.once('exit',(code,signal)=>resolve({code,signal}));});
  async function event(type){for(let i=0;i<200;i++){const error=events.find(e=>e.type==='error');if(error)throw Error(error.message);const value=events.find(e=>e.type===type);if(value)return value;if(child.exitCode!==null)throw Error(`Fixture closed before ${type}: ${stderr}`);await new Promise(r=>setTimeout(r,25));}throw Error(`Timed out waiting for ${type}: ${stderr}`);}
  let commandId=0;
  return {child,events,event,exited,command:value=>require('node:fs').writeFileSync(path.join(profile,`command-${child.pid}.json`),JSON.stringify({id:++commandId,value}))};
}
async function exit(process){return Promise.race([process.exited,new Promise((_resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Aurora did not exit within 10 seconds.')),10000);timer.unref();})]);}
(async()=>{
  await fs.mkdir(output,{recursive:true});const results=[];
  try{
    for(let cycle=0;cycle<3;cycle++){
      const first=launch();await first.event('ready');first.command('minimize');await first.event('minimized');
      const duplicate=launch();assert.equal((await exit(duplicate)).code,0);assert.ok(!duplicate.events.some(e=>e.type==='ready'));
      // Restoration may arrive just after the duplicate process exits.
      let restored=false;for(let attempt=0;attempt<40;attempt++){first.events.splice(0,first.events.length,...first.events.filter(e=>e.type!=='inspect'));first.command('inspect');const state=await first.event('inspect');assert.equal(state.windows,1);if(state.visible&&!state.minimized){restored=true;break;}await new Promise(r=>setTimeout(r,25));}assert.ok(restored,'second launch should restore the original');
      first.command('exercise');assert.ok((await first.event('exercise')).windows>=4);first.command('close');assert.equal((await exit(first)).code,0);
      const report=JSON.parse(await fs.readFile(path.join(profile,`exit-${first.child.pid}.json`),'utf8'));assert.equal(report.aborted,true);assert.equal(report.cursorDisposed,true);assert.equal(report.computerCancelled,true);assert.equal(report.windows,0);
      const saved=JSON.parse(await fs.readFile(path.join(profile,'aurora.json'),'utf8'));assert.ok(saved.chats.some(c=>c.messages.some(m=>m.content==='Lifecycle fixture task')));results.push({cycle:cycle+1,duplicateRejected:true,restored:true,pendingTaskSaved:true,...report});
    }
    // Immediate next launch confirms the lock was released, even with auxiliaries.
    const final=launch();await final.event('ready');final.command('close');assert.equal((await exit(final)).code,0);
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,results},null,2));console.log('Lifecycle smoke passed: '+output);
  }finally{for(const child of children)if(child.exitCode===null&&!child.killed)child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
