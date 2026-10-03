const {createSegmenter}=require('./audio-segmenter');
const speech=require('./speech-provider');
const CONTROLS=new Set(['stop task','stop listening','open aurora','show aurora','minimize aurora','go to sleep']);
function classify(text,mode,scope){
  const normalized=text.toLowerCase().replace(/[.,!?;:]/g,'').replace(/\s+/g,' ').trim();
  if(CONTROLS.has(normalized))return {type:'control',text:normalized};
  if(mode==='approval')return ['approve action','deny action'].includes(normalized)?{type:'approval',text:normalized,scope}:null;
  if(mode==='listen')return normalized?{type:'text',text}:null;
  if(mode==='wake'){
    const match=/^(?:(?:hey|hi|hello|okay|ok)\s+)?(?:aurora|a[u]?rora|orora)\b[\s,.:!?]*(.*)$/i.exec(text.trim());
    if(match)return {type:'wake',text:match[1].trim()};
  }
  return null;
}
function createCloudRecognizer({onEvent,provider,key,language='en',deviceId='',captureFactory,scribeFactory=speech.createScribe,fishTranscribe=speech.transcribeFish,segmentOptions={}}){
  const capture=(captureFactory||require('./audio-capture').createAudioCapture)({onPCM:pcm=>{if(mode!=='paused'&&!waiting)segmenter.push(pcm);},onError:error=>onEvent({type:'error',message:error.message}),deviceId});
  let mode='paused',scope='',epoch=0,clip,recovering=false,waiting=false;
  const segmenter=createSegmenter({
    ...segmentOptions,
    onStart:()=>{
      if(mode==='paused')return;
      clip={epoch,mode,scope,chunks:[],abort:new AbortController()};const current=clip;
      current.timer=setTimeout(()=>{if(clip===current)segmenter.finish();},27000);
      onEvent({type:'speech-start'});
      if(provider==='elevenlabs')current.stream=scribeFactory({key,language,onPartial:text=>{if(clip===current&&epoch===current.epoch)onEvent({type:'partial',text});},onFinal:text=>complete(current,text),onError:error=>failed(current,error)});
    },
    onChunk:pcm=>{if(!clip)return;if(clip.stream)clip.stream.feed(pcm);else clip.chunks.push(pcm);},
    onEnd:({valid})=>{
      const current=clip;if(!current)return;
      clearTimeout(current.timer);
      if(!valid){cancelClip();onEvent({type:'speech-rejected',message:'That sound was too short to recognize. Please try again.'});return;}
      // Release microphone tracks before waiting for a transcript, even on network failure.
      waiting=true;capture.record(false).then(()=>{
        if(clip!==current||epoch!==current.epoch)return;
        onEvent({type:'speech-end'});
        if(current.stream)current.stream.commit();
        else fishTranscribe({pcm:Buffer.concat(current.chunks),key,language,signal:current.abort.signal}).then(text=>complete(current,text),error=>failed(current,error));
      }).catch(error=>failed(current,error));
    }
  });
  function cancelClip(){clearTimeout(clip?.timer);clip?.stream?.abort();clip?.abort.abort();clip=null;segmenter.reset();}
  async function recover(){if(recovering||mode==='paused')return;recovering=true;waiting=false;try{await capture.record(true);}catch(error){onEvent({type:'error',message:error.message});}finally{recovering=false;}}
  function complete(current,text){
    if(current!==clip||epoch!==current.epoch)return;
    clearTimeout(current.timer);clip=null;segmenter.reset();const event=classify(text,current.mode,current.scope);
    if(event){onEvent(event);if(event.type==='control'&&epoch===current.epoch&&mode!=='paused')recover();}else{onEvent({type:'speech-rejected',message:current.mode==='approval'?'Say exactly “approve action” or “deny action”.':'I didn’t catch that. Please try again.'});recover();}
  }
  function failed(current,error){if(current!==clip||epoch!==current.epoch)return;cancelClip();onEvent({type:'error',message:error.message});}
  async function setMode(value,id=''){
    if(!['wake','listen','control','approval','paused'].includes(value))throw Error('Invalid speech mode.');
    epoch++;cancelClip();waiting=false;mode=value;scope=id;await capture.record(value!=='paused');
  }
  function stop(){epoch++;mode='paused';cancelClip();capture.stop();}
  async function finish(){if(!segmenter.finish())onEvent({type:'speech-rejected',message:'No speech captured yet. Speak your request first.'});}
  return {start:()=>capture.start(),mode:setMode,stop,finish};
}
module.exports={createCloudRecognizer,classify};
