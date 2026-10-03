using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Threading;
public class AuroraCursor {
 [StructLayout(LayoutKind.Sequential)] struct IconInfo {public bool icon;public uint x,y;public IntPtr mask,color;}
 [DllImport("user32.dll")] static extern IntPtr CreateIconIndirect(ref IconInfo info);
 [DllImport("user32.dll")] static extern IntPtr LoadCursor(IntPtr instance,IntPtr id);
 [DllImport("user32.dll")] static extern IntPtr CopyIcon(IntPtr icon);
 [DllImport("user32.dll")] static extern bool SetSystemCursor(IntPtr cursor,uint id);
 [DllImport("user32.dll")] static extern bool DestroyCursor(IntPtr cursor);
 [DllImport("user32.dll")] static extern bool SystemParametersInfo(uint action,uint param,IntPtr value,uint flags);
 [DllImport("user32.dll")] static extern bool DrawIconEx(IntPtr dc,int x,int y,IntPtr icon,int width,int height,uint step,IntPtr brush,uint flags);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr bitmap);
 static uint[] ids={32512,32513,32514,32515,32516,32642,32643,32644,32645,32646,32648,32649,32650};
 static Dictionary<uint,IntPtr> originals=new Dictionary<uint,IntPtr>();
 public static Bitmap Artwork(){
  var bitmap=new Bitmap(32,32,System.Drawing.Imaging.PixelFormat.Format32bppArgb);
  using(var g=Graphics.FromImage(bitmap)){g.Clear(Color.Transparent);g.SmoothingMode=SmoothingMode.AntiAlias;
   using(var shape=new GraphicsPath()){
    shape.AddBezier(5.5f,3.5f,3,2.5f,3.2f,5.2f,4,7);
    shape.AddLine(4,7,9,25);
    shape.AddBezier(9,25,9.6f,27,11.3f,26,12.4f,25);
    shape.AddLine(12.4f,25,25,12.5f);
    shape.AddBezier(25,12.5f,27,10.5f,26,9.5f,24,9);
    shape.AddLine(24,9,5.5f,3.5f);shape.CloseFigure();
    using(var fill=new SolidBrush(Color.FromArgb(255,249,193,214)))g.FillPath(fill,shape);
    using(var edge=new Pen(Color.FromArgb(255,111,54,83),1.4f)){edge.LineJoin=LineJoin.Round;g.DrawPath(edge,shape);}
    using(var light=new Pen(Color.FromArgb(205,255,243,249),1.1f)){light.StartCap=LineCap.Round;light.EndCap=LineCap.Round;g.DrawLine(light,6.5f,9,10,21);}
   }
  }return bitmap;
 }
 static IntPtr Create(){using(var color=Artwork())using(var mask=new Bitmap(32,32,System.Drawing.Imaging.PixelFormat.Format1bppIndexed)){
  // Transparent pixels also need a white AND-mask for Windows cursor renderers
  // that fall back to the monochrome mask rather than the colour alpha channel.
  var bits=mask.LockBits(new Rectangle(0,0,32,32),System.Drawing.Imaging.ImageLockMode.WriteOnly,System.Drawing.Imaging.PixelFormat.Format1bppIndexed);
  try{byte[] bytes=new byte[bits.Stride*32];for(int y=0;y<32;y++)for(int x=0;x<32;x++)if(color.GetPixel(x,y).A==0)bytes[y*bits.Stride+x/8]|=(byte)(0x80>>(x%8));Marshal.Copy(bytes,0,bits.Scan0,bytes.Length);}finally{mask.UnlockBits(bits);}
  IntPtr c=color.GetHbitmap(Color.FromArgb(0)),m=mask.GetHbitmap();try{var info=new IconInfo{icon=false,x=4,y=4,color=c,mask=m};return CreateIconIndirect(ref info);}finally{DeleteObject(c);DeleteObject(m);}
 }}
 public static void Restore(){bool failed=false;foreach(var entry in originals){if(!SetSystemCursor(entry.Value,entry.Key)){DestroyCursor(entry.Value);failed=true;}}originals.Clear();if(failed)SystemParametersInfo(0x57,0,IntPtr.Zero,0);}
 static void Activate(){if(originals.Count>0)return;
  try{foreach(uint id in ids){IntPtr saved=CopyIcon(LoadCursor(IntPtr.Zero,new IntPtr(id)));if(saved==IntPtr.Zero)throw new Exception("Could not preserve your Windows cursor.");originals[id]=saved;IntPtr pink=Create();if(pink==IntPtr.Zero)throw new Exception("Could not create the Aurora pointer.");if(!SetSystemCursor(pink,id)){DestroyCursor(pink);throw new Exception("Windows did not allow the Aurora pointer.");}}}catch{Restore();throw;}
 }
 public static string Fingerprint(){using(var image=new Bitmap(44,48))using(var g=Graphics.FromImage(image))using(var stream=new System.IO.MemoryStream()){
  g.Clear(Color.Transparent);IntPtr dc=g.GetHdc();try{DrawIconEx(dc,0,0,LoadCursor(IntPtr.Zero,new IntPtr(32512)),44,48,0,IntPtr.Zero,3);}finally{g.ReleaseHdc(dc);}image.Save(stream,System.Drawing.Imaging.ImageFormat.Png);
  using(var hash=System.Security.Cryptography.SHA256.Create())return BitConverter.ToString(hash.ComputeHash(stream.ToArray())).Replace("-","");
 }}
 public static void Preview(string path){using(var image=Artwork())image.Save(path,System.Drawing.Imaging.ImageFormat.Png);}
 // A separate process restores the captured cursor shapes on idle, EOF, or parent exit.
 public static void Run(int parentPid){
  var commands=new ConcurrentQueue<string>();var reader=new Thread(()=>{try{string line;while((line=Console.ReadLine())!=null)commands.Enqueue(line);}catch{}commands.Enqueue("quit");});reader.IsBackground=true;reader.Start();
  DateTime until=DateTime.MinValue;Console.WriteLine("{\"ready\":true}");
  try{while(true){try{if(Process.GetProcessById(parentPid).HasExited)return;}catch{return;}
    string command;while(commands.TryDequeue(out command)){if(command=="quit")return;if(command=="state"){Console.WriteLine("{\"fingerprint\":\""+Fingerprint()+"\"}");continue;}if(command=="active"){Activate();until=DateTime.UtcNow.AddMilliseconds(1800);Console.WriteLine("{\"active\":true}");}else if(command=="idle"){Restore();until=DateTime.MinValue;Console.WriteLine("{\"active\":false}");}}
    if(originals.Count>0&&DateTime.UtcNow>until){Restore();Console.WriteLine("{\"active\":false}");}Thread.Sleep(50);
  }}finally{Restore();}
 }
}
