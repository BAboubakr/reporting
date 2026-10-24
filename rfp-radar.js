const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateText=value=>{if(!value)return 'Not published by source';const d=new Date(value);return Number.isNaN(d.getTime())?'Unclear':new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:value.includes('T')?'short':undefined,timeZone:'Africa/Casablanca'}).format(d)+' (Rabat)'};
const dayDelta=(a,b)=>Math.ceil((new Date(a)-new Date(b))/86400000);
export function filterRadar(items,filters={}){
 let rows=Array.isArray(items)?items.filter(x=>x&&typeof x==='object'):[];
 if(filters.status&&filters.status!=='all')rows=rows.filter(x=>x.status===filters.status);
 if(filters.authority&&filters.authority!=='all')rows=rows.filter(x=>x.authority===filters.authority);
 if(filters.category&&filters.category!=='all')rows=rows.filter(x=>(x.serviceCategories||[]).includes(filters.category));
 if(filters.relevance&&filters.relevance!=='all')rows=rows.filter(x=>x.fit===filters.relevance);
 if(filters.recent)rows=rows.filter(x=>x.newToAtlas);
 const sort=filters.sort||'relevance';
 rows.sort((a,b)=>sort==='newest'?String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')):sort==='deadline'?String(a.deadlineAt||'9999').localeCompare(String(b.deadlineAt||'9999')):(b.fitScore||0)-(a.fitScore||0));
 return rows;
}
export function renderRadarCards(items=[]){
 if(!items.length)return '<div class="rfp-empty"><strong>No qualifying notices in this view.</strong><p>Atlas does not infer tenders from general project news. Check source coverage below for collection failures.</p></div>';
 return items.map(x=>{
  const cls=x.status==='open'?'open':x.status==='closing soon'?'soon':x.status==='closed'?'closed':'unclear';
  const sources=Array.isArray(x.sourceReferences)&&x.sourceReferences.length?x.sourceReferences:[{sourceName:x.sourceName,url:x.officialUrl||x.sourceUrl}];
  const links=sources.filter(s=>/^https?:\/\//i.test(s.url||'')).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.sourceName||'Official notice')}</a>`).join(' · ');
  const eligible=(x.eligibilityReview||[]).map(v=>`<li>${esc(v)}</li>`).join('');
  const updates=(x.updates||[]).slice(-2).map(u=>`<p class="rfp-update"><b>Updated ${esc(dateText(u.observedAt))}:</b> ${esc(u.change)} changed${u.previous?' from “'+esc(u.previous)+'”':''}${u.current?' to “'+esc(u.current)+'”':''}.</p>`).join('');
  return `<article class="rfp-card"><div class="rfp-card-top"><div><span class="rfp-status ${cls}">${esc(x.status||'unclear')}</span>${x.newToAtlas?'<span class="rfp-new">New to Atlas · discovered within 7 days</span>':''}${x.updatedRecently?'<span class="rfp-updated">Notice updated</span>':''}<h3>${esc(x.title||'Untitled procurement notice')}</h3></div><strong class="rfp-fit">${esc(x.fit||'Possible fit — review required')}<small>${Number.isFinite(x.fitScore)?`${x.fitScore}/100 screening score`:''}</small></strong></div><div class="rfp-facts"><span><b>Authority</b>${esc(x.authority||'Not stated')}</span><span><b>Reference</b>${esc(x.reference||'Not stated')}</span><span><b>Notice type</b>${esc(x.procurementType||'Not stated')}</span><span><b>Published</b>${esc(dateText(x.publishedAt))}</span><span class="deadline ${cls}"><b>Submission deadline</b>${esc(dateText(x.deadlineAt))}${!x.deadlineAt?'<em>Deadline not stated — verify the notice</em>':''}</span><span><b>First discovered by Atlas</b>${esc(dateText(x.firstDiscoveredAt))}</span><span><b>Geographic scope</b>${esc(x.geographicScope||'Not stated in listing')}</span><span><b>Service / technology</b>${esc([...(x.serviceCategories||[]),...(x.technologies||[])].join(' · ')||'Needs manual review')}</span><span><b>Official contract value</b>${esc(x.contractValue||'Not disclosed in listing')}</span></div><p class="rfp-explanation">${esc((x.fitReasons||[]).join(' ' )||'No supported fit evidence; review before pursuing.')}</p><details><summary>Scope evidence, eligibility and risks</summary><p>${esc(x.scope||x.evidence||'The source listing did not expose scope details. Open the official notice and tender dossier.')}</p><p><b>Eligibility from listing:</b> ${esc(x.eligibilityCriteria||'Not exposed; review the official tender dossier.')}</p><ul>${eligible}</ul>${(x.risks||[]).map(r=>`<p class="rfp-risk">${esc(r)}</p>`).join('')}${updates}</details><div class="rfp-links"><b>Official source${sources.length>1?'s':''}:</b> ${links||'Official notice link unavailable — source requires review.'}<small>Detailed deliverables and qualifications require review of the official dossier.</small></div></article>`;
 }).join('');
}
async function boot(){
 const css=document.createElement('link');css.rel='stylesheet';css.href='rfp-radar.css?v=20261017-1';document.head.append(css);
 const host=document.getElementById('rfpRadar');if(!host)return;
 let feed={opportunities:[]},status={sources:[],message:'Source status unavailable.'};
 try{const[r,s]=await Promise.all([fetch('data/rfp-opportunities.json?v=20261017-1',{cache:'no-store'}),fetch('data/rfp-source-status.json?v=20261017-1',{cache:'no-store'})]);if(!r.ok)throw Error(`feed HTTP ${r.status}`);feed=await r.json();if(s.ok)status=await s.json();}catch(error){host.querySelector('#rfpNotice')?.replaceChildren(document.createTextNode(`Radar data unavailable: ${error.message}. The scheduled monitor may not have completed yet.`));}
 const all=Array.isArray(feed.opportunities)?feed.opportunities:[];
 const notice=host.querySelector('#rfpNotice');if(notice&&feed.generatedAt)notice.textContent=`Feed refreshed ${dateText(feed.generatedAt)} · ${all.length} opportunities currently visible. See source coverage below; empty results do not mean procurement coverage is exhaustive.`;
 const select=(id,values,label)=>`<label>${label}<select id="${id}"><option value="all">All</option>${values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`;
 const unique=key=>[...new Set(all.map(x=>x[key]).filter(Boolean))].sort();
 host.querySelector('#rfpFilters').innerHTML=select('rfpStatus',['open','closing soon','unclear','closed','cancelled','awarded'],'Status')+select('rfpAuthority',unique('authority'),'Authority')+select('rfpCategory',[...new Set(all.flatMap(x=>x.serviceCategories||[]))].sort(),'Service category')+select('rfpFit',['Strong potential fit','Possible fit — review required','Low fit / excluded'],'Relevance')+'<label class="rfp-sort-label">Sort by<select id="rfpSort"><option value="relevance">Relevance</option><option value="newest">Newest publication</option><option value="deadline">Earliest deadline</option></select></label><label class="rfp-checkbox"><input id="rfpRecent" type="checkbox"> Discovered in last 7 days</label>';
 const redraw=()=>{const filters={status:host.querySelector('#rfpStatus').value,authority:host.querySelector('#rfpAuthority').value,category:host.querySelector('#rfpCategory').value,relevance:host.querySelector('#rfpFit').value,sort:host.querySelector('#rfpSort').value,recent:host.querySelector('#rfpRecent').checked};const rows=filterRadar(all,filters);host.querySelector('#rfpCount').textContent=`${rows.length} opportunities · ${all.filter(x=>x.newToAtlas).length} new to Atlas`;host.querySelector('#rfpCards').innerHTML=renderRadarCards(rows);};
 host.querySelector('#rfpFilters').addEventListener('change',redraw);redraw();
 const sourceRows=(status.sources||[]).map(s=>`<li class="${s.ok?'ok':'fail'}"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a> — ${s.ok?'checked':'failed'} ${esc(dateText(s.checkedAt))}; ${esc(s.noticesParsed)} notice rows. ${esc(s.message)}</li>`).join('');
 host.querySelector('#rfpCoverage').innerHTML=`<p><b>Coverage status: ${esc(status.coverage||'unknown')}.</b> ${esc(status.message||'')} Last collection: ${esc(dateText(status.generatedAt))}.</p><ul>${sourceRows||'<li>No source monitor status recorded yet.</li>'}</ul><p>“New to Atlas” means first discovered in the past 7 days. The original publication date is shown separately. Active notices and notices discovered/updated in the last 30 days are visible; full history remains in the monitor state.</p>`;
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}

