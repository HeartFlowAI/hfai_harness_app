// Actual system pointer replacement/restoration; leaves the user's cursor intact.
const {spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.AURORA_SMOKE_SOURCE||path.resolve('src'),output=path.resolve('test-output',`cursor-smoke-${Date.now()}`);
const file=path.join(root,'native/agent-cursor.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function helper(parent){const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,'-ParentPid',String(parent)],{windowsHide:true,stdio:['pipe','pipe','pipe']});const events=[];let buffer='',error='';child.stdout.on('data',b=>{buffer+=b;let n;while((n=buffer.indexOf('\n'))>=0){try{events.push(JSON.parse(buffer.slice(0,n)));}catch{}buffer=buffer.slice(n+1);}});child.stderr.on('data',b=>error+=b);return {child,events,send:s=>child.stdin.write(s+'\n'),get error(){return error;}};}
async function until(fn){for(let i=0;i<160;i++){const result=fn();if(result)return result;await wait(50);}throw Error('Cursor check timed out');}
(async()=>{let primary,watchdog,parent;
 try{await fs.mkdir(output,{recursive:true});primary=helper(process.pid);await until(()=>primary.events.some(e=>e.ready));
  async function state(){const n=primary.events.length;primary.send('state');return (await until(()=>primary.events.slice(n).find(e=>e.fingerprint))).fingerprint;}
  const original=await state();primary.send('active');await until(()=>primary.events.some(e=>e.active===true));const pink=await state();assert.notEqual(pink,original);
  await wait(1950);assert.equal(await state(),original,'idle must restore the exact original pointer');
  primary.send('active');await until(()=>primary.events.at(-1)?.active===true);primary.send('idle');await until(()=>primary.events.at(-1)?.active===false);assert.equal(await state(),original);
  parent=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});watchdog=helper(parent.pid);await until(()=>watchdog.events.some(e=>e.ready));watchdog.send('active');await until(()=>watchdog.events.some(e=>e.active===true));assert.notEqual(await state(),original);
  parent.kill();await until(()=>watchdog.child.exitCode!==null);assert.equal(await state(),original,'parent exit must restore the pointer');
  primary.send('active');await until(()=>primary.events.at(-1)?.active===true);primary.child.stdin.end('quit\n');await until(()=>primary.child.exitCode!==null);
  const inspector=helper(process.pid);primary=inspector;await until(()=>inspector.events.some(e=>e.ready));assert.equal(await state(),original,'normal exit must restore the pointer');
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,replacement:true,idleRestore:true,explicitRestore:true,parentExitRestore:true,normalExitRestore:true}));console.log('Cursor smoke passed: '+output);
 }catch(error){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack,nativeError:primary?.error}));console.error(error);process.exitCode=1;}
 finally{primary?.child.stdin.end('idle\nquit\n');watchdog?.child.stdin.end('idle\nquit\n');parent?.kill();}
})();
