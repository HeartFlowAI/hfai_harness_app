function choiceQuestion(question, files, rawChoices='[]') {
  let labels;
  try { labels=JSON.parse(rawChoices); } catch { throw Error('choices must be a JSON array of short labels.'); }
  if(!Array.isArray(labels)||labels.length>40||labels.some(v=>typeof v!=='string'||!v.trim()||v.length>160))throw Error('Offer up to 40 short choice labels.');
  if(files.length&&labels.length)throw Error('Use file_ids or choices, not both.');
  const choices=files.length?files.map(f=>({name:f.name,path:f.path})):labels.map(name=>({name:name.trim()}));
  return {question:choices.length?'Which one did you have in mind?':question,choices:choices.map((c,i)=>({number:i+1,...c}))};
}
function selectChoice(answer,choices){
  const normalize=v=>String(v).toLowerCase().replace(/[.!?]+$/,'').trim();
  const text=normalize(answer);
  const words=['one','two','three','four','five','six','seven','eight','nine','ten'];
  const ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
  const value=/^(?:(?:the|option|number|file)\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?:\s+(?:one|file|option))?$/.exec(text)?.[1];
  const index=/^\d+$/.test(value||'')?Number(value)-1:Math.max(words.indexOf(value),ordinals.indexOf(value));
  if(index>=0&&index<choices.length)return index;
  const matches=choices.map((c,i)=>({c,i})).filter(({c})=>normalize(c.name)===text||(c.path&&normalize(c.path)===text));
  return matches.length===1?matches[0].i:-1;
}
const voiceStyle='This is a voice conversation. Finish using voice_reply alone, with a spoken summary of one or two sentences, usually under 35 words, and complete written details. Never speak code, full paths, URLs or option lists unless the user asks to read them. Speak in brief, natural sentences, with warm, lightly playful mannerisms such as “Hmm, let me check”, “Ah, found it”, or “Got it” when appropriate. Vary your phrasing; match the user’s mood, using curiosity for questions, gentle reassurance for problems, and restrained delight after success. Do not force slang, imitate a regional accent, or add stage directions, emotion tags, or repeated catchphrases. Use the optional voice_reply emotion metadata instead: neutral, warm, happy, curious, calm, reassuring or playful. Keep it subtle: warm greetings, curious questions, reassuring errors, restrained happy success. After verified requested music playback with a fresh observed Pause control, set completion to music_playback; the minimized app will say a short sign-off and return to wake-word listening. Never mark music_playback for a failed action, a search result alone, an ad or an unverified track. Never let personality obscure facts or approval requests. When offering alternatives, use ask_user_question with file_ids for files or choices for other short labels. Do not recite or enumerate the options in your reply or question: the app shows numbered options and speaks “Which one did you have in mind?”. Wait for the answer; if selected_file_id is returned, reveal that exact id.';
module.exports={choiceQuestion,selectChoice,voiceStyle};
