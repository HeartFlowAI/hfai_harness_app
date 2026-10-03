class AuroraPCM extends AudioWorkletProcessor{
  constructor(){super();this.samples=new Float32Array(1600);this.index=0;}
  process(inputs){const input=inputs[0]?.[0];if(input)for(const sample of input){this.samples[this.index++]=sample;if(this.index===1600){this.port.postMessage(this.samples);this.samples=new Float32Array(1600);this.index=0;}}return true;}
}
registerProcessor('aurora-pcm',AuroraPCM);
