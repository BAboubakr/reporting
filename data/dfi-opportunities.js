// Development-finance opportunity intelligence for Morocco.
// This dataset is deliberately structured so future monitoring can append/replace records
// without changing the UI or scoring logic.
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
    id:'isdb-step-el-menzel-ta-2026', institution:'isdb', country:'Morocco', status:'closed', stage:'Award / post-EOI',
    title:'Technical assistance during construction — STEP El Menzel', sector:'Pumped hydro / storage / grid',
    client:'ONEE – Branche Electricité', project:'STEP El Menzel', reference:'MAR1062',
    deadline:'2026-07-08', relevance:96, fit:'Very high',
    scope:'Technical assistance during construction, including review and approval of contract documentation.',
    source:'https://www.isdb.org/project-procurement/fr/appels-doffres/2026/eoi/recrutement-dun-consultant-pour-lassistance-technique-pendant-les-travaux',
    rationale:'Direct fit with Fichtner capabilities in hydropower/storage, owner’s engineering and construction-stage technical advisory.',
    tags:['storage','pumped hydro','ONEE','owner engineer','technical assistance']
  },
  {
    id:'isdb-step-el-menzel-works-2026', institution:'isdb', country:'Morocco', status:'open', stage:'Procurement / works',
    title:'STEP El Menzel — detailed design, equipment, construction, installation and commissioning', sector:'Pumped hydro / storage / grid',
    client:'ONEE – Branche Electricité', project:'STEP El Menzel', reference:'MAR1062',
    deadline:'2026-09-30', relevance:84, fit:'High',
    scope:'Execution studies, equipment supply, construction, installation and commissioning.',
    source:'https://www.isdb.org/project-procurement/fr/appels-doffres/2026/spn/pour-les-etudes-dexecution-la-fourniture-des-equipements-la-construction',
    rationale:'Not a consulting tender itself, but a strong project-stage trigger for owner’s engineer, technical advisory, supervision and adjacent consulting opportunities.',
    tags:['storage','pumped hydro','construction','commissioning','ONEE']
  },
  {
    id:'kfw-green-invest-2026', institution:'kfw', country:'Morocco', status:'closed', stage:'PQ result',
    title:'Consulting accompanying measures for the Green Invest green loan', sector:'Green finance / energy efficiency / renewables',
    client:'Tamwilcom / Moroccan partner financial institutions', project:'Green Invest', reference:'BMZ202370195/KfW512701',
    deadline:'2026-06-23', relevance:58, fit:'Medium',
    scope:'Green-product development, technical expertise, eligibility assessment and support to Tamwilcom and partner financial institutions.',
    source:'https://www.gtai.de/en/trade/morocco/tenders/consulting-accompanying-measures-for-the-green-loan-green-invest--1906456',
    rationale:'DFI-backed consulting opportunity with a renewable-energy component, but more financial/product-oriented than Fichtner’s core engineering advisory. Keep as a pattern and follow-on signal.',
    tags:['KfW','renewables','energy efficiency','green finance','technical expertise']
  },
  {
    id:'kfw-ptx-iresen-2025', institution:'kfw', country:'Morocco', status:'closed', stage:'Tender award / precedent',
    title:'PtX project definition and implementation consulting for IRESEN', sector:'Hydrogen / PtX',
    client:'IRESEN', project:'German-Moroccan Thematic PtX Programme', reference:'BMZ202068138/KfW510951; MO-IRESEN-02',
    deadline:'2025-04-04', relevance:92, fit:'Very high',
    scope:'Define a power-to-liquid demonstration project, prepare and conduct the tender, and act as implementation consultant through design, construction, commissioning and final acceptance.',
    source:'https://www.gtai.de/en/trade/morocco/tenders/consulting-services-for-project-definition-and-implementation--1084990',
    rationale:'Strong precedent for the exact type of KfW-funded Moroccan PtX engineering/implementation assignment Atlas should detect early in future programme phases.',
    tags:['KfW','PtX','hydrogen','IRESEN','implementation consultant','FIDIC']
  },
  {
    id:'afdb-ain-beni-mathar-fichtner-precedent', institution:'afdb', country:'Morocco', status:'closed', stage:'Historical precedent',
    title:'Ain Beni Mathar solar thermal power project — Consultant-Engineer precedent', sector:'Solar thermal / power / grid',
    client:'ONE / Moroccan project stakeholders', project:'Ain Beni Mathar Solar Thermal Power Plant', reference:'AfDB project completion record',
    deadline:null, relevance:95, fit:'Very high',
    scope:'Consultant-Engineer role covering project implementation and technical oversight; AfDB completion documentation records Fichtner as the recruited Consultant-Engineer.',
    source:'https://www.afdb.org/fileadmin/uploads/afdb/Documents/Boards-Documents/Morocco_-_Ain_Beni_Mathar_Solar_Thermal_Power_Plant_Project_-_Project_Completion_Report.pdf',
    rationale:'Important Fichtner/AfDB Morocco precedent. It demonstrates an established relationship pattern that should be considered when new AfDB-financed Moroccan energy projects enter preparation or procurement.',
    tags:['AfDB','Fichtner','solar thermal','consultant engineer','ONE']
  },
  {
    id:'eib-noor-atlas-ta-2025', institution:'eib', country:'Morocco', status:'closed', stage:'Completed procurement',
    title:'Technical assistance for implementation of Noor Atlas PV project', sector:'Solar PV',
    client:'Morocco project stakeholders', project:'Noor Atlas', reference:'AA-010052-001',
    deadline:'2025-06-12', relevance:94, fit:'Very high',
    scope:'Technical assistance for implementation of a Moroccan photovoltaic programme.',
    source:'https://www.eib.org/fr/about/procurement/calls-technical-assistance/all/aa-010052001',
    rationale:'Strong precedent proving the type of EIB-funded Moroccan PV technical assistance Atlas should continuously monitor for follow-on packages and future programmes.',
    tags:['solar','PV','technical assistance','precedent']
  },
  {
    id:'eib-morocco-forest-2026', institution:'eib', country:'Morocco', status:'closed', stage:'Tender closed',
    title:'Inclusive and sustainable forest management — technical assistance', sector:'Climate / natural resources',
    client:'Morocco programme stakeholders', project:'Morocco forest investment programme', reference:'AA-011722-001',
    deadline:'2026-06-11', relevance:32, fit:'Low',
    scope:'Technical assistance for monitoring and implementation of an investment programme.',
    source:'https://www.eib.org/en/about/procurement/calls-technical-assistance/all/aa-011722001',
    rationale:'Useful as a DFI procurement pattern, but currently outside Fichtner’s core energy opportunity space.',
    tags:['climate','technical assistance','low fit']
  }
];

export const dfiWatchRules = {
  priorityInstitutions:['afdb','kfw','afd','eib','world-bank','isdb','ebrd','eu','giz'],
  highFitTerms:['solar','pv','photovoltaic','wind','renewable','bess','battery','storage','pumped hydro','hydro','hydrogen','ammonia','electrolysis','grid','transmission','substation','power','energy','owner engineer','technical assistance','feasibility','pre-feasibility','design','supervision','commissioning'],
  rejectTerms:['forestry','agriculture','social protection','education','health','generic governance','pure finance','gender'],
  stages:['pipeline','forecast','upcoming','eoi','rfp','tender','shortlist','award','implementation']
};
