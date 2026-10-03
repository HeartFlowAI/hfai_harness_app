const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ width: 860, height: 1040, title: 'Aurora · Animation studio', backgroundColor: '#11121b', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, '../src/animation-preview.html'));
});
app.on('window-all-closed', () => app.quit());
