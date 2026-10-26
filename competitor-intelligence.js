const norm=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const priorityValue=value=>{const p=String(value||'').toUpperCase();return p==='HIGH'?3:p==='MEDIUM'?2:p==='WATCH'?1:0;};
const dateOf=item=>item?.date||item?.published||item?.detected||item?.updated||'';
const daysOld=date=>{const time=Date.parse(date||'');return Number.isFinite(time)?Math.max(0,(Date.now()-time)/86400000):Infinity;};
function escapeHtml(value=''){return String(value).replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]));}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
function textOf(item){const entities=Array.isArray(item?.entities)?item.entities.map(x=>typeof x==='string'?x:x?.name||x?.entity||x?.label||'').join(' '):'';return norm(`${item?.title||item?.headline||item?.signal||item?.summary||''} ${item?.summary||''} ${entities} ${item?.competitor||''} ${item?.source||''}`);}
function moroccoRelevant(item){return item?.morocco===true||/\b(morocco|maroc|moroccan|masen|onee|anre|ocp|rabat|casablanca|laayoune|dakhla|tanger|fes|fez|oujda|kenitra|chefchaouen|taza|guercif|ouarzazate|ifrane|benguerir|phosboucraa|jorf lasfar|midelt|noor|guelmim|boujdour|tarfaya|nador|safi|el jadida)\b/.test(textOf(item));}
function classify(item){
 const text=textOf(item);
 if(/\b(financ(?:e|ed|ing|ial)|fund(?:ed|ing)?|loan|debt|lender|credit|bond|capital raise|investment bank)\b/.test(text))return 'financing-side signal';
 if(moroccoRelevant(item)&&/\b(mandate|appointed|award(?:ed)?|contract|selected|commissioned|study|feasibility|tender|project|consortium)\b/.test(text))return 'Morocco mandate';
 if(/\b(mena|middle east|north africa|africa|african|regional|across markets|multi country|multicountry)\b/.test(text))return 'regional signal';
 if(/\b(capability|platform|launch(?:ed|es)?|product|service|technology|expertise|acquisition|partnership|hiring|office|subsidiary|expansion|integrat(?:e|ed|ion))\b/.test(text))return 'capability move';
 return moroccoRelevant(item)?'Morocco mandate':'regional signal';
}
function tokenSimilarity(a,b){const aa=new Set(norm(a).split(' ').filter(x=>x.length>2)),bb=new Set(norm(b).split(' ').filter(x=>x.length>2));if(!aa.size||!bb.size)return 0;let shared=0;for(const word of aa)if(bb.has(word))shared++;return shared/Math.min(aa.size,bb.size);}
function dedupeItems(items){
 const result=[];
 for(const item of items){
  const duplicate=result.find(previous=>previous.competitor===item.competitor&&previous.tag===item.tag&&((item.url&&previous.url===item.url)||tokenSimilarity(previous.signal,item.signal)>=0.84));
  if(!duplicate){item.evidence=[{source:item.source,url:item.url}].filter(e=>e.url);result.push(item);continue;}
  duplicate.evidence=[...duplicate.evidence,...[{source:item.source,url:item.url}].filter(e=>e.url)];
  const authority=item.source&&item.source!=='Atlas collector'?1:0;
  const previousAuthority=duplicate.source&&duplicate.source!=='Atlas collector'?1:0;
  if(priorityValue(item.priority)>priorityValue(duplicate.priority)||(priorityValue(item.priority)===priorityValue(duplicate.priority)&&authority>previousAuthority)){Object.assign(duplicate,{...item,evidence:duplicate.evidence});}
  if(Date.parse(dateOf(item))>Date.parse(dateOf(duplicate)))duplicate.date=dateOf(item);
 }
 return result;
}
function mapLiveSignal(signal){
 const competitor=signal?.competitor;
 if(!competitor)return null;
 const title=signal.title||signal.headline||signal.summary||'Competitor signal';
 const item={competitor,signal:title,theme:(Array.isArray(signal.categories)?signal.categories[0]:signal.categories)||signal.signalType||'Energy transition',priority:String(signal.fichtnerRelevance||'').toUpperCase()|| (Number(signal.actionabilityScore)>=80||Number(signal.relevanceScore)>=80?'HIGH':Number(signal.actionabilityScore)>=60||Number(signal.relevanceScore)>=60?'MEDIUM':'WATCH'),source:signal.source||'Atlas collector',url:signal.url||signal.sources?.[0]?.url||'',date:dateOf(signal),morocco:moroccoRelevant(signal),relationship:'Competitor',tag:classify(signal),signalId:signal.id};
 return item;
}
function mapCurated(item){const date=dateOf(item);return{...item,date,tag:classify(item),morocco:moroccoRelevant(item),relationship:item.relationship||'Competitor'};}
function renderCard(item){return `<article class="competitor-row is-morocco"><div class="competitor-logo">${escapeHtml(item.competitor.split(' ').map(word=>word[0]).join('').slice(0,3))}</div><div class="competitor-main"><div class="competitor-meta"><strong>${escapeHtml(item.competitor)}</strong><span class="competitor-priority ${norm(item.priority)}">${escapeHtml(item.priority||'WATCH')}</span><span>${escapeHtml(item.tag)}</span><span class="signal-region">${item.morocco?'MOROCCO':'REGIONAL'}</span></div><h4>${escapeHtml(item.theme||item.tag)}</h4><p>${escapeHtml(item.signal)}</p><small>${escapeHtml(item.source||'Atlas collector')} · ${escapeHtml(formatDate(item.date))}${item.relationship?` · ${escapeHtml(item.relationship)}`:''} · <a href="${escapeHtml(item.url||'#')}" target="_blank" rel="noopener">Evidence ↗</a></small></div></article>`;}
let competitorNames=[];
async function renderCompetitors(filter='all'){
 const list=document.getElementById('competitorList');if(!list)return;
 let rawSignals=[],seed=[],tracked=[];
 try{
  const [signalData,newsData,competitorData,cleaner]=await Promise.all([import('./data/signals.js'),import('./data/competitor-news.js'),import('./data/competitors.js'),import('./data-cleaner.js')]);
  rawSignals=Array.isArray(window.signals)?window.signals:cleaner.cleanSignals(signalData.signals||[]);
  seed=newsData.competitorNews||[];tracked=competitorData.competitors||[];
 }catch(error){console.error('Atlas competitor signal load failed',error);}
 competitorNames=tracked.map(item=>item.name);
 const filterControl=document.getElementById('competitorFilter');
 if(filterControl&&!filterControl.dataset.bound){const selected=filterControl.value||filter;filterControl.innerHTML='<option value="all">All competitors</option>'+competitorNames.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');filterControl.value=competitorNames.includes(selected)?selected:'all';filterControl.dataset.bound='true';filterControl.addEventListener('change',()=>renderCompetitors(filterControl.value));filter=filterControl.value;}
 const live=rawSignals.filter(signal=>daysOld(dateOf(signal))<=30).map(mapLiveSignal).filter(Boolean);
 const curated=seed.filter(item=>daysOld(dateOf(item))<=30).map(mapCurated).filter(item=>competitorNames.includes(item.competitor));
 const merged=dedupeItems([...live,...curated]).sort((a,b)=>priorityValue(b.priority)-priorityValue(a.priority)||Date.parse(dateOf(b))-Date.parse(dateOf(a)));
 const competitorItems=merged.filter(item=>item.tag!=='financing-side signal');
 const financingItems=merged.filter(item=>item.tag==='financing-side signal');
 const selectedItems=filter==='all'?competitorItems:competitorItems.filter(item=>item.competitor===filter);
 const highCount=competitorItems.filter(item=>priorityValue(item.priority)>=3).length;
 const countNode=document.getElementById('competitorCount');if(countNode)countNode.textContent=competitorNames.length;
 const signalsNode=document.getElementById('competitorSignals');if(signalsNode)signalsNode.textContent=competitorItems.length;
 const highNode=document.getElementById('competitorHigh');if(highNode)highNode.textContent=highCount;
 const names=filter==='all'?competitorNames:competitorNames.filter(name=>name===filter);
 const groups=names.map(name=>{const items=selectedItems.filter(item=>item.competitor===name);const newest=items.map(dateOf).filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];return `<section class="competitor-group"><div class="competitor-group-heading"><h3>${escapeHtml(name)}</h3><span>${newest?`Newest signal · ${escapeHtml(formatDate(newest))}`:'No signal in 30 days'}</span></div>${items.length?items.map(renderCard).join(''):`<p class="empty-state">No signal in 30 days</p>`}</section>`;}).join('');
 const financing=filter==='all'?financingItems:financingItems.filter(item=>item.competitor===filter);
 list.innerHTML=`<section class="competitor-signal-group"><h2>Competitor signals · ${selectedItems.length}</h2>${groups||'<p class="empty-state">No tracked competitor selected.</p>'}</section>${financing.length?`<section class="financing-signal-group"><h2>Financing-side signals · ${financing.length}</h2>${financing.map(renderCard).join('')}</section>`:''}`;
}
document.getElementById('refreshCompetitors')?.addEventListener('click',()=>renderCompetitors(document.getElementById('competitorFilter')?.value||'all'));
renderCompetitors();

