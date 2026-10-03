// Recorders and other topmost windows can change Windows' z-order after creation.
// Reassert the overlay without activating it or taking keyboard focus.
function keepOverlayOnTop(win, { intervalMs = 750 } = {}) {
  let timer;
  const raise = () => {
    if (win.isDestroyed()) return;
    win.setAlwaysOnTop(true, 'screen-saver');
    if (win.isVisible() && !win.isMinimized()) win.moveTop();
  };
  const dispose = () => { clearInterval(timer); win.removeListener('show', raise); win.removeListener('closed', dispose); };
  win.setContentProtection(false);
  win.on('show', raise);
  win.once('closed', dispose);
  raise();
  timer = setInterval(() => { if (win.isDestroyed()) dispose(); else if (win.isVisible() && !win.isMinimized()) raise(); }, intervalMs);
  timer.unref?.();
  return { raise, dispose };
}
module.exports = { keepOverlayOnTop };
