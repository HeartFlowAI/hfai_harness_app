const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pet', {
  dock: () => ipcRenderer.invoke('pet-dock'),
  roam: () => ipcRenderer.invoke('pet-roam'),
  onEvent: callback => ipcRenderer.on('pet-event', (_, event) => callback(event))
});
