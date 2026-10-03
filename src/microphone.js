let stream,context,node,source,generation=0;let commands=Promise.resolve();
async function stop(){generation++;node?.disconnect();source?.disconnect();stream?.getTracks().forEach(track=>track.stop());await context?.close().catch(()=>{});stream=context=node=source=null;}
async function command(value){
 try{
  await stop();if(value.record){
    stream=await navigator.mediaDevices.getUserMedia({audio:{...(value.deviceId?{deviceId:{exact:value.deviceId}}:{}),channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    const current=generation;context=new AudioContext({sampleRate:16000});await context.audioWorklet.addModule('microphone-worklet.js');await context.resume();
    source=context.createMediaStreamSource(stream);node=new AudioWorkletNode(context,'aurora-pcm');
    node.port.onmessage=event=>{if(current!==generation)return;const samples=event.data,pcm=new Uint8Array(samples.length*2),view=new DataView(pcm.buffer);for(let i=0;i<samples.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);window.microphone.send({type:'pcm',data:pcm});};
    // The worklet produces no output: microphone audio is never monitored aloud.
    source.connect(node);node.connect(context.destination);
    stream.getAudioTracks()[0].onended=()=>{if(current===generation)window.microphone.send({type:'error',message:'The microphone disconnected. Enable listening to retry.'});};
  }
  window.microphone.send({type:'ack',id:value.id});
 }catch(error){await stop();window.microphone.send({type:'ack',id:value.id,error:'Could not open the microphone. Check the selected device and Windows microphone permissions.'});}
}
window.microphone.onCommand(value=>{commands=commands.then(()=>command(value));});window.addEventListener('beforeunload',()=>{stream?.getTracks().forEach(track=>track.stop());});
