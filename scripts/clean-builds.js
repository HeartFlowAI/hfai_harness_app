// Default is a dry run. Only redundant unpacked build directories are eligible.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..'), apply = process.argv.includes('--apply');
const folders = fs.readdirSync(root).filter(name => /^dist-aurora-v\d+$/.test(name)).sort((a,b)=>Number(b.match(/\d+$/)[0])-Number(a.match(/\d+$/)[0]));
if (process.platform !== 'win32') throw Error('Run this build cleanup on Windows so active executables and shortcuts can be checked.');
const result = spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`
$ErrorActionPreference='Stop'
$paths=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | ForEach-Object { $_.ExecutablePath })
$shortcutShell=New-Object -ComObject WScript.Shell
$profiles=@(Get-CimInstance Win32_UserProfile | Where-Object { -not $_.Special -and $_.LocalPath -notlike "$env:windir\\*" } | ForEach-Object { $_.LocalPath })
$desktops=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))
foreach($profilePath in $profiles){$desktops+=Join-Path $profilePath 'Desktop';$desktops+=Join-Path $profilePath 'OneDrive\\Desktop'}
foreach($desktopPath in ($desktops | Select-Object -Unique)){if(Test-Path -LiteralPath $desktopPath){foreach($link in (Get-ChildItem -LiteralPath $desktopPath -Filter '*.lnk' -File)){$paths+=$shortcutShell.CreateShortcut($link.FullName).TargetPath}}}
ConvertTo-Json -Compress -InputObject @($paths)
`],{encoding:'utf8',windowsHide:true,timeout:30000});
if(result.status!==0)throw Error('Could not check running apps and desktop shortcuts. No builds were deleted.');
const references = JSON.parse(result.stdout).map(value=>String(value).toLowerCase());
let total = 0;
for(const name of folders.slice(2)) {
  const target = path.resolve(root,name);
  if(path.dirname(target)!==root || !target.startsWith(root+path.sep))throw Error('Build path is outside the workspace.');
  if(fs.lstatSync(target).isSymbolicLink() || fs.realpathSync(target)!==target)throw Error('Build folder resolves through a link. No cleanup allowed.');
  if(references.some(value=>value.startsWith(target.toLowerCase()+path.sep))){console.log(`Keep ${name}: used by a running app or desktop shortcut.`);continue;}
  let size=0;
  function inspect(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||entry.name==='.git')throw Error(`Refusing to clean ${name}: contains a link or Git checkout.`);if(entry.isDirectory())inspect(file);else size+=stat.size;}}
  inspect(target);total+=size;
  console.log(`${apply?'Remove':'Would remove'} ${name}: ${Math.round(size/1048576)} MB`);
  if(apply)fs.rmSync(target,{recursive:true});
}
console.log(`${apply?'Freed':'Eligible to free'} ${Math.round(total/1048576)} MB. Latest two builds, dist, dependencies, test output and publication checkout are preserved.`);
if(!apply)console.log('Apply with npm.cmd run clean:builds -- --apply after reviewing this list.');
