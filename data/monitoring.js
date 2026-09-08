import { dfiInstitutions, dfiOpportunities, dfiWatchRules } from './dfi-opportunities.js';

const monitoring = {
  lookbackDays: 30,
  maxItems: 120,
  marketQueries: [
    'Morocco renewable energy solar PV BESS battery wind hydrogen grid tender',
    'Morocco MASEN renewable tender project',
    'Morocco ONEE grid transmission renewable tender',
    'Morocco ANRE electricity regulation renewable',
    'Morocco green hydrogen ammonia PtX investment',
    'Morocco renewable energy manufacturing investment'
  ],
  competitorQueries: [
    'AFRY Morocco renewable energy','Artelia Morocco renewable energy','Tractebel Morocco energy renewable hydrogen',
    'Mott MacDonald Morocco energy renewable','WSP Morocco energy renewable','Worley Morocco hydrogen OCP energy',
    'Egis Morocco energy renewable','ILF Consulting Engineers Morocco hydrogen energy','DNV Morocco renewable energy grid hydrogen',
    'NOVEC Morocco energy renewable grid hydro','INGEMA Morocco energy engineering renewable',
    'JESA Morocco renewable energy solar OCP','JESA Morocco engineering energy infrastructure','JESA OCP solar project'
  ],
  dfiQueries: [
    'AfDB Morocco energy renewable consultant procurement project',
    'KfW Morocco renewable energy consultant tender climate',
    'AFD Maroc énergie renouvelable appel offres consultant',
    'EIB Morocco energy technical assistance consultant procurement',
    'World Bank Morocco energy consultant procurement renewable',
    'IsDB Morocco energy consultant procurement ONEE renewable',
    'EBRD Morocco energy consultant procurement renewable',
    'EU Global Gateway Morocco energy technical assistance consultant',
    'GIZ Morocco energy transition technical assistance consultant'
  ],
  officialPages: [
    {name:'ONEE tenders',url:'https://www.one.org.ma/FR/pages/aoselect.asp?action=1&domaine=&esp=2&id1=7&id2=64&id3=54&nao=&nature=&objet=&page=1&t1=&t2=&t3=1&type=',type:'official-tender'},
    {name:'ONEE tender results',url:'https://www.one.org.ma/fr/pages/result.asp?esp=2&id1=7&id2=64&id3=56&page=1&t2=1&t3=1',type:'official-result'},
    {name:'MASEN e-Tendering',url:'https://etendering.masen.ma/',type:'official-procurement'},
    {name:'AfDB procurement / consultants',url:'https://www.afdb.org/en/projects-and-operations/procurement',type:'dfi-procurement'},
    {name:'KfW procurement',url:'https://www.kfw-entwicklungsbank.de/International-financing/KfW-Development-Bank/Procurement/',type:'dfi-procurement'},
    {name:'AFD procurement',url:'https://www.afd.fr/en/procurement',type:'dfi-procurement'},
    {name:'EIB technical assistance procurement',url:'https://www.eib.org/en/about/procurement/technical-assistance',type:'dfi-procurement'},
    {name:'World Bank procurement opportunities',url:'https://projects.worldbank.org/en/projects-operations/opportunities',type:'dfi-procurement'},
    {name:'IsDB project procurement',url:'https://www.isdb.org/project-procurement',type:'dfi-procurement'},
    {name:'EBRD procurement',url:'https://www.ebrd.com/work-with-us/procurement.html',type:'dfi-procurement'}
  ]
};

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const score=o=>{const t=`${o.title} ${o.sector} ${o.scope} ${(o.tags||[]).join(' ')}`.toLowerCase();let n=Number(o.relevance)||0;if(dfiWatchRules.highFitTerms.some(x=>t.includes(x)))n+=4;if(dfiWatchRules.rejectTerms.some(x=>t.includes(x)))n-=20;if(o.country==='Morocco')n+=4;return Math.max(0,Math.min(100,n));};

