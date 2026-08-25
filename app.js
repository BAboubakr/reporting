import PptxGenJS from 'https://esm.sh/pptxgenjs@3.12.0';
import { developments, eventData, pipeline, stakeholders, sources } from './data/index.js';

const $ = (id) => document.getElementById(id);
function card(d) { return `<article class="decision-card"><div class="card-top"><span class="badge ${d.level}">${d.state}</span><span class="score">${d.score}</span></div><h3>${d.title}</h3><p>${d.text}</p><div class="card-foot"><span>${d.action}</span><span>${d.evidence}</span></div></article>`; }
$('decisionGrid').innerHTML = developments.slice(0,3).map(card).join('');
$('eventPreview').innerHTML = eventData.slice(0,2).map(e=>`<div class="event-mini"><div class="date-box"><b>${e.day}</b><span>${e.month}</span></div><div><strong>${e.name}</strong><small>${e.detail}</small></div></div>`).join('');
$('developmentList').innerHTML = developments.map(d=>`<article class="development-row"><span class="topic">${d.topic}</span><div><h3>${d.title}</h3><p>${d.text}</p></div><span class="verified">● ${d.state}</span><span class="score">${d.score}</span></article>`).join('');
$('pipelineBoard').innerHTML = Object.entries(pipeline).map(([stage,items])=>`<section class="pipe-column"><h3>${stage}<span>${items.length}</span></h3>${items.map(i=>`<article class="pipe-card"><strong>${i.name}</strong><p>${i.note}</p><footer><span>Owner · ${i.owner}</span><span>Due ${i.due}</span></footer></article>`).join('')}</section>`).join('');
$('eventList').innerHTML = eventData.map(e=>`<article class="event-large"><div class="event-date"><b>${e.day}</b><span>${e.month}</span></div><div><h3>${e.name}</h3><p>${e.detail}</p><small>${e.priority} →</small></div></article>`).join('');
let days = ['31','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','1','2','3','4'];
$('calendarDays').innerHTML = days.map((d,i)=>`<span class="${i===0||i>30?'muted':''} ${['4','12','18'].includes(d)&&i<31?'has-event':''}">${d}</span>`).join('');
$('stakeholderGrid').innerHTML = stakeholders.map(s=>`<article><span class="org-type">${s[1]}</span><h3>${s[0]}</h3><p>${s[2]}</p><small>${s[3]} →</small></article>`).join('');
$('sourceRows').innerHTML = sources.map(s=>`<div class="source-row"><span>${s[0]}</span><span>${s[1]}</span><span>${s[2]}</span><span>${s[3]}</span></div>`).join('');
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-view-target]').forEach(button => button.addEventListener('click', () => setView(button.dataset.viewTarget)));
function setView(id){ document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id)); document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===id)); document.querySelector('.sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'}); }
const modal = $('modalBackdrop'); $('newDevelopment').onclick=()=>modal.hidden=false; document.querySelector('.close-modal').onclick=()=>modal.hidden=true; modal.onclick=e=>{if(e.target===modal)modal.hidden=true}; document.querySelector('.mobile-menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');

function renderReportPreview(){
  const type=$('reportType').value, period=$('reportPeriod').value.trim() || 'Current period', classification=$('reportClassification').value;
  $('reportPreview').innerHTML=`<div class="report-cover"><span>ATLAS</span><p>MOROCCO RENEWABLE ENERGY INTELLIGENCE</p><h2>${type.replace(' ','<br />')}</h2><small>${period} · ${classification}</small></div><div class="report-page"><p class="eyebrow">01 · EXECUTIVE SUMMARY</p><h3>Signals that require a decision</h3><ol>${developments.slice(0,3).map(d=>`<li>${d.title}</li>`).join('')}</ol><p class="report-note">${developments.length} developments · ${Object.values(pipeline).flat().length} pipeline actions · ${eventData.length} engagement events · ${sources.length} source records.</p></div>`;
}
['reportType','reportPeriod','reportClassification'].forEach(id=>$(id).addEventListener('input',renderReportPreview));
renderReportPreview();

