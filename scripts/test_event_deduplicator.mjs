import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, deduplicateEvents, explainEventMatch } from '../data/event-deduplicator.js';

function article(overrides={}) {
  return {
    id: 'source-a',
    title: 'MASEN awards Noor Atlas PV construction contract',
    summary: 'MASEN selected a contractor for the 350 MW Noor Atlas PV project in Ouarzazate, Morocco.',
    url: 'https://news.example/masen-noor-atlas-award',
    source: 'Energy Desk',
    sourceType: 'news',
    published: '2026-10-10T09:00:00Z',
    detected: '2026-10-10T10:00:00Z',
    signalType: 'award',
    projectStage: 'contract award',
    project: 'Noor Atlas PV',
    entities: ['MASEN'],
    categories: ['Solar PV'],
    ...overrides
  };
}

test('tracking URL variants consolidate while original URLs remain available',()=>{
  const a=article({url:'https://www.news.example/story?id=7&utm_source=mail#top'});
  const b=article({id:'source-b',url:'https://news.example/story?utm_campaign=weekly&id=7&fbclid=abc'});
  assert.equal(canonicalizeUrl(a.url),canonicalizeUrl(b.url));
  const [event]=deduplicateEvents([a,b]);
  assert.equal(event.sourceCount,1);
  assert.ok(event.sources[0].originalUrl);
});

test('same award across publications keeps both source links',()=>{
  const a=article();
  const b=article({id:'source-b',title:'Contractor selected for Noor Atlas photovoltaic project',
    summary:'The 350 MW project at Ouarzazate will be built for MASEN.',
    url:'https://journal.example/awarded-noor-atlas',source:'Morocco Journal',
    published:'2026-10-11T09:00:00Z'});
  const [event]=deduplicateEvents([a,b]);
  assert.equal(event.sourceCount,2);
  assert.equal(event.sources.length,2);
});

test('English and French coverage merges with a matching project and event type',()=>{
  const a=article();
  const b=article({id:'source-fr',title:'MASEN attribue le marché de construction du projet Noor Atlas PV',
    summary:'Le projet photovoltaïque de 350 MW sera réalisé à Ouarzazate pour MASEN.',
    url:'https://journal.example/fr/noor-atlas-marche',source:'Journal du Maroc',
    published:'2026-10-12T09:00:00Z',projectStage:'lauréat'});
  assert.equal(explainEventMatch(a,b).match,true);
  assert.equal(deduplicateEvents([a,b]).length,1);
});

test('separate tenders from the same institution remain separate',()=>{
  const a=article({signalType:'tender',projectStage:'tender',project:'ONEE Midelt BESS tender',
    tenderId:'ONEE-12/2026',title:'ONEE tenders 200 MW Midelt battery storage project',
    summary:'ONEE invited bids for a 200 MW BESS near Midelt, Morocco.'});
  const b=article({signalType:'tender',projectStage:'tender',project:'ONEE Safi grid tender',
    tenderId:'ONEE-13/2026',title:'ONEE tenders Safi transmission substation works',
    summary:'ONEE invited bids for a new grid substation at Safi, Morocco.'});
  assert.equal(deduplicateEvents([a,b]).length,2);
});

test('a tender and its later award stay separate and link by project family',()=>{
  const a=article({signalType:'tender',projectStage:'tender',
    title:'MASEN opens tender for Noor Atlas PV project',
    summary:'MASEN invites bids for the 350 MW solar project in Ouarzazate.'});
  const b=article({id:'award-story',signalType:'award',projectStage:'contract award',
    title:'MASEN awards Noor Atlas PV construction contract',
    url:'https://journal.example/noor-atlas-award',
    summary:'MASEN selected a contractor for the 350 MW solar project in Ouarzazate.'});
  const events=deduplicateEvents([a,b]);
  assert.equal(events.length,2);
  assert.equal(events[0].eventFamilyId,events[1].eventFamilyId);
});

test('different project phases are not merged',()=>{
  const a=article({signalType:'project milestone',projectStage:'construction phase 1',
    title:'Construction starts on Noor Atlas PV phase one',
    summary:'Work begins on phase 1 of the 350 MW solar project in Ouarzazate.'});
  const b=article({id:'phase-two',signalType:'project milestone',projectStage:'construction phase 2',
    title:'Construction starts on Noor Atlas PV phase two',
    url:'https://journal.example/noor-phase-two',
    summary:'Work begins on phase 2 of the 350 MW solar project in Ouarzazate.'});
  assert.equal(deduplicateEvents([a,b]).length,2);
});

test('a republished article update retains its previous wording',()=>{
  const a=article();
  const b=article({detected:'2026-10-12T10:00:00Z',
    summary:'MASEN selected a contractor for the 350 MW Noor Atlas PV project in Ouarzazate, Morocco. Commissioning support is included.'});
  const [event]=deduplicateEvents([a,b]);
  assert.equal(event.sourceCount,1);
  assert.ok(event.sources[0].updates?.length);
  assert.match(event.sources[0].summary,/Commissioning support/);
});

test('reprocessing a batch is idempotent',()=>{
  const first=deduplicateEvents([article(),article({id:'copy',url:'https://journal.example/noor-award',source:'Other News'})]);
  const again=deduplicateEvents(first);
  assert.equal(again.length,first.length);
  assert.equal(again[0].sourceCount,first[0].sourceCount);
  assert.equal(again[0].eventId,first[0].eventId);
});

test('incomplete or malformed URLs and dates are safe',()=>{
  const events=deduplicateEvents([{title:'No metadata',url:'ht!tp://bad url',published:'not-a-date'},
    {title:'Solar tender in Morocco',url:3,summary:null,published:null}]);
  assert.equal(events.length,2);
});

test('evidence without enough identity anchors stays separate',()=>{
  const a=article({project:'',signalType:'tender',projectStage:'tender',title:'ONEE tenders solar procurement',
    summary:'ONEE opens a solar procurement tender in Morocco.'});
  const b=article({project:'',id:'other',signalType:'tender',projectStage:'tender',
    title:'ONEE tenders solar procurement',summary:'ONEE opens another solar procurement tender in Morocco.',
    url:'https://journal.example/second-onee-tender'});
  assert.equal(deduplicateEvents([a,b]).length,2);
});

