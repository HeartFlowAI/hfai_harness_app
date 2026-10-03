param([int]$OwnPid)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName Accessibility
# Read source directly: CodeDOM file compilation fails for hidden deployment files.
$auroraDesktopSource = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'desktop-control.cs'))
$auroraLegacySource = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'legacy-accessibility.cs'))
# Both partial classes must compile together; place imports before the declarations.
$auroraSources = @($auroraDesktopSource, $auroraLegacySource)
$auroraImports = @($auroraSources | ForEach-Object { [regex]::Matches($_, '(?m)^using [^;]+;') | ForEach-Object { $_.Value } }) | Select-Object -Unique
$auroraBodies = @($auroraSources | ForEach-Object { [regex]::Replace($_, '(?m)^using [^;]+;\r?\n?', '') })
Add-Type -TypeDefinition (($auroraImports + $auroraBodies) -join [Environment]::NewLine) -ReferencedAssemblies UIAutomationClient,UIAutomationTypes,WindowsBase,Accessibility
[AuroraDesktop]::SetProcessDPIAware() | Out-Null
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::WriteLine('{"ready":true}')
while($null -ne ($line=[Console]::ReadLine())) {
 try {
  $request=$line | ConvertFrom-Json
  $result=@{performed=$request.action}
  switch($request.action) {
   'windows' {$result=@{windows=[AuroraDesktop]::ListWindows($OwnPid)}}
   'navigate' {[AuroraDesktop]::Navigate($request.url)}
   'observe' {$result=[AuroraDesktop]::Observe($OwnPid)}
   'focus' {[AuroraDesktop]::Focus($request.target)}
   'move' {$result=@{position=[AuroraDesktop]::Move($request.target)}}
   'click' {[AuroraDesktop]::Click($request.target)}
   'type' {[AuroraDesktop]::Type($request.target,$request.text)}
   'keys' {[AuroraDesktop]::Keys($request.keys)}
   'scroll' {[AuroraDesktop]::Scroll($request.target,[int]$request.delta)}
   default {throw 'Unknown desktop action.'}
  }
  [Console]::WriteLine((@{id=$request.id;ok=$true;result=$result} | ConvertTo-Json -Depth 7 -Compress))
 } catch {[Console]::WriteLine((@{id=$request.id;ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress))}
}
