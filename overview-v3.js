const escapeHtml = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const UI_NOISE = /^(guides d.?utilisation|outils informatiques|consultations? en cours|0 entités publiques inscrites|tester la configuration( de mon poste)?|accueil|connexion|se connecter|menu|rechercher)$/i;
const NON_FICHTNER_ONEE_MATERIAL = /onee/i;
const ONEE_MATERIAL_ONLY = /(?:matériel|materiel|material|equipment|qualification|qualified|homologation|technical specification|technical specs|specification|raccordement|connection|transformer|transformateur|cellule|protection|inverter|onduleur|cable|câble)/i;
const MOROCCO_TERMS = /\b(morocco|maroc|moroccan|marocain|marocaine|rabat|casablanca|tanger|tangier|f[eè]s|fez|mekn[eè]s|ouarzazate|la[aâ]youne|laayoune|dakhla|khouribga|benguerir|jorf lasfar|safi|agadir|nador|essaouira|onee|masen|anre|amee|iresen|ocp|novec|green power morocco|gpm|ornx)\b/i;
const ENERGY_TERMS = /\b(solar|photovoltaic|pv|bess|battery|storage|wind|eolien|éolien|renewable|renewable energy|hydrogen|green hydrogen|ammonia|ptx|power-to-x|electrolysis|grid|transmission|substation|energy|electricity|power plant|module|cell|decarbon|hydro|pumped storage)\b/i;
const DEVELOPMENT_TERMS = /\b(project|plant|farm|contract|tender|procurement|award|awarded|won|selected|appointed|investment|financing|funding|agreement|partnership|construction|commissioned|feasibility|pre-feed|feed|development|launch|regulation|law|tariff|capacity|mw|mwh|gw|gwh|appel d'offres|laur[eé]at|retenu|attribu[eé]|mise en service)\b/i;
const FOREIGN_ONLY = /\b(india|indian|japan|japanese|ontario|canada|australia|germany|german|france|french|united kingdom|usa|united states|brazil|china|chinese|south africa|egypt|saudi arabia|uae|united arab emirates)\b/i;

const isRelevantOverviewSignal = s => {
  const text = `${s?.title||s?.headline||''} ${s?.summary||''} ${(Array.isArray(s?.categories)?s.categories.join(' '):s?.categories||'')} ${s?.evidenceSnippet||''} ${s?.whyItMatters||''}`;
  if (NON_FICHTNER_ONEE_MATERIAL.test(text) && ONEE_MATERIAL_ONLY.test(text)) return false;
  if (UI_NOISE.test(String(s?.title || s?.headline || '').trim())) return false;
  // The Overview is a Morocco intelligence feed: foreign-only stories must never surface here.
  if (!MOROCCO_TERMS.test(text)) return false;
  if (!ENERGY_TERMS.test(text)) return false;
  if (!DEVELOPMENT_TERMS.test(text)) return false;
  if (FOREIGN_ONLY.test(text) && !MOROCCO_TERMS.test(text)) return false;
  return true;
};

const cleanOverviewSignals = list => (Array.isArray(list) ? list : []).filter(s => {
  const title = String(s?.title || s?.headline || '').trim();
  if (!title) return false;
  if (!String(s?.evidenceSnippet || s?.summary || '').trim() && /masen e-tendering/i.test(String(s?.source || ''))) return false;
  return isRelevantOverviewSignal(s);
});

function atlasLastUpdate(all) {
  const dates = all.map(s => Date.parse(s?.detected || s?.updated || s?.published)).filter(Number.isFinite);
  if (!dates.length) return 'Last update: unavailable';
  const d = new Date(Math.max(...dates));
  return `Last update: ${d.toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Casablanca'})} (Morocco time)`;
}

function loadAtlasOverview() {
  const root = document.getElementById('overview');
  if (!root) return;
  try {
    const all = cleanOverviewSignals(window.signals);
    const events = Array.isArray(window.eventData) ? window.eventData : [];
    const high = all.filter(s => s.fichtnerRelevance === 'HIGH' || Number(s.actionabilityScore) >= 75);
    const actionable = all.filter(s => Number(s.actionabilityScore) >= 60);
    const evidence = all.length ? Math.round(all.filter(s => ['official source','news source'].includes(s.evidenceLevel)).length / all.length * 100) : 0;
    const themes = {'Solar & BESS':['solar','pv','bess','battery','storage'],'Grid & regulation':['grid','onee','anre','regulation','transmission'],'Hydrogen & PtX':['hydrogen','ammonia','ptx','electrolysis'],'Wind':['wind','eolien','éolien'],'Hydro':['hydro'],'Manufacturing':['factory','manufacturing','module','cell']};
    const signalText = s => `${s?.title||''} ${s?.summary||''} ${(Array.isArray(s?.categories)?s.categories.join(' '):s?.categories||'')}`.toLowerCase();
    const counts = Object.entries(themes).map(([name,words])=>[name,all.filter(s=>words.some(w=>signalText(s).includes(w))).length]);
    const max = Math.max(1,...counts.map(([,n])=>n));
    const cards = [...all].sort((a,b)=>(Number(b.actionabilityScore)||0)-(Number(a.actionabilityScore)||0)).slice(0,4).map(s=>`<article class="intel-card"><div class="intel-card-top"><span class="signal-type">${escapeHtml((s.signalType||'MARKET SIGNAL').toUpperCase())}</span><span class="priority ${s.fichtnerRelevance==='HIGH'?'high':''}">${escapeHtml(s.fichtnerRelevance||'WATCH')}</span></div><h3>${escapeHtml(s.title||s.headline||'Untitled signal')}</h3><p>${escapeHtml(s.whyItMatters||s.summary||'Signal detected in Morocco renewable-energy market.')}</p><div class="intel-card-foot"><span>${escapeHtml(s.source||'Source evidence')}</span><a href="${escapeHtml(s.url||'#')}" target="_blank" rel="noopener">Open evidence →</a></div></article>`).join('');
    const rows = counts.sort((a,b)=>b[1]-a[1]).map(([name,count])=>`<button class="theme-row-v3"><span>${escapeHtml(name)}</span><div><i style="width:${Math.max(8,Math.round(count/max*100))}%"></i></div><b>${count}</b></button>`).join('');
    const connects = events.slice(0,4).map(e=>`<article class="connect-card"><div class="connect-date"><b>${escapeHtml(e?.day||'—')}</b><span>${escapeHtml(e?.month||'TBD')}</span></div><div><span class="connect-label">ENGAGEMENT</span><h3>${escapeHtml(e?.title||e?.name||'Energy transition engagement')}</h3><p>${escapeHtml(e?.description||e?.detail||e?.location||'Relevant stakeholders and market participants.')}</p><button data-view-target="events">Open engagement →</button></div></article>`).join('')||'<div class="empty-v3">No upcoming engagements recorded.</div>';
    const decisions = high.slice(0,3).map(s=>`<article class="decision-v3"><span>${escapeHtml((s.signalType||'SIGNAL').toUpperCase())}</span><strong>${escapeHtml(s.title||s.headline||'Untitled signal')}</strong><p>${escapeHtml(s.whyItMatters||s.summary||'Review this signal and decide whether follow-up is required.')}</p><button data-view-target="developments">Review signal →</button></article>`).join('')||'<div class="empty-v3">No high-priority decisions currently queued.</div>';
    root.innerHTML=`<div class="command-head"><div><p class="eyebrow">ATLAS · MOROCCO MARKET COMMAND CENTER</p><h1>What changed in Morocco's<br><em>renewable-energy market?</em></h1><p>Signals are ranked by relevance and actionability so you can decide what deserves attention.</p></div><div class="freshness"><span class="live-dot"></span><b>Monitoring live</b><small>${all.length} clean signals currently indexed</small><small class="last-update">${atlasLastUpdate(all)}</small><button data-view-target="developments">Open intelligence feed →</button></div></div><div class="command-kpis"><div><span>NEW SIGNALS</span><b>${all.length}</b><small>clean signals indexed</small></div><div><span>HIGH PRIORITY</span><b>${high.length}</b><small>requires attention</small></div><div><span>ACTIONABLE</span><b>${actionable.length}</b><small>score ≥ 60</small></div><div><span>EVIDENCE COVERAGE</span><b>${evidence}%</b><small>source-backed records</small></div></div><section class="command-section"><div class="section-title-v3"><div><span>01 · MARKET SIGNALS</span><h2>What needs your attention?</h2></div><button data-view-target="developments">See all signals →</button></div><div class="intel-grid">${cards||'<div class="empty-v3">No Morocco-relevant signals available.</div>'}</div></section><div class="command-two"><section class="command-panel"><div class="section-title-v3"><div><span>02 · MARKET ACTIVITY</span><h2>Where is activity concentrated?</h2></div><small>Current signal distribution</small></div><div class="theme-list-v3">${rows}</div></section><section class="command-panel"><div class="section-title-v3"><div><span>03 · RELATIONSHIPS</span><h2>Next opportunities to connect</h2></div><button data-view-target="events">View calendar →</button></div><div class="connect-list">${connects}</div></section></div><section class="command-section"><div class="section-title-v3"><div><span>04 · DECISION QUEUE</span><h2>Signals needing a decision</h2></div><button data-view-target="opportunities">Open opportunity pipeline →</button></div><div class="decision-grid-v3">${decisions}</div></section>`;
    root.querySelectorAll('[data-view-target]').forEach(button=>button.addEventListener('click',()=>document.querySelector(`.nav-item[data-view="${button.dataset.viewTarget}"]`)?.click()));
  } catch(error) { console.error('Atlas overview failed:',error); root.innerHTML='<div class="empty-v3"><strong>Atlas overview could not load.</strong><br>Please refresh the page.</div>'; }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadAtlasOverview,{once:true}); else loadAtlasOverview();
