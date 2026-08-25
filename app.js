import { developments, eventData, pipeline, stakeholders, sources } from './data/index.js';

const $ = id => document.getElementById(id);
const flatPipeline = Object.values(pipeline).flat();

function renderAll(){
  if($('decisionGrid')) $('decisionGrid').innerHTML = developments.slice(0,3).map(d=>`<article class="decision-card"><div class="card-top"><span class="badge ${d.level}">${d.state}</span><span class="score">${d.score}</span></div><h3>${d.title}</h3><p>${d.text}</p></article>`).join('');
  if($('eventPreview')) $('eventPreview').innerHTML = eventData.slice(0,2).map(e=>`<div class="event-mini"><div class="date-box"><b>${e.day}</b><span>${e.month}</span></div><div><strong>${e.name}</strong><small>${e.priority}</small></div></div>`).join('');
  if($('developmentList')) $('developmentList').innerHTML = developments.map(d=>`<article class="development-row"><span class="topic">${d.topic}</span><div class="dev-content"><h4>${d.title}</h4><p>${d.text}</p></div><div class="dev-meta">${d.date||''}</div></article>`).join('');
  if($('pipelineBoard')) $('pipelineBoard').innerHTML = Object.entries(pipeline).map(([stage,items])=>`<section class="pipe-column"><h3>${stage}<span>${items.length}</span></h3>${items.map(i=>`<div class="pipe-item"><h4>${i.name}</h4><p>${i.note}</p><div class="pipe-meta"><span>${i.owner}</span><span>${i.due}</span></div></div>`).join('')}</section>`).join('');
  if($('eventList')) $('eventList').innerHTML = eventData.map(e=>`<article class="event-large"><div class="event-date"><b>${e.day}</b><span>${e.month}</span></div><div><h3>${e.name}</h3><p>${e.detail}</p><small class="event-priority">${e.priority}</small></div></article>`).join('');
  if($('stakeholderGrid')) $('stakeholderGrid').innerHTML = stakeholders.map(s=>`<article><span class="org-type">${s[1]}</span><h3>${s[0]}</h3><p>${s[2]}</p><small>${s[3]} →</small></article>`).join('');
  if($('sourceRows')) $('sourceRows').innerHTML = sources.map(s=>`<div class="source-row"><span>${s[0]}</span><span>${s[1]}</span><span>${s[2]}</span><span>${s[3]}</span></div>`).join('');
}

function setView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===id));
}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-view-target]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewTarget)));

// Modal: hidden by default. The CSS only displays it when .is-open is present.
(function setupModal(){
  const modal = $('modalBackdrop');
  const openBtn = $('newDevelopment');
  const closeBtn = modal?.querySelector('.close-modal');
  if(!modal) return;

  function openModal(){
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const firstInput = modal.querySelector('input, button, textarea');
    if(firstInput) firstInput.focus();
  }
  function closeModal(){
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // Force the initial state closed in case a previous cached script/CSS touched it.
  closeModal();
  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', e=>{ if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeModal(); });
})();

const mobile=document.querySelector('.mobile-menu');if(mobile)mobile.onclick=()=>document.querySelector('.sidebar').classList.toggle('open');

function renderReportPreview(){
  const type=$('reportType')?.value||'Weekly Intelligence Brief', period=$('reportPeriod')?.value.trim()||'Current period', classification=$('reportClassification')?.value||'';
  if($('reportPreview')) $('reportPreview').innerHTML=`<div class="report-cover"><span>ATLAS</span><p>MOROCCO RENEWABLE ENERGY INTELLIGENCE</p><h2>${type.replace(' ','<br>')}</h2><small>${period} · ${classification}</small></div>`;
}

['reportType','reportPeriod','reportClassification'].forEach(id=>$(id)?.addEventListener('input',renderReportPreview));

$('printPdf')?.addEventListener('click',()=>window.print());
$('downloadPpt')?.addEventListener('click',async()=>{
  const status=$('reportStatus');
  if(status) status.textContent='Checking PowerPoint engine…';
  try{
    const Pptx = window.PptxGenJS || window.pptxgen;
    if(typeof Pptx !== 'function') throw new Error('PowerPoint engine did not load. Please refresh the page and try again.');
    if(status) status.textContent='Generating PowerPoint…';
    const pptx=new Pptx();
    pptx.layout='LAYOUT_WIDE';pptx.author='Atlas';pptx.company='Fichtner';pptx.subject='Morocco Renewable Energy Intelligence';pptx.title=$('reportType')?.value||'Report';
    const green='153A35';
    let s=pptx.addSlide();s.background={color:green};s.addText('ATLAS',{x:.6,y:.5,w:3,h:.3,fontSize:18,bold:true,color:'FFFFFF'});s.addText('MOROCCO RENEWABLE ENERGY INTELLIGENCE',{x:.6,y:2.0,w:10});
    s=pptx.addSlide();s.background={color:'FFFEFA'};s.addText('01 · EXECUTIVE SUMMARY',{x:.6,y:.5,w:5,h:.3,fontSize:9,color:'4D746B'});s.addText('Signals that require a decision',{x:.6,y:.9,w:10});
    s=pptx.addSlide();s.background={color:'FFFEFA'};s.addText('02 · OPPORTUNITY PIPELINE',{x:.6,y:.5,w:5,h:.3,fontSize:9,color:'4D746B'});s.addText('Priority actions',{x:.6,y:.9,w:10});
    s=pptx.addSlide();s.background={color:'FFFEFA'};s.addText('03 · EVIDENCE & ENGAGEMENT',{x:.6,y:.5,w:5,h:.3,fontSize:9,color:'4D746B'});s.addText('Sources and connections',{x:.6,y:.9,w:10});
    await pptx.writeFile({fileName:'Atlas_Morocco_Renewable_Intelligence_Brief.pptx'});
    if(status) status.textContent='PowerPoint downloaded successfully.';
  }catch(err){
    console.error(err);
    if($('reportStatus')) $('reportStatus').textContent='PowerPoint generation failed: '+(err?.message||err);
  }
});

renderAll();renderReportPreview();
