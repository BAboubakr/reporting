import { developments, eventData, pipeline, stakeholders, sources } from './data/index.js';

const $ = id => document.getElementById(id);
const flatPipeline = Object.values(pipeline).flat();

function renderAll(){
  if($('decisionGrid')) $('decisionGrid').innerHTML = developments.slice(0,3).map(d=>`<article class="decision-card"><div class="card-top"><span class="badge ${d.level}">${d.state}</span><span class="score">${d.score}</span></div><h3>${d.title}</h3><p>${d.text}</p><div class="card-foot"><span>${d.action}</span><span>${d.evidence}</span></div></article>`).join('');
  if($('eventPreview')) $('eventPreview').innerHTML = eventData.slice(0,2).map(e=>`<div class="event-mini"><div class="date-box"><b>${e.day}</b><span>${e.month}</span></div><div><strong>${e.name}</strong><small>${e.detail}</small></div></div>`).join('');
  if($('developmentList')) $('developmentList').innerHTML = developments.map(d=>`<article class="development-row"><span class="topic">${d.topic}</span><div><h3>${d.title}</h3><p>${d.text}</p></div><span class="verified">● ${d.state}</span><span class="score">${d.score}</span></article>`).join('');
  if($('pipelineBoard')) $('pipelineBoard').innerHTML = Object.entries(pipeline).map(([stage,items])=>`<section class="pipe-column"><h3>${stage}<span>${items.length}</span></h3>${items.map(i=>`<article class="pipe-card"><strong>${i.name}</strong><p>${i.note}</p><footer><span>Owner · ${i.owner}</span><span>Due ${i.due}</span></footer></article>`).join('')}</section>`).join('');
  if($('eventList')) $('eventList').innerHTML = eventData.map(e=>`<article class="event-large"><div class="event-date"><b>${e.day}</b><span>${e.month}</span></div><div><h3>${e.name}</h3><p>${e.detail}</p><small>${e.priority} →</small></div></article>`).join('');
  if($('stakeholderGrid')) $('stakeholderGrid').innerHTML = stakeholders.map(s=>`<article><span class="org-type">${s[1]}</span><h3>${s[0]}</h3><p>${s[2]}</p><small>${s[3]} →</small></article>`).join('');
  if($('sourceRows')) $('sourceRows').innerHTML = sources.map(s=>`<div class="source-row"><span>${s[0]}</span><span>${s[1]}</span><span>${s[2]}</span><span>${s[3]}</span></div>`).join('');
}

function setView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-view-target]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewTarget)));
const modal=$('modalBackdrop'); if(modal){$('newDevelopment').onclick=()=>modal.hidden=false;document.querySelector('.close-modal').onclick=()=>modal.hidden=true;modal.onclick=e=>{if(e.target===modal)modal.hidden=true};}
const mobile=document.querySelector('.mobile-menu');if(mobile)mobile.onclick=()=>document.querySelector('.sidebar').classList.toggle('open');

function renderReportPreview(){
  const type=$('reportType').value, period=$('reportPeriod').value.trim()||'Current period', classification=$('reportClassification').value;
  $('reportPreview').innerHTML=`<div class="report-cover"><span>ATLAS</span><p>MOROCCO RENEWABLE ENERGY INTELLIGENCE</p><h2>${type.replace(' ','<br>')}</h2><small>${period} · ${classification}</small></div><div class="report-page"><p class="eyebrow">01 · EXECUTIVE SUMMARY</p><h3>Signals that require a decision</h3><ol>${developments.slice(0,5).map(d=>`<li>${d.title}</li>`).join('')}</ol><p class="report-note">${developments.length} developments · ${flatPipeline.length} pipeline actions · ${eventData.length} engagement events · ${sources.length} source records.</p></div>`;
}
['reportType','reportPeriod','reportClassification'].forEach(id=>$(id)?.addEventListener('input',renderReportPreview));

