// Seed enrichment used until the scheduled research job refreshes this signal.
// Paywalled reporting is treated as a lead; contractor identity remains unresolved.
const ifahsaEnrichment = {
  researchedAt: '2026-09-13T15:45:00+01:00',
  status: 'public-evidence',
  project: 'Ifahsa Pumped Hydropower Storage (PHS) Project',
  overallConfidence: 'MEDIUM',
  development: 'Public-source research links the signal to the Ifahsa pumped-hydropower storage project in Morocco.',
  interpretation: 'Ifahsa is a strategic grid-flexibility and renewable-integration asset. The contractor-selection claim needs primary-source confirmation before being treated as awarded.',
  fichtnerImplication: 'Potential relevance for owner’s engineering, technical advisory, grid integration, procurement support and lender technical advisory.',
  facts: [
    { claim: 'Ifahsa is a 300 MW pumped-hydropower storage project in Morocco.', confidence: 'HIGH', status: 'Publicly supported', source: 'World Bank / Morocco project documentation' },
    { claim: 'ONEE is the implementing Moroccan utility.', confidence: 'HIGH', status: 'Publicly supported', source: 'World Bank / ONEE project documentation' },
    { claim: 'The monitored African Energy headline reports that a contractor was selected.', confidence: 'MEDIUM', status: 'Reported', source: 'African Energy — original signal' },
    { claim: 'The specific construction contractor is not independently confirmed yet.', confidence: 'HIGH', status: 'Unresolved', source: 'Atlas cross-check' }
  ],
  sources: [
    { name: 'World Bank — Ifahsa PHS Project', role: 'Project identification, financing and technical context', url: 'https://www.worldbank.org/en/news/press-release/2026/07/01/world-bank-group-and-morocco-partner-to-unlock-the-power-of-next-generation-hydropower' },
    { name: 'World Bank — Ifahsa project documents', role: 'Procurement / environmental and project documentation', url: 'https://documents.worldbank.org/' },
    { name: 'ONEE — Ifahsa project documentation', role: 'Moroccan utility / project evidence', url: 'https://www.onee.ma/' },
    { name: 'African Energy — original signal', role: 'Lead reporting contractor selection; subscriber source', url: 'https://www.africa-energy.com/' }
  ],
  recommendedActions: [
    'Confirm the selected construction contractor against ONEE / World Bank procurement documentation.',
    'Track the construction package, scope and remaining technical-advisory opportunities.',
    'Assess potential Fichtner roles in owner’s engineering, grid integration, lender technical advisory and commissioning.'
  ],
  unresolved: ['Exact construction contractor / awarded consortium and contract scope']
};

export const enrichments = {
  'sig-db4691a0f4ad': ifahsaEnrichment,
  'sig-7669d8eaeca4': ifahsaEnrichment
};
