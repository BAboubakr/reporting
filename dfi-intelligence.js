import { dfiInstitutions, dfiOpportunities, dfiWatchRules } from './data/dfi-opportunities.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const today=new Date(); today.setHours(0,0,0,0);
const dateValue=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?null:d};
const institution=id=>dfiInstitutions.find(x=>x.id===id)||{short:id,name:id,priority:0};
const scoreOpportunity=o=>{
  const text=`${o.title} ${o.sector} ${o.scope} ${o.tags?.join(' ')||''}`.toLowerCase();
  let score=Number(o.relevance)||0;
  if(dfiWatchRules.highFitTerms.some(t=>text.includes(t))) score+=4;
  if(dfiWatchRules.rejectTerms.some(t=>text.includes(t))) score-=20;
  if(o.country==='Morocco') score+=4;
  return Math.max(0,Math.min(100,score));
};
const ranked=dfiOpportunities.map(o=>({...o,computedScore:scoreOpportunity(o)})).sort((a,b)=>b.computedScore-a.computedScore);

function ensureUI(){
  const nav=document.querySelector('.nav-secondary');
  if(nav&&!nav.querySelector('[data-view="dfi"]')){
    const b=document.createElement('button'); b.className='nav-item'; b.dataset.view='dfi'; b.innerHTML='<span class="nav-icon">◈</span> DFI opportunities';
    nav.insertBefore(b,nav.querySelector('[data-view="reporting"]')||null);
    b.addEventListener('click',()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='dfi'));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view==='dfi'));});
  }
  if(!document.getElementById('dfi')){
    const main=document.querySelector('main.main'); if(!main)return;
    const section=document.createElement('section'); section.className='content view'; section.id='dfi';
    section.innerHTML=`<div class="page-heading"><div><p class="eyebrow">DEVELOPMENT FINANCE INTELLIGENCE</p><h1>DFI consulting opportunities</h1><p>Track Morocco opportunities and project-stage signals financed by institutions relevant to Fichtner.</p></div></div><div class="dfi-kpis" id="dfiKpis"></div><div class="dfi-layout"><section class="panel"><div class="panel-head"><div><p class="eyebrow">OPPORTUNITY PIPELINE</p><h3>Highest-fit DFI signals</h3></div><select id="dfiFilter"><option value="all">All institutions</option>${dfiInstitutions.map(x=>`<option value="${esc(x.id)}">${esc(x.short)}</option>`).join('')}</select></div><div id="dfiList" class="dfi-list"></div></section><aside class="panel"><p class="eyebrow">MONITORING UNIVERSE</p><h3>Priority DFIs</h3><div id="dfiInstitutions"></div></aside></div>`;
    main.appendChild(section);
    document.getElementById('dfiFilter').addEventListener('change',render);
  }
}

function render(){
  const filter=document.getElementById('dfiFilter')?.value||'all';
  const data=ranked.filter(o=>filter==='all'||o.institution===filter);
  const open=data.filter(o=>['open','pipeline','forecast','upcoming','eoi','rfp','tender'].includes(o.status)||['pipeline','forecast','upcoming','eoi','rfp','tender'].includes(o.stage.toLowerCase()));
  const high=data.filter(o=>o.computedScore>=80);
  const k=document.getElementById('dfiKpis');
  if(k)k.innerHTML=`<article><span>DFIs monitored</span><strong>${dfiInstitutions.length}</strong><small>Priority development-finance sources</small></article><article><span>Current / upcoming</span><strong>${open.length}</strong><small>Open procurement or forward signals</small></article><article><span>High-fit signals</span><strong>${high.length}</strong><small>Fichtner relevance ≥ 80</small></article><article><span>Energy / infrastructure</span><strong>${data.filter(o=>o.computedScore>=60).length}</strong><small>Signals worth commercial review</small></article>`;
  const list=document.getElementById('dfiList');
  if(list)list.innerHTML=data.map(o=>{const d=dateValue(o.deadline), expired=d&&d<today&&o.status!=='open'; const inst=institution(o.institution); return `<article class="dfi-card"><div class="dfi-card-top"><span class="dfi-badge">${esc(inst.short)}</span><span class="dfi-score">${o.computedScore}/100</span></div><h4>${esc(o.title)}</h4><p class="dfi-meta">${esc(o.sector)} · ${esc(o.stage)}</p><p>${esc(o.scope)}</p><div class="dfi-card-bottom"><span>${esc(o.fit)} fit</span><span>${d?`Deadline ${esc(o.deadline)}`:'No deadline'}</span><span>${expired?'Closed / monitor follow-on':'Actionable / monitor'}</span></div><p class="dfi-rationale">${esc(o.rationale)}</p><a href="${esc(o.source)}" target="_blank" rel="noopener">View source →</a></article>`}).join('')||'<div class="empty-state">No DFI signals match this filter.</div>';
  const box=document.getElementById('dfiInstitutions'); if(box)box.innerHTML=dfiInstitutions.map(x=>`<div class="dfi-inst"><strong>${esc(x.short)}</strong><span>${'★'.repeat(x.priority)}${'☆'.repeat(5-x.priority)}</span><small>${esc(x.focus)}</small></div>`).join('');
}

const style=document.createElement('style'); style.textContent=`.dfi-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.dfi-kpis article{padding:16px;border:1px solid #e7e9ec;border-radius:14px;background:#fff}.dfi-kpis span,.dfi-kpis small{display:block;color:#69717d;font-size:12px}.dfi-kpis strong{display:block;font-size:28px;margin:6px 0}.dfi-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px}.dfi-list{display:grid;gap:10px;padding:0 16px 16px}.dfi-card{border:1px solid #e7e9ec;border-radius:14px;padding:15px;background:#fff}.dfi-card-top,.dfi-card-bottom{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.dfi-badge{font-size:11px;font-weight:700;text-transform:uppercase}.dfi-score{font-weight:700}.dfi-card h4{margin:8px 0 5px}.dfi-card p{margin:5px 0;color:#555}.dfi-meta,.dfi-card-bottom{font-size:12px;color:#69717d}.dfi-rationale{font-size:12px}.dfi-card a{font-size:12px}.dfi-inst{padding:11px 0;border-bottom:1px solid #eee}.dfi-inst strong{display:inline-block;margin-right:8px}.dfi-inst span{font-size:11px}.dfi-inst small{display:block;color:#69717d;margin-top:4px}@media(max-width:800px){.dfi-kpis{grid-template-columns:repeat(2,1fr)}.dfi-layout{grid-template-columns:1fr}}@media(max-width:500px){.dfi-kpis{grid-template-columns:1fr}}`; document.head.appendChild(style);

function init(){ensureUI();render();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
