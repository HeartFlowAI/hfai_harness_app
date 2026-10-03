// Real Windows mouse/keyboard against an isolated WinForms fixture, no user apps.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const sourceRoot=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');
const {createComputerControl}=require(path.join(sourceRoot,'computer-control'));
const output=path.resolve('test-output',`computer-smoke-${Date.now()}`);
const code=`using System;using System.Windows.Forms;
public class Fixture { [STAThread] public static void Main(){var f=new Form();f.Text="Aurora isolated control fixture";f.Width=600;f.Height=320;f.StartPosition=FormStartPosition.CenterScreen;var edit=new TextBox();edit.AccessibleName="Search query";edit.SetBounds(30,40,400,35);var label=new Label();label.Text="Not playing";label.SetBounds(30,160,400,40);var button=new Button();button.AccessibleName="Play Despacito";button.Text="Play Despacito";button.SetBounds(30,90,180,40);button.Click+=(a,b)=>{label.Text="Playing: "+edit.Text;};f.Controls.Add(edit);f.Controls.Add(label);f.Controls.Add(button);Application.Run(f);}}
`;
(async()=>{let fixture,overlay;let electron;if(process.argv.includes('--overlay')){electron=require('electron');electron.app.disableHardwareAcceleration();await electron.app.whenReady();overlay=require(path.join(sourceRoot,'input-overlay')).createInputOverlay();}const events=[],controller=new AbortController(),computer=createComputerControl({onActivity:e=>{events.push(e);overlay?.activity(e);}});
 try{
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'fixture.cs'),code);
  const compile='param($Source,$Output) Add-Type -Path $Source -OutputAssembly $Output -OutputType WindowsApplication -ReferencedAssemblies System.Windows.Forms,System.Drawing';
  await fs.writeFile(path.join(output,'compile.ps1'),compile);
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(output,'compile.ps1'),'-Source',path.join(output,'fixture.cs'),'-Output',path.join(output,'AuroraControlFixture.exe')],{windowsHide:true,stdio:'pipe'});
  fixture=spawn(path.join(output,'AuroraControlFixture.exe'),[],{windowsHide:false,stdio:'ignore'});await new Promise(r=>setTimeout(r,600));
  const action=args=>computer.action(args,controller.signal);
  let view=await action({action:'observe'});const window=view.windows.find(w=>w.title==='Aurora isolated control fixture');assert.ok(window);
  await action({action:'focus',target:window.id});view=await action({action:'observe'});assert.equal(view.title,window.title);
  let edit=view.controls.find(c=>c.name==='Search query'&&c.editable);assert.ok(edit);
  await action({action:'type',target:edit.id,text:'Despacito Aurora ♥'});
  await assert.rejects(action({action:'click',target:edit.id}),/expired/);
  view=await action({action:'observe'});const play=view.controls.find(c=>c.name==='Play Despacito');assert.ok(play);
  await action({action:'click',target:play.id});view=await action({action:'observe'});
  assert.ok(view.controls.some(c=>c.name==='Playing: Despacito Aurora ♥'),JSON.stringify(view.controls));
  assert.ok(events.some(e=>e.action==='pointer'));assert.ok(events.some(e=>e.action==='type'));
  if(electron){const hud=electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('input-overlay.html?kind=hud'));if(hud)await fs.writeFile(path.join(output,'keyboard-display.png'),(await hud.webContents.capturePage()).toPNG());}
  controller.abort();await assert.rejects(action({action:'keys',keys:'ENTER'}),/abort/i);
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,realMouse:true,realUnicodeKeyboard:true,staleTargetRejected:true,stopped:true}));console.log('Computer smoke passed: '+output);
 }catch(error){await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack}));console.error(error);process.exitCode=1;}
 finally{computer.cancel();fixture?.kill();overlay?.dispose();electron?.app.exit(process.exitCode||0);}
})();
