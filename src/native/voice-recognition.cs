using System;
using System.Linq;
using System.Speech.Recognition;
using System.Threading;
using System.Web.Script.Serialization;

public static class AuroraRecognition {
 static readonly object outputLock = new object();
 static readonly object stateLock = new object();
 static readonly JavaScriptSerializer json = new JavaScriptSerializer();
 static SpeechRecognitionEngine engine;
 static Grammar wake, dictation, controls, approval;
 static volatile string scope = "";
 static volatile string mode = "paused";
 static bool running;
 static string lastHypothesis="";
 static readonly ManualResetEvent completed = new ManualResetEvent(true);
 static void Emit(object value) { lock(outputLock) { Console.WriteLine(json.Serialize(value)); Console.Out.Flush(); } }
 static void ChangeMode(string requested, string id, string context) {
  if(requested=="finish") {
   var previous=mode;
   if(running){engine.RecognizeAsyncStop();if(!completed.WaitOne(3000))throw new Exception("Speech recognizer did not finish.");running=false;}
   engine.SetInputToNull();
   object result=null;
   lock(stateLock){if(mode==previous){if(previous=="listen" && !String.IsNullOrWhiteSpace(lastHypothesis)){mode="paused";result=new {type="text",text=lastHypothesis};}else result=new {type="speech-rejected",message="No speech recognized. Please try again.",restart=true};}}
   Emit(new {type="mode",mode=mode,id=id});if(result!=null)Emit(result);return;
  }
  lock(stateLock) {mode = "paused";}
  if(running) { engine.RecognizeAsyncCancel(); if(!completed.WaitOne(3000)) throw new Exception("Speech recognizer did not pause. Turn listening off and try again."); running=false; }
  engine.SetInputToNull();
  lock(stateLock) {scope=context;lastHypothesis="";}
  if(requested == "wake" || requested == "listen" || requested == "control" || requested == "approval") {
   wake.Enabled = requested == "wake"; dictation.Enabled = requested == "listen";
   controls.Enabled = requested == "wake" || requested == "control" || requested == "approval" || requested == "listen";
   approval.Enabled = requested == "approval";
   engine.SetInputToDefaultAudioDevice();
   lock(stateLock) {mode=requested;} running=true; completed.Reset(); engine.RecognizeAsync(RecognizeMode.Multiple);
  }
  Emit(new { type="mode", mode=mode, id=id });
 }
 public static void Run(bool probe, string recognizerId) {
  try {
   var installed = SpeechRecognitionEngine.InstalledRecognizers();
   if(probe) { Emit(new { type="capabilities", recognizers=installed.Select(r=>new {id=r.Id, language=r.Culture.Name, name=r.Description}).ToArray() }); return; }
   var selected = installed.FirstOrDefault(r=>r.Id==recognizerId) ?? installed.FirstOrDefault(r=>r.Culture.TwoLetterISOLanguageName=="en");
   if(selected==null) throw new Exception("No matching Windows speech recognizer is installed. Install an English speech language in Windows Settings, then restart Aurora.");
   engine=new SpeechRecognitionEngine(selected);
   var builder=new GrammarBuilder(); builder.Culture=selected.Culture; builder.Append(new Choices("Aurora", "hey Aurora"));
   wake=new Grammar(builder); wake.Name="aurora-wake";
   dictation=new DictationGrammar(); dictation.Name="aurora-dictation"; dictation.Enabled=false;
   var commands=new GrammarBuilder();commands.Culture=selected.Culture;commands.Append(new Choices("stop task","stop listening","open Aurora","show Aurora","minimize Aurora","go to sleep"));
   controls=new Grammar(commands);controls.Name="aurora-controls";controls.Enabled=false;controls.Priority=10;
   var confirmation=new GrammarBuilder();confirmation.Culture=selected.Culture;confirmation.Append(new Choices("approve action","deny action"));
   approval=new Grammar(confirmation);approval.Name="aurora-approval";approval.Enabled=false;approval.Priority=10;
   engine.LoadGrammar(wake); engine.LoadGrammar(dictation);engine.LoadGrammar(controls);engine.LoadGrammar(approval);
   engine.EndSilenceTimeout=TimeSpan.FromMilliseconds(900);
   engine.EndSilenceTimeoutAmbiguous=TimeSpan.FromMilliseconds(1200);
   engine.RecognizeCompleted+=(s,e)=>{ completed.Set(); if(e.Error!=null) Emit(new {type="error",message="Windows speech recognition stopped: "+e.Error.Message}); };
   engine.SpeechHypothesized+=(s,e)=>{if(mode=="listen" && e.Result.Grammar!=null && e.Result.Grammar.Name==dictation.Name){lock(stateLock){lastHypothesis=e.Result.Text;}Emit(new {type="partial",text=e.Result.Text});}};
   engine.SpeechRecognized+=(s,e)=>{
    object result=null;
    lock(stateLock) {
     var current=mode;
     if(current=="wake" && e.Result.Grammar.Name==wake.Name && e.Result.Confidence>=0.60f) {mode="paused";result=new {type="wake"};}
     else if(current=="listen" && e.Result.Grammar.Name==dictation.Name && e.Result.Confidence>=0.35f) {mode="paused";result=new {type="text",text=e.Result.Text};}
     else if(current=="approval" && e.Result.Grammar.Name==approval.Name && e.Result.Confidence>=0.80f) {mode="paused";result=new {type="approval",text=e.Result.Text,scope=scope};}
     else if((current=="control" || current=="wake" || current=="approval" || current=="listen") && e.Result.Grammar.Name==controls.Name && e.Result.Confidence>=0.75f) result=new {type="control",text=e.Result.Text};
    }
    if(result!=null)Emit(result);
   };
   Emit(new {type="ready",language=selected.Culture.Name});
   string line;
   while((line=Console.ReadLine())!=null) {
    var command=json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(line);
    var request=Convert.ToString(command["mode"]);
    if(request=="stop") break;
    ChangeMode(request,Convert.ToString(command["id"]),command.ContainsKey("scope")?Convert.ToString(command["scope"]):"");
   }
  } catch(Exception error) {Emit(new {type="error",message=error.Message});}
  finally {mode="paused";if(engine!=null){engine.Dispose();engine=null;}}
 }
}
