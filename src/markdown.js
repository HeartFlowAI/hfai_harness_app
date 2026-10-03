// Raw HTML is escaped and generated HTML passes a strict sanitizer before display.
// Tool output and model text can never introduce scripts, images, forms or IPC controls.
(() => {
  const escape = text => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  marked.use({renderer:{html: token => escape(token.text)}});
  const aliases = {ps:'powershell',ps1:'powershell',shell:'bash',sh:'bash',js:'javascript',py:'python',html:'markup',xml:'markup'};
  function safeURL(value) {
    try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  }
  function render(body, source) {
    const html = marked.parse(source,{gfm:true,breaks:false,async:false});
    body.innerHTML = DOMPurify.sanitize(html,{
      ALLOWED_TAGS:['p','br','strong','em','del','code','pre','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','hr','a','table','thead','tbody','tr','th','td'],
      ALLOWED_ATTR:['href','title','class','start','colspan','rowspan'],
      ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false
    });
    body.querySelectorAll('a').forEach(link => {
      const url = safeURL(link.getAttribute('href'));
      if (!url) { link.removeAttribute('href'); return; }
      link.href = url; link.title = url;
      link.addEventListener('click',event=>{event.preventDefault();window.aurora?.openLink(url).then(result=>{if(!result.ok)window.dispatchEvent(new CustomEvent('aurora-notice',{detail:result.error}));});});
    });
    body.querySelectorAll('table').forEach(table=>{const wrapper=document.createElement('div');wrapper.className='table-scroll';table.before(wrapper);wrapper.append(table);});
    body.querySelectorAll('pre > code').forEach(code => {
      const raw = code.textContent;
      const name = [...code.classList].find(value=>value.startsWith('language-'))?.slice(9).toLowerCase() || 'text';
      const language = aliases[name] || name;
      // Discard any author-supplied CSS classes. Only our known syntax grammars render.
      code.className = `language-${Object.hasOwn(Prism.languages,language) ? language : 'text'}`;
      if (raw.length < 60000 && Object.hasOwn(Prism.languages,language)) Prism.highlightElement(code);
      const pre = code.parentElement, block = document.createElement('div');block.className='code-block';
      const toolbar=document.createElement('div');toolbar.className='code-toolbar';
      const label=document.createElement('span');label.textContent=name;
      const copy=document.createElement('button');copy.type='button';copy.className='code-copy';copy.textContent='Copy';copy.setAttribute('aria-label',`Copy ${name} code`);
      copy.addEventListener('click',async()=>{try{const result=await window.aurora.copyText(raw);if(!result.ok)throw new Error(result.error);copy.textContent='Copied';setTimeout(()=>{copy.textContent='Copy';},1500);}catch(error){window.dispatchEvent(new CustomEvent('aurora-notice',{detail:error.message}));}});
      toolbar.append(label,copy);pre.before(block);block.append(toolbar,pre);
    });
  }
  window.AuroraMarkdown = {render,safeURL};
})();