$('printPdf').onclick=()=>window.print();
$('downloadPpt').onclick=async()=>{
  const status=$('reportStatus');
  try{
    status.textContent='Generating PowerPoint…';
    const pptx=new PptxGenJS();
    pptx.layout='LAYOUT_WIDE'; pptx.author='Atlas'; pptx.subject='Morocco Renewable Energy Intelligence'; pptx.title=$('reportType').value; pptx.company='Fichtner';
    const green='153A35',lime='D9E858',ink='16302C',muted='64716D';
    let slide=pptx.addSlide(); slide.background={color:green};
    slide.addText('ATLAS',{x:.55,y:.42,w:3,h:.35,fontFace:'Aptos Display',fontSize:18,bold:true,color:'FFFFFF',charSpacing:2});
    slide.addShape(pptx.ShapeType.rect,{x:11.7,y:.48,w:.55,h:.08,line:{color:lime},fill:{color:lime}});
    slide.addText('MOROCCO RENEWABLE ENERGY INTELLIGENCE',{x:.55,y:2.1,w:9,h:.3,fontFace:'Aptos',fontSize:10,color:'BFD8CE',charSpacing:1.3});
    slide.addText($('reportType').value,{x:.55,y:2.52,w:8.8,h:1.25,fontFace:'Aptos Display',fontSize:30,bold:true,color:'FFFFFF',fit:'shrink'});
    slide.addText(`${$('reportPeriod').value} · ${$('reportClassification').value}`,{x:.55,y:6.75,w:9,h:.25,fontFace:'Aptos',fontSize:9,color:'BFD8CE'});
    slide=pptx.addSlide(); slide.background={color:'FFFEFA'};
    slide.addText('01 · EXECUTIVE SUMMARY',{x:.6,y:.5,w:4,h:.25,fontFace:'Aptos',fontSize:9,color:'4D746B',charSpacing:1});
    slide.addText('Signals that require a decision',{x:.6,y:.9,w:10,h:.5,fontFace:'Aptos Display',fontSize:25,bold:true,color:ink});
    developments.slice(0,5).forEach((d,index)=>slide.addText(d.title,{x:.85,y:1.65+index*.75,w:10.8,h:.4,fontFace:'Aptos',fontSize:14,color:'435B54',bullet:{indent:16},fit:'shrink'}));
    slide.addText(`Tracker: ${developments.length} developments · ${Object.values(pipeline).flat().length} pipeline actions · ${eventData.length} events · ${sources.length} sources`,{x:.6,y:6.55,w:11.5,h:.3,fontFace:'Aptos',fontSize:8,color:muted});
    slide=pptx.addSlide(); slide.background={color:'FFFEFA'};
    slide.addText('02 · PRIORITY ACTIONS',{x:.6,y:.5,w:4,h:.25,fontFace:'Aptos',fontSize:9,color:'4D746B',charSpacing:1});
    slide.addText('Fichtner opportunity pipeline',{x:.6,y:.9,w:10,h:.5,fontFace:'Aptos Display',fontSize:25,bold:true,color:ink});
    const actions=Object.values(pipeline).flat().slice(0,6);
    actions.forEach((a,index)=>{const y=1.55+index*0.82;slide.addText(a.name,{x:.75,y,w:8.5,h:.25,fontFace:'Aptos',fontSize:12,bold:true,color:ink,fit:'shrink'});slide.addText(`${a.owner} · Due ${a.due}`,{x:9.4,y:y+.02,w:2.7,h:.2,fontFace:'Aptos',fontSize:8,color:'28745F',align:'right'});slide.addText(a.note,{x:.75,y:y+.29,w:11.2,h:.22,fontFace:'Aptos',fontSize:8,color:muted,fit:'shrink'});});
    slide=pptx.addSlide(); slide.background={color:'FFFEFA'};
    slide.addText('03 · EVIDENCE & ENGAGEMENT',{x:.6,y:.5,w:5,h:.25,fontFace:'Aptos',fontSize:9,color:'4D746B',charSpacing:1});
    slide.addText('Sources and next connections',{x:.6,y:.9,w:10,h:.5,fontFace:'Aptos Display',fontSize:25,bold:true,color:ink});
    sources.slice(0,5).forEach((s,index)=>slide.addText(`${s[0]} · ${s[1]} · ${s[2]}`,{x:.8,y:1.6+index*.6,w:11,h:.3,fontFace:'Aptos',fontSize:10,color:'435B54',bullet:{indent:16},fit:'shrink'}));
    eventData.slice(0,3).forEach((e,index)=>slide.addText(`${e.day} ${e.month} — ${e.name} — ${e.priority}`,{x:.8,y:5.0+index*.45,w:11,h:.25,fontFace:'Aptos',fontSize:9,color:ink,fit:'shrink'}));
    await pptx.writeFile({fileName:'Atlas_Morocco_Renewable_Intelligence_Brief.pptx'});
    status.textContent='PowerPoint downloaded successfully.';
  }catch(error){ console.error(error); status.textContent=`PowerPoint generation failed: ${error.message || 'unknown browser error'}.`; }
};
