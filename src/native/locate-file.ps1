param([Parameter(Mandatory=$true)][string]$Target)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class AuroraWindow {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[AuroraWindow]::SetProcessDPIAware() | Out-Null
$shell = New-Object -ComObject Shell.Application
$last = ''
$activated = $false
$deadline = [DateTime]::UtcNow.AddSeconds(9)
while ([DateTime]::UtcNow -lt $deadline) {
 $result = @{ visible = $false; selected = $false }
 try {
  foreach ($window in $shell.Windows()) {
   if ([IO.Path]::GetFileName($window.FullName) -ine 'explorer.exe') { continue }
   $selected = $window.Document.SelectedItems()
   $found = $false
   foreach ($item in $selected) { if ($item.Path -ieq $Target) { $found = $true; break } }
   if (!$found) { continue }
   $result.selected = $true
   $tabHandle = [IntPtr][long]$window.HWND
   $hwnd = [AuroraWindow]::GetAncestor($tabHandle, 2)
   if (!$activated) { [AuroraWindow]::SetForegroundWindow($hwnd) | Out-Null; $activated = $true }
   if ([AuroraWindow]::IsIconic($hwnd) -or [AuroraWindow]::GetForegroundWindow() -ne $hwnd) { $result.reason = 'Explorer is not foreground'; $result.window = [long]$hwnd; $result.foreground = [long][AuroraWindow]::GetForegroundWindow(); continue }
   $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
   $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty, $true))
   $result.reason = 'Selected row not visible'
   $result.names = @($elements | ForEach-Object { $_.Current.Name })
   $name = [IO.Path]::GetFileName($Target)
   $stem = [IO.Path]::GetFileNameWithoutExtension($Target)
   foreach ($element in $elements) {
    $current = $element.Current
    if ($current.IsOffscreen -or ($current.Name -ine $name -and $current.Name -ine $stem)) { continue }
    $rect = $current.BoundingRectangle
    if ($rect.IsEmpty -or $rect.Width -le 0 -or $rect.Height -le 0) { continue }
    $result = @{ visible = $true; selected = $true; x = $rect.X; y = $rect.Y; width = $rect.Width; height = $rect.Height }
    break
   }
  }
 } catch { $result = @{ visible = $false; reason = $_.Exception.Message } }
 $json = ConvertTo-Json -Compress -InputObject $result
 [Console]::WriteLine($json)
 Start-Sleep -Milliseconds 200
}
