const OFFICIAL = /\b(masen|onee|anre|afdb|african development bank|world bank|ebrd|kfw|eib|european investment bank)\b/i;
const GOOGLE_NEWS = /(^|\.)news\.google\.com$/i;
const LINKEDIN = /(^|\.)linkedin\.com$|\blinkedin\b/i;
const TYPE_ORDER = { official: 0, news: 1, linkedin: 2 };

function hostname(value) {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(String(value || '')) ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}
const publisherKey = value => String(value || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function sourceType(record, signal, publisher, domain) {
  const explicit = String(record?.sourceType || '').toLowerCase();
  if (explicit === 'official' || OFFICIAL.test(`${publisher} ${domain}`)) return 'official';
  if (explicit === 'linkedin' || LINKEDIN.test(`${publisher} ${domain}`)) return 'linkedin';
  const signalType = String(signal?.sourceType || '').toLowerCase();
  if (signalType === 'official') return 'official';
  if (signalType === 'linkedin' && !record) return 'linkedin';
  return 'news';
}

function recordsFor(signal) {
  const records = Array.isArray(signal?.sources) ? [...signal.sources] : [];
  const parentLinkedIn = String(signal?.sourceType || '').toLowerCase() === 'linkedin';
  if (parentLinkedIn && (signal.sourceAccount || signal.sourceAccountUrl)) {
    records.push({
      publisher: signal.sourceAccount || 'LinkedIn',
      url: signal.sourceAccountUrl || 'https://www.linkedin.com/',
      sourceType: 'linkedin',
      published: signal.published || signal.detected,
    });
  }
  if (!records.length && (signal?.url || signal?.source)) records.push({
    publisher: signal.publisher || signal.publication || signal.source,
    url: signal.url,
    sourceType: signal.sourceType,
    published: signal.published || signal.detected,
  });
  return records;
}

function recordIdentity(record, signal, knownDomains) {
  const publisher = String(record?.publisher || record?.publication || record?.source || '').trim();
  const urls = [record?.publisherUrl, record?.canonicalUrl, record?.originalUrl, record?.domain, record?.publisherDomain, record?.url];
  let domain = '';
  let link = '';
  for (const candidate of urls) {
    const host = hostname(candidate);
    if (!host || GOOGLE_NEWS.test(host) || host === 'google.com') continue;
    domain = host;
    link = /^https?:\/\//i.test(String(candidate)) ? String(candidate) : `https://${host}`;
    break;
  }
  if (!domain && publisher && !/\s/.test(publisher)) domain = hostname(publisher);
  if (!domain && publisher) domain = knownDomains.get(publisherKey(publisher)) || '';
  if (domain === 'linkedin.com' || domain.endsWith('.linkedin.com')) domain = 'linkedin.com';
  const rawUrl = record?.url || signal?.url || '';
  const rawHost = hostname(rawUrl);
  if (!link && rawHost && !GOOGLE_NEWS.test(rawHost) && rawHost !== 'google.com') link = rawUrl;
  const label = publisher || (domain ? domain : (GOOGLE_NEWS.test(rawHost) ? 'Google News (unresolved)' : rawHost || 'Unknown source'));
  const identity = domain || (publisher ? `publisher:${publisherKey(publisher)}` : 'google-news-unresolved');
  if (!link) link = rawUrl || (domain ? `https://${domain}` : 'https://news.google.com/');
  const date = record?.published || record?.publicationDate || signal?.published || signal?.publicationDate || signal?.detected || '';
  return { identity, domain, label, link, date, type: sourceType(record, signal, publisher, domain) };
}

export function buildSourceEvidence(signals = []) {
  const rows = new Map();
  const knownDomains = new Map();
  const typeSignals = new Map(Object.keys(TYPE_ORDER).map(type => [type, new Set()]));
  for (const signal of signals) for (const record of recordsFor(signal)) {
    const publisher = String(record?.publisher || record?.publication || record?.source || '').trim();
    const direct = [record?.publisherUrl, record?.canonicalUrl, record?.originalUrl, record?.domain, record?.publisherDomain, record?.url].map(hostname).find(host => host && !GOOGLE_NEWS.test(host) && host !== 'google.com');
    if (publisher && direct) knownDomains.set(publisherKey(publisher), direct);
  }
  for (const signal of signals) {
    const id = String(signal?.id || signal?.eventId || `${signal?.title || ''}|${signal?.published || ''}`);
    const signalType = sourceType(null, signal, signal?.source || signal?.publisher || '', hostname(signal?.url));
    typeSignals.get(signalType).add(id);
    const seen = new Set();
    for (const record of recordsFor(signal)) {
      const item = recordIdentity(record, signal, knownDomains);
      if (seen.has(item.identity)) continue;
      seen.add(item.identity);
      let row = rows.get(item.identity);
      if (!row) {
        row = { key: item.identity, name: item.domain || item.label, type: item.type, latest: item.date, count: 0, link: item.link, signalIds: new Set() };
        rows.set(item.identity, row);
      }
      row.signalIds.add(id);
      if (TYPE_ORDER[item.type] < TYPE_ORDER[row.type]) row.type = item.type;
      if (Date.parse(item.date) > Date.parse(row.latest || 0)) row.latest = item.date;
      if (!row.domain && item.domain) row.domain = item.domain;
      if (item.domain && !row.link.includes('news.google.com')) row.link = item.link;
      if (item.label && row.name === 'Google News (unresolved)') row.name = item.label;
    }
  }
  const total = signals.length;
  for (const row of rows.values()) row.count = row.signalIds.size;
  return {
    rows: [...rows.values()].sort((a, b) => Date.parse(b.latest || 0) - Date.parse(a.latest || 0) || b.count - a.count || a.name.localeCompare(b.name)),
    totalSignals: total,
    typeCounts: Object.fromEntries([...typeSignals].map(([type, ids]) => [type, ids.size])),
    warnings: [...typeSignals].filter(([, ids]) => total > 0 && ids.size / total > 0.5).map(([type]) => type),
  };
}

export function renderSourceEvidence(container, signals, escapeHtml = value => String(value)) {
  if (!container) return;
  const summary = buildSourceEvidence(signals);
  if (!container.dataset.sourceEvidenceReady) {
    container.dataset.sourceEvidenceReady = 'true';
    const toolbar = document.createElement('div');
    toolbar.className = 'source-evidence-toolbar';
    toolbar.innerHTML = '<div><b>Signal-derived publisher coverage</b><span id="sourceEvidenceSummary"></span><div id="sourceEvidenceWarning" role="status" aria-live="polite" style="color:#a33;font-weight:700"></div></div><label>Type <select id="sourceEvidenceType"><option value="all">All types</option><option value="official">Official</option><option value="news">News</option><option value="linkedin">LinkedIn</option></select></label><label>Sort <select id="sourceEvidenceSort"><option value="latest">Latest published</option><option value="count">Signal count</option><option value="name">Publisher / domain</option></select></label>';
    container.parentElement.insertBefore(toolbar, container);
    container.setAttribute('role', 'table');
    container.innerHTML = '<div class="source-row source-head" role="row"><span role="columnheader">Publisher / domain</span><span role="columnheader">Type</span><span role="columnheader">Latest published</span><span role="columnheader">Signals</span></div><div id="sourceRows" role="rowgroup"></div>';
    toolbar.querySelectorAll('select').forEach(control => control.addEventListener('change', () => draw()));
  }
  function draw() {
    const type = document.getElementById('sourceEvidenceType')?.value || 'all';
    const sort = document.getElementById('sourceEvidenceSort')?.value || 'latest';
    let visible = summary.rows.filter(row => type === 'all' || row.type === type);
    visible = [...visible].sort(sort === 'count' ? (a, b) => b.count - a.count || a.name.localeCompare(b.name) : sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => Date.parse(b.latest || 0) - Date.parse(a.latest || 0) || b.count - a.count);
    const warning = summary.warnings.length ? `Source mix warning: ${summary.warnings.map(value => `${value} (${Math.round(summary.typeCounts[value] / summary.totalSignals * 100)}%)`).join(', ')} of signals.` : '';
    const summaryEl = document.getElementById('sourceEvidenceSummary');
    if (summaryEl) summaryEl.textContent = `${summary.rows.length} publishers · ${summary.totalSignals} signals`;
    const warningEl = document.getElementById('sourceEvidenceWarning');
    if (warningEl) warningEl.textContent = warning;
    const rows = document.getElementById('sourceRows');
    if (rows) rows.innerHTML = visible.map(row => `<div class="source-row" role="row" style="display:grid;grid-template-columns:minmax(180px,2fr) repeat(3,minmax(110px,1fr));gap:12px;padding:14px 18px;align-items:center"><span role="cell"><a href="${escapeHtml(row.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.name)}</a></span><span role="cell">${escapeHtml(row.type)}</span><span role="cell">${escapeHtml(row.latest ? new Date(row.latest).toLocaleDateString('en-GB') : '—')}</span><span role="cell">${row.count}</span></div>`).join('') || '<div class="source-empty">No publishers match this type.</div>';
  }
  draw();
}

