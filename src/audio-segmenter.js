// End-of-turn detection is independent of transcription. PCM16, mono, 16 kHz.
function createSegmenter({onStart,onChunk,onEnd,onLevel=()=>{},silenceMs=950,maxMs=25000,minMs=180,sensitivity=0.012}){
  let active=false,pre=[],preBytes=0,total=0,voiced=0,quiet=0,onset=0,floor=.002;
  function reset(){active=false;pre=[];preBytes=0;total=0;voiced=0;quiet=0;onset=0;}
  function finish(){if(!active)return false;const valid=voiced>=minMs;active=false;onEnd({valid,durationMs:total});reset();return true;}
  function push(pcm){
    if(!Buffer.isBuffer(pcm)||!pcm.length||pcm.length%2)return;
    let sum=0;for(let i=0;i<pcm.length;i+=2){const sample=pcm.readInt16LE(i)/32768;sum+=sample*sample;}
    const rms=Math.sqrt(sum/(pcm.length/2)),ms=pcm.length/32;
    const speech=rms>Math.max(sensitivity,Math.min(.045,floor*3));onLevel(rms);
    if(!active){
      if(!speech)floor=floor*.97+rms*.03;
      pre.push(pcm);preBytes+=pcm.length;while(preBytes>9600&&pre.length>1)preBytes-=pre.shift().length;
      onset=speech?onset+ms:0;if(onset<80)return;
      active=true;total=preBytes/32;voiced=onset;quiet=0;onStart();for(const chunk of pre)onChunk(chunk);pre=[];preBytes=0;return;
    }
    total+=ms;voiced+=speech?ms:0;quiet=speech?0:quiet+ms;onChunk(pcm);
    if(quiet>=silenceMs||total>=maxMs)finish();
  }
  return {push,finish,reset,get active(){return active;}};
}
function pcmWave(pcm){const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);}
module.exports={createSegmenter,pcmWave};
