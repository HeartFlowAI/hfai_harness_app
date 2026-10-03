const {test}=require('node:test');
const assert=require('node:assert/strict');
const {choiceQuestion,selectChoice}=require('../src/voice-choices');
test('file choices are displayed with paths but never appended to spoken clarification',()=>{
  const result=choiceQuestion('Do you mean secret.pdf or another.pdf?',[{name:'secret.pdf',path:'C:/first/secret.pdf'},{name:'secret.pdf',path:'C:/second/secret.pdf'}]);
  assert.equal(result.question,'Which one did you have in mind?');
  assert.equal(result.choices[1].number,2);
  assert.equal(selectChoice('secret.pdf',result.choices),-1);
  assert.equal(selectChoice('the second one.',result.choices),1);
  assert.equal(selectChoice('C:/second/secret.pdf',result.choices),1);
  assert.equal(selectChoice('option 9',result.choices),-1);
});
test('general alternatives support spoken numbers and names without guessing',()=>{
  const result=choiceQuestion('What format?',[],'["PDF", "Word document", "Plain text"]');
  assert.equal(result.question,'Which one did you have in mind?');
  assert.equal(selectChoice('two',result.choices),1);
  assert.equal(selectChoice('number three',result.choices),2);
  assert.equal(selectChoice('Word document!',result.choices),1);
  assert.equal(selectChoice('maybe the other one',result.choices),-1);
  assert.equal(choiceQuestion('What filename?',[]).question,'What filename?');
  assert.throws(()=>choiceQuestion('?',[],'{}'),/labels/);
  assert.throws(()=>choiceQuestion('?',[{name:'file'}],'["other"]'),/not both/);
});
