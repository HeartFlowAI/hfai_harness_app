const {randomUUID}=require('node:crypto');
const mode=value=>value==='code'?'code':'normal';
function project(data,id){return data.projects.find(p=>p.id===id);}
function syncWorkspace(data){data.workspace=project(data,data.activeProjectId)?.workspace||(!data.activeProjectId?data.defaultWorkspace:'')||'';}
function createSession(data){const chat={id:randomUUID(),title:'New conversation',messages:[],created:Date.now(),updated:Date.now(),mode:mode(data.mode),projectId:data.activeProjectId||null};data.chats.unshift(chat);data.currentId=chat.id;syncWorkspace(data);return chat;}
function selectSession(data,id){const chat=data.chats.find(c=>c.id===id);if(!chat)throw Error('Session not found.');data.currentId=id;data.mode=chat.mode;data.activeProjectId=chat.projectId;syncWorkspace(data);return chat;}
function normalize(data){
 data.projects=Array.isArray(data.projects)?data.projects.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').map(p=>({...p,workspace:typeof p.workspace==='string'?p.workspace:''})):[];
 data.defaultWorkspace=typeof data.defaultWorkspace==='string'?data.defaultWorkspace:(data.workspace||'');
 data.chats=Array.isArray(data.chats)?data.chats:[];
 for(const chat of data.chats){chat.mode=mode(chat.mode);chat.projectId=project(data,chat.projectId)?chat.projectId:null;chat.updated=chat.updated||chat.created||Date.now();}
 data.mode=mode(data.mode);data.activeProjectId=project(data,data.activeProjectId)?data.activeProjectId:null;
 if(data.chats.some(c=>c.id===data.currentId))selectSession(data,data.currentId);else chooseContext(data,data.mode,data.activeProjectId);
 return data;
}
function chooseContext(data,nextMode,projectId){
 if(!['normal','code'].includes(nextMode))throw Error('Choose Normal or Aurora Code.');
 if(projectId!==null&&!project(data,projectId))throw Error('Project not found.');
 data.mode=nextMode;data.activeProjectId=projectId;
 const chat=data.chats.find(c=>c.mode===nextMode&&c.projectId===projectId);
 if(chat)selectSession(data,chat.id);else createSession(data);
}
function addProject(data,name){if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('Use a project name between 1 and 80 characters.');const p={id:randomUUID(),name:name.trim(),workspace:'',created:Date.now()};data.projects.push(p);chooseContext(data,data.mode,p.id);return p;}
function assignProject(data,id){if(id!==null&&!project(data,id))throw Error('Project not found.');const chat=data.chats.find(c=>c.id===data.currentId);chat.projectId=id;data.activeProjectId=id;syncWorkspace(data);}
function deleteSession(data,id){if(!data.chats.some(c=>c.id===id))throw Error('Session not found.');data.chats=data.chats.filter(c=>c.id!==id);if(data.currentId===id)chooseContext(data,data.mode,data.activeProjectId);}
function setWorkspace(data,folder){const p=project(data,data.activeProjectId);if(p)p.workspace=folder;else data.defaultWorkspace=folder;syncWorkspace(data);}
function summaries(data){return data.chats.map(c=>({id:c.id,title:c.title,mode:c.mode,projectId:c.projectId,updated:c.updated}));}
function searchSessions(data,query){
 if(typeof query!=='string'||query.length>200)throw Error('Search with up to 200 characters.');const term=query.trim().toLocaleLowerCase();if(!term)return [];
 const hits=[];for(const chat of data.chats){let snippet='';let matched=chat.title.toLocaleLowerCase().includes(term);
 for(const message of chat.messages){if(!['user','assistant'].includes(message.role)||typeof message.content!=='string')continue;const index=message.content.toLocaleLowerCase().indexOf(term);if(index>=0){matched=true;snippet=message.content.slice(Math.max(0,index-35),index+120).replace(/\s+/g,' ');break;}}
 if(matched)hits.push({...summaries({chats:[chat]})[0],snippet});if(hits.length===100)break;}
 return hits;
}
module.exports={normalize,createSession,selectSession,chooseContext,addProject,assignProject,deleteSession,setWorkspace,summaries,searchSessions};
