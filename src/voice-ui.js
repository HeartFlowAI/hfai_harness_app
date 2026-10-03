(() => {
  const el=id=>document.getElementById(id);
  let voice,questionId,questionCard,playing;
  const labels={off:'Microphone off',starting:'Starting microphone…',wake:'Listening for “Aurora”',waking:'Aurora heard you',speaking:'Aurora is speaking',listening:'Listening to you',transcribing:'Recording stopped · transcribing…',working:'Working · voice controls available',approval:'Say “approve action” or “deny action”'};
  window.renderAuroraVoice=value=>{
    if(!value)return;voice=value;if(value.enabled&&value.provider==='fish')window.AuroraPcmPlayer?.prepare();else if(!value.enabled)window.AuroraPcmPlayer?.release();
    el('voice-toggle').textContent=value.enabled?'◉ Stop listening':'◉ Enable listening';
    el('voice-toggle').classList.toggle('listening',value.enabled);
    el('voice-status').textContent=labels[value.status]||'Microphone off';
    el('voice-status').dataset.active=String(value.enabled);
    el('pet-host').dataset.voice=value.status;
    el('voice-dialog-toggle').textContent=value.enabled?'Turn microphone off':'Enable active listening';
    document.querySelectorAll('[data-stop-listening]').forEach(button=>button.hidden=!value.enabled);
  };
  function speechFields(){
    const cloud=el('speech-engine').value==='cloud',eleven=el('voice-provider').value==='elevenlabs';
    el('recognizer').hidden=cloud;el('recognizer-label').hidden=cloud;
    for(const id of ['speech-language','speech-language-label','speech-language-help'])el(id).hidden=!cloud;
    el('speech-help').textContent=cloud?(eleven?'ElevenLabs Scribe Realtime · live words, then automatic submission after a pause.':'Fish Audio Transcribe Pro · words appear after you finish, then submit automatically.')+' Uses the key above. Microphone audio for wake words and requests goes to this provider; usage charges apply.':'Older local Windows recognition. If it mishears you, choose Cloud recognition.';
  }
  function fields(){
    const provider=el('voice-provider').value,selected=voice?.[provider];
    el('voice-key').value='';el('voice-id').value=selected?.voiceId||'';
    el('voice-key-help').textContent=selected?.hasKey?'A key is saved. Leave blank to keep it.':'Your key is encrypted on this Windows device.';
    el('voice-load').hidden=provider!=='elevenlabs';el('fish-model-label').hidden=provider!=='fish';el('fish-model').hidden=provider!=='fish';
    el('voice-id-help').textContent=provider==='fish'?'Paste a voice model’s reference ID from your Fish Audio voice library.':'Load your ElevenLabs voices, then choose a voice ID.';
    el('voice-ids').replaceChildren();
    el('voice-status-message').textContent='';
    speechFields();
  }
  el('voice-open').onclick=action(async()=>{
    voice=(await call(window.aurora.load())).voice;
    el('voice-provider').value=voice.provider;el('fish-model').value=voice.fishModel;el('speech-engine').value=voice.recognitionEngine||'windows';el('speech-language').value=voice.speechLanguage||'en';fields();
    el('voice-dialog').showModal();el('recognizer').replaceChildren();
    el('voice-status-message').textContent='Checking installed Windows speech languages…';
    try{const available=await call(window.aurora.voiceCapabilities());for(const item of available.recognizers){const option=document.createElement('option');option.value=item.id;option.textContent=item.language+' · '+item.name;el('recognizer').append(option);}if(voice.recognizerId)el('recognizer').value=voice.recognizerId;el('voice-status-message').textContent=available.recognizers.length?'Cloud recognition and Windows fallback are available as options.':'Cloud recognition needs no Windows speech language. Install an English speech language only for the local fallback.';}catch(error){el('voice-status-message').textContent='Windows fallback is unavailable. You can still use Cloud recognition.';}
  });
  el('voice-close').onclick=()=>el('voice-dialog').close();el('voice-provider').onchange=fields;
  el('speech-engine').onchange=speechFields;
  const values=()=>({provider:el('voice-provider').value,key:el('voice-key').value,voiceId:el('voice-id').value.trim(),recognizerId:el('recognizer').value,fishModel:el('fish-model').value,recognitionEngine:el('speech-engine').value,speechLanguage:el('speech-language').value.trim().toLowerCase()||'en'});
  async function save(){const result=await call(window.aurora.voiceSettings(values()));window.renderAuroraVoice(result);el('voice-key').value='';el('voice-key-help').textContent=result[result.provider].hasKey?'A key is saved. Leave blank to keep it.':'No voice key saved.';}
  el('voice-form').onsubmit=async event=>{event.preventDefault();try{await save();el('voice-status-message').textContent='Voice settings saved. Listening is off until you enable it.';}catch(error){el('voice-status-message').textContent=error.message;}};
  el('voice-forget').onclick=action(async()=>{window.renderAuroraVoice(await call(window.aurora.voiceSettings({...values(),key:'',forgetKey:true})));fields();});
  el('voice-load').onclick=async()=>{
    el('voice-load').disabled=true;
    try{const voices=await call(window.aurora.voiceVoices(el('voice-key').value));el('voice-ids').replaceChildren();for(const item of voices){const option=document.createElement('option');option.value=item.id;option.label=item.name;el('voice-ids').append(option);}el('voice-status-message').textContent=`${voices.length} voices loaded. Choose one in Voice ID.`;}catch(error){el('voice-status-message').textContent=error.message;}finally{el('voice-load').disabled=false;}
  };
  async function toggle(fromDialog){
    const enabled=!voice?.enabled;
    if(enabled&&fromDialog)await save();
    el('voice-toggle').disabled=true;el('voice-dialog-toggle').disabled=true;
    try{window.renderAuroraVoice(await call(window.aurora.voiceToggle(enabled)));if(enabled&&fromDialog)el('voice-dialog').close();}
    finally{el('voice-toggle').disabled=false;el('voice-dialog-toggle').disabled=false;}
  }
  el('voice-toggle').onclick=action(()=>toggle(false));
  el('voice-dialog-toggle').onclick=async()=>{try{await toggle(true);}catch(error){el('voice-status-message').textContent=error.message;}};
  document.querySelectorAll('[data-stop-listening]').forEach(button=>button.onclick=action(async()=>window.renderAuroraVoice(await call(window.aurora.voiceToggle(false)))));
  function stopAudio(){if(!playing)return;if(playing.pcm){playing.pcm.stop();playing=null;return;}playing.audio.onended=null;playing.audio.onerror=null;playing.audio.pause();playing.audio.src='';URL.revokeObjectURL(playing.url);playing=null;}
  window.aurora.onEvent(event=>{
    if(event.type==='voice-state'){window.renderAuroraVoice(event.voice);if(['waking','speaking'].includes(event.voice.status)&&el('voice-dialog').open)el('voice-dialog').close();}
    if(event.type==='voice-transcript')el('voice-last-heard').textContent=`You said: ${event.text}`;
    if(event.type==='voice-partial')el('voice-last-heard').textContent=event.text?`Hearing: ${event.text}`:'';
    if(event.type==='voice-audio-stop'&&playing?.id===event.id)stopAudio();
    if(event.type==='voice-audio-start'){
      stopAudio();const finish=error=>{if(playing?.id!==event.id)return;stopAudio();window.aurora.voicePlayback(event.id,error).catch(()=>{});};
      try{playing={id:event.id,pcm:new window.AuroraPcmPlayer(event.sampleRate,finish)};}catch(error){window.aurora.voicePlayback(event.id,'Audio playback failed').catch(()=>{});}
    }
    if(event.type==='voice-audio-chunk'&&playing?.id===event.id&&playing.pcm){try{playing.pcm.push(Uint8Array.from(atob(event.audio),c=>c.charCodeAt(0)));}catch(error){const id=event.id;stopAudio();window.aurora.voicePlayback(id,'Audio playback failed').catch(()=>{});}}
    if(event.type==='voice-audio-end'&&playing?.id===event.id&&playing.pcm)playing.pcm.end();
    if(event.type==='voice-audio'){
      stopAudio();
      const bytes=Uint8Array.from(atob(event.audio),c=>c.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:event.mime})),audio=new Audio(url);playing={id:event.id,audio,url};
      const finish=error=>{if(playing?.id!==event.id)return;stopAudio();window.aurora.voicePlayback(event.id,error).catch(()=>{});};
      audio.onended=()=>finish();audio.onerror=()=>finish('Audio playback failed');audio.play().catch(()=>finish('Audio playback failed'));
    }
    if(event.type==='question'){
      questionId=event.id;
      if(el('file-results-dialog').open)el('file-results-dialog').close();
      const body=addMessage('assistant',event.question),card=body.parentElement;questionCard=card;card.classList.add('clarification');card.dataset.questionId=event.id;
      const choices=document.createElement('div');choices.className='question-choices';
      async function answer(text){if(questionId!==event.id)return;try{await call(window.aurora.answerQuestion(event.id,text));}catch(error){toast(error.message);}}
      for(const choice of event.choices||[]){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=choice.number+'. '+choice.name;button.title=choice.path||choice.name;button.onclick=()=>answer('Option '+choice.number);choices.append(button);}
      const form=document.createElement('form');form.id='question-form';form.className='question-form';
      const input=document.createElement('input');input.id='question-answer';input.maxLength=4000;input.required=true;input.autocomplete='off';input.placeholder='Reply here, or answer by voice';input.setAttribute('aria-label','Answer Aurora’s question');
      const send=document.createElement('button');send.type='submit';send.className='primary';send.textContent='Reply';
      const stop=document.createElement('button');stop.id='question-stop';stop.type='button';stop.className='text-button';stop.textContent='Stop task';stop.onclick=()=>window.aurora.stop();
      form.onsubmit=e=>{e.preventDefault();answer(input.value);};form.append(input,send,stop);card.append(choices,form);el('welcome').hidden=true;scroll();
    }
    if(event.type==='question-closed'&&event.id===questionId){
      questionId=null;questionCard?.querySelector('.question-form')?.remove();questionCard?.querySelector('.question-choices')?.remove();
      if(event.answer)addMessage('user',event.answer);else if(questionCard){const note=document.createElement('small');note.textContent='Task stopped';questionCard.append(note);}questionCard=null;
    }
  });
  window.addEventListener('beforeunload',stopAudio);
})();
