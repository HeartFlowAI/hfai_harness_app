param([string]$Label,[ValidateSet('opera','brave')][string]$ProcessName='opera',[ValidateSet('minimize','close')][string]$Action)
$ErrorActionPreference='Stop'
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class AuroraFixtureWindow {
 public delegate bool Visitor(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Visitor visitor,IntPtr p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder text,int length);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern bool SetProp(IntPtr h,string name,IntPtr value);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr GetProp(IntPtr h,string name);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint message,IntPtr w,IntPtr l);
}
'@
[AuroraFixtureWindow]::EnumWindows({param($h,$p)
 $text=[Text.StringBuilder]::new(512);[AuroraFixtureWindow]::GetWindowText($h,$text,512)|Out-Null
 [uint32]$targetPid=0;[AuroraFixtureWindow]::GetWindowThreadProcessId($h,[ref]$targetPid)|Out-Null
 if(($text.ToString().StartsWith($Label,[StringComparison]::Ordinal) -or [AuroraFixtureWindow]::GetProp($h,$Label) -eq [IntPtr]1) -and (Get-Process -Id $targetPid -ErrorAction SilentlyContinue).ProcessName -eq $ProcessName){
  if($Action -eq 'minimize'){[AuroraFixtureWindow]::SetProp($h,$Label,[IntPtr]1)|Out-Null;[AuroraFixtureWindow]::ShowWindow($h,6)|Out-Null}else{[AuroraFixtureWindow]::PostMessage($h,0x10,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null}
 }
 return $true
},[IntPtr]::Zero)|Out-Null
