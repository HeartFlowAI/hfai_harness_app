const path = require('node:path');
const fs = require('node:fs');
function installedWindowsApp(app, exists = fs.existsSync) {
  // An unpacked Electron build is also "packaged", but has no NSIS installation.
  return app.isPackaged && exists(path.join(path.dirname(app.getPath('exe')), 'Uninstall Heartflow Aurora.exe'));
}
function createUpdates({ app, driver, emit, busy, beforeInstall, enabled = app.isPackaged }) {
  let state = { status: enabled ? 'idle' : 'development', currentVersion: app.getVersion(), version: '', percent: 0, error: '' }, pending;
  const snapshot = () => ({ ...state });
  const update = patch => { state = { ...state, ...patch }; emit({type:'update',updates:snapshot()}); };
  if (enabled) {
    driver.autoDownload = false;
    // Explicit user restart only; closing Aurora never silently installs a build.
    driver.autoInstallOnAppQuit = false;
    driver.allowPrerelease = false;
    driver.allowDowngrade = false;
    driver.on('checking-for-update', () => update({status:'checking',error:''}));
    driver.on('update-available', info => update({status:'available',version:info.version,error:''}));
    driver.on('update-not-available', () => update({status:'current',version:'',error:''}));
    driver.on('download-progress', progress => update({status:'downloading',percent:Math.max(0,Math.min(100,progress.percent))}));
    driver.on('update-downloaded', info => update({status:'ready',version:info.version,percent:100,error:''}));
    driver.on('error', () => update({status:'error',error:'Could not check or download the update. Your current app is unchanged. Try again later.'}));
  }
  async function action(value) {
    if (!['check','download','install'].includes(value)) throw Error('Unknown update action.');
    if (!enabled) throw Error('Updates are available in the installed app. Development and portable copies use manual installation.');
    if (pending) return pending;
    if (value === 'install') {
      if (state.status !== 'ready') throw Error('Download the update first.');
      if (busy()) throw Error('Finish or stop the current task or voice conversation before restarting.');
      await beforeInstall();
      if (busy()) throw Error('A task started while preparing the update. Finish it before restarting.');
      driver.quitAndInstall(false,true); return snapshot();
    }
    if (value === 'download' && state.status !== 'available') throw Error('Check for a new version first.');
    if (value === 'check' && ['ready','downloading'].includes(state.status)) return snapshot();
    if (value === 'download') update({status:'downloading',percent:0,error:''});
    pending = (async () => {
      try { if (value === 'check') await driver.checkForUpdates(); else await driver.downloadUpdate(); }
      catch { update({status:'error',error:'Could not check or download the update. Your current app is unchanged. Try again later.'}); }
      finally { pending = null; }
      return snapshot();
    })();
    return pending;
  }
  return { snapshot, action };
}
module.exports = { createUpdates, installedWindowsApp };
