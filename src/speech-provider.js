const {pcmWave}=require('./audio-segmenter');
function cleanTranscript(text){return String(text||'').replace(/<\|speaker:\d+\|>/g,'').replace(/\[[^\]]*\]/g,'').replace(/\s+/g,' ').trim().slice(0,4000);}
async function transcribeFish({pcm,key,language='en',signal,fetchImpl=fetch}){
  signal?.throwIfAborted();if(!key?.trim())throw Error('Save a Fish Audio API key first.');
  const form=new FormData();form.append('audio',new Blob([pcmWave(pcm)],{type:'audio/wav'}),'speech.wav');form.append('ignore_timestamps','true');form.append('tag_audio_events','false');form.append('diarize','false');if(language)form.append('language',language);
  let response;try{response=await fetchImpl('https://api.fish.audio/v1/asr',{method:'POST',headers:{Authorization:`Bearer ${key}`,model:'transcribe-1-pro'},body:form,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),redirect:'error'});}catch(error){if(signal?.aborted)throw error;throw Error('Speech transcription could not be reached. Try again.');}
  if(!response.ok){await response.body?.cancel();throw Error(`Fish transcription returned ${response.status}. Check Speech-to-Text access and credits for your key.`);}
  return cleanTranscript((await response.json()).text);
}
function createScribe({key,language='en',onPartial,onFinal,onError,Socket=require('ws'),timeoutMs=12000}){
  const url=new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime');url.searchParams.set('model_id','scribe_v2_realtime');url.searchParams.set('audio_format','pcm_16000');url.searchParams.set('commit_strategy','manual');if(language)url.searchParams.set('language_code',language);
  const socket=new Socket(url.href,{headers:{'xi-api-key':key},handshakeTimeout:10000,maxPayload:100000});
  let ready=false,ended=false,committed=false,commitSent=false,queue=[],queuedBytes=0;
  let timer=setTimeout(()=>fail('Speech connection timed out. Try again.'),timeoutMs);
  function abort(){if(ended)return;ended=true;clearTimeout(timer);queue=[];socket.terminate();}
  function fail(message){if(ended)return;abort();onError(Error(message));}
  function send(pcm,commit=false){if(ended)return;try{if(socket.readyState!==undefined&&socket.readyState!==1)throw Error('Connection closed');socket.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:pcm.toString('base64'),sample_rate:16000,...(commit?{commit:true}:{})}));}catch{fail('Speech connection closed while sending audio. Please try again.');}}
  function flush(){if(!ready||ended)return;for(const pcm of queue)send(pcm);queue=[];queuedBytes=0;if(committed&&!commitSent){commitSent=true;send(Buffer.alloc(3200),true);}}
  function feed(pcm){if(ended)return;queue.push(pcm);queuedBytes+=pcm.length;if(queuedBytes>960000){fail('Speech connection is too slow. Try again.');return;}flush();}
  function commit(){if(ended||committed)return;committed=true;clearTimeout(timer);timer=setTimeout(()=>fail('Transcription took too long. Your recording has stopped; please try again.'),timeoutMs);flush();}
  socket.on('message',data=>{
    if(ended)return;let value;try{value=JSON.parse(data.toString());}catch{return;}
    if(value.message_type==='session_started'){ready=true;clearTimeout(timer);timer=setTimeout(()=>fail('Speech session timed out.'),40000);flush();}
    else if(value.message_type==='partial_transcript'){onPartial(cleanTranscript(value.text));}
    else if(value.message_type==='committed_transcript'&&commitSent){const text=cleanTranscript(value.text);abort();onFinal(text);}
    else if(/error|quota|rate_limited|auth|payment|invalid/i.test(value.message_type||'')){fail('Speech provider rejected the session. Check Speech-to-Text permissions and account credits.');}
  });
  socket.on('error',()=>fail('Could not connect to ElevenLabs transcription. Check your connection and key.'));
  socket.on('close',()=>{if(!ended)fail('Speech connection closed before transcription completed. Try again.');});
  return {feed,commit,abort};
}
module.exports={createScribe,transcribeFish,cleanTranscript};
