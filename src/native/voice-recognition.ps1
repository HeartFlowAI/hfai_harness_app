param([switch]$Probe, [string]$RecognizerId = '')
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
 Add-Type -AssemblyName System.Speech
 Add-Type -AssemblyName System.Web.Extensions
 Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'voice-recognition.cs'))) -ReferencedAssemblies @('System.Speech', 'System.Web.Extensions', 'System.Core')
 [AuroraRecognition]::Run([bool]$Probe, $RecognizerId)
} catch {
 [Console]::WriteLine((ConvertTo-Json -Compress -InputObject @{type='error';message=$_.Exception.Message}))
 exit 1
}
