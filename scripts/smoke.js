// Run with node_modules/.bin/electron scripts/smoke.js --smoke-test.
// Isolated settings and fake provider: no account, network call, or user files involved.
const { app, BrowserWindow, dialog, clipboard } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve('test-output', `smoke-${Date.now()}`);
app.setPath('userData', path.join(output, 'profile'));
const sourceRoot = process.env.AURORA_SMOKE_SOURCE || path.resolve('src');
const provider = require(path.join(sourceRoot,'provider'));
let step = 0;
let copied = '';
clipboard.writeText = text => { copied = text; }; // Never replace the user's real clipboard during tests.
provider.listModels = async () => ['test-tool-model'];
provider.chat = async ({ onText, messages }) => {
  assert.equal(messages[0].role, 'system');
  const turn=step++;
  if (turn === 0) return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'write_file', arguments: { path: 'hello-aurora.txt', content: 'Hello from Aurora ♥' } } }] };
  if (turn >= 2) { await new Promise(resolve=>setTimeout(resolve,2100));onText('Hello again!');return {role:'assistant',content:'Hello again!'}; }
  assert.equal(messages.at(-1).role, 'tool');
  const content = '## Ready\n\n**Created hello-aurora.txt.** We made it happen!\n\n- Saved in your workspace\n- Ready to read\n\n```powershell\n$greeting = "Hello Aurora"\nWrite-Output $greeting\n```\n\n| File | Status |\n| --- | --- |\n| `hello-aurora.txt` | Created |\n\n[Ollama documentation](https://docs.ollama.com/)';
  for(let i=0;i<content.length;i+=23){onText(content.slice(i,i+23));await new Promise(resolve=>setTimeout(resolve,15));}
  return { role: 'assistant', content };
};
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path.join(output, 'workspace')] });
require(path.join(sourceRoot,'main'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition) { for (let i = 0; i < 100; i++) { if (await condition()) return; await pause(100); } throw new Error('Smoke test timed out'); }
app.whenReady().then(async () => {
  try {
    await fs.mkdir(path.join(output, 'workspace'), { recursive: true });
    let win;
    await until(() => { win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('index.html')); return win && !win.webContents.isLoading(); });
    const errors = [];
    win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
    const js = source => win.webContents.executeJavaScript(source);
    await until(() => js('!!window.aurora && !!document.getElementById("model-label").textContent'));
    await until(() => js('document.querySelector(".pet-host").classList.contains("has-atlas")'));
    await until(() => js('document.querySelector(".pet-host").classList.contains("has-walk")'));
    await pause(300);
    await fs.writeFile(path.join(output, 'welcome.png'), (await win.webContents.capturePage()).toPNG());
    const initial = await js('window.aurora.load()'); assert.equal(initial.ok, true); assert.equal(initial.value.hasKey, false);
    const settings = await js('window.aurora.saveSettings({key:"fake-smoke-key",model:"test-tool-model"})'); assert.equal(settings.ok, true);
    await js('window.aurora.workspace()');
    await js(`window.aurora.onEvent(event => { if(event.type === 'approval') { setTimeout(() => window.aurora.approval(event.id, true), 400); } }); true;`);
    const done = await js('window.aurora.send("Create our first file")'); assert.equal(done.ok, true);
    assert.equal(await fs.readFile(path.join(output, 'workspace', 'hello-aurora.txt'), 'utf8'), 'Hello from Aurora ♥');
    const snapshot = await js('window.aurora.load()'); assert.equal(snapshot.value.messages.at(-1).role, 'assistant');
    assert.equal(snapshot.value.busy, false);
    assert.equal(snapshot.value.state,'celebrating');
    const nextReply=js('window.aurora.send("Hello again")');
    await pause(1900);
    assert.equal((await js('window.aurora.load()')).value.state,'thinking','an old celebration timer must not interrupt new work');
    await nextReply;
    assert.equal((await js('window.aurora.load()')).value.state,'idle','ordinary replies must not celebrate');
    await until(() => js('document.getElementById("messages").textContent.includes("Created hello-aurora.txt")'));
    assert.equal(await js('document.querySelectorAll(".message.assistant strong").length'),1);
    assert.equal(await js('document.querySelectorAll(".message.assistant li").length'),2);
    assert.equal(await js('document.querySelectorAll(".code-block .token.variable").length > 0'),true);
    assert.equal(await js('document.querySelectorAll(".table-scroll table").length'),1);
    assert.equal((await js('window.aurora.openLink("file:///C:/Windows")')).ok,false);
    await js('document.querySelector(".code-copy").click(); true;');
    await until(()=>copied.includes('Write-Output $greeting'));
    const security=await js(`(()=>{const element=document.createElement('div');AuroraMarkdown.render(element,'<img src=x onerror="alert(1)"><script>alert(1)</script>\\n\\n[bad](javascript:alert(1)) [file](file:///C:/Windows)');return {active:element.querySelectorAll('script,img,iframe,button').length,unsafe:[...element.querySelectorAll('a')].some(a=>a.hasAttribute('href'))};})()`);
    assert.deepEqual(security,{active:0,unsafe:false});
    await pause(1200); await fs.writeFile(path.join(output, 'chat.png'), (await win.webContents.capturePage()).toPNG());
    const saved = await fs.readFile(path.join(output, 'profile', 'aurora.json'), 'utf8'); assert.ok(!saved.includes('fake-smoke-key')); assert.ok(JSON.parse(saved).encryptedKey);
    await js('window.aurora.pet("detach")');
    await until(() => BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('pet.html')));
    const pet = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('pet.html'));
    await until(() => !pet.webContents.isLoading()); await pause(2500);
    assert.equal(pet.isAlwaysOnTop(),true);
    pet.setAlwaysOnTop(false);await pause(1000);assert.equal(pet.isAlwaysOnTop(),true,'pet must recover its overlay order');
    assert.equal((await js('window.aurora.load()')).value.state,'idle','celebration must end');
    assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-host").classList.contains("has-atlas")'),true);
    assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-host").classList.contains("has-walk")'),true);
    const petCapture=await pet.webContents.capturePage();
    assert.equal(petCapture.toBitmap()[3],0,'software rendering must preserve transparent corners');
    assert.match(app.getGPUFeatureStatus().gpu_compositing,/^disabled/,'Windows capture compatibility must use software composition');
    await fs.writeFile(path.join(output, 'pet.png'), petCapture.toPNG());
    assert.equal((await pet.webContents.executeJavaScript('window.pet.roam()')).ok, true);
    assert.equal((await pet.webContents.executeJavaScript('window.pet.dock()')).ok, true);
    await until(() => !BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('pet.html')));
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, errors }));
    console.log(`Desktop smoke test passed. Screenshots: ${output}`);
    app.exit(0);
  } catch (error) { await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: false, error: error.stack })); console.error(error); app.exit(1); }
});
