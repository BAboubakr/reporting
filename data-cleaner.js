// Atlas data-quality layer. Filters portal/UI artefacts before the dashboard uses signals.
const UI_ARTIFACT_PATTERNS = [
  /^guides? d.?utilisation$/i,
  /^outils informatiques$/i,
  /^consultations? en cours$/i,
  /^0 entités publiques inscrites$/i,
  /^tester la configuration de mon poste$/i,
  /^tester la configuration$/i,
  /^accueil$/i,
  /^connexion$/i,
  /^se connecter$/i,
  /^menu$/i,
  /^rechercher$/i
];

export function isNoiseSignal(signal) {
  if (!signal || typeof signal !== 'object') return true;
  const title = String(signal.title || signal.headline || '').trim();
  const summary = String(signal.summary || '').trim();
  const snippet = String(signal.evidenceSnippet || '').trim();
  const text = `${title} ${summary} ${snippet}`.trim();

  if (!title) return true;
  if (UI_ARTIFACT_PATTERNS.some(p => p.test(title))) return true;
  if (UI_ARTIFACT_PATTERNS.some(p => p.test(summary))) return true;
  // A portal navigation label with no substantive evidence is not an intelligence signal.
  if (!snippet && /e-?tendering|tendering|portail|portal/i.test(String(signal.source || '')) && Number(signal.relevanceScore || 0) < 60) return true;
  if (text.length < 18 && !signal.url) return true;
  return false;
}

export function cleanSignals(signals = []) {
  const seen = new Set();
  return signals.filter(s => {
    if (isNoiseSignal(s)) return false;
    const key = `${String(s.title || '').trim().toLowerCase()}|${String(s.source || '').trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getLastSignalUpdate(signals = []) {
  const timestamps = cleanSignals(signals)
    .map(s => Date.parse(s.detected || s.updated || s.published))
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
}
