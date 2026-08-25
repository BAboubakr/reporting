const COMPETITORS = ['AFRY','Artelia','Tractebel','Mott MacDonald','WSP','Worley','Egis','ILF Consulting Engineers'];
const competitorSignals = [
  {competitor:'Artelia', type:'Market capability', theme:'Solar / Grid / PtX', signal:'Artelia Morocco explicitly covers renewable energy, dams, project management and multidisciplinary engineering, while the group markets owner’s engineering, due diligence and technical advisory for solar.', priority:'HIGH', source:'Artelia Morocco / Artelia Energy', url:'https://www.arteliagroup.com/fr/artelia-maroc/'},
  {competitor:'Worley', type:'Local footprint', theme:'Hydrogen / Low-carbon energy', signal:'Worley operates offices in Casablanca and Rabat and lists renewable energy and low-carbon energy among its Moroccan industries. Its hydrogen offer spans feasibility through engineering and asset integration.', priority:'HIGH', source:'Worley Morocco / Hydrogen', url:'https://www.worley.com/en/about-us/where-we-operate/morocco'},
  {competitor:'WSP', type:'Capability positioning', theme:'Grid / Renewables', signal:'WSP positions multidisciplinary services across development, planning, front-end design, project management and commissioning, including solar, wind, hydropower and transmission/distribution.', priority:'MEDIUM', source:'WSP Energy & Generation', url:'https://www.wsp.com/en-me/sectors/energy-and-generation'},
  {competitor:'AFRY', type:'Watch', theme:'Energy transition', signal:'Track AFRY for Morocco mandates, consortium participation, renewable-energy studies and owner’s-engineer roles.', priority:'WATCH', source:'Atlas watchlist', url:'https://afry.com/'},
  {competitor:'Tractebel', type:'Watch', theme:'Energy / Grid', signal:'Track Tractebel for Moroccan power, grid, hydropower and energy-transition assignments.', priority:'WATCH', source:'Atlas watchlist', url:'https://tractebel-engie.com/'},
  {competitor:'Mott MacDonald', type:'Watch', theme:'Infrastructure / Energy', signal:'Track Mott MacDonald for advisory, infrastructure, grid and renewable-energy mandates in Morocco.', priority:'WATCH', source:'Atlas watchlist', url:'https://www.mottmac.com/'},
  {competitor:'Egis', type:'Watch', theme:'Infrastructure / Energy', signal:'Track Egis for Moroccan infrastructure, energy-transition and project-management activity.', priority:'WATCH', source:'Atlas watchlist', url:'https://www.egis-group.com/'},
  {competitor:'ILF Consulting Engineers', type:'Watch', theme:'Energy / Infrastructure', signal:'Track ILF for renewable-energy, hydrogen, transmission and infrastructure advisory roles in Morocco.', priority:'WATCH', source:'Atlas watchlist', url:'https://www.ilf.com/'}
];
function renderCompetitors(filter='all'){
 const list=document.getElementById('competitorList'); if(!list)return;
 const items=filter==='all'?competitorSignals:competitorSignals.filter(x=>x.competitor===filter);
 const high=competitorSignals.filter(x=>x.priority==='HIGH').length;
 document.getElementById('competitorSignals').textContent=competitorSignals.length;
 document.getElementById('competitorHigh').textContent=high;
 list.innerHTML=items.map(x=>`<article class="competitor-row"><div class="competitor-logo">${x.competitor.split(' ').map(w=>w[0]).join('').slice(0,3)}</div><div class="competitor-main"><div class="competitor-meta"><strong>${x.competitor}</strong><span class="competitor-priority ${x.priority.toLowerCase()}">${x.priority}</span><span>${x.type}</span></div><h4>${x.theme}</h4><p>${x.signal}</p><small>${x.source} · <a href="${x.url}" target="_blank" rel="noopener">Evidence ↗</a></small></div></article>`).join('');
}
const cf=document.getElementById('competitorFilter'); cf?.addEventListener('change',()=>renderCompetitors(cf.value));
document.getElementById('refreshCompetitors')?.addEventListener('click',()=>renderCompetitors(cf?.value||'all'));
renderCompetitors();