// Schedule small PCM buffers as they arrive; generation and playback overlap.
window.AuroraPcmPlayer=class {
  static prepare(){if(!this.shared||this.shared.state==='closed'){this.shared=new AudioContext({sampleRate:24000});}return this.shared;}
  static release(){const context=this.shared;this.shared=null;context?.close().catch(()=>{});}
  constructor(rate,finish){
    if(rate!==24000)throw Error('Unsupported voice sample rate.');
    this.rate=rate;this.finish=finish;this.context=window.AuroraPcmPlayer.prepare();this.sources=new Set();this.next=0;this.done=false;this.stopped=false;this.tail=null;this.samples=0;
    this.context.resume().catch(()=>{if(!this.stopped)this.finish('Audio playback failed');});
  }
  push(bytes){
    if(this.stopped||this.done)return;
    if(this.tail!==null){const combined=new Uint8Array(bytes.length+1);combined[0]=this.tail;combined.set(bytes,1);bytes=combined;this.tail=null;}
    if(bytes.length%2){this.tail=bytes[bytes.length-1];bytes=bytes.slice(0,-1);}
    if(!bytes.length)return;
    const buffer=this.context.createBuffer(1,bytes.length/2,this.rate),data=buffer.getChannelData(0),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let i=0;i<data.length;i++)data[i]=view.getInt16(i*2,true)/32768;
    this.samples+=data.length;if(this.samples>this.rate*110)throw Error('Speech too long.');
    const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);this.sources.add(source);
    const start=Math.max(this.context.currentTime+.06,this.next);this.next=start+buffer.duration;
    source.onended=()=>{source.disconnect();this.sources.delete(source);if(this.done&&!this.stopped&&!this.sources.size)this.finish();};source.start(start);
  }
  end(){this.done=true;if(this.tail!==null||!this.samples){this.finish('Voice provider returned incomplete audio.');return;}if(!this.sources.size&&!this.stopped)this.finish();}
  stop(){this.stopped=true;for(const source of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}this.sources.clear();}
};
