// Consolidated Atlas report engine. Keeps the previous data gate and deduplication
// before creating a five-slide, evidence-led management report.
import { signals as rawSignals } from './data/signals.js?report=V4-20260920';

const REPORT_ENGINE_VERSION = 'V5';
const LEGACY_SLIDE_COUNT = 9;
const TARGET_SLIDE_COUNT = 5;
const UI_NOISE = /\b(outils informatiques|consultations clôturées|spécifications techniques|specifications techniques|matériel accepté|materiel accepte|guides d.?utilisation|0 entités publiques inscrites|tester la configuration|accueil|connexion|se connecter|menu|rechercher)\b/i;
const MOROCCO = /\b(morocco|maroc|moroccan|marocain|marocaine|rabat|casablanca|tanger|tangier|f[eè]s|fez|mekn[eè]s|ouarzazate|la[aâ]youne|laayoune|dakhla|khouribga|benguerir|jorf lasfar|safi|agadir|nador|essaouira|onee|masen|anre|amee|iresen|ocp|novec|gpm|ornx)\b/i;
const ENERGY = /\b(solar|photovoltaic|pv|bess|battery|storage|wind|offshore wind|eolien|éolien|renewable|renewable energy|hydrogen|green hydrogen|ammonia|ptx|power-to-x|electrolysis|grid|transmission|substation|interconnection|electricity|power plant|energy|hydro|pumped storage|decarbon|module|cell)\b/i;
const DEVELOPMENT = /\b(project|plant|farm|contract|tender|procurement|award|awarded|won|selected|appointed|investment|financing|funding|agreement|partnership|construction|commissioned|feasibility|pre-feed|feed|development|launch|regulation|law|tariff|capacity|mw|mwh|gw|gwh|appel d'offres|laur[eé]at|retenu|attribu[eé]|mise en service|programme|corridor|consultation)\b/i;
const DEDUP_STOP = new Set('the a an and or to of in on for with from by as at is are was were be this that team help advance appointed selected project projects plant plants development renewable energy morocco maroc news now international water power renewables latest report says according'.split(' '));
const COMPETITORS = ['AFRY','Artelia','Tractebel','Mott MacDonald','WSP','Worley','Egis','ILF Consulting Engineers','DNV','NOVEC','INGEMA','JESA'];
const ALIASES = {AFRY:['afry'],Artelia:['artelia'],Tractebel:['tractebel','engie'],'Mott MacDonald':['mott macdonald'],WSP:['wsp'],Worley:['worley'],Egis:['egis'],'ILF Consulting Engineers':['ilf consulting engineers'],DNV:['dnv'],NOVEC:['novec'],INGEMA:['ingema'],JESA:['jesa','jesa s.a','jesa sa']};
const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const signalText = s => String(`${s?.title||s?.headline||s?.signal||''} ${s?.summary||''} ${s?.evidenceSnippet||''} ${Array.isArray(s?.entities)?s.entities.join(' '):s?.entities||''} ${s?.source||''} ${s?.whyItMatters||''}`);
const canonical = s => norm(s?.title||s?.headline||s?.signal||'').replace(/\b(?:african energy|africa energy|africa energy intelligence|energy intelligence|renewable energy news)\b/g,' ').replace(/\s+/g,' ').trim();
const storyTokens = s => new Set(norm(`${s?.title||s?.headline||s?.signal||''} ${s?.summary||''} ${s?.evidenceSnippet||''}`).split(' ').filter(x=>x.length>=3&&!DEDUP_STOP.has(x)));
const similarity = (a,b) => { if(!a.size||!b.size)return 0; let n=0; for(const token of a)if(b.has(token))n++; return n/Math.min(a.size,b.size); };
const priority = s => (Number(s?.qualityScore)||0)*2+(Number(s?.relevanceScore)||0)+(Number(s?.actionabilityScore)||0)+(Date.parse(s?.published||s?.detected||s?.updated)||0)/1e13;
const actionability = s => Number(s?.actionabilityScore)||0;
const rankSignals = list => [...list].sort((a,b)=>actionability(b)-actionability(a)||(Number(b.relevanceScore)||0)-(Number(a.relevanceScore)||0)||(Date.parse(b.published||b.detected||'')||0)-(Date.parse(a.published||a.detected||'')||0));
const date = value => { const d=new Date(value); return Number.isNaN(d.getTime())?null:d; };
const fmtDate = value => { const d=date(value); return d?d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):String(value||'Undated'); };
const escapeText = value => String(value||'').replace(/\s+/g,' ').trim();

