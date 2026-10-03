// The supplied portrait remains Aurora's idle artwork. Activity poses share a 4x4 atlas.
const auroraAnimations = {
  idle: { frames: [0], duration: 4500 },
  thinking: { frames: [2], duration: 1000 },
  waiting: { frames: [3], duration: 1000 },
  coding: { frames: [4, 5], duration: 300 },
  browsing: { frames: [6, 7], duration: 480 },
  walking: { frames: [0, 1, 2, 3], duration: 180 },
  climbing: { frames: [10, 11], duration: 260 },
  teleporting: { frames: [0], duration: 1000 },
  celebrating: { frames: [12, 13], duration: 420 },
  pointing: { frames: [0], duration: 1000 },
  error: { frames: [14, 15], duration: 850 }
};
// Measured source rectangles accommodate the artist's spacing without clipping poses.
// Rendering these regions leaves the generated PNG itself untouched.
const auroraFrameRects = [
  [81,21,217,296], [372,20,221,296], [676,21,204,295], [995,22,197,295],
  [80,334,219,294], [384,335,219,292], [683,333,217,294], [993,335,217,292],
  [73,644,200,272], [370,644,209,272], [678,640,187,277], [987,630,187,287],
  [79,925,215,303], [390,942,203,286], [679,940,204,288], [998,941,206,287]
];
const auroraWalkRects=[[96,7,487,586],[663,10,441,596],[100,621,511,584],[683,621,443,594]];
document.querySelectorAll('.pet-host').forEach(host => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reference = document.createElement('img');
  reference.className = 'aurora-reference'; reference.src = 'assets/aurora/reference.png';
  reference.alt = 'Aurora, with pink hair and a white, purple and gold heart-themed outfit';
  reference.draggable = false;
  const sprite = document.createElement('canvas'); sprite.className = 'aurora-sprite frame-0';
  sprite.setAttribute('role', 'img'); sprite.setAttribute('aria-label', 'Aurora');
  const stars = document.createElement('div'); stars.className = 'aurora-stars'; stars.textContent = '✦'; stars.setAttribute('aria-hidden', 'true');
  const bubble = document.createElement('div'); bubble.className = 'aurora-bubble'; bubble.setAttribute('aria-hidden', 'true');
  const portal=document.createElement('div');portal.className='aurora-portal';portal.setAttribute('aria-hidden','true');
  host.replaceChildren(reference, sprite, stars, bubble,portal);
  let dirty = true;
  const atlas = new Image();
  atlas.onload = () => { host.classList.add('has-atlas'); dirty = true; };
  atlas.onerror = () => host.classList.add('atlas-unavailable');
  atlas.src = 'assets/aurora/activity-atlas.png';
  const walkAtlas=new Image();
  walkAtlas.onload=()=>{host.classList.add('has-walk');dirty=true;};
  walkAtlas.src='assets/aurora/walk-cycle.png';
  const pointImage = new Image();
  pointImage.onload = () => { host.classList.add('has-point'); dirty = true; };
  pointImage.src = 'assets/aurora/pointing.png';
  let previous = '', previousFacing = '', frame = 0, lastTick = 0;
  const resize = () => {
    const ratio = devicePixelRatio || 1;
    sprite.width = Math.round(host.clientWidth * ratio); sprite.height = Math.round(host.clientHeight * ratio);
    dirty = true;
  };
  new ResizeObserver(resize).observe(host);
  const draw = (index,state) => {
    const walking=state==='walking',pointing=state==='pointing',image=pointing?pointImage:walking?walkAtlas:atlas;
    if (!image.complete || !image.naturalWidth || !sprite.width) return;
    const [x,y,w,h] = pointing ? [224,8,890,1234] : (walking?auroraWalkRects:auroraFrameRects)[index];
    const ctx = sprite.getContext('2d');
    ctx.clearRect(0,0,sprite.width,sprite.height); ctx.imageSmoothingEnabled = false;
    const scale = sprite.height * .76 / (pointing?1234:walking?596:296);
    const padding = 2;
    const width = (w + padding * 2) * scale, height = (h + padding * 2) * scale;
    ctx.save();
    if((walking||pointing)&&host.dataset.facing==='left'){ctx.translate(sprite.width,0);ctx.scale(-1,1);}
    ctx.drawImage(image, x-padding, y-padding, w+padding*2, h+padding*2,
      (sprite.width-width)/2, sprite.height*.88-height, width, height);
    ctx.restore();
    dirty = false;
  };
  const tick = now => {
    const state = Object.hasOwn(auroraAnimations, host.dataset.state) ? host.dataset.state : 'idle';
    const animation = auroraAnimations[state];
    if (state !== previous) { previous = state; frame = 0; lastTick = now; dirty = true; }
    if(host.dataset.facing!==previousFacing){previousFacing=host.dataset.facing;dirty=true;}
    if (!reducedMotion.matches && now - lastTick >= animation.duration) { frame = (frame + 1) % animation.frames.length; lastTick = now; }
    if (reducedMotion.matches) frame = 0;
    const nextClass = `aurora-sprite frame-${animation.frames[frame]}`;
    if (sprite.className !== nextClass) { sprite.className = nextClass; dirty = true; }
    if (dirty) draw(animation.frames[frame],state);
    sprite.setAttribute('aria-label', `Aurora ${state}`);
    const text = state === 'thinking' ? '···' : state === 'waiting' ? '?' : state === 'error' ? '!' : '';
    if (bubble.textContent !== text) bubble.textContent = text;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
