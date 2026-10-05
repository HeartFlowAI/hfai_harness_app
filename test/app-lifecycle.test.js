const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createLifecycle}=require('../src/app-lifecycle');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
  const app=new EventEmitter(),calls={lock:0,cleanup:0,reopen:0,relaunch:0,exit:[],quit:0},errors=[];
  app.requestSingleInstanceLock=()=>{calls.lock++;return options.lock!==false;};
  app.exit=code=>calls.exit.push(code);app.relaunch=()=>calls.relaunch++;
  app.quit=()=>{let prevented=false;app.emit('before-quit',{preventDefault(){prevented=true;}});if(!prevented){calls.quit++;app.emit('quit');}};
  const lifecycle=createLifecycle({app,reopen:()=>calls.reopen++,cleanup:()=>calls.cleanup++,flush:async()=>{},onError:error=>errors.push(error.message),...options});
  return {app,calls,lifecycle,errors};
}
test('a duplicate exits immediately without starting cleanup or another window',()=>{const f=fixture({lock:false});assert.equal(f.lifecycle.primary,false);assert.deepEqual(f.calls.exit,[0]);assert.equal(f.calls.cleanup,0);assert.equal(f.app.listenerCount('before-quit'),0);});
test('a second launch during startup is restored once the window exists',()=>{const f=fixture();f.app.emit('second-instance');f.app.emit('second-instance');assert.equal(f.calls.reopen,0);f.lifecycle.ready();assert.equal(f.calls.reopen,1);f.app.emit('second-instance');assert.equal(f.calls.reopen,2);assert.equal(f.calls.lock,1);});
test('closing the main window cleans up once and waits for pending saves',async()=>{let saved;const f=fixture({flush:()=>new Promise(resolve=>{saved=resolve;})});let prevented=false;f.lifecycle.closeMain({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.lifecycle.closing,true);assert.equal(f.calls.cleanup,1);await turn();assert.equal(f.calls.quit,0);f.app.quit();assert.equal(f.calls.cleanup,1);saved();await turn();assert.equal(f.calls.quit,1);assert.equal(f.calls.exit.length,0);});
test('a launch arriving during shutdown requests one fresh process after saving',async()=>{let saved;const f=fixture({flush:()=>new Promise(resolve=>{saved=resolve;})});f.app.quit();await turn();f.app.emit('second-instance');f.app.emit('second-instance');saved();await turn();assert.equal(f.calls.relaunch,1);assert.equal(f.calls.quit,1);assert.equal(f.calls.reopen,0);});
test('save failures and cleanup failures cannot keep the app running',async()=>{const f=fixture({cleanup:()=>{throw Error('cleanup fixture failure');},flush:async()=>{throw Error('save fixture failure');}});f.app.quit();await turn();assert.equal(f.calls.quit,1);assert.deepEqual(f.errors,['cleanup fixture failure','save fixture failure']);});
test('a hung task has a bounded exit rather than an indefinitely held lock',async()=>{const f=fixture({flush:()=>new Promise(()=>{}),timeoutMs:20});f.app.quit();await new Promise(resolve=>setTimeout(resolve,40));assert.deepEqual(f.calls.exit,[0]);assert.match(f.errors[0],/timed out/);});
