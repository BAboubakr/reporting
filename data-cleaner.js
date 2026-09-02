// Atlas data-quality layer. Morocco-first, evidence-first filtering for renewable-energy intelligence.
const UI_ARTIFACT_PATTERNS=[/^guides? d.?utilisation$/i,/^outils informatiques$/i,/^consultations? en cours$/i,/^0 entités publiques inscrites$/i,/^tester la configuration(?: de mon poste)?$/i,/^spécifications techniques$/i,/^specifications techniques$/i,/^accueil$/i,/^connexion$/i,/^se connecter$/i,/^menu$/i,/^rechercher$/i];
const FICHTNER_NOISE=[/^matriel accept rseau onee$/i,/^matériel accepté réseau onee$/i,/^materiel accepte reseau onee$/i];
const PORTAL_SOURCES=/masen\s*e-?tendering|e-?tendering\.masen\.ma/i;
const GENERIC_BOILERPLATE=/^(?:market movement|tender|partnership|investment|project announcement|manufacturing) signal relevant to morocco renewable-energy activity$/i;
const MOROCCO_TERMS=/\b(morocco|maroc|moroccan|marocain|marocaine|rabat|casablanca|tanger|tangier|f[eè]s|fez|mekn[eè]s|ouarzazate|la[aâ]youne|laayoune|dakhla|khouribga|benguerir|jorf lasfar|safi|agadir|nador|essaouira|onee|masen|anre|amee|iresen|ocp|novec|green power morocco|gpm|ornx)\b/i;
const ENERGY_TERMS=/\b(solar|photovoltaic|pv|bess|battery|storage|wind|eolien|éolien|renewable|renewable energy|hydrogen|green hydrogen|ammonia|ptx|power-to-x|electrolysis|grid|transmission|substation|energy|electricity|power plant|module|cell|decarbon|hydro|pumped storage)\b/i;
const DEVELOPMENT_TERMS=/\b(project|plant|farm|contract|tender|procurement|award|awarded|won|selected|appointed|investment|financing|funding|agreement|partnership|construction|commissioned|feasibility|pre-feed|feed|development|launch|regulation|law|tariff|capacity|mw|mwh|gw|gwh|appel d'offres|laur[eé]at|retenu|attribu[eé]|mise en service)\b/i;
const FOREIGN_ONLY=/\b(india|indian|japan|japanese|ontario|canada|australia|germany|german|france|french|united kingdom|usa|united states|brazil|china|chinese|south africa|egypt|saudi arabia|uae|united arab emirates)\b/i;
function fields(s){return{title:String(s?.title||s?.headline||'').trim(),summary:String(s?.summary||'').trim(),snippet:String(s?.evidenceSnippet||'').trim(),why:String(s?.whyItMatters||'').trim(),source:String(s?.source||'').trim()};}
export function isNoiseSignal(s){
 if(!s||typeof s!=='object')return true;
 const {title,summary,snippet,why,source}=fields(s);
 const sourceText=`${title} ${summary} ${snippet} ${source}`.trim();
 const analysisText=`${sourceText} ${why}`.trim();
 if(!title)return true;
 if(FICHTNER_NOISE.some(p=>p.test(title)||p.test(summary)))return true;
 if(UI_ARTIFACT_PATTERNS.some(p=>p.test(title)||p.test(summary)))return true;
 if(GENERIC_BOILERPLATE.test(summary))return true;
 if(PORTAL_SOURCES.test(`${source} ${s.url||''}`)&&!DEVELOPMENT_TERMS.test(sourceText.replace(/outils informatiques|spécifications techniques|specifications techniques|guides? d.?utilisation|consultations? en cours/ig,'')))return true;
 // IMPORTANT: Morocco/energy/development relevance must be proven by source-derived evidence.
 // Analyst-generated whyItMatters is intentionally excluded from this gate.
 if(!MOROCCO_TERMS.test(sourceText))return true;
 if(!ENERGY_TERMS.test(sourceText))return true;
 if(!DEVELOPMENT_TERMS.test(sourceText))return true;
 if(FOREIGN_ONLY.test(sourceText)&&!MOROCCO_TERMS.test(sourceText))return true;
 if(analysisText.length<30&&!s.url)return true;
 return false;
}
export function cleanSignals(signals=[]){const seen=new Set();return signals.filter(s=>{if(isNoiseSignal(s))return false;const key=`${String(s.title||'').trim().toLowerCase()}|${String(s.source||'').trim().toLowerCase()}`;if(seen.has(key))return false;seen.add(key);return true;});}
export function getLastSignalUpdate(signals=[]){const timestamps=cleanSignals(signals).map(s=>Date.parse(s.detected||s.updated||s.published)).filter(Number.isFinite);return timestamps.length?new Date(Math.max(...timestamps)):null;}