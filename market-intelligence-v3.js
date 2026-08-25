const MARKET_THEMES=[
  {name:'Solar PV',key:'solar',rx:/solar|photovoltaic|pv/i},
  {name:'BESS & storage',key:'storage',rx:/bess|battery|storage/i},
  {name:'Grid & transmission',key:'grid',rx:/grid|transmission|substation|onee|225 kv|245 kv/i},
  {name:'Wind',key:'wind',rx:/wind|eolien|éolien/i},
  {name:'Hydrogen & PtX',key:'hydrogen',rx:/hydrogen|ammonia|ptx|power-to-x|electrolysis/i},
  {name:'Hydro',key:'hydro',rx:/hydro|pumped storage|dam/i}
];
const marketEsc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const marketDate=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}):'—'};
const marketAge=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?Math.max(0,(Date.now()-t)/86400000):999};
function marketTheme(s){const t=`${s.title||''} ${s.summary||''} ${(s.categories||[]).join(' ')}`;return MARKET_THEMES.find(x=>x.rx.test(t))||{name:'Energy market',key:'market',rx:/.*/};}
async function renderMarketIntelligence(){
 const root=document.getElementById('market');if(!root)return;
 let signals=[];try{const m=await import('./data/signals.js');signals=m.signals||[]}catch(e){console.warn('Atlas market signals unavailable',e)}
 const recent=signals.filter(s=>marketAge(s.published||s.detected)<=30).sort((a,b)=>(b.actionabilityScore||0)-(a.actionabilityScore||0));
 const themes=MARKET_THEMES.map(theme=>{const items=recent.filter(s=>theme.rx.test(`${s.title||''} ${s.summary||''} ${(s.categories||[]).join(' ')}`));return {...theme,count:items.length,top:items[0]};});
 const total=recent.length, high=recent.filter(s=>(s.relevanceScore||0)>=80||s.fichtnerRelevance==='HIGH').length;
 const top=recent.slice(0,6);
 root.innerHTML=`
 <div class="market-v3-head"><div><p class="eyebrow">SECTOR SITUATIONAL AWARENESS</p><h1>Market intelligence</h1><p>What is moving across Morocco's renewable-energy ecosystem — projects, procurement, regulation, infrastructure and investment.</p></div><div class="market-live"><span class="live-dot"></span><strong>Live collector</strong><small>Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></div>
 <div class="market-v3-kpis"><article><span>Signals · 30 days</span><strong>${total}</strong><small>Across monitored sources</small></article><article><span>High relevance</span><strong>${high}</strong><small>Priority for Fichtner</small></article><article><span>Technologies tracked</span><strong>${MARKET_THEMES.length}</strong><small>PV · BESS · wind · grid · PtX · hydro</small></article><article><span>Collector status</span><strong class="status-live">LIVE</strong><small>Automatic monitoring</small></article></div>
 <div class="market-v3-grid">
  <section class="market-v3-panel market-theme-panel"><div class="market-v3-panel-head"><div><p class="eyebrow">MARKET ACTIVITY</p><h3>What is moving?</h3></div><span class="market-period">Last 30 days</span></div><div class="market-theme-list">${themes.map(x=>`<article class="market-theme"><div class="theme-icon ${x.key}">${x.key==='solar'?'PV':x.key==='storage'?'BS':x.key==='grid'?'GR':x.key==='wind'?'WI':x.key==='hydrogen'?'HX':'HY'}</div><div class="theme-copy"><div><strong>${marketEsc(x.name)}</strong><span>${x.count} signal${x.count===1?'':'s'}</span></div><div class="theme-track"><i style="width:${Math.max(4,total?Math.round(x.count/Math.max(1,total)*100):4)}%"></i></div><small>${x.top?marketEsc(x.top.title):'No recent signal detected'}</small></div></article>`).join('')}</div></section>
  <section class="market-v3-panel market-priority-panel"><div class="market-v3-panel-head"><div><p class="eyebrow">INTELLIGENCE QUEUE</p><h3>Signals worth reading</h3></div><button class="market-link" data-view-target="developments">All developments →</button></div><div class="market-signal-list">${top.length?top.map(s=>{const th=marketTheme(s);const level=s.fichtnerRelevance||(s.relevanceScore>=80?'HIGH':s.relevanceScore>=60?'MEDIUM':'WATCH');return `<article class="market-signal"><div class="signal-top"><span class="signal-theme ${th.key}">${marketEsc(th.name)}</span><b class="signal-level ${String(level).toLowerCase()}">${marketEsc(level)}</b><time>${marketDate(s.published||s.detected)}</time></div><h4>${marketEsc(s.title)}</h4><p>${marketEsc(s.summary||s.whyItMatters||'Market signal detected by Atlas.')}</p><small>${marketEsc(s.source||'Atlas collector')} ${s.url?`· <a href="${marketEsc(s.url)}" target="_blank" rel="noopener">Evidence ↗</a>`:''}</small></article>`}).join(''):'<div class="market-empty"><strong>No recent signals available.</strong><p>The automatic collector will populate this view on its next run.</p></div>'}</div></section>
 </div>
 <section class="market-v3-panel market-outlook"><div class="market-v3-panel-head"><div><p class="eyebrow">STRATEGIC READOUT</p><h3>Where to pay attention</h3></div></div><div class="market-readout-grid"><article><span>01</span><strong>Projects & procurement</strong><p>Track new tenders, awards and project milestones where technical advisory may emerge.</p></article><article><span>02</span><strong>Grid & storage</strong><p>ONEE transmission, interconnection and BESS activity can create early engineering opportunities.</p></article><article><span>03</span><strong>Hydrogen & PtX</strong><p>Follow pre-FEED, FEED, infrastructure and financing signals before procurement becomes visible.</p></article><article><span>04</span><strong>Regulation</strong><p>ANRE and government decisions can materially change the addressable project pipeline.</p></article></div></section>`;
 root.querySelectorAll('[data-view-target]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`[data-view="${b.dataset.viewTarget}"]`)?.click()));
}
renderMarketIntelligence();
