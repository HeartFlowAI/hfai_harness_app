const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('aurora', {
  load: () => ipcRenderer.invoke('load'),
  voiceCapabilities: () => ipcRenderer.invoke('voice-capabilities'),
  voiceSettings: values => ipcRenderer.invoke('voice-settings',values),
  voiceVoices: key => ipcRenderer.invoke('voice-voices',key),
  voiceToggle: enabled => ipcRenderer.invoke('voice-toggle',enabled),
  voicePlayback: (id,error) => ipcRenderer.invoke('voice-playback',{id,error}),
  answerQuestion: (id,answer) => ipcRenderer.invoke('question-answer',{id,answer}),
  saveSettings: values => ipcRenderer.invoke('settings', values),
  models: key => ipcRenderer.invoke('models', key),
  workspace: () => ipcRenderer.invoke('workspace'),
  searchFolder: remove => ipcRenderer.invoke('search-folder', remove),
  revealFile: id => ipcRenderer.invoke('reveal-file', id),
  send: message => ipcRenderer.invoke('send', message),
  stop: () => ipcRenderer.invoke('stop'),
  newChat: () => ipcRenderer.invoke('new-chat'),
  selectChat: id => ipcRenderer.invoke('select-chat', id),
  sessionContext: value=>ipcRenderer.invoke('session-context',value),
  createProject: name=>ipcRenderer.invoke('project-create',name),
  sessionProject: id=>ipcRenderer.invoke('session-project',id),
  searchSessions: query=>ipcRenderer.invoke('session-search',query),
  deleteSession: id=>ipcRenderer.invoke('session-delete',id),
  approval: (id, allow) => ipcRenderer.invoke('approval', { id, allow }),
  pet: action => ipcRenderer.invoke('pet', action),
  copyText: text => ipcRenderer.invoke('copy-text',text),
  openLink: url => ipcRenderer.invoke('open-link',url),
  onEvent: callback => {
    const handler = (_, event) => callback(event);
    ipcRenderer.on('event', handler);
    return () => ipcRenderer.removeListener('event', handler);
  }
});
