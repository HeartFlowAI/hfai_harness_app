// Palette variants share Classic art; community outfits have their own pose sheets.
const list = [
  {id:'classic',name:'Classic',description:'Aurora’s original pink and gold',filter:'none'},
  {id:'moonlight',name:'Moonlight',description:'Cool blue and violet',filter:'hue-rotate(315deg) saturate(.8)'},
  {id:'sunrise',name:'Sunrise',description:'Warm peach and rose',filter:'hue-rotate(55deg) saturate(.8)'},
  {id:'mint',name:'Mint',description:'Fresh green and aqua',filter:'hue-rotate(155deg) saturate(.65)'},
  {id:'cyber',name:'Cyber',creator:'Jaymie',description:'Neon hearts and futuristic black armour',filter:'none',atlas:'assets/aurora/skins/cyber.png',rows:[0,.264,.492,.737,1]},
  {id:'dark',name:'Dark',creator:'Jaymie',description:'Lavender hair and gothic lace',filter:'none',atlas:'assets/aurora/skins/dark.png',rows:[0,.257,.509,.744,1]},
  {id:'cozy',name:'Cozy',creator:'Jaymie',description:'Pink hearts and an oversized jacket',filter:'none',atlas:'assets/aurora/skins/cozy.png',rows:[0,.256,.501,.733,1]}
];
const valid = id => list.some(item => item.id === id);
const frameRect = (skin,index,width,height) => {
  const row=Math.floor(index/4),column=index%4;
  return [column*width/4,skin.rows[row]*height,width/4,(skin.rows[row+1]-skin.rows[row])*height];
};
if (typeof module !== 'undefined') module.exports = {list,valid,frameRect};
else window.AuroraAppearances = {list,valid,frameRect};
