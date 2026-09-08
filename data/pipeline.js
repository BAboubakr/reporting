import { eventData } from './events.js';
import { signals } from './signals.js';

const MOROCCO_TERMS=/morocco|maroc|masen|onee|anre|ocp|rabat|casablanca|laayoune|dakhla|tanger|fes|fez|oujda|kenitra|nador|safi|el jadida|jorf lasfar|midelt|noor|guelmim|boujdour|tarfaya|ouarzazate|benguerir/i;
const ENERGY_TERMS=/solar|pv|photovoltaic|wind|renewable|bess|battery|storage|hydro|pumped|hydrogen|ammonia|electrolysis|grid|transmission|substation|power|energy/i;
const ACTIONABLE_TERMS=/award|awarded|selected|contract|tender|procurement|prequalification|rfp|rfq|eoi|feasibility|study|pre-feasibility|pre-feasibility|development|construction|investment|commission|project/i;

function dateValue(v){const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}
function signalText(s){return clean(`${s.title||s.headline||''} ${s.summary||''} ${(s.entities||[]).join(' ')} ${s.projectStage||''} ${s.signalType||''}`);}
function isEvidenceBacked(s){
  const t=signalText(s);
  return MOROCCO_TERMS.test(t) && ENERGY_TERMS.test(t) && ACTIONABLE_TERMS.test(t) && Number(s.relevanceScore||0)>=60 && Number(s.actionabilityScore||0)>=40;
}
function futureEvents(){
  const now=new Date(); now.setHours(0,0,0,0);
  return eventData.filter(e=>e.verified===true).map(e=>({...e,_date:dateValue(e.date)})).filter(e=>e._date&&e._date>=now).sort((a,b)=>a._date-b._date);
}
function signalOpportunities(){
  const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-30);
  return signals.filter(s=>{const d=dateValue(s.published||s.detected);return d&&d>=cutoff&&isEvidenceBacked(s)})
    .sort((a,b)=>(Number(b.actionabilityScore||0)+Number(b.relevanceScore||0))-(Number(a.actionabilityScore||0)+Number(a.relevanceScore||0)));
}

const events=futureEvents();
const projects=signalOpportunities();

export const pipeline={
  Monitor: projects.slice(4,8).map(s=>({
    name:clean(s.title||s.headline),
    note:`Evidence-backed signal · ${clean(s.projectStage||s.signalType||'development')}. Reassess before outreach.`,
    owner:'Unassigned',
    due:'Rolling review',
    source:s.url||null,
    signalId:s.id,
    verified:true,
    generated:true
  })),
  Qualify: projects.slice(0,4).map(s=>({
    name:clean(s.title||s.headline),
    note:`Evidence-backed ${clean(s.projectStage||s.signalType||'development')} signal. Validate client, procurement route and Fichtner fit before engagement.`,
    owner:'Unassigned',
    due:'Within 7 days',
    source:s.url||null,
    signalId:s.id,
    verified:true,
    generated:true
  })),
  Engage: events.slice(0,4).map(e=>({
    name:e.name,
    note:`Verified future event in ${clean(e.detail)}. Target meetings only where a relevant stakeholder is identifiable.`,
    owner:'Unassigned',
    due:e.date,
    source:e.source,
    eventId:e.id,
    verified:true,
    generated:true
  }))
};
