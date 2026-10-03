// Bundle browser libraries locally; production renderers never load a CDN.
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('src/vendor');
fs.mkdirSync(output, {recursive:true});
const files = [
  ['marked/lib/marked.umd.js','marked.js'],
  ['dompurify/dist/purify.min.js','purify.js'],
  ['prismjs/components/prism-core.min.js','prism.js'],
  ...['markup','clike','javascript','powershell','python','bash','json'].map(name=>[`prismjs/components/prism-${name}.min.js`,`prism-${name}.js`]),
  ['marked/LICENSE','MARKED-LICENSE'],
  ['dompurify/LICENSE','DOMPURIFY-LICENSE'],
  ['dompurify/LICENSE-MPL','DOMPURIFY-LICENSE-MPL'],
  ['prismjs/LICENSE','PRISM-LICENSE']
];
for(const [source,target] of files) fs.copyFileSync(path.join('node_modules',source),path.join(output,target));
console.log('Markdown and highlighting libraries bundled locally.');
