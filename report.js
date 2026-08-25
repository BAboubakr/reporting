/* Atlas Reporting Engine
 * Builds the management brief from the data currently rendered by Atlas.
 * No backend or paid API required.
 */
(function () {
  const $ = (id) => document.getElementById(id);

  function currentDevelopments() {
    return [...document.querySelectorAll('#developmentList .development-row')].map((row) => ({
      topic: row.querySelector('.topic')?.textContent.trim() || 'MARKET SIGNAL',
      title: row.querySelector('h3')?.textContent.trim() || 'Untitled development',
      text: row.querySelector('p')?.textContent.trim() || '',
      state: row.querySelector('.verified')?.textContent.replace('●', '').trim() || 'REVIEW',
      score: row.querySelector('.score')?.textContent.trim() || ''
    }));
  }

  function currentPipeline() {
    return [...document.querySelectorAll('#pipelineBoard .pipe-column')].flatMap((column) => {
      const stage = column.querySelector('h3')?.childNodes[0]?.textContent.trim() || 'Monitor';
      return [...column.querySelectorAll('.pipe-card')].map((card) => ({
        stage,
        name: card.querySelector('strong')?.textContent.trim() || 'Opportunity',
        note: card.querySelector('p')?.textContent.trim() || '',
        footer: card.querySelector('footer')?.textContent.replace(/\s+/g, ' ').trim() || ''
      }));
    });
  }

  function currentEvents() {
    return [...document.querySelectorAll('#eventList .event-large')].map((item) => ({
      name: item.querySelector('h3')?.textContent.trim() || 'Event',
      detail: item.querySelector('p')?.textContent.trim() || '',
      priority: item.querySelector('small')?.textContent.replace('→', '').trim() || ''
    }));
  }

  function currentSources() {
    return [...document.querySelectorAll('#sourceRows .source-row')].map((row) => {
      const cells = [...row.children].map((cell) => cell.textContent.trim());
      return { title: cells[0] || 'Source', type: cells[1] || '', date: cells[2] || '', claims: cells[3] || '' };
    });
  }

  function addHeader(slide, section, title, pptx) {
    const ink = '16302C';
    slide.background = { color: 'FFFEFA' };
    slide.addText(section, { x: .6, y: .45, w: 5, h: .22, fontFace: 'Aptos', fontSize: 9, color: '4D746B', charSpacing: 1.1 });
    slide.addText(title, { x: .6, y: .85, w: 11.2, h: .48, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: ink });
  }

  function addFooter(slide, page, pptx) {
    slide.addText(`ATLAS · MOROCCO RENEWABLE ENERGY INTELLIGENCE · ${page}`, { x: .6, y: 7.05, w: 7, h: .16, fontFace: 'Aptos', fontSize: 6.5, color: '7A8580', charSpacing: .6 });
  }

  function addBulletList(slide, items, y, options = {}) {
    const color = options.color || '435B54';
    items.forEach((text, index) => {
      slide.addText(text, { x: .9, y: y + index * .72, w: 10.7, h: .42, fontFace: 'Aptos', fontSize: 13, color, bullet: { indent: 14 } });
    });
  }

  function buildReport() {
    if (!window.PptxGenJS) {
      const status = $('reportStatus');
      if (status) status.textContent = 'PowerPoint library is still loading. Please try again in a moment.';
      return;
    }

    const developments = currentDevelopments();
    const pipeline = currentPipeline();
    const events = currentEvents();
    const sources = currentSources();
    const reportType = $('reportType')?.value || 'Weekly Intelligence Brief';
    const period = $('reportPeriod')?.value || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const classification = $('reportClassification')?.value || 'Internal — Fichtner';
    const highPriority = developments.filter((d) => /HIGH|STRATEGIC|VERIFIED/i.test(d.state));
    const opportunityCount = pipeline.length;

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Atlas';
    pptx.company = 'Fichtner';
    pptx.subject = 'Morocco Renewable Energy Intelligence';
    pptx.title = reportType;
    pptx.lang = 'en-US';
    pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-US' };

    const green = '153A35', lime = 'D9E858', ink = '16302C', muted = '64716D', cream = 'FFFEFA';

    // 1. Cover
    let slide = pptx.addSlide();
    slide.background = { color: green };
    slide.addText('ATLAS', { x: .55, y: .42, w: 3, h: .35, fontFace: 'Aptos Display', fontSize: 18, bold: true, color: 'FFFFFF', charSpacing: 2 });
    slide.addShape(pptx.ShapeType.rect, { x: 11.7, y: .48, w: .55, h: .08, line: { color: lime }, fill: { color: lime } });
    slide.addText('MOROCCO RENEWABLE ENERGY INTELLIGENCE', { x: .55, y: 2.0, w: 8, h: .3, fontFace: 'Aptos', fontSize: 10, color: 'BFD8CE', charSpacing: 1.3 });
    slide.addText(reportType, { x: .55, y: 2.48, w: 8.8, h: 1.1, fontFace: 'Aptos Display', fontSize: 30, bold: true, color: 'FFFFFF', breakLine: false });
    slide.addText(`${period} · ${classification}`, { x: .55, y: 6.7, w: 8.5, h: .25, fontFace: 'Aptos', fontSize: 9, color: 'BFD8CE' });

    // 2. Executive summary
    slide = pptx.addSlide();
    addHeader(slide, '01 · EXECUTIVE SUMMARY', 'Signals that require a decision', pptx);
    const summary = highPriority.slice(0, 4).map((d) => `${d.title} — ${d.text}`);
    if (!summary.length) summary.push('No priority developments are currently available in the tracker.');
    addBulletList(slide, summary, 1.65);
    slide.addShape(pptx.ShapeType.line, { x: .7, y: 4.85, w: 11.4, h: 0, line: { color: 'DCE1D9', width: 1 } });
    slide.addText(`${developments.length} tracked developments · ${opportunityCount} active pipeline items · ${events.length} upcoming engagements · ${sources.length} source records`, { x: .7, y: 5.2, w: 11, h: .3, fontFace: 'Aptos', fontSize: 11, bold: true, color: ink });
    slide.addText('Source-confirmed facts and analyst interpretation should remain clearly distinguished when this brief is used for client or management decisions.', { x: .7, y: 5.75, w: 10.8, h: .45, fontFace: 'Aptos', fontSize: 9, color: muted });
    addFooter(slide, 2, pptx);

    // 3. Developments
    slide = pptx.addSlide();
    addHeader(slide, '02 · MARKET DEVELOPMENTS', 'What changed in the tracker', pptx);
    developments.slice(0, 5).forEach((d, i) => {
      const y = 1.55 + i * 1.05;
      slide.addText(d.topic, { x: .65, y, w: 2.05, h: .18, fontFace: 'Aptos', fontSize: 7, bold: true, color: '28745F', charSpacing: .7 });
      slide.addText(d.title, { x: 2.65, y: y - .03, w: 7.2, h: .25, fontFace: 'Aptos', fontSize: 12, bold: true, color: ink });
      slide.addText(d.text, { x: 2.65, y: y + .31, w: 7.2, h: .32, fontFace: 'Aptos', fontSize: 8.5, color: muted });
      slide.addText(d.state, { x: 10.1, y: y + .02, w: 2, h: .18, fontFace: 'Aptos', fontSize: 7, bold: true, color: '28745F', align: 'right' });
      slide.addShape(pptx.ShapeType.line, { x: .65, y: y + .76, w: 11.25, h: 0, line: { color: 'E3E6DF', width: .6 } });
    });
    addFooter(slide, 3, pptx);

    // 4. Opportunity pipeline
    slide = pptx.addSlide();
    addHeader(slide, '03 · OPPORTUNITY PIPELINE', 'Where Fichtner should focus', pptx);
    const stages = ['Engage', 'Qualify', 'Monitor'];
    stages.forEach((stageName, col) => {
      const x = .65 + col * 4.05;
      const items = pipeline.filter((p) => p.stage.toLowerCase() === stageName.toLowerCase());
      slide.addText(stageName.toUpperCase(), { x, y: 1.55, w: 3.6, h: .2, fontFace: 'Aptos', fontSize: 8, bold: true, color: '4D746B', charSpacing: 1 });
      if (!items.length) {
        slide.addText('No current items', { x, y: 1.95, w: 3.5, h: .3, fontFace: 'Aptos', fontSize: 10, color: muted });
      }
      items.slice(0, 3).forEach((item, i) => {
        const y = 1.95 + i * 1.35;
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.55, h: 1.05, rectRadius: .05, line: { color: 'DCE1D9' }, fill: { color: cream } });
        slide.addText(item.name, { x: x + .2, y: y + .17, w: 3.1, h: .25, fontFace: 'Aptos', fontSize: 11, bold: true, color: ink });
        slide.addText(item.note, { x: x + .2, y: y + .48, w: 3.1, h: .28, fontFace: 'Aptos', fontSize: 8, color: muted });
        slide.addText(item.footer, { x: x + .2, y: y + .79, w: 3.1, h: .15, fontFace: 'Aptos', fontSize: 6.5, color: '28745F' });
      });
    });
    addFooter(slide, 4, pptx);

    // 5. Engagement
    slide = pptx.addSlide();
    addHeader(slide, '04 · ENGAGEMENT', 'Near-term relationship opportunities', pptx);
    if (!events.length) {
      slide.addText('No upcoming engagements are currently recorded.', { x: .75, y: 1.7, w: 8, h: .3, fontFace: 'Aptos', fontSize: 12, color: muted });
    }
    events.slice(0, 6).forEach((event, i) => {
      const y = 1.55 + i * .82;
      slide.addText(event.name, { x: .75, y, w: 5.6, h: .22, fontFace: 'Aptos', fontSize: 11, bold: true, color: ink });
      slide.addText(event.detail, { x: 6.35, y, w: 3.7, h: .22, fontFace: 'Aptos', fontSize: 8.5, color: muted });
      slide.addText(event.priority, { x: 10.2, y, w: 1.7, h: .22, fontFace: 'Aptos', fontSize: 7.5, bold: true, color: '28745F', align: 'right' });
      slide.addShape(pptx.ShapeType.line, { x: .75, y: y + .42, w: 11.1, h: 0, line: { color: 'E3E6DF', width: .6 } });
    });
    addFooter(slide, 5, pptx);

    // 6. Evidence
    slide = pptx.addSlide();
    addHeader(slide, '05 · SOURCE EVIDENCE', 'Audit trail behind the brief', pptx);
    sources.slice(0, 8).forEach((source, i) => {
      const y = 1.5 + i * .62;
      slide.addText(source.title, { x: .65, y, w: 6.3, h: .2, fontFace: 'Aptos', fontSize: 8.5, color: ink });
      slide.addText(source.type, { x: 7.05, y, w: 1.8, h: .2, fontFace: 'Aptos', fontSize: 7.5, color: muted });
      slide.addText(source.date, { x: 8.95, y, w: 1.45, h: .2, fontFace: 'Aptos', fontSize: 7.5, color: muted });
      slide.addText(`${source.claims} claims`, { x: 10.45, y, w: 1.35, h: .2, fontFace: 'Aptos', fontSize: 7.5, color: '28745F', align: 'right' });
    });
    slide.addText('This report is generated from the current Atlas tracker state. External source verification remains required before consequential decisions.', { x: .65, y: 6.3, w: 11.1, h: .35, fontFace: 'Aptos', fontSize: 8, color: muted });
    addFooter(slide, 6, pptx);

    const safeName = reportType.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
    const fileName = `Atlas_Morocco_Renewable_Intelligence_${safeName}_${period.replace(/[^a-z0-9]+/gi, '_')}.pptx`;
    const status = $('reportStatus');
    if (status) status.textContent = 'Preparing PowerPoint download…';
    pptx.writeFile({ fileName }).then(() => {
      if (status) status.textContent = `PowerPoint generated: ${fileName}`;
    }).catch((error) => {
      console.error(error);
      if (status) status.textContent = 'PowerPoint generation failed. Check the browser console for details.';
    });
  }

  function updatePreview() {
    const cover = document.querySelector('#reportPreview .report-cover');
    if (!cover) return;
    const type = $('reportType')?.value || 'Weekly Intelligence Brief';
    const period = $('reportPeriod')?.value || '';
    const classification = $('reportClassification')?.value || '';
    const title = cover.querySelector('h2');
    const meta = cover.querySelector('small');
    if (title) title.innerHTML = type.replace(/ /g, ' ').replace(' ', '<br />');
    if (meta) meta.textContent = `${period} · ${classification}`;
  }

  window.addEventListener('DOMContentLoaded', () => {
    const button = $('downloadPpt');
    if (button) button.onclick = buildReport;
    ['reportType', 'reportPeriod', 'reportClassification'].forEach((id) => $(id)?.addEventListener('input', updatePreview));
    updatePreview();
  });
})();
