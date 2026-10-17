import { deduplicateEvents } from './data/event-deduplicator.js';

export function escapeReportHtml(value='') {
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function safeHttpUrl(value) {
  try { const url=new URL(String(value||'')); return /^https?:$/.test(url.protocol)?url.href:''; }
  catch { return ''; }
}

function displayDate(value) {
  if(!value)return 'Not reported';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
}

function formatValue(value) {
  if(value&&typeof value==='object'){
    return [value.amount??value.value??value.number,value.unit,value.currency].filter(Boolean).join(' ');
  }
  return String(value??'');
}

function sourcesFor(signal) {
  if(Array.isArray(signal?.sources)&&signal.sources.length)return signal.sources;
  return signal?.url?[{url:signal.url,source:signal.source,headline:signal.headline||signal.title,published:signal.published||signal.detected}]:[];
}

function score(signal) {
  return (Number(signal?.qualityScore)||0)*2+(Number(signal?.relevanceScore)||0)+
    (Number(signal?.actionabilityScore)||0)+(String(signal?.fichtnerRelevance).toUpperCase()==='HIGH'?50:0);
}

function eventCard(signal,index) {
  const title=signal.title||signal.headline||signal.signal||'Untitled development';
  const tags=[signal.signalType,signal.projectStage,...(Array.isArray(signal.categories)?signal.categories:[signal.categories])].filter(Boolean);
  const facts=[];
  const organizations=Array.isArray(signal.entities)?signal.entities.filter(Boolean).join(', '):signal.organizations;
  for(const [label,value] of [['Project',signal.project||signal.projectName],['Organizations',organizations],['Location',signal.location||signal.region],
    ['Capacity',signal.capacity],['Value',signal.financialValue],['Stage',signal.projectStage],
    ['Event date',signal.eventDate],['Published',signal.published]])if(value)facts.push('<div><dt>'+escapeReportHtml(label)+'</dt><dd>'+escapeReportHtml(label==='Event date'||label==='Published'?displayDate(value):formatValue(value))+'</dd></div>');
  const sourceLinks=sourcesFor(signal).map(source=>{
    const url=safeHttpUrl(source.url||source.originalUrl); if(!url)return '';
    const publisher=source.source||source.publication||source.publisher||'Source';
    const info=[source.published||source.publicationDate?displayDate(source.published||source.publicationDate):'',source.headline||source.title||''].filter(Boolean).join(' · ');
    return '<li><a href="'+escapeReportHtml(url)+'">'+escapeReportHtml(publisher)+'</a>'+(info?'<span>'+escapeReportHtml(info)+'</span>':'')+'</li>';
  }).filter(Boolean).join('');
  const why=String(signal.whyItMatters||'').trim();
  const assessment=why&&!/^(?:market movement|tender|partnership|investment|project announcement|manufacturing) signal relevant to morocco renewable-energy activity(?:; .*)?$/i.test(why)
    ?'<div class="assessment"><b>Atlas assessment · analytical</b><p>'+escapeReportHtml(why)+'</p></div>':'';
  const description=signal.summary||signal.evidenceSnippet||signal.text||'Source summary was not supplied.';
  const sourceCount=sourcesFor(signal).length;
  return '<article class="event-card"><div class="event-top"><span>'+String(index+1).padStart(2,'0')+'</span><span>'+escapeReportHtml(signal.fichtnerRelevance||signal.priority||'WATCH')+'</span></div>'+
    '<h3>'+escapeReportHtml(title)+'</h3>'+(tags.length?'<p class="tags">'+tags.map(tag=>'<span>'+escapeReportHtml(tag)+'</span>').join('')+'</p>':'')+
    '<p>'+escapeReportHtml(description)+'</p>'+(facts.length?'<dl class="facts">'+facts.join('')+'</dl>':'')+assessment+
    (sourceLinks?'<div class="sources"><b>Evidence · '+sourceCount+' source'+(sourceCount===1?'':'s')+'</b><ul>'+sourceLinks+'</ul></div>':'')+'</article>';
}

function pipelineCards(pipeline,signals) {
  const known=new Set(signals.flatMap(signal=>[signal.id,signal.eventId].filter(Boolean).map(String)));
  return Object.values(pipeline||{}).flat().filter(Boolean).filter(item=>{
    const linked=String(item.signalId||item.eventId||'');
    return !linked||!known.has(linked);
  }).slice(0,8).map(item=>{
    const url=safeHttpUrl(item.source);
    return '<article class="pipeline-item"><h3>'+escapeReportHtml(item.name||item.title||'Opportunity')+'</h3><p>'+
      escapeReportHtml(item.note||item.text||item.action||'Follow-up details were not supplied.')+'</p><small>'+
      escapeReportHtml(item.owner||'Unassigned')+' · '+escapeReportHtml(item.due||'No due date')+'</small>'+
      (url?'<a href="'+escapeReportHtml(url)+'">Open source</a>':'')+'</article>';
  }).join('');
}

export function buildPdfReport({signals=[],pipeline={},reportType='Weekly Intelligence Brief',reportPeriod='',classification='Internal — Fichtner',generatedAt=new Date()}={}) {
  const ranked=deduplicateEvents(Array.isArray(signals)?signals:[]).sort((a,b)=>score(b)-score(a)||
    (Date.parse(b.published||b.detected||0)||0)-(Date.parse(a.published||a.detected||0)||0)).slice(0,10);
  const sourceCount=ranked.reduce((n,event)=>n+sourcesFor(event).length,0);
  const generated=displayDate(generatedAt);
  const executive=ranked.slice(0,3).map(event=>'<li><b>'+escapeReportHtml(event.title||event.headline||'Development')+'</b><span>'+
    escapeReportHtml(event.summary||event.evidenceSnippet||'')+'</span></li>').join('');
  const pipelineHtml=pipelineCards(pipeline,ranked);
  const methodology='Events are grouped using canonical source URLs, stable source identifiers, distinctive article text, and corroborated project, stage, organization, location, capacity and date fields. Different event types or project stages are kept separate. When confidence is insufficient, records remain separate for human review. This brief uses the records available to Atlas at generation time; it does not independently verify source claims.';
  const css='<style>'+
    '@page{size:A4;margin:16mm 15mm 19mm;@bottom-left{content:"ATLAS · MOROCCO RENEWABLE ENERGY INTELLIGENCE";font:8pt Arial,sans-serif;color:#71807e}@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt Arial,sans-serif;color:#71807e}}'+
    '#atlasPdfReportHost{display:none;color:#233431;font:10pt/1.45 Arial,Helvetica,sans-serif}#atlasPdfReportHost *{box-sizing:border-box}'+
    '#atlasPdfReportHost .cover{min-height:255mm;display:flex;flex-direction:column;justify-content:space-between;padding:18mm 12mm 12mm;background:#173b37;color:#fff;page-break-after:always}'+
    '#atlasPdfReportHost .brand{font-size:13pt;font-weight:700;letter-spacing:2px}#atlasPdfReportHost .brand span{display:block;margin-top:2mm;font-size:8pt;font-weight:400;letter-spacing:1px;color:#c7dbd6}'+
    '#atlasPdfReportHost h1{max-width:150mm;margin:0;font-size:29pt;line-height:1.12}#atlasPdfReportHost h2{margin:0;color:#173b37;font-size:19pt;line-height:1.2}'+
    '#atlasPdfReportHost h3{margin:1mm 0 2mm;color:#173b37;font-size:12pt;line-height:1.3;overflow-wrap:anywhere}#atlasPdfReportHost p{margin:2mm 0;color:#40504c}'+
    '#atlasPdfReportHost .cover-meta{border-top:1px solid #8ca8a2;padding-top:5mm;display:grid;grid-template-columns:1fr 1fr;gap:4mm 12mm;color:#e2ece9}'+
    '#atlasPdfReportHost .cover-meta b{display:block;font-size:7.5pt;letter-spacing:.7px;text-transform:uppercase;color:#b9d7d1}#atlasPdfReportHost .cover-meta span{display:block;margin-top:1mm;font-size:10pt}'+
    '#atlasPdfReportHost .pdf-page{max-width:180mm;margin:0 auto}#atlasPdfReportHost .section{margin:0 0 9mm}#atlasPdfReportHost .section-heading{margin:0 0 4mm;border-bottom:1px solid #b8c8c4;padding:0 0 2mm;break-after:avoid-page}'+
    '#atlasPdfReportHost .section-heading p{margin:0 0 1mm;color:#2c6e68;font-size:8pt;font-weight:700;letter-spacing:1px;text-transform:uppercase}#atlasPdfReportHost .subhead{margin:1mm 0 0;color:#657477;font-size:9pt}'+
    '#atlasPdfReportHost .executive-list{padding:0;list-style:none}#atlasPdfReportHost .executive-list li{border-left:2px solid #2c6e68;margin:0 0 4mm;padding-left:4mm;break-inside:avoid}#atlasPdfReportHost .executive-list span{display:block;margin-top:1mm;color:#556562}'+
    '#atlasPdfReportHost .event-card,.pipeline-item{border:1px solid #d4dfdc;border-radius:2mm;padding:4mm;margin:0 0 4mm;break-inside:avoid}#atlasPdfReportHost .event-top{display:flex;justify-content:space-between;color:#2c6e68;font-size:8pt;font-weight:700;letter-spacing:.4px;text-transform:uppercase}'+
    '#atlasPdfReportHost .tags{display:flex;flex-wrap:wrap;gap:1.5mm;margin:0 0 2mm}#atlasPdfReportHost .tags span{border:1px solid #d4dfdc;border-radius:10mm;padding:1px 2mm;color:#53615f;font-size:7.5pt}'+
    '#atlasPdfReportHost .facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm;margin:3mm 0}#atlasPdfReportHost .facts div{min-width:0;border-top:1px solid #e4ebe9;padding-top:1.5mm}#atlasPdfReportHost dt{color:#71807e;font-size:7pt;font-weight:700;text-transform:uppercase}#atlasPdfReportHost dd{margin:0;overflow-wrap:anywhere}'+
    '#atlasPdfReportHost .assessment{border-left:2px solid #829a95;margin:3mm 0;padding:1mm 0 1mm 3mm;color:#42514e}#atlasPdfReportHost .assessment b{font-size:8pt;color:#61736f}#atlasPdfReportHost .assessment p{margin:1mm 0 0}'+
    '#atlasPdfReportHost .sources{border-top:1px solid #e4ebe9;margin-top:3mm;padding-top:2mm}#atlasPdfReportHost .sources>b{font-size:8pt;color:#53615f}#atlasPdfReportHost .sources ul{margin:1mm 0 0;padding-left:5mm}#atlasPdfReportHost .sources li{margin:1mm 0;overflow-wrap:anywhere}'+
    '#atlasPdfReportHost .sources a,.pipeline-item>a{color:#1d625d;text-decoration:underline}#atlasPdfReportHost .sources li span{display:block;color:#71807e;font-size:8pt}#atlasPdfReportHost .pipeline-item small{display:block;color:#71807e;margin-bottom:2mm}'+
    '#atlasPdfReportHost .methodology{border:1px solid #d4dfdc;background:#f5f8f7;padding:4mm;color:#566562;font-size:8.5pt}#atlasPdfReportHost .empty{border:1px dashed #b8c8c4;padding:6mm;color:#667572}#atlasPdfReportHost .report-end{margin-top:8mm;padding-top:3mm;border-top:1px solid #d4dfdc;color:#71807e;font-size:8pt}'+
    '@media print{body.atlas-printing>*:not(#atlasPdfReportHost){display:none!important}body.atlas-printing #atlasPdfReportHost{display:block!important}body.atlas-printing{margin:0;background:white}#atlasPdfReportHost .pdf-toolbar{display:none!important}#atlasPdfReportHost .cover{min-height:255mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}#atlasPdfReportHost a{color:#1d625d}}'+
    '@media screen{body.atlas-printing #atlasPdfReportHost{display:block;position:fixed;z-index:10000;inset:0;overflow:auto;background:#edf2f0;padding:18mm 12mm}.pdf-toolbar{position:sticky;top:0;margin:-12mm -6mm 8mm;padding:3mm 6mm;background:#173b37;color:#fff;z-index:2}.pdf-toolbar button{margin-left:3mm;padding:2mm 4mm;border:0;border-radius:1mm;background:#fff;color:#173b37;font-weight:700;cursor:pointer}.pdf-preview-page{max-width:210mm;margin:0 auto 10mm;background:#fff;box-shadow:0 2px 16px #0002}.pdf-preview-page .cover{min-height:297mm}}'+
    '</style>';
  const cover='<section class="cover"><div class="brand">ATLAS<span>MOROCCO RENEWABLE ENERGY INTELLIGENCE</span></div><div><h1>'+
    escapeReportHtml(reportType)+'</h1><p>'+escapeReportHtml(reportPeriod||'Current reporting period')+'</p></div><div class="cover-meta">'+
    '<div><b>Reporting period</b><span>'+escapeReportHtml(reportPeriod||'Current period')+'</span></div>'+
    '<div><b>Generated</b><span>'+escapeReportHtml(generated)+'</span></div>'+
    '<div><b>Classification</b><span>'+escapeReportHtml(classification)+'</span></div>'+
    '<div><b>Developments</b><span>'+ranked.length+' selected · '+sourceCount+' source records</span></div></div></section>';
  const executiveSection='<section class="section"><header class="section-heading"><p>Executive intelligence brief</p><h2>What changed</h2><div class="subhead">'+
    ranked.length+' distinct event'+(ranked.length===1?'':'s')+' selected from the deduplicated Atlas signal set.</div></header>'+
    (executive?'<ol class="executive-list">'+executive+'</ol>':'<div class="empty">No qualifying developments were available in the selected reporting period.</div>')+'</section>';
  const developments='<section class="section"><header class="section-heading"><p>Ranked by Atlas evidence and relevance scores</p><h2>Key developments</h2><div class="subhead">Reported facts, Atlas interpretation and source evidence are shown separately.</div></header>'+
    (ranked.length?ranked.map(eventCard).join(''):'<div class="empty">No developments to report.</div>')+'</section>';
  const pipelineSection=pipelineHtml?'<section class="section"><header class="section-heading"><p>Commercial follow-up</p><h2>Pipeline actions</h2><div class="subhead">Pipeline entries linked to a listed event are omitted to avoid repeating the same development.</div></header>'+pipelineHtml+'</section>':'';
  const sourcesSection='<section class="section"><header class="section-heading"><p>Evidence and caveats</p><h2>Sources &amp; methodology</h2></header><div class="methodology">'+
    escapeReportHtml(methodology)+'<br><br>Each listed source link points to its original article. Publication date and event date remain separate where supplied. An award is not inferred from a tender announcement; proposals and reported plans are not described as committed investment unless the source record says so.</div>'+
    '<p class="report-end">Atlas · Morocco Renewable Energy Intelligence · '+escapeReportHtml(classification)+' · Generated '+escapeReportHtml(generated)+'</p></section>';
  return css+'<div class="pdf-toolbar"><b>PDF report preview</b><button type="button" data-atlas-print>Print / Save as PDF</button><button type="button" data-atlas-close>Close</button></div><main class="pdf-preview-page">'+cover+
    '<div class="pdf-page">'+executiveSection+developments+pipelineSection+sourcesSection+'</div></main>';
}

