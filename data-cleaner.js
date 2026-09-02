// Atlas data-quality layer. Morocco-first, evidence-first filtering for renewable-energy intelligence.
const UI_ARTIFACT_PATTERNS=[/^guides? d.?utilisation$/i,/^outils informatiques$/i,/^consultations? en cours$/i,/^0 entités publiques inscrites$/i,/^tester la configuration(?: de mon poste)?$/i,/^spécifications techniques$/i,/^specifications techniques$/i,/^accueil$/i,/^connexion$/i,/^se connecter$/i,/^menu$/i,/^rechercher$/i];
const FICHTNER_NOISE=[/^matriel accept rseau onee$/i,/^matériel accepté réseau onee$/i,/^materiel accepte reseau onee$/i];
const PORTAL_SOURCES=/masen\s*e-?tendering|e-?tendering\.masen\.ma/i;
const GENERIC_BOILERPLATE=/^(?:market movement|tender|partnership|investment|project announcement|manufacturing) signal relevant to morocco renewable-energy activity$/i;
const MOROCCO_TERMS=/\b(morocco|maroc|moroccan|marocain|marocaine|rabat|casablanca|tanger|tangier|f[eè]s|fez|mekn[eè]s|ouarzazate|la[aâ]youne|laayoune|dakhla|khouribga|benguerir|jorf lasfar|safi|agadir|nador|essaouira|onee|masen|anre|amee|iresen|ocp|novec|green power morocco|gpm|ornx)\b/i;
const ENERGY_TERMS=/\b(solar|photovoltaic|pv|bess|battery|storage|wind|eolien|éolien|renewable|renewable energy|hydrogen|green hydrogen|ammonia|ptx|power-to-x|electrolysis|grid|transmission|substation|energy|electricity|power plant|module|cell|decarbon|hydro|pumped storage)\b/i;
const DEVELOPMENT_TERMS=/\b(project|plant|farm|contract|tender|procurement|award|awarded|won|selected|appointed|investment|financing|funding|agreement|partnership|construction|commissioned|feasibility|pre-feed|feed|development|launch|regulation|law|tariff|capacity|mw|mwh|gw|gwh|appel d'offres|laur[eé]at|retenu|attribu[eé]|mise en service)\b/i;
const FOREIGN_ONLY=/\b(india|indian|japan|japanese|ontario|canada|australia|germany|german|france|french|united kingdom|usa|united states|brazil|china|chinese|south africa|egypt|saudi arabia|uae|united arab emirates)\b/i;
const DEDUP_STOPWORDS=new Set('the a an and or to of in on for with from by as at is are was were be this that team help advance appointed selected project projects plant plants development renewable energy morocco maroc news now international water power renewables latest report says according'.split(' '));
function fields(s){return{title:String(s?.title||s?.headline||'').trim(),summary:String(s?.summary||'').trim(),snippet:String(s?.evidenceSnippet||'').trim(),why:String(s?.whyItMatters||'').trim(),source:String(s?.source||'').trim()};}
function normStoryText(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function storyTokens(s){const {title,summary,snippet}=fields(s);const text=normStoryText(`${title} ${summary} ${snippet}`);return new Set(text.split(' ').filter(t=>t.length>=3&&!DEDUP_STOPWORDS.has(t)&&!/^\d+(?:mw|mwh|gw|gwh)?$/.test(t)));}
function tokenSimilarity(a,b){if(!a.size||!b.size)return 0;let common=0;for(const t of a)if(b.has(t))common++;return common/Math.min(a.size,b.size);}
function isDuplicateStory(a,b){const ta=storyTokens(a),tb=storyTokens(b);if(!ta.size||!tb.size)return false;const similarity=tokenSimilarity(ta,tb);if(similarity>=0.78)return true;let distinctive=0;for(const t of ta){if(tb.has(t)&&t.length>=6)distinctive++;}return distinctive>=4&&similarity>=0.62;}
function signalPriority(s){const quality=Number(s?.qualityScore)||0;const relevance=Number(s?.relevanceScore)||0;const evidence=s?.evidenceLevel==='official source'?30:s?.evidenceLevel==='primary source'?25:s?.evidenceLevel==='news source'?10:0;const ts=Date.parse(s?.published||s?.detected||s?.updated)||0;return quality*2+relevance+evidence+ts/1e13;}
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
 // Morocco/energy/development relevance must be proven by source-derived evidence.
 // Analyst-generated whyItMatters is intentionally excluded from this gate.
 if(!MOROCCO_TERMS.test(sourceText))return true;
 if(!ENERGY_TERMS.test(sourceText))return true;
 if(!DEVELOPMENT_TERMS.test(sourceText))return true;
 if(FOREIGN_ONLY.test(sourceText)&&!MOROCCO_TERMS.test(sourceText))return true;
 if(analysisText.length<30&&!s.url)return true;
 return false;
}
export function cleanSignals(signals=[]){
 const candidates=Array.isArray(signals)?signals.filter(s=>!isNoiseSignal(s)):[];
 candidates.sort((a,b)=>signalPriority(b)-signalPriority(a));
 const kept=[];
 for(const signal of candidates){
   const exactKey=`${normStoryText(signal.title)}|${normStoryText(signal.source)}`;
   if(kept.some(k=>k.__exactKey===exactKey||isDuplicateStory(signal,k)))continue;
   Object.defineProperty(signal,'__exactKey',{value:exactKey,enumerable:false,configurable:true});
   kept.push(signal);
 }
 kept.forEach(s=>{try{delete s.__exactKey;}catch{}});
 return kept;
}
export function getLastSignalUpdate(signals=[]){const timestamps=cleanSignals(signals).map(s=>Date.parse(s.detected||s.updated||s.published)).filter(Number.isFinite);return timestamps.length?new Date(Math.max(...timestamps)):null;}
