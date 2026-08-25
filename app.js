const developments = [
  { topic: 'TENDER · SOLAR + BESS', title: 'MASEN opens prequalification for 400 MW solar-plus-storage programme', text: 'Early procurement signal with potential owner’s engineering and tender-advisory relevance.', state: 'HIGH PRIORITY', level: 'high', score: '92 / 100', action: 'Qualify · due 29 Aug', evidence: '3 source records' },
  { topic: 'GRID · TRANSMISSION', title: 'ONEE outlines southern grid reinforcement corridor', text: 'Planned transmission capacity could unlock renewable and hydrogen projects in the south.', state: 'STRATEGIC SIGNAL', level: 'medium', score: '76 / 100', action: 'Research · assign owner', evidence: '2 source records' },
  { topic: 'PARTNERSHIP · PTX', title: 'Industrial consortium signs green ammonia development MoU', text: 'Early-stage partner and infrastructure signal; project details require verification.', state: 'WATCH', level: 'watch', score: '64 / 100', action: 'Monitor · next review 05 Sep', evidence: '1 source record' }
];
const eventData = [
  {day:'29',month:'AUG',name:'Morocco Energy & Industry Forum',detail:'Casablanca · Investor and developer roundtable',priority:'Seek meetings'},
  {day:'04',month:'SEP',name:'ONEE supplier information session',detail:'Rabat · Grid procurement briefing',priority:'Attend if feasible'},
  {day:'12',month:'SEP',name:'Green Hydrogen Morocco Summit',detail:'Marrakech · Policy, ports & offtake',priority:'Must attend'}
];
const pipeline = {
  'Monitor': [{name:'Green ammonia consortium',note:'Validate project scope and Moroccan counterparties.',owner:'SA',due:'05 Sep'}, {name:'Dakhla wind resource study',note:'Track environmental consultation timeline.',owner:'MK',due:'12 Sep'}],
  'Qualify': [{name:'400 MW solar + BESS programme',note:'Map likely procurement and owner’s engineer scope.',owner:'SA',due:'29 Aug'}, {name:'Southern grid corridor',note:'Identify entry points and international partners.',owner:'IA',due:'02 Sep'}],
  'Engage': [{name:'Hydrogen summit stakeholder meetings',note:'Request meetings with port and developer delegates.',owner:'FA',due:'26 Aug'}, {name:'Pumped-storage technical advisory',note:'Prepare relevant credentials for client discussion.',owner:'MK',due:'30 Aug'}]
};
const stakeholders = [
  ['MASEN','PUBLIC DEVELOPER','Solar, storage & hydrogen programmes','6 linked developments'],['ONEE','UTILITY / GRID OPERATOR','Transmission, generation & procurement','8 linked developments'],['OCP Group','INDUSTRIAL OFFTAKER','Green ammonia & industrial decarbonisation','4 linked developments'],['AMMC','REGULATOR','Capital markets and investment framework','2 linked developments'],['Nareva','DEVELOPER','Wind, solar and infrastructure','5 linked developments'],['Port of Tanger Med','PORT / LOGISTICS','Hydrogen and export infrastructure','3 linked developments']
];
const sources = [['MASEN procurement notice — solar & storage programme','Official notice','25 Aug 2026','7'],['ONEE Transmission Development Plan 2026–2030','Utility publication','22 Aug 2026','4'],['Ministry of Energy — hydrogen partnership announcement','Government release','20 Aug 2026','3'],['EBRD Morocco country update','Lender publication','18 Aug 2026','2']];

function card(d) { return `<article class="decision-card"><div class="card-top"><span class="badge ${d.level}">${d.state}</span><span class="score">${d.score}</span></div><h3>${d.title}</h3><p>${d.text}</p><div class="card-foot"><span>${d.action}</span><span>${d.evidence}</span></div></article>`; }
document.getElementById('decisionGrid').innerHTML = developments.map(card).join('');
document.getElementById('eventPreview').innerHTML = eventData.slice(0,2).map(e=>`<div class="event-mini"><div class="date-box"><b>${e.day}</b><span>${e.month}</span></div><div><strong>${e.name}</strong><small>${e.detail}</small></div></div>`).join('');
document.getElementById('developmentList').innerHTML = developments.concat([{topic:'REGULATION · MARKET',title:'Consultation launches on direct electricity supply framework',text:'Regulatory signal for C&I renewable procurement and private-sector offtake.',state:'VERIFIED',level:'watch',score:'89% evidence',action:'Reviewed today',evidence:'4 claims'}]).map(d=>`<article class="development-row"><span class="topic">${d.topic}</span><div><h3>${d.title}</h3><p>${d.text}</p></div><span class="verified">● ${d.state}</span><span class="score">${d.score}</span></article>`).join('');
document.getElementById('pipelineBoard').innerHTML = Object.entries(pipeline).map(([stage,items])=>`<section class="pipe-column"><h3>${stage}<span>${items.length}</span></h3>${items.map(i=>`<article class="pipe-card"><strong>${i.name}</strong><p>${i.note}</p><footer><span>Owner · ${i.owner}</span><span>Due ${i.due}</span></footer></article>`).join('')}</section>`).join('');
document.getElementById('eventList').innerHTML = eventData.map(e=>`<article class="event-large"><div class="event-date"><b>${e.day}</b><span>${e.month}</span></div><div><h3>${e.name}</h3><p>${e.detail}</p><small>${e.priority} →</small></div></article>`).join('');
let days = ['31','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','1','2','3','4'];
document.getElementById('calendarDays').innerHTML = days.map((d,i)=>`<span class="${i===0||i>30?'muted':''} ${['4','12','18'].includes(d)&&i<31?'has-event':''}">${d}</span>`).join('');
document.getElementById('stakeholderGrid').innerHTML = stakeholders.map(s=>`<article><span class="org-type">${s[1]}</span><h3>${s[0]}</h3><p>${s[2]}</p><small>${s[3]} →</small></article>`).join('');
document.getElementById('sourceRows').innerHTML = sources.map(s=>`<div class="source-row"><span>${s[0]}</span><span>${s[1]}</span><span>${s[2]}</span><span>${s[3]}</span></div>`).join('');

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-view-target]').forEach(button => button.addEventListener('click', () => setView(button.dataset.viewTarget)));
function setView(id){ document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id)); document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===id)); document.querySelector('.sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'}); }
const modal = document.getElementById('modalBackdrop'); document.getElementById('newDevelopment').onclick=()=>modal.hidden=false; document.querySelector('.close-modal').onclick=()=>modal.hidden=true; modal.onclick=e=>{if(e.target===modal)modal.hidden=true}; document.querySelector('.mobile-menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
