const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { keepOverlayOnTop } = require('../src/overlay-window');
test('overlay regains topmost order after another window covers it without taking focus', async () => {
  const win = new EventEmitter(); let visible=true, destroyed=false, top=false, moves=0, protection;
  Object.assign(win, { isDestroyed:()=>destroyed, isVisible:()=>visible, isMinimized:()=>false,
    setAlwaysOnTop:(flag,level)=>{top=flag;assert.equal(level,'screen-saver');},moveTop:()=>moves++,setContentProtection:value=>{protection=value;},focus:()=>assert.fail('overlay must never steal focus') });
  const layer=keepOverlayOnTop(win,{intervalMs:10});
  assert.equal(protection,false);assert.equal(top,true);
  top=false;await new Promise(resolve=>setTimeout(resolve,35));assert.equal(top,true);assert.ok(moves>1);
  visible=false;const hiddenMoves=moves;await new Promise(resolve=>setTimeout(resolve,25));assert.equal(moves,hiddenMoves);
  visible=true;win.emit('show');assert.ok(moves>hiddenMoves);
  destroyed=true;win.emit('closed');const finalMoves=moves;await new Promise(resolve=>setTimeout(resolve,25));assert.equal(moves,finalMoves);
  layer.dispose();assert.equal(win.listenerCount('show'),0);
});