function injectDfiView(){
  if(document.getElementById('dfi'))return;
  const nav=document.querySelector('.nav-secondary');
  if(nav&&!nav.querySelector('[data-view="dfi"]')){
    const b=document.createElement('button');b.className='nav-item';b.dataset.view='dfi';b.innerHTML='<span class="nav-icon">◈</span> DFI opportunities';
    nav.insertBefore(b,nav.querySelector('[data-view="reporting"]')||null);
    b.addEventListener('click',()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='dfi'));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view==='dfi'));});
  }
  const main=document.querySelector('main.main');if(!main)return;
  const s=document.createElement('section');s.className='content view';s.id='dfi';
  s.innerHTML=`<div class="page-heading"><div><p class="eyebrow">DEVELOPMENT FINANCE INTELLIGENCE</p><h1>DFI consulting opportunities</h1><p>Morocco procurement and project-stage signals from development-finance institutions, scored for Fichtner relevance.</p></div></div><div class="dfi-kpis" id="dfiKpis"></div><div class="dfi-layout"><section class="panel"><div class="panel-head"><div><p class="eyebrow">OPPORTUNITY PIPELINE</p><h3>Highest-fit DFI signals</h3></div><select id="dfiFilter"><option value="all">All institutions</option>${dfiInstitutions.map(x=>`<option value="${esc(x.id)}">${esc(x.short)}</option>`).join('')}</select></div><div id="dfiList" class="dfi-list"></div></section><aside class="panel"><p class="eyebrow">MONITORING UNIVERSE</p><h3>Priority DFIs</h3><div id="dfiInstitutions"></div></aside></div>`;
  main.appendChild(s);
  const style=document.createElement('style');style.textContent='.dfi-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.dfi-kpis article{padding:16px;border:1px solid #e7e9ec;border-radius:14px;background:#fff}.dfi-kpis span,.dfi-kpis small{display:block;color:#69717d;font-size:12px}.dfi-kpis strong{display:block;font-size:28px;margin:6px 0}.dfi-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px}.dfi-list{display:grid;gap:10px;padding:0 16px 16px}.dfi-card{border:1px solid #e7e9ec;border-radius:14px;padding:15px;background:#fff}.dfi-card-top,.dfi-card-bottom{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.dfi-badge{font-size:11px;font-weight:700;text-transform:uppercase}.dfi-score{font-weight:700}.dfi-card h4{margin:8px 0 5px}.dfi-card p{margin:5px 0;color:#555}.dfi-meta,.dfi-card-bottom{font-size:12px;color:#69717d}.dfi-rationale{font-size:12px}.dfi-card a{font-size:12px}.dfi-inst{padding:11px 0;border-bottom:1px solid #eee}.dfi-inst strong{display:inline-block;margin-right:8px}.dfi-inst span{font-size:11px}.dfi-inst small{display:block;color:#69717d;margin-top:4px}@media(max-width:800px){.dfi-kpis{grid-template-columns:repeat(2,1fr)}.dfi-layout{grid-template-columns:1fr}}@media(max-width:500px){.dfi-kpis{grid-template-columns:1fr}}';document.head.appendChild(style);
  document.getElementById('dfiFilter').addEventListener('change',renderDfi);renderDfi();
}
function renderDfi(){
  const filter=document.getElementById('dfiFilter')?.value||'all';const data=dfiOpportunities.map(o=>({...o,computedScore:score(o)})).filter(o=>filter==='all'||o.institution===filter).sort((a,b)=>b.computedScore-a.computedScore);const open=data.filter(o=>!['closed','completed'].includes(o.status));const high=data.filter(o=>o.computedScore>=80);
  const k=document.getElementById('dfiKpis');if(k)k.innerHTML=`<article><span>DFIs monitored</span><strong>${dfiInstitutions.length}</strong><small>Priority development-finance sources</small></article><article><span>Current / upcoming</span><strong>${open.length}</strong><small>Open procurement or forward signals</small></article><article><span>High-fit signals</span><strong>${high.length}</strong><small>Fichtner relevance ≥ 80</small></article><article><span>Energy / infrastructure</span><strong>${data.filter(o=>o.computedScore>=60).length}</strong><small>Commercial review candidates</small></article>`;
  const list=document.getElementById('dfiList');if(list)list.innerHTML=data.map(o=>`<article class="dfi-card"><div class="dfi-card-top"><span class="dfi-badge">${esc(dfiInstitutions.find(x=>x.id===o.institution)?.short||o.institution)}</span><span class="dfi-score">${o.computedScore}/100</span></div><h4>${esc(o.title)}</h4><p class="dfi-meta">${esc(o.sector)} · ${esc(o.stage)} · ${esc(o.status)}</p><p>${esc(o.scope)}</p><div class="dfi-card-bottom"><span>${esc(o.fit)} fit</span><span>${o.deadline?`Deadline ${esc(o.deadline)}`:'No deadline'}</span><span>${esc(o.client||'Project owner')}</span></div><p class="dfi-rationale">${esc(o.rationale)}</p><a href="${esc(o.source)}" target="_blank" rel="noopener">View source →</a></article>`).join('')||'<div class="empty-state">No DFI signals match this filter.</div>';
  const box=document.getElementById('dfiInstitutions');if(box)box.innerHTML=dfiInstitutions.map(x=>`<div class="dfi-inst"><strong>${esc(x.short)}</strong><span>${'★'.repeat(x.priority)}${'☆'.repeat(5-x.priority)}</span><small>${esc(x.focus)}</small></div>`).join('');
}

if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectDfiView);else injectDfiView();}
export { monitoring, dfiInstitutions, dfiOpportunities };
