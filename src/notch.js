const el=id=>document.getElementById(id);let approval;
const labels={off:'Microphone off',starting:'Starting…',wake:'Listening for “Aurora”',waking:'I’m here',speaking:'Aurora is speaking',listening:'Listening to you',transcribing:'Recording stopped · transcribing…',working:'Working on your request',approval:'Waiting for your decision'};
window.notch.onVisibility(visible=>el('notch').classList.toggle('is-visible',visible));
window.notch.onEvent(value=>{
  const host=el('pet-host'),status=value.voice.status;approval=value.approval;
  host.dataset.appearance=value.appearance||'classic';
  el('notch').dataset.expanded=String(value.expanded);el('notch').dataset.status=status;
  if(value.visible)requestAnimationFrame(()=>el('notch').classList.add('is-visible'));
  host.dataset.state=value.speechPose||value.state;host.dataset.voice=status;
  el('status').textContent=status==='working'?(value.activity||labels.working):labels[status]||status;
  el('reply').textContent=value.reply||value.question?.question||'';
  el('choices').replaceChildren();
  const choices=value.question?.choices||[];el('choices').hidden=!choices.length;
  for(const choice of choices){const row=document.createElement('div');row.className='voice-choice';const label=document.createElement('strong');label.textContent=choice.number+'. '+choice.name;row.append(label);if(choice.path){const path=document.createElement('small');path.textContent=choice.path;row.append(path);}el('choices').append(row);}
  el('heard').textContent=value.partial||value.transcript?`You: ${value.partial||value.transcript}`:'';el('heard').dataset.partial=String(!!value.partial);
  el('proposal').hidden=!approval;el('approval-buttons').hidden=!approval;
  el('proposal').textContent=approval?`${approval.name}\n${JSON.stringify(approval.args,null,2)}`:'';
  el('error').textContent=value.error||'';el('mic').hidden=!value.voice.enabled;
  el('finish').hidden=!['listening','approval'].includes(status);
  el('hint').textContent=approval?'Say “approve action” or “deny action”':status==='transcribing'?'Recording finished · preparing your request':status==='off'?'Enable listening in Aurora':status==='wake'?'Say “Aurora” to wake me':status==='working'?'Say “stop task” to cancel':status==='listening'&&value.question?.choices?.length?'Say a number or the option’s name':status==='listening'?'Keep talking · pause to send · “go to sleep” ends our conversation':'I’ll listen when I finish speaking';
});
async function action(value){try{const result=await window.notch.action(value);if(!result.ok)el('error').textContent=result.error;}catch(error){el('error').textContent=error.message;}}
el('open').onclick=()=>action({action:'open'});el('stop').onclick=()=>action({action:'stop'});el('mic').onclick=()=>action({action:'microphone-off'});
el('approve').onclick=()=>action({action:'approval',id:approval?.id,allow:true});el('deny').onclick=()=>action({action:'approval',id:approval?.id,allow:false});
el('finish').onclick=()=>action({action:'finish'});