// Preserve the former v3 sanitizer behavior while keeping it inside this module.
function sanitizeSignals(list) {
  const ordered=[...list].filter(s=>String(s?.filterDecision||'KEEP').toUpperCase()!=='REVIEW'&&String(s?.filterDecision||'KEEP').toUpperCase()!=='REJECT').sort((a,b)=>priority(b)-priority(a));
  const kept=[];
  for(const signal of ordered){
    const title=canonical(signal),tokens=storyTokens(signal);let duplicate=false;
    for(const existing of kept){
      const existingTitle=canonical(existing);
      if(title&&title===existingTitle){duplicate=true;break;}
      const existingTokens=storyTokens(existing),sim=similarity(tokens,existingTokens);
      if(sim>=.78||(sim>=.62&&[...tokens].filter(token=>token.length>=6&&existingTokens.has(token)).length>=4)){duplicate=true;break;}
    }
    if(!duplicate)kept.push(signal);
  }
  return kept;
}
function usable(signal){const text=signalText(signal);return !!text.trim()&&!UI_NOISE.test(text)&&MOROCCO.test(text)&&ENERGY.test(text)&&DEVELOPMENT.test(text)&&String(signal?.filterDecision||'KEEP').toUpperCase()!=='REVIEW'&&String(signal?.filterDecision||'KEEP').toUpperCase()!=='REJECT';}
function sourceRecords(signal){
  const records=[];
  for(const list of [signal?.sources,signal?.enrichment?.sources,signal?.enrichment?.additionalEvidence,signal?.additionalEvidence])if(Array.isArray(list))records.push(...list);
  return records;
}
function publisherKey(record){
  const raw=String(record?.url||record?.originalUrl||'');
  try{const host=new URL(raw).hostname.toLowerCase().replace(/^www\./,'');if(host&&!/(^|\.)news\.google\.com$/.test(host))return host;}catch{}
  const label=String(record?.source||record?.publisher||record?.publication||'').toLowerCase().replace(/^www\./,'').replace(/\.(com|org|net|co\.uk|ma)$/,'').replace(/[^a-z0-9]+/g,' ').trim();
  if(!label||/linkedin|google news/.test(label))return '';
  return label;
}
function publisherNames(signal){
  const names=new Map();
  for(const record of sourceRecords(signal)){const key=publisherKey(record);if(key)names.set(key,String(record.source||record.publisher||record.publication||key));}
  const socialOnly=/linkedin/i.test(String(signal?.source||''))&&names.size===0;
  return {keys:[...names.keys()],names:[...names.values()],socialOnly};
}
const corroborated = signal => {const p=publisherNames(signal);return !p.socialOnly&&p.keys.length>=2;};
const uncertainty = signal => escapeText(signal?.uncertainty||signal?.limitations||signal?.confidenceNotes||'');
function reportUncertainty(signal){return uncertainty(signal)||(corroborated(signal)?'Project stage, final terms and owner confirmation require primary-source review.':'Single publisher or social lead; key claims need independent or primary-source confirmation.');}
function interpretation(signal){return escapeText(signal?.whyItMatters||signal?.analystInterpretation||signal?.summary||'Analyst review is required to determine commercial relevance.');}
function titleOf(signal){return escapeText(signal?.headline||signal?.title||signal?.signal||'Untitled signal');}
function windowFor(type,periodText){
  const value=String(periodText||'').trim(),now=new Date();
  if(/monthly|month/i.test(type)){
    let year=now.getFullYear(),month=now.getMonth();
    const iso=value.match(/^(\d{4})-(\d{2})$/),named=value.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if(iso){year=Number(iso[1]);month=Number(iso[2])-1;}else if(named){const parsed=new Date(`${named[1]} 1, ${named[2]}`);if(!Number.isNaN(parsed.getTime())){year=parsed.getFullYear();month=parsed.getMonth();}}
    return {start:new Date(year,month,1),end:new Date(year,month+1,1),label:value||new Date(year,month,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'})};
  }
  let year=now.getFullYear(),week;
  const iso=value.match(/^(?:ISO\s+week\s+)?(\d{4})-W(\d{2})$/i);
  if(iso){year=Number(iso[1]);week=Number(iso[2]);}
  else {const temp=new Date(now);temp.setHours(0,0,0,0);temp.setDate(temp.getDate()+4-(temp.getDay()||7));year=temp.getFullYear();const jan1=new Date(year,0,1);week=Math.ceil((((temp-jan1)/86400000)+1)/7);}
  const jan4=new Date(year,0,4),monday=new Date(jan4);monday.setDate(jan4.getDate()-((jan4.getDay()+6)%7)+(week-1)*7);monday.setHours(0,0,0,0);const end=new Date(monday);end.setDate(end.getDate()+7);
  return {start:monday,end,label:value||`${year}-W${String(week).padStart(2,'0')}`};
}
function within(signal,range){const d=date(signal?.published||signal?.detected||signal?.date);return !!d&&d>=range.start&&d<range.end;}
function currentPeriod(type){if(/monthly|month/i.test(type))return new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'});const w=windowFor(type,'');return `${w.start.getFullYear()}-W${String(isoWeek(w.start)).padStart(2,'0')}`;}
function isoWeek(value){const d=new Date(value);d.setHours(0,0,0,0);d.setDate(d.getDate()+4-(d.getDay()||7));const y=new Date(d.getFullYear(),0,1);return Math.ceil((((d-y)/86400000)+1)/7);}
function reportStatus(message){const el=document.getElementById('reportStatus');if(el)el.textContent=`Atlas Report Engine ${REPORT_ENGINE_VERSION} · ${message}`;}
function addTitle(slide,kicker,heading,sub){slide.addText(kicker.toUpperCase(),{x:.55,y:.28,w:7,h:.18,fontSize:8.5,bold:true,color:'005AAF',charSpacing:1,margin:0});slide.addText(heading,{x:.55,y:.62,w:12.2,h:.45,fontSize:22,bold:true,color:'17212B',margin:0,fit:'shrink'});if(sub)slide.addText(sub,{x:.55,y:1.14,w:12.1,h:.28,fontSize:8.5,color:'64748B',margin:0,fit:'shrink'});}
function addFooter(slide,n,logoData,classification){slide.addText(`${classification} · FICHTNER · ${n}/5`,{x:9.1,y:7.12,w:3.2,h:.14,fontSize:6.8,color:'64748B',margin:0,align:'right'});slide.addImage({data:logoData,x:.55,y:7.03,w:1.15,h:.15});}
function safeText(slide,text,opts){slide.addText(String(text||''),{...opts,breakLine:false,fit:'shrink'});}
function addSignalRows(slide,items,{x,y,w,rowH,max=4,mode='interpretation'}={}){
  const rows=items.slice(0,max);if(!rows.length){safeText(slide,mode==='fact'?'No corroborated facts with two distinct publishers in this period.':'No eligible signals in the selected period.',{x,y,w,h:.35,fontSize:9,color:'64748B',margin:0});return;}
  rows.forEach((signal,index)=>{const yy=y+index*rowH;slide.addShape('roundRect',{x,y:yy,w,h:rowH-.09,rectRadius:.04,line:{color:'DCE5EF',width:.7},fill:{color:'FFFFFF'}});safeText(slide,`${String(index+1).padStart(2,'0')} · ACTIONABILITY ${actionability(signal)}/100`,{x:x+.12,y:yy+.08,w:w-.24,h:.13,fontSize:6.6,bold:true,color:'005AAF',margin:0});safeText(slide,titleOf(signal),{x:x+.12,y:yy+.27,w:w-.24,h:.26,fontSize:8.1,bold:true,color:'17212B',margin:0});if(mode==='fact'){const p=publisherNames(signal);safeText(slide,`${p.names.join(' · ')} · ${fmtDate(signal.published||signal.date)}`,{x:x+.12,y:yy+.57,w:w-.24,h:.16,fontSize:6.7,color:'475569',margin:0});}else{safeText(slide,`Interpretation: ${interpretation(signal)}`,{x:x+.12,y:yy+.56,w:w-.24,h:rowH-.69,fontSize:7,color:'334155',margin:0});}}
  );
}
function addLogoData(){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=130;const context=canvas.getContext('2d');context.drawImage(img,0,0,1024,130);resolve(canvas.toDataURL('image/png'));}catch(error){reject(error);}};img.onerror=()=>reject(new Error('Local Fichtner logo could not be loaded.'));img.src=new URL('./vendor/fichtner-logo.svg',location.href).href;});}
async function loadData(){const [{developments=[]},{pipeline={}},{competitorNews=[]}]=await Promise.all([import('./data/developments.js?report=V5'),import('./data/pipeline.js?report=V5'),import('./data/competitor-news.js?report=V5')]);const signals=sanitizeSignals(rawSignals).filter(usable);return {signals:rankSignals(signals),developments,pipeline,competitorNews};}
function addCover(ppt,{type,period,classification,signalCount,factCount,logoData}){
  const slide=ppt.addSlide();slide.background={color:'FFFFFF'};slide.addShape('rect',{x:0,y:0,w:.14,h:7.5,line:{color:'005AAF',transparency:100},fill:{color:'005AAF'}});slide.addImage({data:logoData,x:.72,y:.62,w:2.45,h:.31});safeText(slide,'MOROCCO RENEWABLE ENERGY INTELLIGENCE',{x:.72,y:1.84,w:10.8,h:.26,fontSize:11,bold:true,charSpacing:1.3,color:'005AAF',margin:0});safeText(slide,type.toUpperCase(),{x:.72,y:2.42,w:11.6,h:.74,fontSize:28,bold:true,color:'17212B',margin:0});safeText(slide,period,{x:.72,y:3.42,w:10.7,h:.32,fontSize:15,color:'475569',margin:0});slide.addShape('line',{x:.72,y:4.15,w:4.1,h:0,line:{color:'005AAF',width:2}});safeText(slide,`${signalCount} eligible signals ranked by actionability · ${factCount} with corroboration from distinct publishers`,{x:.72,y:4.48,w:10.5,h:.34,fontSize:10,color:'334155',margin:0,fit:'shrink'});safeText(slide,classification,{x:.72,y:6.54,w:8,h:.2,fontSize:8.5,bold:true,color:'64748B',margin:0});addFooter(slide,1,logoData,classification);return slide;
}
function addFactsAndInterpretation(ppt,{signals,period,classification,logoData}){
  const slide=ppt.addSlide();addTitle(slide,'01 · Evidence & assessment','Confirmed facts and analyst interpretation',`${period} · Separate source corroboration from analysis; ranked by actionability.`);
  const facts=rankSignals(signals.filter(corroborated)),interpretations=rankSignals(signals);
  slide.addShape('roundRect',{x:.55,y:1.58,w:6.05,h:5.22,rectRadius:.05,line:{color:'BDD7F1',width:1},fill:{color:'F6FAFF'}});slide.addShape('roundRect',{x:6.78,y:1.58,w:6.0,h:5.22,rectRadius:.05,line:{color:'DCE5EF',width:1},fill:{color:'FFFFFF'}});
  safeText(slide,`CONFIRMED FACTS · ${facts.length}`,{x:.78,y:1.8,w:5.6,h:.24,fontSize:11,bold:true,color:'005AAF',margin:0});safeText(slide,'At least two distinct publisher identities per item',{x:.78,y:2.1,w:5.6,h:.2,fontSize:7,color:'64748B',margin:0});
  safeText(slide,`ANALYST INTERPRETATION · ${interpretations.length}`,{x:7.02,y:1.8,w:5.5,h:.24,fontSize:11,bold:true,color:'17212B',margin:0});safeText(slide,'Assessment is interpretive and requires commercial validation',{x:7.02,y:2.1,w:5.5,h:.2,fontSize:7,color:'64748B',margin:0});
  addSignalRows(slide,facts,{x:.78,y:2.47,w:5.58,rowH:.99,max:4,mode:'fact'});addSignalRows(slide,interpretations,{x:7.02,y:2.47,w:5.52,rowH:.99,max:4,mode:'interpretation'});addFooter(slide,2,logoData,classification);return {facts,interpretations};
}
function addMarketAndDevelopments(ppt,{signals,period,classification,logoData,developments}){
  const slide=ppt.addSlide();addTitle(slide,'02 · Market pulse','Developments and activity by theme',`${period} · The displayed development set excludes REVIEW and rejected signals.`);
  const themes=[['Solar & BESS',/solar|photovoltaic|pv|bess|battery|storage/i],['Grid & power infrastructure',/grid|transmission|substation|interconnection|electricity|power plant/i],['Hydrogen & PtX',/hydrogen|ammonia|ptx|power-to-x|electrolysis/i],['Wind',/wind|offshore wind|eolien|éolien/i],['Hydro & pumped storage',/hydro|pumped storage/i],['Policy & market',/regulation|policy|tariff|law|consultation|framework/i]];
  const counts=themes.map(([name,re])=>[name,signals.filter(s=>re.test(signalText(s))).length]),max=Math.max(1,...counts.map(row=>row[1]));
  counts.forEach(([name,value],i)=>{const y=1.63+i*.36;safeText(slide,name,{x:.7,y,w:2.65,h:.17,fontSize:7.4,bold:true,color:'334155',margin:0});slide.addShape('roundRect',{x:3.45,y:y+.01,w:3.3,h:.12,rectRadius:.02,line:{color:'E2E8F0',width:.4},fill:{color:'F1F5F9'}});if(value)slide.addShape('roundRect',{x:3.45,y:y+.01,w:3.3*value/max,h:.12,rectRadius:.02,line:{color:'005AAF',transparency:100},fill:{color:'005AAF'}});safeText(slide,String(value),{x:6.85,y,w:.4,h:.17,fontSize:7.2,bold:true,color:'005AAF',align:'right',margin:0});});
  safeText(slide,'ACTIONABILITY-RANKED DEVELOPMENTS',{x:7.55,y:1.62,w:4.95,h:.2,fontSize:9,bold:true,color:'005AAF',margin:0});
  const rows=signals.slice(0,5);rows.forEach((signal,i)=>{const y=1.96+i*.91;safeText(slide,`${i+1}. ${titleOf(signal)}`,{x:7.55,y,w:4.95,h:.27,fontSize:7.5,bold:true,color:'17212B',margin:0});safeText(slide,`Actionability ${actionability(signal)}/100 · Uncertainty: ${reportUncertainty(signal)}`,{x:7.55,y:y+.33,w:4.95,h:.43,fontSize:6.7,color:'475569',margin:0});});
  if(!rows.length)safeText(slide,'No eligible developments in this reporting period.',{x:7.55,y:2.05,w:4.9,h:.3,fontSize:8,color:'64748B',margin:0});
  const curated=(Array.isArray(developments)?developments:[]).filter(item=>String(item?.filterDecision||'KEEP').toUpperCase()!=='REVIEW').slice(0,2);if(curated.length)safeText(slide,`Curated register: ${curated.map(d=>escapeText(d.title||d.name||d.project)).filter(Boolean).join(' · ')}`,{x:.7,y:4.02,w:6.7,h:.48,fontSize:7,color:'64748B',margin:0,fit:'shrink'});
  addFooter(slide,3,logoData,classification);
}
function addOpportunityImplications(ppt,{signals,pipeline,period,classification,logoData}){
  const slide=ppt.addSlide();addTitle(slide,'03 · Opportunity implications','Where Fichtner can act',`${period} · Ranked by actionability; all interpretations require validation.`);
  const entries=Object.values(pipeline||{}).flat().filter(item=>String(item?.filterDecision||'KEEP').toUpperCase()!=='REVIEW').sort((a,b)=>(Number(b.actionabilityScore)||0)-(Number(a.actionabilityScore)||0));
  const high=signals.filter(s=>actionability(s)>=60).slice(0,4);
  const columns=[{title:'PIPELINE',items:entries.slice(0,5).map(item=>({title:item.name||item.title||'Opportunity',detail:item.nextAction||item.note||item.action||'Next action not recorded.',uncertainty:item.uncertainty||'Mandate, eligibility and procurement timeline require source confirmation.'}))},{title:'ANALYST ACTIONS',items:high.map(signal=>({title:titleOf(signal),detail:interpretation(signal),uncertainty:reportUncertainty(signal)}))}];
  columns.forEach((column,i)=>{const x=.65+i*6.18,w=5.95;slide.addShape('roundRect',{x,y:1.66,w,h:5.05,rectRadius:.05,line:{color:'DCE5EF',width:1},fill:{color:i?'FFFFFF':'F6FAFF'}});safeText(slide,column.title,{x:x+.22,y:1.9,w:w-.44,h:.25,fontSize:11,bold:true,color:'005AAF',margin:0});if(!column.items.length)safeText(slide,'No items available for this period.',{x:x+.22,y:2.35,w:w-.44,h:.3,fontSize:8,color:'64748B',margin:0});column.items.slice(0,5).forEach((item,j)=>{const yy=2.34+j*.82;safeText(slide,`${j+1}. ${escapeText(item.title)}`,{x:x+.22,y:yy,w:w-.44,h:.22,fontSize:8,bold:true,color:'17212B',margin:0});safeText(slide,`Interpretation: ${escapeText(item.detail)}`,{x:x+.22,y:yy+.25,w:w-.44,h:.23,fontSize:6.9,color:'334155',margin:0});safeText(slide,`Uncertainty: ${escapeText(item.uncertainty)}`,{x:x+.22,y:yy+.52,w:w-.44,h:.23,fontSize:6.5,color:'64748B',margin:0});});});addFooter(slide,4,logoData,classification);
}
function addCompetitorAndUncertainty(ppt,{signals,competitorNews,period,classification,logoData}){
  const slide=ppt.addSlide();addTitle(slide,'04 · Watchlist & confidence','Competitor signals and explicit uncertainty',`${period} · Review primary sources before external or commercial decisions.`);
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
  const competitorSignals=signals.filter(signal=>{const text=signalText(signal).toLowerCase();return COMPETITORS.some(name=>(ALIASES[name]||[name.toLowerCase()]).some(alias=>text.includes(alias)))&&date(signal.published||signal.detected)>=cutoff;}).slice(0,4);
  const records=[...(Array.isArray(competitorNews)?competitorNews:[]).filter(item=>String(item?.filterDecision||'KEEP').toUpperCase()!=='REVIEW'),...competitorSignals].sort((a,b)=>{const score=item=>Number(item?.actionabilityScore)||(String(item?.priority||'').toUpperCase()==='HIGH'?75:0);return score(b)-score(a)||(Date.parse(b?.published||b?.date||b?.detected||'')||0)-(Date.parse(a?.published||a?.date||a?.detected||'')||0);});
  safeText(slide,'COMPETITOR WATCH · LAST 30 DAYS',{x:.68,y:1.62,w:5.7,h:.22,fontSize:9,bold:true,color:'005AAF',margin:0});
  records.slice(0,5).forEach((item,i)=>{const y=1.98+i*.54;safeText(slide,titleOf(item),{x:.7,y,w:5.65,h:.2,fontSize:7.3,bold:true,color:'17212B',margin:0});safeText(slide,`${fmtDate(item.published||item.date||item.detected)} · ${escapeText(item.source||item.competitor||'Atlas signal')}`,{x:.7,y:y+.23,w:5.65,h:.15,fontSize:6.5,color:'64748B',margin:0});});if(!records.length)safeText(slide,'No eligible competitor signal in the 30-day window.',{x:.7,y:2,w:5.5,h:.3,fontSize:8,color:'64748B',margin:0});
  safeText(slide,'UNCERTAINTY REGISTER',{x:6.78,y:1.62,w:5.8,h:.22,fontSize:9,bold:true,color:'005AAF',margin:0});
  rankSignals(signals).slice(0,6).forEach((signal,i)=>{const y=1.98+i*.75;safeText(slide,`${i+1}. ${titleOf(signal)}`,{x:6.8,y,w:5.65,h:.2,fontSize:7.2,bold:true,color:'17212B',margin:0});safeText(slide,`Uncertainty: ${reportUncertainty(signal)}`,{x:6.8,y:y+.23,w:5.65,h:.36,fontSize:6.8,color:'475569',margin:0});});if(!signals.length)safeText(slide,'No eligible signals; uncertainty cannot be assessed from this reporting period.',{x:6.8,y:2,w:5.5,h:.3,fontSize:8,color:'64748B',margin:0});addFooter(slide,5,logoData,classification);
}
function install(){
  if(window.__atlasConsolidatedReportInstalled)return;window.__atlasConsolidatedReportInstalled=true;
  const typeInput=document.getElementById('reportType'),periodInput=document.getElementById('reportPeriod'),button=document.getElementById('downloadPpt');
  if(periodInput&&!periodInput.dataset.userEdited){periodInput.value=currentPeriod(typeInput?.value||'Weekly Intelligence Brief');}
  typeInput?.addEventListener('change',()=>{if(periodInput&&!periodInput.dataset.userEdited)periodInput.value=currentPeriod(typeInput.value);});
  periodInput?.addEventListener('input',()=>{periodInput.dataset.userEdited='true';});
  if(button)button.addEventListener('click',event=>{event.preventDefault();buildReport();});
  reportStatus(typeof window.PptxGenJS==='function'?'local PptxGenJS 3.12.0 ready · slide count 9 → 5':'local PowerPoint engine failed to load');
}
async function buildReport(){
  try{
    const Constructor=window.PptxGenJS;if(typeof Constructor!=='function')throw new Error('Local PowerPoint engine is unavailable. Reload the page and try again.');
    const type=document.getElementById('reportType')?.value||'Weekly Intelligence Brief',classification=document.getElementById('reportClassification')?.value||'Internal — Fichtner';
    const periodInput=document.getElementById('reportPeriod');if(periodInput&&!periodInput.value.trim())periodInput.value=currentPeriod(type);
    const period=periodInput?.value.trim()||currentPeriod(type),range=windowFor(type,period);
    reportStatus('preparing the evidence-led report…');
    const [{signals,developments,pipeline,competitorNews},logoData]=await Promise.all([loadData(),addLogoData()]);
    const eligible=rankSignals(signals.filter(signal=>within(signal,range))),facts=eligible.filter(corroborated);
    const ppt=new Constructor();ppt.layout='LAYOUT_WIDE';ppt.author='Atlas Intelligence';ppt.company='Fichtner';ppt.subject='Morocco Renewable Energy Intelligence';ppt.title=type;ppt.lang='en-US';
    addCover(ppt,{type,period,classification,signalCount:eligible.length,factCount:facts.length,logoData});
    addFactsAndInterpretation(ppt,{signals:eligible,period,classification,logoData});
    addMarketAndDevelopments(ppt,{signals:eligible,period,classification,logoData,developments});
    addOpportunityImplications(ppt,{signals:eligible,pipeline,period,classification,logoData});
    addCompetitorAndUncertainty(ppt,{signals:eligible,competitorNews,period,classification,logoData});
    const generatedSlideCount=Array.isArray(ppt._slides)?ppt._slides.length:TARGET_SLIDE_COUNT;
    if(generatedSlideCount!==TARGET_SLIDE_COUNT)throw new Error(`Expected ${TARGET_SLIDE_COUNT} slides, generated ${generatedSlideCount}.`);
    reportStatus('writing PowerPoint locally…');
    const filename=`Atlas_${type.replace(/[^a-z0-9]+/gi,'_')}_${period.replace(/[^a-z0-9]+/gi,'_')}.pptx`;
    await ppt.writeFile({fileName:filename});
    reportStatus(`ready · slides ${LEGACY_SLIDE_COUNT} → ${generatedSlideCount} · ${eligible.length} eligible · ${facts.length} corroborated`);
  }catch(error){console.error(error);reportStatus(`error · ${error.message||error}`);alert(`Atlas report generation failed: ${error.message||error}`);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
