import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSignals, getMoroccoReviewSignals, isNoiseSignal } from '../data-cleaner.js';

const relevantSignal = overrides => ({
  id: 'fixture',
  title: 'Morocco solar project development update',
  summary: 'A solar project development update in Morocco.',
  evidenceSnippet: 'Morocco solar project development update.',
  source: 'Example News',
  sourceType: 'news',
  url: 'https://example.com/story',
  evidenceLevel: 'news source',
  entities: ['Morocco'],
  ...overrides
});

test('keeps the existing empty-title and MASEN e-Tendering noise guards', () => {
  assert.equal(isNoiseSignal(relevantSignal({ title: '' })), true);

  const navigationLabels = [
    "Guides d’utilisation",
    'Outils informatiques',
    'Consultations en cours',
    '0 entités publiques inscrites',
    'Tester la configuration de mon poste',
    'Spécifications techniques',
    'Specifications techniques',
    'Accueil',
    'Connexion',
    'Se connecter',
    'Menu',
    'Rechercher'
  ];
  for (const title of navigationLabels) {
    assert.equal(isNoiseSignal({
      title,
      source: 'MASEN e-Tendering',
      url: 'https://e-tendering.masen.ma/'
    }), true, `${title} should remain portal noise`);
  }

  for (const title of ['Matériel accepté réseau ONEE', 'Materiel accepte reseau ONEE', 'Matriel accept rseau ONEE']) {
    assert.equal(isNoiseSignal(relevantSignal({ title })), true, `${title} should remain a known noise case`);
  }
  assert.equal(isNoiseSignal(relevantSignal({
    summary: 'Market movement signal relevant to Morocco renewable-energy activity'
  })), true, 'generated boilerplate should remain excluded');
  assert.equal(isNoiseSignal({
    title: 'Open',
    source: 'MASEN e-Tendering',
    url: 'https://e-tendering.masen.ma/'
  }), true, 'portal navigation without a development term should remain excluded');
  assert.equal(isNoiseSignal(relevantSignal({ title: 'Morocco project development update', summary: 'Morocco project development only.', evidenceSnippet: 'Morocco project development update.' })), true,
    'source-derived energy relevance must remain required');
  assert.equal(isNoiseSignal(relevantSignal({
    title: 'Morocco solar overview', summary: 'Solar overview in Morocco.', evidenceSnippet: 'Morocco solar information.'
  })), true, 'a concrete development term must remain required');
  assert.equal(isNoiseSignal(relevantSignal({
    title: 'Saudi Arabia solar project', summary: 'Saudi Arabia solar project.', evidenceSnippet: 'Saudi Arabia solar project.'
  }), { skipMoroccoGate: true }), true, 'foreign-only noise should remain excluded');
});

test('filters generic institutional FAQ, registration, and how-to pages', () => {
  for (const title of ['FAQ: Solar procurement', 'Vendor registration', 'How to submit a tender']) {
    assert.equal(isNoiseSignal(relevantSignal({ title })), true, `${title} should be excluded`);
  }
});

test('moves unsubstantiated Morocco signals to REVIEW and keeps them out of clean analytics', () => {
  const signal = relevantSignal({
    id: 'no-morocco',
    title: 'Solar project development update',
    summary: 'A solar project development update.',
    evidenceSnippet: 'The project is under development.',
    entities: ['Example Energy']
  });

  const review = getMoroccoReviewSignals([signal]);
  assert.equal(review.length, 1);
  assert.equal(review[0].filterDecision, 'REVIEW');
  assert.match(review[0].filterReason, /Morocco relevance/i);

  const cleaned = cleanSignals([signal]);
  assert.equal(cleaned.length, 0, 'review records must not enter counts, pipeline, or reports');
  assert.equal(cleaned.reviewSignals[0].filterDecision, 'REVIEW');
});

test('accepts Morocco evidence from title, summary, entities, or a sourced snippet', () => {
  const cases = [
    relevantSignal({ id: 'title', title: 'Morocco solar project development update' }),
    relevantSignal({ id: 'summary', title: 'Solar project development update', summary: 'A new project in Morocco.' }),
    relevantSignal({ id: 'entity', title: 'Solar project development update', entities: ['Morocco'] }),
    relevantSignal({ id: 'snippet', title: 'Solar project development update', evidenceSnippet: 'Morocco project development details.' })
  ];

  for (const signal of cases) {
    assert.equal(isNoiseSignal(signal), false, `${signal.id} should pass the Morocco relevance gate`);
    assert.equal(getMoroccoReviewSignals([signal]).length, 0);
  }
});

test('allows the named official institutions through the Morocco gate', () => {
  for (const source of ['MASEN', 'ONEE', 'ANRE', 'AfDB', 'World Bank', 'EBRD', 'KfW', 'EIB']) {
    const signal = relevantSignal({
      id: `official-${source}`,
      sourceType: 'official',
      source,
      title: 'Solar project development update',
      summary: 'An update on a solar energy project.',
      evidenceSnippet: 'Project development details.',
      entities: []
    });
    assert.equal(isNoiseSignal(signal), false, `${source} should pass the official-source exception`);
    assert.equal(getMoroccoReviewSignals([signal]).length, 0);
  }
  assert.equal(isNoiseSignal(relevantSignal({
    source: 'MASEN',
    title: 'Solar project development update',
    summary: 'An update on a solar energy project.',
    evidenceSnippet: 'Project development details.',
    entities: []
  })), true, 'institution names alone must not exempt non-official records');
});

test('collapses titles with the same normalized first 60 characters and keeps the official record', () => {
  const common = 'Morocco solar project development update covering technical preparation and expected capacity';
  const news = relevantSignal({
    id: 'news-copy',
    title: `${common} according to a market report`,
    summary: 'A market report describes project preparation in Morocco.',
    evidenceSnippet: 'Morocco solar project preparation.',
    source: 'Example News',
    sourceType: 'news',
    url: 'https://example.com/news-copy',
    evidenceLevel: 'news source'
  });
  const official = relevantSignal({
    id: 'official-copy',
    title: `${common.replace('solar', 'sólar')} confirmed by the project owner`,
    summary: 'The project owner describes development preparation in Morocco.',
    evidenceSnippet: 'Morocco solar project preparation.',
    source: 'MASEN',
    sourceType: 'official',
    url: 'https://masen.ma/official-copy',
    evidenceLevel: 'official source'
  });

  const cleaned = cleanSignals([news, official]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, 'official-copy');
  assert.equal(cleaned[0].sources.length, 2);
});

