const {contextBridge,ipcRenderer}=require('electron');const channel=process.argv.find(arg=>arg.startsWith('aurora-microphone-'));
contextBridge.exposeInMainWorld('microphone',{send:value=>ipcRenderer.send(channel,value),onCommand:callback=>ipcRenderer.on('microphone-command',(_,value)=>callback(value))});
