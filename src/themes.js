// Whole-app themes. Each theme maps onto the shared CSS variables in themes.css.
// Heartflow is the default and matches the original palette.
(() => {
  const list = [
    { id: 'heartflow', name: 'Heartflow', description: 'Slate neutrals with a signal-blue accent', swatches: ['#5b8cff', '#38bdf8', '#0b0d12'] },
    { id: 'midnight', name: 'Midnight', description: 'Cool blue and cyan on deep navy', swatches: ['#4f8cff', '#38d0ff', '#070b16'] },
    { id: 'ember', name: 'Ember', description: 'Warm amber and rose', swatches: ['#ff8a3d', '#ff4d6d', '#140b09'] },
    { id: 'mint', name: 'Mint', description: 'Fresh teal and green', swatches: ['#2fe0a6', '#5ad1ff', '#07120f'] }
  ];
  const valid = id => list.some(item => item.id === id);
  if (typeof module !== 'undefined') module.exports = { list, valid };
  else window.AuroraThemes = { list, valid };
})();
