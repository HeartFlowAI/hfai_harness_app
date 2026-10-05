// One primary app per Windows user/profile. Auxiliary windows never own its life.
function createLifecycle({app, isolated=false, reopen, cleanup, flush, onError=()=>{}, timeoutMs=7000}) {
  const primary=isolated || app.requestSingleInstanceLock();
  let ready=false, closing=false, canClose=false, queuedOpen=false, restart=false, timer;
  if(!primary){app.exit(0);return {primary:false};}
  app.on('second-instance',()=>{
    if(closing){restart=true;return;}
    if(ready)reopen();else queuedOpen=true;
  });
  const finish=()=>{
    if(canClose)return;
    clearTimeout(timer);canClose=true;
    if(restart)app.relaunch();
    app.quit();
  };
  app.on('before-quit',event=>{
    if(canClose)return;
    event.preventDefault();
    if(closing)return;
    closing=true;
    timer=setTimeout(()=>{onError(Error('Aurora shutdown timed out.'));if(restart)app.relaunch();app.exit(0);},timeoutMs);
    try{cleanup();}catch(error){onError(error);}
    Promise.resolve().then(flush).catch(onError).finally(finish);
  });
  app.on('window-all-closed',()=>app.quit());
  app.on('quit',()=>clearTimeout(timer));
  return {
    primary,
    ready(){ready=true;if(queuedOpen&&!closing){queuedOpen=false;reopen();}},
    closeMain(event){if(canClose)return;event.preventDefault();app.quit();},
    get closing(){return closing;}
  };
}
module.exports={createLifecycle};
