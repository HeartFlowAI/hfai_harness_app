const teleportPreview=document.querySelector('[data-state=teleporting]');
setInterval(()=>{teleportPreview.dataset.phase=teleportPreview.dataset.phase==='out'?'in':'out';},300);
const walkPreview=document.querySelector('[data-state=walking]');
setInterval(()=>{walkPreview.dataset.facing=walkPreview.dataset.facing==='right'?'left':'right';},3000);

const pointPreview=document.querySelector("[data-state=pointing]");
setInterval(()=>{pointPreview.dataset.facing=pointPreview.dataset.facing==="right"?"left":"right";},3000);
