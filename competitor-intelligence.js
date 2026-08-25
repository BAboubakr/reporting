const COMPETITORS=['AFRY','Artelia','Tractebel','Mott MacDonald','WSP','Worley','Egis','ILF Consulting Engineers','DNV','NOVEC','INGEMA'];
const norm=v=>String(v||'').toLowerCase();
const moroccoRelevant=s=>/morocco|maroc|masen|onee|anre|ocp|rabat|casablanca|laayoune|dakhla|tanger|fes|fez|oujda|kenitra|chefchaouen|taza|guercif|ouarzazate|ifrane/.test(norm(`${s.title} ${s.summary} ${(s.entities||[]).join(' ')} ${s.competitor||''}`));
const daysOld=d=>{const t=Date.parse(d||'');return Number.isFinite(t)?Math.max(0,(Date.now()-t)/86400000):999;};
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function formatDate(v){const d=new Date(v);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
async function renderCompetitors(filter='all'){
 const list=document.getElementById('competitorList');if(!list)return;
 let signals=[];try{signals=(await import('./data/signals.js')).signals||[];}catch(e){console.error('Atlas competitor signal load failed',e);}
 const live=signals.filter(s=>s.competitor&&COMPETITORS.includes(s.competitor)&&daysOld(s.published||s.detected)<=30).map(s=>({competitor:s.competitor,type:s.signalType||'Market movement',theme:(s.categories||['Energy transition'])[0],signal:s.title,priority:s.fichtnerRelevance||(s.relevanceScore>=80?'HIGH':s.relevanceScore>=60?'MEDIUM':'WATCH'),source:s.source||'Atlas collector',url:s.url,date:s.published||s.detected,morocco:moroccoRelevant(s),evidence:s.evidenceSnippet||s.summary||''})).sort((a,b)=>(b.morocco-a.morocco)||((b.priority==='HIGH')-(a.priority==='HIGH'))||(Date.parse(b.date||'')-Date.parse(a.date||'')));
 const items=filter==='all'?live:live.filter(x=>x.competitor===filter);const moroccoCount=live.filter(x=>x.morocco).length;const high=live.filter(x=>x.priority==='HIGH'&&x.morocco).length;
 document.getElementById('competitorCount').textContent=COMPETITORS.length;document.getElementById('competitorSignals').textContent=moroccoCount;document.getElementById('competitorHigh').textContent=high;
 if(!items.length){const selected=filter==='all'?'the monitored competitors':filter;list.innerHTML=`<div class="empty-state"><strong>No recent Morocco-specific signal for ${selected}.</strong><p>Atlas is monitoring this competitor continuously. Regional/global activity is kept out of the Morocco signal count until a Morocco link is evidenced.</p></div>`;return;}
 list.innerHTML=items.map(x=>`<article class="competitor-row ${x.morocco?'is-morocco':''}"><div class="competitor-logo">${escapeHtml(x.competitor.split(' ').map(w=>w[0]).join('').slice(0,3))}</div><div class="competitor-main"><div class="competitor-meta"><strong>${escapeHtml(x.competitor)}</strong><span class="competitor-priority ${norm(x.priority)}">${escapeHtml(x.priority)}</span><span>${escapeHtml(x.type)}</span><span class="signal-region">${x.morocco?'MOROCCO':'REGIONAL / GLOBAL'}</span></div><h4>${escapeHtml(x.theme)}</h4><p>${escapeHtml(x.signal)}</p><small>${escapeHtml(x.source)} · ${escapeHtml(formatDate(x.date))} · <a href="${escapeHtml(x.url||'#')}" target="_blank" rel="noopener">Evidence ↗</a></small></div></article>`).join('');
}
const cf=document.getElementById('competitorFilter');
if(cf){cf.innerHTML='<option value="all">All competitors</option>'+COMPETITORS.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');cf.addEventListener('change',()=>renderCompetitors(cf.value));}
document.getElementById('refreshCompetitors')?.addEventListener('click',()=>renderCompetitors(cf?.value||'all'));
renderCompetitors();
