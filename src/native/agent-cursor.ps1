param([int]$ParentPid,[string]$Preview)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'agent-cursor.cs'))) -ReferencedAssemblies System.Drawing
if($Preview){[AuroraCursor]::Preview($Preview);exit}
[AuroraCursor]::Run($ParentPid)
