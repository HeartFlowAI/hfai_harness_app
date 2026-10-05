window.pet.onEvent(event => {
  const host=document.querySelector('.pet-host');
  if(event.appearance){host.dataset.appearance=event.appearance;return;}
  if(event.voiceMode){host.dataset.voice=event.voiceMode;return;}
  host.dataset.state=event.state;
  host.dataset.phase=event.phase || '';
  if(event.facing)host.dataset.facing=event.facing;
  document.getElementById('point-label').textContent=event.state==='pointing' ? `Here it is! ${event.label || ''}` : '';
});
document.getElementById('home').addEventListener('click', () => window.pet.dock());
document.getElementById('walk').addEventListener('click', () => window.pet.roam());
