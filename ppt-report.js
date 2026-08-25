function esc(value='') {
  return String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function dateLabel(value) {
  if (!value) return 'Undated';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
}

function topSignals(signals) {
  return [...signals].sort((a,b) => {
    const ar = Number(a.relevanceScore || 0), br = Number(b.relevanceScore || 0);
    const aa = Number(a.actionabilityScore || 0), ba = Number(b.actionabilityScore || 0);
    return (br + ba) - (ar + aa);
  }).slice(0, 6);
}

function themeCounts(signals) {
  const map = new Map();
  signals.forEach(s => (s.categories || []).forEach(c => map.set(c, (map.get(c) || 0) + 1)));
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
}

function addHeader(slide, kicker, title, subtitle='') {
  slide.addText(kicker.toUpperCase(), {x:.55,y:.35,w:4.5,h:.22,fontSize:9,bold:true,color:'5D6B70',charSpacing:1.2,margin:0});
  slide.addText(title, {x:.55,y:.7,w:11.7,h:.55,fontSize:25,bold:true,color:'173B37',margin:0,fit:'shrink'});
  if (subtitle) slide.addText(subtitle, {x:.55,y:1.3,w:11.7,h:.35,fontSize:11,color:'66757A',margin:0,fit:'shrink'});
}

function addSignalCard(slide, s, x, y, w, h) {
  const priority = String(s.fichtnerRelevance || 'WATCH').toUpperCase();
  const accent = priority === 'HIGH' ? '173B37' : priority === 'MEDIUM' ? '2C6E68' : '87979A';
  slide.addShape('roundRect', {x,y,w,h,rectRadius:.06,line:{color:'DCE4E2',width:1},fill:{color:'FFFFFF'}});
  slide.addShape('rect', {x,y,w:.07,h, line:{color:accent,transparency:100},fill:{color:accent}});
  slide.addText(priority, {x:x+.2,y:y+.16,w:1.1,h:.2,fontSize:8,bold:true,color:accent,charSpacing:.8,margin:0});
  slide.addText(dateLabel(s.published), {x:x+w-1.45,y:y+.16,w:1.25,h:.2,fontSize:8,color:'78878B',align:'right',margin:0});
  slide.addText(s.headline || s.title || 'Untitled signal', {x:x+.2,y:y+.5,w:w-.4,h:.48,fontSize:13,bold:true,color:'173B37',margin:0,fit:'shrink',breakLine:false});
  const meta = [s.signalType, s.projectStage, s.source].filter(Boolean).join(' · ');
  slide.addText(meta, {x:x+.2,y:y+1.05,w:w-.4,h:.3,fontSize:8.5,color:'68777B',margin:0,fit:'shrink'});
  const why = s.whyItMatters || s.summary || s.evidenceSnippet || 'Signal detected by Atlas monitoring.';
  slide.addText(why, {x:x+.2,y:y+1.4,w:w-.4,h:h-1.62,fontSize:9.5,color:'35464A',margin:0,breakLine:false,fit:'shrink'});
}

async function generateStructuredPpt() {
  const status = document.getElementById('reportStatus');
  if (status) status.textContent = 'Generating intelligence report…';
  try {
    const { signals = [] } = await import('./data/signals.js?report=20260825');
    const Pptx = window.PptxGenJS || window.pptxgen;
    if (typeof Pptx !== 'function') throw new Error('PowerPoint engine did not load.');
    const usable = signals.filter(s => s && (s.headline || s.title) && s.url);
    const ranked = topSignals(usable);
    const high = usable.filter(s => String(s.fichtnerRelevance).toUpperCase() === 'HIGH').length;
    const primary = usable.filter(s => /official|primary|government|regulator|utility/i.test(String(s.evidenceLevel || s.sourceType || ''))).length;
    const themes = themeCounts(usable);
    const pptx = new Pptx();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Atlas';
    pptx.company = 'Fichtner';
    pptx.subject = 'Morocco Renewable Energy Intelligence';
    pptx.title = document.getElementById('reportType')?.value || 'Morocco Renewable Energy Intelligence Brief';
    pptx.lang = 'en-US';

    let s = pptx.addSlide();
    s.background = {color:'173B37'};
    s.addText('ATLAS', {x:.65,y:.55,w:2,h:.3,fontSize:18,bold:true,color:'FFFFFF',margin:0,charSpacing:1});
    s.addText('MOROCCO RENEWABLE ENERGY', {x:.65,y:2.0,w:10.8,h:.55,fontSize:25,bold:true,color:'FFFFFF',margin:0});
    s.addText('INTELLIGENCE BRIEF', {x:.65,y:2.65,w:10.8,h:.55,fontSize:25,bold:true,color:'B9D7D1',margin:0});
    s.addText(`${dateLabel(new Date())} · ${usable.length} structured signals`, {x:.65,y:3.45,w:8,h:.3,fontSize:11,color:'D7E6E2',margin:0});
    s.addText('Decision-oriented monitoring of projects, procurement, policy, competitors and market movements.', {x:.65,y:5.55,w:10.8,h:.55,fontSize:12,color:'D7E6E2',margin:0,fit:'shrink'});

    s = pptx.addSlide();
    addHeader(s,'01 · Executive signal','What requires attention now',`${high} high-priority signals · ${primary} primary/official evidence records · ${usable.length} total structured signals`);
    ranked.slice(0,4).forEach((item,i)=>addSignalCard(s,item,.55+(i%2)*6.05,1.9+Math.floor(i/2)*2.45,5.7,2.15));

    s = pptx.addSlide();
    addHeader(s,'02 · Market pulse','Activity by theme','Signal volume from the same structured dataset used by Atlas monitoring.');
    const max = Math.max(1,...themes.map(t=>t[1]));
    themes.forEach(([theme,count],i)=>{
      const y=1.95+i*.65;
      s.addText(theme,{x:.7,y,w:3.2,h:.22,fontSize:10,bold:true,color:'294B47',margin:0,fit:'shrink'});
      s.addShape('roundRect',{x:3.9,y:y+.01,w:6.2,h:.2,rectRadius:.04,line:{color:'DCE4E2',transparency:100},fill:{color:'E8EFED'}});
      s.addShape('roundRect',{x:3.9,y:y+.01,w:6.2*(count/max),h:.2,rectRadius:.04,line:{color:'2C6E68',transparency:100},fill:{color:'2C6E68'}});
      s.addText(String(count),{x:10.35,y:y-.02,w:.55,h:.25,fontSize:10,bold:true,color:'173B37',align:'right',margin:0});
    });
    s.addText('Interpretation', {x:.7,y:6.15,w:1.4,h:.25,fontSize:9,bold:true,color:'5D6B70',margin:0});
    s.addText('Atlas prioritises signals by relevance, actionability, novelty and evidence quality rather than treating every publication equally.', {x:2.0,y:6.12,w:9.8,h:.35,fontSize:9.5,color:'4C5B5F',margin:0,fit:'shrink'});

    s = pptx.addSlide();
    addHeader(s,'03 · Signal register','Priority intelligence','The strongest signals with evidence traceability and Fichtner relevance.');
    ranked.slice(0,5).forEach((item,i)=>addSignalCard(s,item,.55,1.8+i*.95,12.0,.78));
    ranked.slice(0,5).forEach((item,i)=>{
      s.addText(`${item.source || 'Source'} · ${item.url}`,{x:6.8,y:1.8+i*.95+.5,w:5.2,h:.16,fontSize:7,color:'647477',margin:0,fit:'shrink'});
    });

    s = pptx.addSlide();
    addHeader(s,'04 · Strategic implications','What Atlas suggests','The report separates evidence from interpretation so the next action is visible.');
    const implications = ranked.slice(0,4).map((x,i)=>({n:i+1,title:x.headline||x.title,text:x.whyItMatters||x.summary||'Review the source and assess potential commercial relevance.'}));
    implications.forEach((it,i)=>{
      const y=1.9+i*1.15;
      s.addText(String(it.n).padStart(2,'0'),{x:.65,y,w:.45,h:.35,fontSize:16,bold:true,color:'2C6E68',margin:0});
      s.addText(it.title,{x:1.3,y,w:4.5,h:.3,fontSize:11,bold:true,color:'173B37',margin:0,fit:'shrink'});
      s.addText(it.text,{x:5.9,y:y-.02,w:6.0,h:.55,fontSize:9.5,color:'4C5B5F',margin:0,fit:'shrink'});
    });

    s = pptx.addSlide();
    addHeader(s,'05 · Evidence','Source traceability','Every highlighted signal links back to its original source.');
    ranked.slice(0,8).forEach((item,i)=>{
      const y=1.85+i*.55;
      s.addText(dateLabel(item.published),{x:.65,y,w:1.05,h:.18,fontSize:7.5,color:'657477',margin:0});
      s.addText(item.source || 'Unknown source',{x:1.85,y,w:2.0,h:.18,fontSize:8.5,bold:true,color:'294B47',margin:0,fit:'shrink'});
      s.addText(item.headline || item.title,{x:3.95,y,w:5.7,h:.18,fontSize:8.5,color:'35464A',margin:0,fit:'shrink'});
      s.addText(item.url,{x:9.7,y,w:2.75,h:.18,fontSize:7,color:'2C6E68',margin:0,fit:'shrink'});
    });

    await pptx.writeFile({fileName:'Atlas_Morocco_Renewable_Intelligence_Brief.pptx'});
    if (status) status.textContent = 'PowerPoint generated from structured Atlas signals.';
  } catch (err) {
    console.error(err);
    if (status) status.textContent = `PowerPoint generation failed: ${err.message}`;
  }
}

function install() {
  const old = document.getElementById('downloadPpt');
  if (!old || old.dataset.structuredPpt === 'true') return;
  const replacement = old.cloneNode(true);
  replacement.dataset.structuredPpt = 'true';
  old.replaceWith(replacement);
  replacement.addEventListener('click', generateStructuredPpt);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
else install();
