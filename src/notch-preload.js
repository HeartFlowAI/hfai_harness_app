const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('notch',{
  action:value=>ipcRenderer.invoke('notch-action',value),
  onEvent:callback=>ipcRenderer.on('notch-event',(_,value)=>callback(value)),
  onVisibility:callback=>ipcRenderer.on('notch-visibility',(_,value)=>callback(value))
});
