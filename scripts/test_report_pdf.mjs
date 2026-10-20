import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfReport } from '../report-pdf.js';

const stamp='2026-10-17T12:00:00Z';
function signal(index,overrides={}) {
  return {
    id:'event-'+index,eventId:'event-'+index,project:'Morocco solar package '+index,
    title:'MASEN awards solar package '+index+' for Ouarzazate',
    summary:'MASEN reported a solar development in Morocco. This record contains source-backed detail.',
    url:'https://news.example/story/'+index,source:'Energy Desk',published:stamp,
    signalType:'award',projectStage:'contract award',entities:['MASEN'],categories:['Solar PV'],
    relevanceScore:70-index,actionabilityScore:60-index,sourceCount:1,
    sources:[{url:'https://news.example/story/'+index,source:'Energy Desk',headline:'Solar package '+index,published:stamp}],
    ...overrides
  };
}

test('zero-signal report has a readable empty state and no missing-value artifacts',()=>{
  const html=buildPdfReport({signals:[],generatedAt:stamp});
  assert.match(html,/No qualifying developments were available/);
  assert.match(html,/Sources &amp; methodology/);
  assert.doesNotMatch(html,/undefined|null/);
});

test('one signal produces one event card and a clickable source',()=>{
  const html=buildPdfReport({signals:[signal(1)],generatedAt:stamp,reportPeriod:'10–17 Oct 2026'});
  assert.equal((html.match(/class="event-card"/g)||[]).length,1);
  assert.match(html,/href="https:\/\/news\.example\/story\/1"/);
  assert.match(html,/Evidence · 1 source/);
});

test('normal and large input sets are bounded to ten ranked developments',()=>{
  const html=buildPdfReport({signals:Array.from({length:200},(_,i)=>signal(i)),generatedAt:stamp});
  assert.equal((html.match(/class="event-card"/g)||[]).length,10);
  assert.match(html,/10 selected/);
});

test('long text wraps and unsafe source schemes are not emitted as links',()=>{
  const html=buildPdfReport({signals:[signal(1,{
    title:'MASEN '+('very-long-project-name-').repeat(30),
    summary:'Long evidence. '.repeat(200),
    sources:[{url:'javascript:alert(1)',source:'Unsafe'}]
  })],generatedAt:stamp});
  assert.match(html,/overflow-wrap:anywhere/);
  assert.doesNotMatch(html,/href="javascript:/i);
});

test('source lists and analytical interpretation stay separate from reported facts',()=>{
  const html=buildPdfReport({signals:[signal(1,{
    whyItMatters:'Analyst assessment: this award may create an owner-engineering opportunity.',
    sources:[{url:'https://source-a.example/item',source:'Source A'},{url:'https://source-b.example/item',source:'Source B'}]
  })],generatedAt:stamp});
  assert.match(html,/Atlas assessment · analytical/);
  assert.match(html,/Source A/);
  assert.match(html,/Source B/);
  assert.match(html,/Evidence · 2 sources/);
});

test('a long source list remains complete and remains link-addressable',()=>{
  const sources=Array.from({length:40},(_,i)=>({url:'https://source-'+i+'.example/item',source:'Source '+i}));
  const html=buildPdfReport({signals:[signal(1,{sources,sourceCount:sources.length})],generatedAt:stamp});
  assert.equal((html.match(/<li><a href=/g)||[]).length,40);
  assert.match(html,/Evidence · 40 sources/);
});

