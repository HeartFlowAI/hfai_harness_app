const greetings=['Hey! I’m here. What’s on your mind?','Hi! What can I help you with?','I’m listening. What shall we do?','Hey there. Tell me what you’d like to do.','Aurora here. How can I help?','Ready when you are. What are we working on?'];
function greetingPicker(random=Math.random){let previous=-1;return ()=>{const choices=greetings.map((text,index)=>({text,index})).filter(item=>item.index!==previous);const item=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];previous=item.index;return item.text;};}
module.exports={greetings,greetingPicker};
