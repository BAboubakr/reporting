// Atlas data-quality layer. Filters portal/UI artefacts, boilerplate captures and duplicates.
const UI_ARTIFACT_PATTERNS = [/^guides? d.?utilisation$/i,/^outils informatiques$/i,/^consultations? en cours$/i,/^0 entités publiques inscrites$/i,/^tester la configuration(?: de mon poste)?$/i,/^spécifications techniques$/i,/^specifications techniques$/i,/^accueil$/i,/^connexion$/i,/^se connecter$/i,/^menu$/i,/^rechercher$/i];
const IRRELEVANT_FICHTNER_SIGNALS = [/^matriel accept rseau onee$/i,/^matériel accepté réseau onee$/i,/^materiel accepte reseau onee$/i];
const GENERIC_SIGNAL_SUMMARIES = [/^(?:market movement|tender|partnership|investment|project announcement|manufacturing) signal relevant to morocco renewable-energy activity$/i];
export function isNoiseSignal(signal){
 if(!signal||typeof signal!=='object')return true;
 const title=String(signal.title||signal.headline||'').trim(),summary=String(signal.summary||'').trim(),snippet=String(signal.evidenceSnippet||'').trim(),source=String(signal.source||'').trim();
 const text=`${title} ${summary} ${snippet}`.trim();
 if(!title)return true;
 if(IRRELEVANT_FICHTNER_SIGNALS.some(p=>p.test(title)||p.test(summary)))return true;
 if(UI_ARTIFACT_PATTERNS.some(p=>p.test(title)||p.test(summary)))return true;
 if(GENERIC_SIGNAL_SUMMARIES.some(p=>p.test(summary)))return true;
 if(/masen|e-?tendering|tendering|etendering@masen\.ma/i.test(source)){
   if(!snippet)return true;
   if(UI_ARTIFACT_PATTERNS.some(p=>p.test(title)))return true;
   if(/^(?:market movement|tender) signal relevant to morocco renewable-energy activity$/i.test(String(signal.whyItMatters||'').trim()))return true;
 }
 if(text.length<18&&!signal.url)return true;
 return false;
}
export function cleanSignals(signals=[]){const seen=new Set();return signals.filter(s=>{if(isNoiseSignal(s))return false;const key=`${String(s.title||'').trim().toLowerCase()}|${String(s.source||'').trim().toLowerCase()}`;if(seen.has(key))return false;seen.add(key);return true;});}
export function getLastSignalUpdate(signals=[]){const timestamps=cleanSignals(signals).map(s=>Date.parse(s.detected||s.updated||s.published)).filter(Number.isFinite);return timestamps.length?new Date(Math.max(...timestamps)):null;}
