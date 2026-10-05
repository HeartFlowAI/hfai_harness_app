// Palette variants share Classic art; community outfits have their own pose sheets.
const list = [
  {id:'classic',name:'Classic',description:'Aurora’s original pink and gold',filter:'none'},
  {id:'moonlight',name:'Moonlight',description:'Cool blue and violet',filter:'hue-rotate(315deg) saturate(.8)'},
  {id:'sunrise',name:'Sunrise',description:'Warm peach and rose',filter:'hue-rotate(55deg) saturate(.8)'},
  {id:'cyber',name:'Cyber',creator:'Jaymie',description:'Neon hearts and futuristic black armour',filter:'none',atlas:'assets/aurora/skins/cyber.png',rows:[0,.25,.5,.75,1]},
  {id:'dark',name:'Dark',creator:'Jaymie',description:'Lavender hair and gothic lace',filter:'none',atlas:'assets/aurora/skins/dark.png',rows:[0,.25,.5,.75,1]},
  {id:'cozy',name:'Cozy',creator:'Jaymie',description:'Pink hearts and an oversized jacket',filter:'none',atlas:'assets/aurora/skins/cozy.png',rows:[0,.25,.5,.75,1]}
];
const valid = id => list.some(item => item.id === id);
const frameRect = (skin,index,width,height) => {
  const row=Math.floor(index/4),column=index%4;
  // Artists' grids are approximate. Overscan protects boots/hands; component
  // isolation removes neighbouring fragments that enter this safety margin.
  const cellWidth=width/4,cellHeight=(skin.rows[row+1]-skin.rows[row])*height;
  const x=Math.max(0,column*cellWidth-cellWidth*.1),y=Math.max(0,skin.rows[row]*height-cellHeight*.1);
  const right=Math.min(width,(column+1)*cellWidth+cellWidth*.1),bottom=Math.min(height,skin.rows[row+1]*height+cellHeight*.1);
  return [x,y,right-x,bottom-y];
};
if (typeof module !== 'undefined') module.exports = {list,valid,frameRect};
else window.AuroraAppearances = {list,valid,frameRect};
