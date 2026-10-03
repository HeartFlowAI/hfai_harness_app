const {greetingPicker}=require('./voice-greetings');
function createVoiceSession({createListener,speak,execute,show,onState,onError,onPartial=()=>{},onControl=async()=>{},onApproval=()=>{},getGreeting=greetingPicker(),listenMs=45000,echoMs=250}){
  let listener,enabled=false,status='off',epoch=0,speechEpoch=0,speechAbort,timer,question='',approval=null,quiet=false,beforeTranscribe='listening';
  const update=(value,detail='')=>{status=value;onState({enabled,status:value,detail});};
  const alive=value=>enabled&&epoch===value;
  function idleTimer(){clearTimeout(timer);timer=setTimeout(()=>{wakeMode().catch(fail);},listenMs);}
  function stop(){enabled=false;epoch++;speechEpoch++;clearTimeout(timer);speechAbort?.abort();listener?.stop();listener=null;question='';approval=null;quiet=false;update('off','Microphone off');}
  async function wakeMode(){clearTimeout(timer);if(!enabled)return;const session=epoch;await listener.mode('wake');if(alive(session))update('wake','Listening for “Aurora”');}
  async function listenMode(){
    if(!enabled)return;const session=epoch,utterance=speechEpoch;
    await listener.mode(approval?'approval':'listen',approval?.id||'');
    if(!alive(session)||utterance!==speechEpoch)return;
    update(approval?'approval':'listening',approval?'Say “approve action” or “deny action”':question?'Listening for your answer':'Tell Aurora what you need');
    idleTimer();
  }
  async function sayAndListen(text,options={}){
    if(!enabled)return;
    const session=epoch,utterance=++speechEpoch;clearTimeout(timer);speechAbort?.abort();speechAbort=new AbortController();
    await listener.mode('paused');if(!alive(session)||utterance!==speechEpoch)return;
    update('speaking',text);show();
    try{await speak(text,speechAbort.signal,options);}catch(error){if(!alive(session)||utterance!==speechEpoch)return;throw error;}
    if(echoMs)await new Promise(resolve=>setTimeout(resolve,echoMs));
    if(!alive(session)||utterance!==speechEpoch)return;
    if(options.sleepAfterReply)await wakeMode();else await listenMode();
  }
  async function control(text){
    const command=text.toLowerCase().replace(/[.!?]$/,'').replace(/^aurora[ ,]+/,'').trim();
    if(command==='stop listening'){stop();return true;}
    if(['go to sleep',"that's all",'end conversation'].includes(command)){quiet=true;speechEpoch++;speechAbort?.abort();await wakeMode();return true;}
    if(command==='stop task'){await cancelTask();return true;}
    if(['open aurora','show aurora','minimize aurora'].includes(command)){await onControl(command==='minimize aurora'?'minimize':'open');return true;}
    return false;
  }
  async function cancelTask(){epoch++;speechEpoch++;clearTimeout(timer);speechAbort?.abort();question='';approval=null;await onControl('stop');await wakeMode();}
  function fail(error){if(!enabled)return;stop();onError(error.message||String(error));}
  async function handle(event){
    if(!enabled)return;
    const handlingEpoch=epoch;
    try{
      if(event.type==='error')throw new Error(event.message);
      if(event.type==='speech-start'&&['listening','approval'].includes(status)){clearTimeout(timer);return;}
      if(event.type==='speech-end'&&['listening','approval'].includes(status)){beforeTranscribe=status;clearTimeout(timer);update('transcribing','Recording stopped · transcribing your words');return;}
      if(event.type==='speech-rejected'&&['listening','approval','transcribing'].includes(status)){onPartial('');if(event.restart)await listener.mode(approval?'approval':'listen',approval?.id||'');update(approval?'approval':'listening',event.message);idleTimer();return;}
      if(event.type==='partial'&&status==='listening'){onPartial(String(event.text||'').slice(0,4000));idleTimer();return;}
      if(event.type==='control'&&['wake','working','approval','listening','transcribing'].includes(status)){await control(String(event.text||''));if(enabled&&status==='transcribing'){update(beforeTranscribe);idleTimer();}return;}
      if(event.type==='approval'&&['approval','transcribing'].includes(status)&&approval&&event.scope===approval.id){
        const text=String(event.text||'').toLowerCase();if(!['approve action','deny action'].includes(text))return;
        const id=approval.id;clearTimeout(timer);approval=null;question='';update('working','Working on your request');await listener.mode('control');
        if(alive(handlingEpoch))onApproval(id,text==='approve action');return;
      }
      if(event.type==='wake'&&status==='wake'){quiet=false;update('waking');await sayAndListen(approval?.prompt||question||getGreeting(),{kind:approval?'approval':question?'question':'greeting'});if(event.text&&status==='listening')await handle({type:'text',text:event.text});}
      else if(event.type==='text'&&['listening','transcribing'].includes(status)&&!approval){
        const text=String(event.text||'').trim();if(!text)return;
        if(await control(text))return;
        const session=epoch;clearTimeout(timer);update('working','Working on your request');await listener.mode('control');
        if(!alive(session))return;
        const reply=await execute(text);
        if(!alive(session)||reply?.continuing)return;
        question='';
        if(reply?.followUp){question=reply.content;if(!quiet)await sayAndListen(question,{kind:'question'});return;}
        if(quiet)return;
        if(reply?.content)await sayAndListen(reply.content,{emotion:reply.emotion,sleepAfterReply:reply.sleepAfterReply===true});
        else await listenMode();
      }
    }catch(error){if(epoch===handlingEpoch)fail(error);}
  }
  async function start(){
    if(enabled)return;
    enabled=true;const session=++epoch;update('starting','Starting local speech recognition');
    listener=createListener(event=>{handle(event);});
    try{await listener.start();if(!alive(session))return;await wakeMode();}catch(error){if(alive(session))fail(error);throw error;}
  }
  async function ask(text){question=text;if(enabled&&!quiet)await sayAndListen(text,{kind:'question'});}
  async function askApproval(id,text){approval={id,prompt:text};question='';if(enabled&&!quiet)await sayAndListen(text,{kind:'approval'});}
  async function pause(){clearTimeout(timer);speechEpoch++;speechAbort?.abort();if(enabled){await listener.mode('control');update('working','Working on your request');}}
  async function announce(text){
    if(!enabled)return;
    const session=epoch,utterance=++speechEpoch;speechAbort?.abort();speechAbort=new AbortController();
    await listener.mode('paused');if(!alive(session)||utterance!==speechEpoch)return;
    update('speaking',text);
    try{await speak(text,speechAbort.signal);}catch(error){if(!alive(session)||utterance!==speechEpoch)return;throw error;}
    if(alive(session)&&utterance===speechEpoch)update('working','Review the approval in the app');
  }
  async function approvalClosed(id){if(approval?.id!==id)return;approval=null;question='';await pause();}
  async function finish(){if(!enabled||!['listening','approval'].includes(status))throw Error('Aurora is not recording a request right now.');if(!listener.finish)throw Error('This speech engine does not support finishing a recording.');await listener.finish();}
  return {start,stop,cancelTask,finish,ask,askApproval,approvalClosed,pause,announce,resume:wakeMode,get active(){return enabled;},get status(){return status;}};
}
module.exports={createVoiceSession};
