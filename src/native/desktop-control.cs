using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Automation;
public partial class AuroraDesktop {
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,System.Text.StringBuilder text,int length);
 delegate bool WindowVisitor(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowVisitor callback,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h,WindowVisitor callback,IntPtr p);
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")] static extern uint SendInput(uint count,Input[] input,int size);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [StructLayout(LayoutKind.Sequential)] struct Point {public int x,y;}
 [StructLayout(LayoutKind.Sequential)] struct Mouse {public int dx,dy;public uint data,flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] struct Key {public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Explicit)] struct Union {[FieldOffset(0)]public Mouse mouse;[FieldOffset(0)]public Key key;}
 [StructLayout(LayoutKind.Sequential)] struct Input {public uint type;public Union value;}
 public class Window {public string id,title,process;public int pid;public bool minimized,foreground;}
 public class Node {public string id,name,kind,value;public bool editable;public string provider;}
 public class View {public string windowId,title,process;public Window[] windows;public Node[] controls;public bool truncated;public string provider;}
 static Dictionary<string,AutomationElement> elements=new Dictionary<string,AutomationElement>();
 static Dictionary<string,Window> windows=new Dictionary<string,Window>();
 static IntPtr observed;static uint observedPid;static int generation;
 static string Cut(string s,int n){return s==null?"":s.Substring(0,Math.Min(s.Length,n));}
 static string ProcessName(int pid){try{return Process.GetProcessById(pid).ProcessName;}catch{return "";}}
 static bool Blocked(string process){string p=process.ToLowerInvariant();return !(p=="opera"||p=="chrome"||p=="msedge"||p=="firefox"||p=="brave"||p=="explorer"||p=="notepad"||p=="calculatorapp"||p=="calculator"||p=="applicationframehost"||p=="auroracontrolfixture");}
 public static Window[] ListWindows(int ownPid){windows.Clear();var list=new List<Window>();EnumWindows((h,p)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(!IsWindowVisible(h)||pid==ownPid||Blocked(ProcessName((int)pid)))return true;var text=new System.Text.StringBuilder(512);GetWindowText(h,text,512);if(String.IsNullOrWhiteSpace(text.ToString()))return true;var w=new Window{id=h.ToInt64().ToString(),title=Cut(text.ToString(),180),pid=(int)pid,process=ProcessName((int)pid),minimized=IsIconic(h),foreground=GetForegroundWindow()==h};list.Add(w);windows[w.id]=w;return list.Count<35;},IntPtr.Zero);return list.ToArray();}
 static void ClearControls(){elements.Clear();legacyElements.Clear();}
 public static View Observe(int ownPid){
  ClearControls();generation++;observed=GetForegroundWindow();GetWindowThreadProcessId(observed,out observedPid);
  var result=new View();result.windowId=observed.ToInt64().ToString();result.process=ProcessName((int)observedPid);result.windows=ListWindows(ownPid);
  if(observed==IntPtr.Zero||observedPid==ownPid||Blocked(result.process)){result.title="Select a listed application window first.";result.controls=new Node[0];return result;}
  var roots=LegacyRoots(observed);
  var root=AutomationElement.FromHandle(observed);result.title=Cut(root.Current.Name,180);var walker=TreeWalker.ControlViewWalker;
  var queue=new Queue<AutomationElement>();queue.Enqueue(root);var nodes=new List<Node>();var clock=Stopwatch.StartNew();int visited=0;
  while(queue.Count>0&&visited<600&&nodes.Count<180&&clock.ElapsedMilliseconds<3500){var e=queue.Dequeue();visited++;
   try{var c=e.Current;if(c.IsPassword)continue;
    if(!c.IsOffscreen&&c.IsEnabled&&!String.IsNullOrWhiteSpace(c.Name)&&c.BoundingRectangle.Width>0&&c.BoundingRectangle.Height>0){
     string id="v"+generation+":"+nodes.Count;elements[id]=e;object pattern;string value="";if(c.ControlType==ControlType.Edit&&e.TryGetCurrentPattern(ValuePattern.Pattern,out pattern))value=Cut(((ValuePattern)pattern).Current.Value,180);nodes.Add(new Node{id=id,name=Cut(c.Name,220),kind=c.ControlType.ProgrammaticName.Replace("ControlType.",""),editable=c.ControlType==ControlType.Edit,value=value,provider="uia"});}
    var child=walker.GetFirstChild(e);int siblings=0;while(child!=null&&siblings++<200){queue.Enqueue(child);child=walker.GetNextSibling(child);}
   }catch{}
  }
  result.truncated=queue.Count>0;
  if(IsBrowser(result.process))ReadLegacy(roots,nodes,clock,result);
  result.controls=nodes.ToArray();result.provider=legacyElements.Count>0?"uia+msaa":"uia";return result;
 }
 static void CheckWindow(){uint pid;GetWindowThreadProcessId(observed,out pid);if(!IsWindow(observed)||pid!=observedPid||GetForegroundWindow()!=observed)throw new Exception("The foreground window changed. Observe again before acting.");
  Point p;GetCursorPos(out p);if(p.x<=2&&p.x>=0&&p.y<=2&&p.y>=0)throw new Exception("Stopped: mouse is in the top-left safety corner.");}
 public static void Focus(string id){Window w;if(!windows.TryGetValue(id,out w))throw new Exception("Observe windows before choosing a window id.");var h=new IntPtr(long.Parse(id));uint pid;GetWindowThreadProcessId(h,out pid);if(!IsWindow(h)||pid!=w.pid)throw new Exception("That window expired.");
  if(GetForegroundWindow()!=h){ShowWindow(h,9);Thread.Sleep(100);}
  for(int attempt=0;attempt<3&&GetForegroundWindow()!=h;attempt++){
   if(attempt>0){Send(new[]{KeyEvent(18,false),KeyEvent(18,true)});Thread.Sleep(50);}
   uint ignored,ownThread=GetCurrentThreadId(),foregroundThread=GetWindowThreadProcessId(GetForegroundWindow(),out ignored),targetThread=GetWindowThreadProcessId(h,out ignored);
   bool fg=foregroundThread!=ownThread&&AttachThreadInput(ownThread,foregroundThread,true),target=targetThread!=ownThread&&targetThread!=foregroundThread&&AttachThreadInput(ownThread,targetThread,true);
   try{ShowWindow(h,9);BringWindowToTop(h);SetForegroundWindow(h);}finally{if(target)AttachThreadInput(ownThread,targetThread,false);if(fg)AttachThreadInput(ownThread,foregroundThread,false);}Thread.Sleep(140);
  }
  if(GetForegroundWindow()!=h)throw new Exception("Windows did not activate the requested window. No typing or clicking was performed.");observed=h;observedPid=pid;ClearControls();
 }
 static AutomationElement Target(string id){CheckWindow();AutomationElement e;if(!elements.TryGetValue(id,out e))throw new Exception("This control id expired. Observe again.");var c=e.Current;if(c.IsPassword||c.IsOffscreen||!c.IsEnabled)throw new Exception("Control is hidden, disabled or protected.");return e;}
 static void Send(Input[] input){if(SendInput((uint)input.Length,input,Marshal.SizeOf(typeof(Input)))!=input.Length)throw new Exception("Windows blocked input. Elevated windows cannot be controlled.");}
 public static int[] Move(string id){LegacyTarget legacy=null;AutomationElement e=null;System.Windows.Rect r;if(legacyElements.ContainsKey(id)){legacy=Legacy(id);r=legacy.Bounds();}else{e=Target(id);r=e.Current.BoundingRectangle;}int x=(int)(r.X+r.Width/2),y=(int)(r.Y+r.Height/2);
  // A browser link's bounding-box centre can land on its thumbnail overlay or
  // neighbouring child. Prefer the provider's actual clickable point.
  System.Windows.Point clickable;if(e!=null&&e.TryGetClickablePoint(out clickable)&&r.Contains(clickable)){x=(int)Math.Round(clickable.X);y=(int)Math.Round(clickable.Y);}
  Point from,last;GetCursorPos(out from);last=from;
  double dx=x-from.x,dy=y-from.y,distance=Math.Sqrt(dx*dx+dy*dy);
  int duration=(int)Math.Min(520,Math.Max(180,160+distance*.28)),frames=Math.Max(1,duration/16);
  double bend=Math.Min(24,distance*.055),nx=distance>0?-dy/distance:0,ny=distance>0?dx/distance:0;
  for(int i=1;i<=frames;i++){CheckWindow();Point actual;GetCursorPos(out actual);if(Math.Abs(actual.x-last.x)>20||Math.Abs(actual.y-last.y)>20)throw new Exception("Stopped because the pointer moved unexpectedly (expected "+last.x+","+last.y+"; observed "+actual.x+","+actual.y+").");
   double t=(double)i/frames,ease=t*t*t*(t*(t*6-15)+10),arc=Math.Sin(Math.PI*ease)*bend;
   last.x=(int)Math.Round(from.x+dx*ease+nx*arc);last.y=(int)Math.Round(from.y+dy*ease+ny*arc);if(!SetCursorPos(last.x,last.y))throw new Exception("Windows blocked pointer movement.");GetCursorPos(out last);
   Console.WriteLine("{\"pointer\":true,\"x\":"+last.x+",\"y\":"+last.y+"}");Thread.Sleep(16);
  }
  if(legacy!=null){if(GetAncestor(WindowFromPoint(new Point{x=x,y=y}),2)!=observed)throw new Exception("Another window covers that target.");LegacyValidate(legacy);return new int[]{x,y};}
  var hit=AutomationElement.FromPoint(new System.Windows.Point(x,y));var current=hit;bool matches=false;for(int i=0;i<15&&current!=null;i++){if(Automation.Compare(current,e)){matches=true;break;}current=TreeWalker.ControlViewWalker.GetParent(current);}
  if(!matches)throw new Exception("Another window or control covers that target. Observe again.");return new int[]{x,y};
 }
 public static void Click(string id){var target=Move(id);Thread.Sleep(85);CheckWindow();Point position;GetCursorPos(out position);if(Math.Abs(position.x-target[0])>3||Math.Abs(position.y-target[1])>3)throw new Exception("Stopped because you moved the pointer before clicking.");Send(new[]{new Input{type=0,value=new Union{mouse=new Mouse{flags=2}}},new Input{type=0,value=new Union{mouse=new Mouse{flags=4}}}});Thread.Sleep(180);ClearControls();}
 static Input KeyEvent(ushort code,bool up){return new Input{type=1,value=new Union{key=new Key{vk=code,flags=up?2u:0u}}};}
 public static void Type(string id,string text){if(legacyElements.ContainsKey(id)){LegacyType(id,text);return;}var e=Target(id);if(e.Current.ControlType!=ControlType.Edit)throw new Exception("Choose an editable control.");Click(id);CheckWindow();var focused=AutomationElement.FocusedElement;
  if(focused.Current.IsPassword||!Automation.Compare(focused,e))throw new Exception("The requested text field did not gain focus.");
  Send(new[]{KeyEvent(17,false),KeyEvent(65,false),KeyEvent(65,true),KeyEvent(17,true)});
  UnicodeText(text);ClearControls();
 }
 static void UnicodeText(string text){foreach(char c in text){CheckWindow();Send(new[]{new Input{type=1,value=new Union{key=new Key{scan=c,flags=4}}},new Input{type=1,value=new Union{key=new Key{scan=c,flags=6}}}});Thread.Sleep(2);}}
 public static void Navigate(string url){CheckWindow();if(!IsBrowser(ProcessName((int)observedPid)))throw new Exception("Navigation requires a foreground browser window.");Keys("CTRL+L");Thread.Sleep(100);Send(new[]{KeyEvent(17,false),KeyEvent(65,false),KeyEvent(65,true),KeyEvent(17,true)});UnicodeText(url);Keys("ENTER");ClearControls();}
 public static void Keys(string combo){CheckWindow();if(AutomationElement.FocusedElement.Current.IsPassword)throw new Exception("Protected password field.");var map=new Dictionary<string,ushort>{{"CTRL",17},{"SHIFT",16},{"ALT",18},{"L",76},{"A",65},{"F",70},{"ENTER",13},{"TAB",9},{"ESC",27},{"SPACE",32},{"BACKSPACE",8},{"LEFT",37},{"RIGHT",39}};
  var keys=combo.Split('+');var input=new List<Input>();foreach(var k in keys)input.Add(KeyEvent(map[k],false));for(int i=keys.Length-1;i>=0;i--)input.Add(KeyEvent(map[keys[i]],true));Send(input.ToArray());Thread.Sleep(160);ClearControls();
 }
 public static void Scroll(string id,int delta){Move(id);CheckWindow();Send(new[]{new Input{type=0,value=new Union{mouse=new Mouse{flags=0x800,data=unchecked((uint)delta)}}}});Thread.Sleep(180);ClearControls();}
}
