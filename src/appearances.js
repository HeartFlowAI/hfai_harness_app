// Colour treatments reuse every existing pose and animation. New artwork can be
// registered here later without creating another character on screen.
const list = [
  {id:'classic',name:'Classic',description:'Aurora’s original pink and gold',filter:'none'},
  {id:'moonlight',name:'Moonlight',description:'Cool blue and violet',filter:'hue-rotate(315deg) saturate(.8)'},
  {id:'sunrise',name:'Sunrise',description:'Warm peach and rose',filter:'hue-rotate(55deg) saturate(.8)'},
  {id:'mint',name:'Mint',description:'Fresh green and aqua',filter:'hue-rotate(155deg) saturate(.65)'}
];
const valid = id => list.some(item => item.id === id);
if (typeof module !== 'undefined') module.exports = {list,valid};
else window.AuroraAppearances = {list,valid};
