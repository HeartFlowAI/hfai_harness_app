// Clarification holds the real agent loop, respects choice order, and cancels cleanly.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('test-output',`question-smoke-${Date.now()}`),folder=path.join(output,'files');
app.setPath('userData',path.join(output,'profile'));
for(const name of ['desktop','documents','downloads'])app.setPath(name,folder);
delete process.env.OneDrive;delete process.env.OneDriveConsumer;
const root=process.env.AURORA_SMOKE_SOURCE || path.resolve('src');
let step=0,ids,shown,question;
require(path.join(root,'file-presentation')).createFilePresentation=()=>({cancel(){},async reveal(filename){shown=filename;return {selectedInExplorer:true,highlighted:false};}});
require(path.join(root,'provider')).chat=async({messages})=>{
 const turn=step++;
 if(turn===0)return {role:'assistant',content:'',tool_calls:[{function:{name:'find_files',arguments:{query:'invoice'}}}]};
 if(turn===1){const files=JSON.parse(messages.at(-1).content).matches;ids=[files[1].id,files[0].id];return {role:'assistant',content:'',tool_calls:[{function:{name:'ask_user_question',arguments:{question:'Which file should I show?',file_ids:JSON.stringify(ids)}}}]};}
 if(turn===2){const result=JSON.parse(messages.at(-1).content);assert.equal(result.answer,'Option one');assert.equal(result.selected_file_id,ids[0]);return {role:'assistant',content:'',tool_calls:[{function:{name:'reveal_file',arguments:{file_id:result.selected_file_id}}}]};}
 if(turn===4)return {role:'assistant',content:'',tool_calls:[{function:{name:'ask_user_question',arguments:{question:'Choose a topic?',choices:JSON.stringify(['Music','Coding'])}}}]};
 if(turn===5){assert.equal(JSON.parse(messages.at(-1).content).selected_option,2);return {role:'assistant',content:'Coding it is.'};}
 if(turn===3)return {role:'assistant',content:'Selected your file.'};
 return {role:'assistant',content:'',tool_calls:[{function:{name:'ask_user_question',arguments:{question:'One more detail?'}}}]};
};
require(path.join(root,'main'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await wait(30);}throw Error('Question smoke timed out');}
app.whenReady().then(async()=>{
 try{
  await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'invoice-a.pdf'),'a');await fs.writeFile(path.join(folder,'invoice-b.pdf'),'b');
  let win;await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  const js=s=>win.webContents.executeJavaScript(s);
  await js('window.aurora.saveSettings({key:"fake-question-key",model:"test"})');
  await js('window.aurora.onEvent(event=>{if(event.type==="question")window._testQuestion=event;});true');
  await js('document.getElementById("prompt").focus()');
  const task=js('window.aurora.send("Find my invoice")');
  await until(async()=>{question=await js('window._testQuestion');return !!question;});
  assert.equal(await js('document.querySelector("dialog[open]")'),null);
  assert.equal(await js('document.activeElement.id'),'prompt', 'clarification must not steal keyboard focus');
  assert.ok(await js('document.querySelector("#messages .clarification").textContent.includes("Which one did you have in mind?")'));
  assert.equal(step,2);assert.equal(shown,undefined);assert.equal(question.choices[0].name,'invoice-b.pdf');assert.equal(question.choices[1].name,'invoice-a.pdf');
  win.showInactive();await wait(200);
  await fs.writeFile(path.join(output,'inline-question.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal((await js('window.aurora.load()')).value.busy,true);
  const guessed=await js('window.aurora.answerQuestion("guessed-id","Option one")');assert.equal(guessed.ok,false);
  await js('document.getElementById("question-answer").value="Option one";document.getElementById("question-form").requestSubmit()');
  assert.equal((await task).ok,true);assert.equal(shown,path.join(folder,'invoice-b.pdf'));
  const snapshot=(await js('window.aurora.load()')).value;assert.equal(snapshot.busy,false);assert.ok(snapshot.messages.some(m=>m.tool_name==='ask_user_question'&&JSON.parse(m.content).selected_file_id===ids[0]));
  await js('window._testQuestion=null;true');const second=js('window.aurora.send("Ask another question")');await until(()=>js('!!window._testQuestion'));
  await js('document.querySelectorAll(".question-choices button")[1].click()');assert.equal((await second).ok,true);
  await js('window._testQuestion=null;true');const third=js('window.aurora.send("Ask one last question")');await until(()=>js('!!window._testQuestion'));
  await js('document.getElementById("question-stop").click()');assert.equal((await third).ok,true);assert.equal((await js('window.aurora.load()')).value.busy,false);
  assert.equal(await js('!!document.getElementById("question-form")'),false);
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,selected:shown}));console.log('Question smoke passed: '+output);app.exit(0);
 }catch(error){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack}));console.error(error);app.exit(1);}
});