$('printPdf').onclick=()=>window.print();
$('downloadPpt').onclick=async()=>{
  const status=$('reportStatus');
  status.textContent='Checking PowerPoint engine…';
  try{
    const Pptx = window.PptxGenJS || window.pptxgen;
    if(typeof Pptx !== 'function') throw new Error('PowerPoint engine did not load. Please refresh the page and try again.');
    status.textContent='Generating PowerPoint…';
    const pptx=new Pptx();
    pptx.layout='LAYOUT_WIDE';pptx.author='Atlas';pptx.company='Fichtner';pptx.subject='Morocco Renewable Energy Intelligence';pptx.title=$('reportType').value;
    const green='153A35',ink='16302C',muted='64716D';
    let s=pptx.addSlide();s.background={color:green};s.addText('ATLAS',{x:.6,y:.5,w:3,h:.3,fontSize:18,bold:true,color:'FFFFFF'});s.addText('MOROCCO RENEWABLE ENERGY INTELLIGENCE',{x:.6,y:2.0,w:10,h:.3,fontSize:10,color:'BFD8CE'});s.addText($('reportType').value,{x:.6,y:2.6,w:10,h:1,fontSize:30,bold:true,color:'FFFFFF'});s.addText(`${$('reportPeriod').value} · ${$('reportClassification').value}`,{x:.6,y:6.7,w:10,h:.3,fontSize:9,color:'BFD8CE'});
    s=pptx.addSlide();s.background={color:'FFFEFA'};s.addText('01 · EXECUTIVE SUMMARY',{x:.6,y:.5,w:5,h:.3,fontSize:9,color:'4D746B'});s.addText('Signals that require a decision',{x:.6,y:.9,w:10,h:.5,fontSize:25,bold:true,color:ink});developments.slice(0,5).forEach((d,i)=>s.addText(d.title,{x:.8,y:1.7+i*.75,w:11,h:.35,fontSize:13,color:ink,bullet:{indent:16}}));s.addText(`${developments.length} developments · ${flatPipeline.length} pipeline actions · ${eventData.length} events · ${sources.length} sources`,{x:.6,y:6.6,w:11,h:.25,fontSize:8,color:muted});
    s=pptx.addSlide();s.background={color:'FFFEFA'};s.addText('02 · OPPORTUNITY PIPELINE',{x:.6,y:.5,w:5,h:.3,fontSize:9,color:'4D746B'});s.addText('Priority actions',{x:.6,y:.9,w:10,h:.5,fontSize:25,bold:true,color:ink});flatPipeline.slice(0,6).forEach((a,i)=>{const y=1.6+i*.8;s.addText(a.name,{x:.8,y,w:8.5,h:.25,fontSize:12,bold:true,color:ink});s.addText(`${a.owner} · Due ${a.due}`,{x:9.4,y,w:2.5,h:.2,fontSize:8,color:'28745F',align:'right'});s.addText(a.note,{x:.8,y:y+.28,w:11,h:.2,fontSize:8,color:muted});});
    s=pptx.addSlide();s.background={color:'FFFEFA'};s.addText('03 · EVIDENCE & ENGAGEMENT',{x:.6,y:.5,w:5,h:.3,fontSize:9,color:'4D746B'});s.addText('Sources and connections',{x:.6,y:.9,w:10,h:.5,fontSize:25,bold:true,color:ink});sources.slice(0,5).forEach((x,i)=>s.addText(`${x[0]} · ${x[1]} · ${x[2]}`,{x:.8,y:1.6+i*.6,w:11,h:.3,fontSize:9,color:ink}));eventData.slice(0,3).forEach((e,i)=>s.addText(`${e.day} ${e.month} — ${e.name} — ${e.priority}`,{x:.8,y:5+i*.45,w:11,h:.25,fontSize:9,color:ink}));
    await pptx.writeFile({fileName:'Atlas_Morocco_Renewable_Intelligence_Brief.pptx'});status.textContent='PowerPoint downloaded successfully.';
  }catch(err){console.error(err);status.textContent='PowerPoint generation failed: '+(err?.message||err);}
};

renderAll();renderReportPreview();
