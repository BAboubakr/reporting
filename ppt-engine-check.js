(async()=>{
  const status=document.getElementById('reportStatus');
  const set=t=>{if(status)status.textContent=t;};
  const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
  try{
    if(!(window.PptxGenJS||window.pptxgen)) await load('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js');
    const P=window.PptxGenJS||window.pptxgen;
    if(typeof P!=='function') throw new Error('PptxGenJS constructor unavailable');
    const test=new P(); test.layout='LAYOUT_WIDE'; test.addSlide().addText('Atlas engine test',{x:1,y:1,w:4,h:1});
    if(typeof test.write!=='function') throw new Error('PptxGenJS write() unavailable');
    await test.write({outputType:'blob'});
    window.__atlasPptxReady=true;
    set('PowerPoint engine verified — PptxGenJS 3.12.0 can generate a PPTX blob.');
  }catch(e){window.__atlasPptxReady=false;set(`PowerPoint engine FAILED verification: ${e.message}`);console.error('Atlas PPT engine verification failed',e);}
})();
