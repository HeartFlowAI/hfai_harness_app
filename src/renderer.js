const $ = id => document.getElementById(id);
let view, busy = false, detached = false, replyElement, replyText = '', replyTimer, approvalId, toastTimer;
let searchTimer,searchGeneration=0,searchResults=null,deletingId;
const captions = { idle: 'Here to help. Happy to be here.', thinking: 'Connecting the little dots…', browsing: 'A little curiosity goes a long way.', coding: 'Making something good, together.', waiting: 'I’ll wait for your say-so.', celebrating: 'We made it happen! ✦', error: 'A little hiccup. Let’s try again.' };
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 7000); }
async function call(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; }
function action(fn) { return async (...args) => { try { await fn(...args); } catch (error) { toast(error.message); } }; }
function scroll() { $('messages').scrollTop = $('messages').scrollHeight; }
function pinned() { const area=$('messages');return area.scrollHeight-area.scrollTop-area.clientHeight<100; }
function addMessage(role, content, autoScroll = true) {
  const element = document.createElement('div'); element.className = `message ${role}`;
  const author = document.createElement('div'); author.className = 'message-author'; author.textContent = role === 'user' ? 'You' : 'Aurora ✦';
  const body = document.createElement('div'); body.className = 'message-body';
  if(role==='assistant')AuroraMarkdown.render(body,content);else body.textContent=content;
  element.append(author, body); $('messages').append(element); if(autoScroll)scroll(); return body;
}
function flushReply() {
  clearTimeout(replyTimer);replyTimer=null;
  if(!replyElement?.isConnected)return;
  const follow=pinned();AuroraMarkdown.render(replyElement,replyText);if(follow)scroll();
}
window.addEventListener('aurora-notice',event=>toast(event.detail));
function activity(name, args, result, id) {
  const item = document.createElement('details'); item.className = 'activity-item'; if (id) item.dataset.id = id;
  const title = document.createElement('summary'); title.textContent = `${result ? '✓' : '◌'} ${name}`;
  const pre = document.createElement('pre'); pre.textContent = JSON.stringify(args, null, 2) + (result ? `\n\n${result}` : '');
  item.append(title, pre); const empty = $('activity').querySelector('.activity-empty'); empty?.remove(); $('activity').prepend(item);
}
function setBusy(value) { busy = value; $('stop').hidden = !value; $('send').disabled = value; $('new-chat').disabled = value; $('workspace').disabled = value;for(const id of ['mode-normal','mode-code','project-add','session-project','session-delete'])$(id).disabled=value; }
function petDisplay(value) { detached = value; $('pet-host').hidden = value; $('detach').textContent = value ? '↙ Bring Aurora home' : '↗ Let me explore your desktop'; $('roam').hidden = !value; }
function render(data) {
  const changedChat=view?.currentId!==data.currentId;
  if (changedChat) { $('file-results-open').hidden = true; $('file-results-dialog').close(); $('file-results').replaceChildren(); }
  view = data; setBusy(data.busy); petDisplay(data.detached);
  window.renderAuroraVoice?.(data.voice);
  $('pet-host').dataset.state = data.state || 'idle'; $('pet-caption').textContent = captions[data.state] || captions.idle;
  $('model-label').textContent = data.model || 'Ollama Cloud · not connected';
  $('workspace-label').textContent = data.workspace || 'No folder selected'; $('workspace-label').title = data.workspace || '';
  renderLibrary();
  if (!data.busy) renderMessages(data.messages,changedChat);
}
function renderLibrary(){
  const code=view.mode==='code',p=view.projects.find(p=>p.id===view.activeProjectId),chat=view.chats.find(c=>c.id===view.currentId);
  document.body.dataset.mode=view.mode;$('mode-normal').setAttribute('aria-pressed',String(!code));$('mode-code').setAttribute('aria-pressed',String(code));
  for(const id of ['mode-normal','mode-code','project-add','session-project','session-delete'])$(id).disabled=busy;
  document.querySelector('.agent-heading h1').textContent=code?'Aurora Code':'Aurora';document.querySelector('.agent-heading div>span').textContent=code?'Build, debug, and create.':'Your ideas, brought to life.';
  $('prompt').placeholder=code?'What shall we build or fix?':'What shall we work on?';$('session-title').textContent=chat?.title||'New conversation';$('session-context').textContent=`${code?'Aurora Code':'Normal'} · ${p?.name||'No project'}`;
  const welcome=$('welcome');welcome.querySelector('.eyebrow').textContent=code?'YOUR CODING COMPANION':'MEET YOUR NEW COMPANION';welcome.querySelector('h2').textContent=code?'Your next idea starts here.':'A little spark. A lot of possibility.';welcome.querySelector('p').textContent=code?'Choose a project folder, describe your idea, and let’s build it together.':'I’m Aurora. Tell me what you’re imagining, and we’ll make it happen together.';
  const suggestions=code?[
    ['▱ Understand this project','Explore the code and structure ↗','Explore the selected workspace and explain its structure and how to run it.'],
    ['⌘ Review my code','Find issues worth fixing ↗','Review the selected workspace for concrete bugs. Explain findings before proposing changes.'],
    ['✦ Help me build','Start with an idea ↗','Help me build something in this workspace. Ask what I want to create before changing files.']
  ]:[['▱ Explore my workspace','Find your starting point ↗','Explore the selected workspace and tell me what is in it.'],['⌘ Make something with me','Create our first file ↗','Create a file called hello-aurora.txt in my workspace with a short introduction to yourself.'],['◎ Research an idea','Follow your curiosity ↗','Search the web for the latest Ollama cloud documentation and summarize it with source links.']];
  welcome.querySelectorAll('[data-prompt]').forEach((button,i)=>{button.firstChild.textContent=suggestions[i][0];button.querySelector('span').textContent=suggestions[i][1];button.dataset.prompt=suggestions[i][2];});
  $('projects').replaceChildren();for(const item of [{id:null,name:'All ungrouped'},...view.projects]){const b=document.createElement('button');b.className='project-link'+(item.id===view.activeProjectId?' active':'');b.textContent=(item.id?'▱ ':'◌ ')+item.name;b.title=item.name;b.disabled=busy;b.onclick=action(async()=>{clearSearch();render(await call(window.aurora.sessionContext({mode:view.mode,projectId:item.id})));renderHistory();});$('projects').append(b);}
  $('session-project').replaceChildren();for(const item of [{id:'',name:'No project'},...view.projects]){const o=document.createElement('option');o.value=item.id;o.textContent=item.name;$('session-project').append(o);}$('session-project').value=view.activeProjectId||'';
  $('chats').replaceChildren();const searching=$('session-search').value.trim();$('sessions-label').textContent=searching?'SEARCH RESULTS · ALL SESSIONS':'SESSIONS';
  const chats=searching?(searchResults||[]):view.chats.filter(c=>c.mode===view.mode&&c.projectId===view.activeProjectId);
  for(const c of chats){const b=document.createElement('button');b.className='chat-link'+(c.id===view.currentId?' active':'');const title=document.createElement('span');title.textContent=c.title;b.append(title);if(searching){const small=document.createElement('small');small.textContent=(c.mode==='code'?'Aurora Code':'Normal')+' · '+(view.projects.find(p=>p.id===c.projectId)?.name||'No project')+(c.snippet?' — '+c.snippet:'');b.append(small);}b.title=c.title;b.disabled=busy;b.onclick=action(async()=>{clearSearch();render(await call(window.aurora.selectChat(c.id)));renderHistory();});$('chats').append(b);}
  if(!chats.length){const empty=document.createElement('p');empty.className='library-empty';empty.textContent=searching?'No matching sessions.':'Start a new conversation.';$('chats').append(empty);}
}
function clearSearch(){searchGeneration++;clearTimeout(searchTimer);searchResults=null;$('session-search').value='';}
$('session-search').oninput=()=>{const generation=++searchGeneration;clearTimeout(searchTimer);const query=$('session-search').value;searchTimer=setTimeout(action(async()=>{const results=query.trim()?await call(window.aurora.searchSessions(query)):null;if(generation!==searchGeneration)return;searchResults=results;renderLibrary();}),180);};
for(const [id,mode] of [['mode-normal','normal'],['mode-code','code']])$(id).onclick=action(async()=>{clearSearch();render(await call(window.aurora.sessionContext({mode,projectId:view.activeProjectId})));renderHistory();});
$('project-add').onclick=()=>{$('project-name').value='';$('project-dialog').showModal();$('project-name').focus();};$('project-close').onclick=()=>$('project-dialog').close();
$('project-form').onsubmit=event=>{event.preventDefault();action(async()=>{const data=await call(window.aurora.createProject($('project-name').value));$('project-dialog').close();clearSearch();render(data);renderHistory();})()};
$('session-project').onchange=action(async()=>{render(await call(window.aurora.sessionProject($('session-project').value||null)));renderHistory();});
$('session-delete').onclick=()=>{deletingId=view.currentId;$('delete-session-description').textContent=view.chats.find(c=>c.id===deletingId)?.title||'Current session';$('delete-session-dialog').showModal();};$('delete-session-cancel').onclick=()=>$('delete-session-dialog').close();
$('delete-session-confirm').onclick=action(async()=>{const data=await call(window.aurora.deleteSession(deletingId));$('delete-session-dialog').close();clearSearch();render(data);renderHistory();toast('Session deleted.');});
function renderMessages(messages,changedChat=false) { const follow=changedChat||pinned(),top=$('messages').scrollTop;$('messages').replaceChildren(); for (const m of messages) { if (['user', 'assistant'].includes(m.role) && m.content) addMessage(m.role, m.content,false); if(m.role==='tool'&&m.tool_name==='ask_user_question'){try{const result=JSON.parse(m.content);if(result.question&&result.answer){addMessage('assistant',result.question,false);addMessage('user',result.answer,false);}}catch{}} } $('welcome').hidden = messages.some(m => m.role === 'user'); if(follow)scroll();else $('messages').scrollTop=top; }
function renderHistory() { $('activity').replaceChildren(); const messages = view.messages; for (let i = 0; i < messages.length; i++) { const m = messages[i]; if (m.role === 'tool') activity(m.tool_name, {}, m.content); } if (!$('activity').children.length) { const empty = document.createElement('div'); empty.className = 'activity-empty'; empty.textContent = 'Our next adventure starts with your first message.'; $('activity').append(empty); } }
async function submit() {
  const text = $('prompt').value.trim(); if (!text || busy) return;
  if (!view.hasKey || !view.model) { openSettings(); toast('Connect Ollama Cloud to start chatting with Aurora.'); return; }
  $('prompt').value = ''; $('welcome').hidden = true; addMessage('user', text); setBusy(true);
  try { await call(window.aurora.send(text)); } catch (error) { toast(error.message); setBusy(false); }
}
$('composer').addEventListener('submit', event => { event.preventDefault(); submit(); });
$('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } });
document.querySelectorAll('[data-prompt]').forEach(button => button.onclick = () => { $('prompt').value = button.dataset.prompt; $('prompt').focus(); });
$('stop').onclick = action(() => call(window.aurora.stop()));
$('new-chat').onclick = action(async () => { clearSearch();render(await call(window.aurora.newChat())); renderHistory(); });
$('workspace').onclick = action(async () => render(await call(window.aurora.workspace())));
$('detach').onclick = action(() => call(window.aurora.pet(detached ? 'dock' : 'detach')));
$('roam').onclick = action(() => call(window.aurora.pet('roam')));
function renderSearchFolders() {
  $('search-folders').replaceChildren();
  for (const root of view.searchRoots || []) {
    const row = document.createElement('div'); row.className = 'search-folder';
    const label = document.createElement('span'); label.textContent = root; label.title = root; row.append(label);
    if (view.searchFolders?.includes(root)) { const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.className = 'text-button'; remove.onclick = action(async () => { render(await call(window.aurora.searchFolder(root))); renderSearchFolders(); }); row.append(remove); }
    $('search-folders').append(row);
  }
}
$('search-folder-add').onclick = action(async () => { render(await call(window.aurora.searchFolder())); renderSearchFolders(); });
function openSettings() { $('api-key').value = ''; $('model').value = view.model || ''; $('computer-enabled').checked=view.computerEnabled!==false; $('key-help').textContent = view.hasKey ? 'A key is saved. Leave blank to keep it, or paste a replacement.' : 'Create a key at ollama.com/settings/keys.'; $('settings-status').textContent = ''; renderSearchFolders(); $('settings-dialog').showModal(); }
$('settings-open').onclick = openSettings; $('settings-close').onclick = () => $('settings-dialog').close();
$('fetch-models').onclick = async () => { $('fetch-models').disabled = true; $('settings-status').textContent = 'Checking your connection…'; try { const models = await call(window.aurora.models($('api-key').value)); $('models').replaceChildren(); for (const model of models) { const option = document.createElement('option'); option.value = model; $('models').append(option); } if (!$('model').value && models.length) $('model').value = models[0]; $('settings-status').textContent = `Connected. ${models.length} models available. Choose a tool-capable model.`; } catch (error) { $('settings-status').textContent = error.message; } finally { $('fetch-models').disabled = false; } };
$('settings-form').onsubmit = async event => { event.preventDefault(); try { render(await call(window.aurora.saveSettings({ key: $('api-key').value, model: $('model').value, computerEnabled:$('computer-enabled').checked }))); $('api-key').value = ''; $('settings-dialog').close(); toast('Connection saved. Aurora is ready.'); } catch (error) { $('settings-status').textContent = error.message; } };
$('forget-key').onclick = action(async () => { render(await call(window.aurora.saveSettings({ model: $('model').value, forgetKey: true }))); $('api-key').value = ''; $('key-help').textContent = 'Saved key removed.'; });
async function approve(allow) { if (!approvalId) return; try { await call(window.aurora.approval(approvalId, allow)); } catch (error) { toast(error.message); } }
$('allow').onclick = () => approve(true); $('deny').onclick = () => approve(false); $('approval-dialog').addEventListener('cancel', event => { event.preventDefault(); approve(false); });
window.aurora.onEvent(event => {
  switch (event.type) {
    case 'files-found': {
      $('file-results').replaceChildren();
      $('file-results-note').textContent = `${event.matches.length} match${event.matches.length === 1 ? '' : 'es'}${event.truncated ? ' · Search limit reached; narrow your filename keywords.' : ''}. Select a file to show it in Explorer. File contents are not opened.`;
      for (const file of event.matches) {
        const row = document.createElement('div'); row.className = 'file-result';
        const name = document.createElement('strong'); name.textContent = file.name;
        const location = document.createElement('small'); location.textContent = file.path;
        const button = document.createElement('button'); button.className = 'secondary'; button.textContent = 'Show in Explorer';
        button.onclick = action(async () => { $('file-results-dialog').close(); const result = await call(window.aurora.revealFile(file.id)); toast(result.highlighted ? 'Aurora found it — look for the glowing border.' : result.message || 'Selected in Explorer.'); });
        row.append(name,location,button); $('file-results').append(row);
      }
      $('file-results-open').hidden = !event.matches.length;
      break;
    }
    case 'snapshot': render(event.data); break;
    case 'state': $('pet-host').dataset.state = event.state; $('pet-host').dataset.phase=event.phase||''; $('pet-caption').textContent = captions[event.state] || captions.idle; $('status-text').textContent = event.detail || 'Ready when you are'; break;
    case 'pet': petDisplay(event.detached); break;
    case 'voice-expression': $('pet-host').dataset.state=event.pose;break;
    case 'reply-start': flushReply();replyText='';replyElement = addMessage('assistant', '',pinned()); break;
    case 'token': if (replyElement) { replyText += event.text; if(!replyTimer)replyTimer=setTimeout(flushReply,40); } break;
    case 'reply-end': flushReply();if (replyElement && !replyText) replyElement.parentElement.remove(); replyElement = null; break;
    case 'tool-start': activity(event.name, event.args, null, event.id); break;
    case 'tool-end': { const item = [...$('activity').children].find(e => e.dataset.id === event.id); if (item) { item.querySelector('summary').textContent = `${event.result.includes('"error"') ? '!' : '✓'} ${item.querySelector('summary').textContent.slice(2)}`; item.querySelector('pre').textContent += `\n\n${event.result}`; } break; }
    case 'approval': approvalId = event.id; $('approval-title').textContent = event.name === 'write_file' ? 'May I write this file?' : 'May I run this command?'; $('approval-description').textContent = event.name === 'write_file' ? `Create or replace ${event.args.path} in your selected workspace.` : 'PowerShell runs with your Windows user permissions. It can access files and services outside the workspace. Review the command before approving.'; $('approval-content').textContent = event.name === 'write_file' ? event.args.content : event.args.command; if ($('settings-dialog').open) $('settings-dialog').close(); $('approval-dialog').showModal(); break;
    case 'approval-closed': if (approvalId === event.id) { approvalId = null; $('approval-dialog').close(); } break;
    case 'error': toast(event.message); break;
  }
});
$('file-results-close').onclick = () => $('file-results-dialog').close();
$('file-results-open').onclick = () => $('file-results-dialog').showModal();
action(async () => { render(await call(window.aurora.load())); renderHistory(); if (!view.hasKey) $('status-text').textContent = 'Connect Ollama Cloud in Settings to get started'; })();
