const { BrowserWindow, screen, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const { keepOverlayOnTop } = require('./overlay-window');

function createFilePresentation({ point, finish, onNative = () => {}, runtime, fallbackMs = 5000, maxMs = 9000, highlightMs = 6000 }) {
  const native = runtime || { BrowserWindow, screen, shell, spawn, fs };
  let active;
  function cancel() {
    if (!active) return;
    const old = active; active = null;
    clearTimeout(old.timer); clearTimeout(old.fallbackTimer); old.child?.kill();
    old.layer?.dispose();
    if (old.overlay && !old.overlay.isDestroyed()) old.overlay.close();
    old.resolve?.({ revealRequested: true, selectedInExplorer: !!old.selected, highlighted: false, message: 'Asked Explorer to select the file; screen location was unavailable.' });
    finish();
  }
  async function reveal(filename) {
    const stat = await native.fs.stat(filename);
    if (!stat.isFile()) throw new Error('That file is no longer available. Search again.');
    cancel();
    const session = { visible: false, everVisible: false }; active = session;
    native.shell.showItemInFolder(filename);
    const overlay = session.overlay = new native.BrowserWindow({ width: 100, height: 60, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false, hasShadow: false, show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
    overlay.setIgnoreMouseEvents(true);
    session.layer = keepOverlayOnTop(overlay);
    overlay.loadFile(path.join(__dirname, 'highlight.html'));
    await new Promise(resolve => overlay.webContents.once('did-finish-load', resolve));
    if (active !== session) return { revealRequested: true, highlighted: false, message: 'File presentation canceled.' };
    const ready = new Promise(resolve => { session.resolve = resolve; });
    const helperPath = path.join(__dirname, 'native', 'locate-file.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    const child = session.child = native.spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helperPath, '-Target', filename], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '';
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,end); buffer = buffer.slice(end+1);
        let result; try { result = JSON.parse(line); } catch { continue; }
        onNative(result);
        if (active !== session) return;
        session.selected = result.selected;
        if (!result.visible) { session.visible = false; overlay.hide(); finish(); continue; }
        const rect = native.screen.screenToDipRect(null, { x: Math.round(result.x), y: Math.round(result.y), width: Math.round(result.width), height: Math.round(result.height) });
        if (![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) continue;
        overlay.setBounds({ x: rect.x-4, y: rect.y-4, width: rect.width+8, height: rect.height+8 }); overlay.showInactive(); session.layer.raise();
        session.visible = true;
        if (!session.everVisible) { clearTimeout(session.timer); session.timer = setTimeout(() => { if (active === session) cancel(); }, highlightMs); }
        session.everVisible = true; point(rect, filename);
        session.resolve?.({ selectedInExplorer: true, highlighted: true, path: filename }); session.resolve = null;
      }
    });
    child.on('error', () => cancel());
    child.on('close', () => { if (active === session) cancel(); });
    // Do not delay the model's reply waiting for the full highlight duration.
    session.fallbackTimer = setTimeout(() => { if (active === session && session.resolve) { session.resolve({ revealRequested: true, selectedInExplorer: !!session.selected, highlighted: session.everVisible, path: filename, message: session.everVisible ? 'Highlighted the selected file.' : 'Asked Explorer to select the file. Its on-screen location could not be verified.' }); session.resolve = null; } }, fallbackMs);
    session.timer = setTimeout(() => { if (active === session) cancel(); }, maxMs);
    return ready;
  }
  return { reveal, cancel };
}
module.exports = { createFilePresentation };
