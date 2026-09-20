/* Atlas Developments emergency renderer: independent of cleaner/competitor modules. */
(function(){
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()};
  function render(items,filter){
    const root=document.getElementById('developmentList'); if(!root)return;
    const clean=(items||[]).filter(s=>s&&s.title&&!/\bRINA\b/i.test([s.title,s.summary,s.headline,s.evidenceSnippet].join(' ')));
    const out=clean.filter(s=>{
      const t=[s.title,s.summary,s.categories,s.signalType,s.projectStage,s.evidenceLevel].flat().join(' ').toLowerCase();
      if(filter==='verified')return /official|primary|verified|news source|multi-source/.test(t);
      if(filter==='needs-review')return /watch|review|verify/.test(t);
      if(filter==='tenders')return /tender|procurement|prequalification|appel d'offres/.test(t);
      if(filter==='policy')return /policy|regulation|anre|law|tariff|consultation/.test(t);
      if(filter==='grid')return /grid|transmission|onee|substation|kv/.test(t);
      return true;
    }).sort((a,b)=>dt(b.published||b.detected||b.updated)-dt(a.published||a.detected||a.updated)).slice(0,40);
    root.innerHTML=out.map(s=>{
      const score=Number(s.actionabilityScore||s.relevanceScore||0);
      const level=s.fichtnerRelevance==='HIGH'||score>=75?'high':score>=60?'medium':'watch';
      const state=s.fichtnerRelevance==='HIGH'||score>=75?'HIGH PRIORITY':score>=60?'STRATEGIC SIGNAL':'WATCH';
      const topic=(s.signalType||'SIGNAL')+' · '+(Array.isArray(s.categories)?s.categories[0]:(s.categories||'RENEWABLE ENERGY'));
      return '<article class="development-card '+level+'"><div class="dev-top"><span class="dev-topic">'+esc(topic.toUpperCase())+'</span><span class="dev-score">'+esc(score?score+' / 100':'—')+'</span></div><div class="dev-state">'+esc(state)+'</div><h3 class="dev-title">'+esc(s.title||s.headline)+'</h3><p class="dev-summary">'+esc(s.summary||s.evidenceSnippet||s.whyItMatters||'Morocco renewable-energy market signal.')+'</p><div class="dev-bottom"><div class="dev-meta">'+esc(s.published||s.detected||'')+' · '+esc(s.evidenceLevel||s.source||'Source evidence')+'</div>'+(s.url?'<a class="dev-evidence" href="'+esc(s.url)+'" target="_blank" rel="noopener">Evidence ↗</a>':'')+'</div></article>';
    }).join('')||'<div class="development-empty"><strong>No developments match this filter.</strong><br>Atlas could not find eligible signals.</div>';
  }
  async function boot(){
    try{
      const m=await import('./data/signals.js?v=20260920-1');
      const items=m.signals||[];
      window.__atlasDevelopmentFallbackItems=items;
      render(items,'all');
      document.querySelectorAll('.filter-row .filter').forEach((b,i)=>b.addEventListener('click',()=>render(items,['all','verified','needs-review','tenders','policy','grid'][i]||'all')));
      console.info('[Atlas] independent Developments renderer loaded:',items.length);
    }catch(e){console.error('[Atlas] Developments fallback failed',e);}
  }
  window.addEventListener('load',()=>setTimeout(boot,250));
})();