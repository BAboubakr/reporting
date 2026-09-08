// Development-finance opportunity intelligence for Morocco.
// Raw records may be retained here, but Atlas should only surface records that are currently actionable.
export const dfiInstitutions = [
  {id:'afdb', name:'African Development Bank', short:'AfDB', priority:5, focus:'Energy, power, renewable energy, grids, SEFA, infrastructure'},
  {id:'kfw', name:'KfW', short:'KfW', priority:5, focus:'Climate, energy, renewable energy, energy efficiency, infrastructure'},
  {id:'afd', name:'Agence Française de Développement', short:'AFD', priority:5, focus:'Energy transition, infrastructure, climate, water-energy nexus'},
  {id:'eib', name:'European Investment Bank', short:'EIB', priority:5, focus:'Energy, grids, renewables, technical assistance, Global Gateway'},
  {id:'world-bank', name:'World Bank', short:'World Bank', priority:5, focus:'Energy, infrastructure, policy, project preparation and procurement'},
  {id:'isdb', name:'Islamic Development Bank', short:'IsDB', priority:4, focus:'Energy infrastructure, project implementation, technical assistance'},
  {id:'ebrd', name:'European Bank for Reconstruction and Development', short:'EBRD', priority:4, focus:'Energy transition, renewables, infrastructure and advisory'},
  {id:'eu', name:'European Union / Global Gateway', short:'EU / Global Gateway', priority:4, focus:'Energy transition, infrastructure, hydrogen and technical assistance'},
  {id:'giz', name:'GIZ', short:'GIZ', priority:4, focus:'Technical assistance, energy transition, climate and capacity building'}
];

export const dfiOpportunities = [
  {
    id:'isdb-step-el-menzel-works-2026', institution:'isdb', country:'Morocco', status:'open', stage:'Project-stage trigger',
    title:'STEP El Menzel — detailed design, equipment, construction, installation and commissioning', sector:'Pumped hydro / storage / grid',
    client:'ONEE – Branche Electricité', project:'STEP El Menzel', reference:'MAR1062',
    deadline:'2026-09-30', relevance:84, fit:'High', opportunityType:'project-stage trigger',
    scope:'Execution studies, equipment supply, construction, installation and commissioning.',
    source:'https://www.isdb.org/project-procurement/fr/appels-doffres/2026/spn/pour-les-etudes-dexecution-la-fourniture-des-equipements-la-construction',
    rationale:'Not a consulting tender itself, but a strong project-stage trigger for owner’s engineer, technical advisory, supervision and adjacent consulting opportunities.',
    tags:['storage','pumped hydro','construction','commissioning','ONEE']
  }
];

const today=new Date();
today.setHours(0,0,0,0);

const deadlineIsCurrent=o=>{
  if(!o?.deadline)return false;
  const d=new Date(`${o.deadline}T23:59:59`);
  return !Number.isNaN(d.getTime()) && d>=today;
};

// Single source of truth for the live DFI view: expired or non-actionable records never surface.
export const openDfiOpportunities = dfiOpportunities
  .filter(o=>o.country==='Morocco' && o.status==='open' && deadlineIsCurrent(o))
  .sort((a,b)=>b.relevance-a.relevance);

export const dfiWatchRules = {
  priorityInstitutions:['afdb','kfw','afd','eib','world-bank','isdb','ebrd','eu','giz'],
  highFitTerms:['solar','pv','photovoltaic','wind','renewable','bess','battery','storage','pumped hydro','hydro','hydrogen','ammonia','electrolysis','grid','transmission','substation','power','energy','owner engineer','technical assistance','feasibility','pre-feasibility','design','supervision','commissioning'],
  rejectTerms:['forestry','agriculture','social protection','education','health','generic governance','pure finance','gender'],
  stages:['pipeline','forecast','upcoming','eoi','rfp','tender','shortlist','award','implementation']
};
