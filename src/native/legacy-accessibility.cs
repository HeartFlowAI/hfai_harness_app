using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Accessibility;
using System.Windows.Automation;
public partial class AuroraDesktop {
 [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr h,uint objectId,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out object accessible);
 [DllImport("oleacc.dll")] static extern int AccessibleChildren(IAccessible parent,int start,int count,[Out,MarshalAs(UnmanagedType.LPArray,SizeParamIndex=2)]object[] children,out int obtained);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,System.Text.StringBuilder name,int length);
 [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h,uint message,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 class LegacyTarget {
  public IAccessible accessible;public object child;public string name;public int role;
  public string Name(){return accessible.get_accName(child)??"";}
  public int State(){return Convert.ToInt32(accessible.get_accState(child));}
  public System.Windows.Rect Bounds(){int x,y,w,h;accessible.accLocation(out x,out y,out w,out h,child);return new System.Windows.Rect(x,y,Math.Max(0,w),Math.Max(0,h));}
 }
 static Dictionary<string,LegacyTarget> legacyElements=new Dictionary<string,LegacyTarget>();
 static bool IsBrowser(string process){return process=="opera"||process=="chrome"||process=="msedge"||process=="firefox"||process=="brave";}
 static IAccessible Accessible(IntPtr h){try{Guid iid=new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");object obj;return AccessibleObjectFromWindow(h,0xfffffffcu,ref iid,out obj)>=0?obj as IAccessible:null;}catch{return null;}}
 static List<IAccessible> LegacyRoots(IntPtr h){var result=new List<IAccessible>();if(!IsBrowser(ProcessName((int)observedPid)))return result;
  // Request the standard native accessibility object, including existing render widgets.
  var root=Accessible(h);if(root!=null)result.Add(root);
  int visited=0;EnumChildWindows(h,(child,p)=>{if(++visited>80)return false;var name=new System.Text.StringBuilder(128);GetClassName(child,name,128);
   if(name.ToString().StartsWith("Chrome_RenderWidgetHost")){IntPtr ignored;SendMessageTimeout(child,0x3d,IntPtr.Zero,new IntPtr(1),2,150,out ignored);var acc=Accessible(child);if(acc!=null)result.Insert(0,acc);}return true;},IntPtr.Zero);
  return result;
 }
 static string RoleName(int role){switch(role){case 15:return "Document";case 30:return "Link";case 41:return "Text";case 42:return "Edit";case 43:return "Button";case 44:return "Checkbox";case 45:return "RadioButton";case 46:return "ComboBox";case 34:return "ListItem";case 37:return "Tab";case 12:return "MenuItem";default:return "Control";}}
 static void ReadLegacy(List<IAccessible> roots,List<Node> nodes,Stopwatch clock,View view){
  var queue=new Queue<LegacyTarget>();foreach(var root in roots)queue.Enqueue(new LegacyTarget{accessible=root,child=0});int visited=0;
  while(queue.Count>0&&visited++<1200&&nodes.Count<280&&clock.ElapsedMilliseconds<6000){var item=queue.Dequeue();
   try{int state=item.State();if((state&0x200000)!=0)continue;item.role=Convert.ToInt32(item.accessible.get_accRole(item.child));item.name=item.Name();
    var rect=item.Bounds();if((state&0x18001)==0&&rect.Width>0&&rect.Height>0&&!String.IsNullOrWhiteSpace(item.name)){
     bool editable=(item.role==42||item.role==46)&&(state&0x40)==0;string value="";if(editable)try{value=Cut(item.accessible.get_accValue(item.child),180);}catch{}
     bool duplicate=nodes.Exists(n=>n.name==Cut(item.name,220)&&n.kind==RoleName(item.role));
     if(!duplicate){string id="m"+generation+":"+nodes.Count;legacyElements[id]=item;nodes.Add(new Node{id=id,name=Cut(item.name,220),kind=RoleName(item.role),editable=editable,value=value,provider="msaa"});}
    }
    if(Convert.ToInt32(item.child)!=0)continue;
    int count=Math.Min(240,item.accessible.accChildCount);if(count<=0)continue;object[] children=new object[count];int obtained;if(AccessibleChildren(item.accessible,0,count,children,out obtained)<0)continue;
    for(int i=0;i<obtained;i++){var child=children[i] as IAccessible;if(child!=null)queue.Enqueue(new LegacyTarget{accessible=child,child=0});else if(children[i] is int){object obj=null;try{obj=item.accessible.get_accChild(children[i]);}catch{}var accessible=obj as IAccessible;queue.Enqueue(accessible!=null?new LegacyTarget{accessible=accessible,child=0}:new LegacyTarget{accessible=item.accessible,child=children[i]});}}
   }catch{}
  }
  if(queue.Count>0)view.truncated=true;
 }
 static void LegacyValidate(LegacyTarget item){CheckWindow();if(item.Name()!=item.name||(item.State()&0x218001)!=0)throw new Exception("That browser control changed or became protected/hidden. Observe again.");}
 static LegacyTarget Legacy(string id){CheckWindow();LegacyTarget item;if(!legacyElements.TryGetValue(id,out item))throw new Exception("This browser control expired. Observe again.");LegacyValidate(item);return item;}
 static void LegacyType(string id,string text){var item=Legacy(id);if((item.role!=42&&item.role!=46)||(item.State()&0x40)!=0)throw new Exception("Choose an editable browser control.");Click(id);CheckWindow();if((item.State()&4)==0)throw new Exception("The requested browser field did not gain focus.");Send(new[]{KeyEvent(17,false),KeyEvent(65,false),KeyEvent(65,true),KeyEvent(17,true)});UnicodeText(text);ClearControls();}
}
