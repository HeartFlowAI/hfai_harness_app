const {cleanCues,fishText}=require('./voice-expression');
function spokenText(text, limit=1400) {
  const plain=String(text||'').replace(/```[\s\S]*?```/g,' See the code in our chat. ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[#*_`>|]/g,'').replace(/\s+/g,' ').trim();
  const clean=cleanCues(plain);return clean.length>limit ? clean.slice(0,limit).replace(/\s+\S*$/,'')+'. The rest is in our chat.' : clean;
}
async function synthesize({provider,key,voiceId,fishModel='s2.1-pro',text,emotion='neutral',signal,onStart,onChunk,fetchImpl=fetch}) {
  signal?.throwIfAborted();
  if(!['elevenlabs','fish'].includes(provider)||typeof key!=='string'||!key.trim())throw new Error('Save a voice provider API key first.');
  if(typeof voiceId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(voiceId))throw new Error('Choose a voice ID in Voice settings.');
  const speech=spokenText(text);if(!speech)throw new Error('There is no reply to speak.');
  const eleven=provider==='elevenlabs';
  if(!eleven&&!['s1','s2-pro','s2.1-pro','s2.1-pro-free'].includes(fishModel))throw new Error('Choose a supported Fish Audio model.');
  const url=eleven ? `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128` : 'https://api.fish.audio/v1/tts';
  const headers=eleven ? {'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'} : {'Authorization':`Bearer ${key}`,'Content-Type':'application/json','model':fishModel};
  const streaming=!eleven&&typeof onChunk==='function';
  const body=eleven ? {text:speech,model_id:'eleven_flash_v2_5'} : {text:fishText(speech,emotion,fishModel),reference_id:voiceId,format:streaming?'pcm':'mp3',...(streaming?{sample_rate:24000}:{}),latency:'low'};
  const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000);
  let response;
  try {response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal:combined,redirect:'error'});}catch(error){if(signal?.aborted)throw error;throw new Error('Voice provider could not be reached. Check your connection.');}
  if(!response.ok){await response.body?.cancel();throw new Error(`${eleven?'ElevenLabs':'Fish Audio'} returned ${response.status}. Check your key, voice ID and account credits.`);}
  const mime=response.headers.get('content-type')||'';
  if(!/^audio\//i.test(mime)&&!mime.includes('octet-stream')){await response.body?.cancel();throw new Error('Voice provider did not return playable audio.');}
  if(streaming)onStart?.({sampleRate:24000});
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5000000)throw new Error('Spoken reply is too large.');chunks.push(Buffer.from(value));if(streaming)onChunk(value);}}finally{await reader.cancel().catch(()=>{});}
  if(!size)throw new Error('Voice provider returned empty audio.');
  return {audio:Buffer.concat(chunks),mime:streaming?'audio/pcm':'audio/mpeg',...(streaming?{streamed:true,sampleRate:24000}:{})};
}
async function listVoices(key,fetchImpl=fetch){
  if(typeof key!=='string'||!key.trim()||key.length>1000)throw new Error('Enter an ElevenLabs key first.');
  const response=await fetchImpl('https://api.elevenlabs.io/v2/voices?page_size=100',{headers:{'xi-api-key':key},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw new Error(`ElevenLabs returned ${response.status}. Check your key.`);
  const data=await response.json();return (data.voices||[]).map(v=>({id:v.voice_id,name:v.name})).filter(v=>typeof v.id==='string'&&typeof v.name==='string').slice(0,100);
}
module.exports={synthesize,listVoices,spokenText};
