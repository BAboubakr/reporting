const escapeHtml = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function loadAtlasOverview() {
  const root = document.getElementById('overview');
  if (!root) return;

  try {
    // app.js loads the canonical data layer before this module executes.
    // Use those shared objects directly instead of importing the data a second time.
    // This avoids a fragile second module-loading path and keeps Overview resilient.
    const all = Array.isArray(window.signals) ? window.signals : [];
    const events = Array.isArray(window.eventData) ? window.eventData : [];

    const high = all.filter(s => s && (s.fichtnerRelevance === 'HIGH' || Number(s.actionabilityScore) >= 75));
    const actionable = all.filter(s => s && Number(s.actionabilityScore) >= 60);
    const evidence = all.length
      ? Math.round(all.filter(s => s && ['official source', 'news source'].includes(s.evidenceLevel)).length / all.length * 100)
      : 0;

    const themes = {
      'Solar & BESS': ['solar', 'pv', 'bess', 'battery', 'storage'],
      'Grid & regulation': ['grid', 'onee', 'anre', 'regulation', 'transmission'],
      'Hydrogen & PtX': ['hydrogen', 'ammonia', 'ptx', 'electrolysis'],
      'Wind': ['wind', 'eolien', 'éolien'],
      'Hydro': ['hydro'],
      'Manufacturing': ['factory', 'manufacturing', 'module', 'cell']
    };

    const signalText = s => {
      const categories = Array.isArray(s?.categories) ? s.categories.join(' ') : String(s?.categories || '');
      return `${s?.title || ''} ${s?.summary || ''} ${categories}`.toLowerCase();
    };

    const counts = Object.entries(themes).map(([name, words]) => [
      name,
      all.filter(s => words.some(word => signalText(s).includes(word))).length
    ]);
    const max = Math.max(1, ...counts.map(([, count]) => count));

    const cards = [...all]
      .filter(Boolean)
      .sort((a, b) => (Number(b.actionabilityScore) || 0) - (Number(a.actionabilityScore) || 0))
      .slice(0, 4)
      .map(s => `<article class="intel-card">
        <div class="intel-card-top">
          <span class="signal-type">${escapeHtml((s.signalType || 'MARKET SIGNAL').toUpperCase())}</span>
          <span class="priority ${s.fichtnerRelevance === 'HIGH' ? 'high' : ''}">${escapeHtml(s.fichtnerRelevance || 'WATCH')}</span>
        </div>
        <h3>${escapeHtml(s.title || s.headline || 'Untitled signal')}</h3>
        <p>${escapeHtml(s.whyItMatters || s.summary || 'Signal detected in Morocco renewable-energy market.')}</p>
        <div class="intel-card-foot">
          <span>${escapeHtml(s.source || 'Source evidence')}</span>
          <a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noopener">Open evidence →</a>
        </div>
      </article>`)
      .join('');

    const rows = counts
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<button class="theme-row-v3" data-theme="${escapeHtml(name)}">
        <span>${escapeHtml(name)}</span>
        <div><i style="width:${Math.max(8, Math.round(count / max * 100))}%"></i></div>
        <b>${count}</b>
      </button>`)
      .join('');

    const connects = events.slice(0, 4).map(e => {
      const dateValue = e?.date || e?.start || '';
      const d = dateValue ? new Date(dateValue) : null;
      const validDate = d && !Number.isNaN(d.getTime());
      return `<article class="connect-card">
        <div class="connect-date">
          <b>${validDate ? d.getDate() : escapeHtml(e?.day || '—')}</b>
          <span>${validDate ? d.toLocaleString('en', { month: 'short' }).toUpperCase() : escapeHtml(e?.month || 'TBD')}</span>
        </div>
        <div>
          <span class="connect-label">ENGAGEMENT</span>
          <h3>${escapeHtml(e?.title || e?.name || 'Energy transition engagement')}</h3>
          <p>${escapeHtml(e?.description || e?.detail || e?.location || 'Relevant stakeholders and market participants.')}</p>
          <button data-view-target="events">Open engagement →</button>
        </div>
      </article>`;
    }).join('') || '<div class="empty-v3">No upcoming engagements recorded.</div>';

    const decisions = high.slice(0, 3).map(s => `<article class="decision-v3">
      <span>${escapeHtml((s.signalType || 'SIGNAL').toUpperCase())}</span>
      <strong>${escapeHtml(s.title || s.headline || 'Untitled signal')}</strong>
      <p>${escapeHtml(s.whyItMatters || s.summary || 'Review this signal and decide whether follow-up is required.')}</p>
      <button data-view-target="developments">Review signal →</button>
    </article>`).join('') || '<div class="empty-v3">No high-priority decisions currently queued.</div>';

    root.innerHTML = `<div class="command-head">
      <div>
        <p class="eyebrow">ATLAS · MOROCCO MARKET COMMAND CENTER</p>
        <h1>What changed in Morocco's<br><em>renewable-energy market?</em></h1>
        <p>Signals are ranked by relevance and actionability so you can decide what deserves attention.</p>
      </div>
      <div class="freshness">
        <span class="live-dot"></span><b>Monitoring live</b>
        <small>${all.length} signals currently indexed</small>
        <button data-view-target="developments">Open intelligence feed →</button>
      </div>
    </div>
    <div class="command-kpis">
      <div><span>NEW SIGNALS</span><b>${all.length}</b><small>indexed by Atlas</small></div>
      <div><span>HIGH PRIORITY</span><b>${high.length}</b><small>requires attention</small></div>
      <div><span>ACTIONABLE</span><b>${actionable.length}</b><small>score ≥ 60</small></div>
      <div><span>EVIDENCE COVERAGE</span><b>${evidence}%</b><small>source-backed records</small></div>
    </div>
    <section class="command-section">
      <div class="section-title-v3"><div><span>01 · MARKET SIGNALS</span><h2>What needs your attention?</h2></div><button data-view-target="developments">See all signals →</button></div>
      <div class="intel-grid">${cards || '<div class="empty-v3">No signals available.</div>'}</div>
    </section>
    <div class="command-two">
      <section class="command-panel">
        <div class="section-title-v3"><div><span>02 · MARKET ACTIVITY</span><h2>Where is activity concentrated?</h2></div><small>Current signal distribution</small></div>
        <div class="theme-list-v3">${rows}</div>
      </section>
      <section class="command-panel">
        <div class="section-title-v3"><div><span>03 · RELATIONSHIPS</span><h2>Next opportunities to connect</h2></div><button data-view-target="events">View calendar →</button></div>
        <div class="connect-list">${connects}</div>
      </section>
    </div>
    <section class="command-section">
      <div class="section-title-v3"><div><span>04 · DECISION QUEUE</span><h2>Signals needing a decision</h2></div><button data-view-target="opportunities">Open opportunity pipeline →</button></div>
      <div class="decision-grid-v3">${decisions}</div>
    </section>`;

    root.querySelectorAll('[data-view-target]').forEach(button => {
      button.addEventListener('click', () => document.querySelector(`.nav-item[data-view="${button.dataset.viewTarget}"]`)?.click());
    });
  } catch (error) {
    console.error('Atlas overview failed:', error);
    root.innerHTML = `<div class="empty-v3"><strong>Atlas overview could not load.</strong><br>Please refresh the page. If the problem persists, open the browser console for details.</div>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAtlasOverview, { once: true });
} else {
  loadAtlasOverview();
}
