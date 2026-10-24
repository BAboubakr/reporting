import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanSignals } from '../data-cleaner.js';
import { eventMilestone } from '../data/event-deduplicator.js';

const archive = JSON.parse(readFileSync(new URL('../data/archive/signals.json', import.meta.url), 'utf8')).signals;
const currentSource = readFileSync(new URL('../data/signals.js', import.meta.url), 'utf8');
const currentSignals = JSON.parse(currentSource.slice(currentSource.indexOf('=') + 1, currentSource.lastIndexOf(';')).trim());

function records(ids) {
  return ids.map(id => {
    const record = archive.find(signal => signal.id === id);
    assert.ok(record, `expected actual archived signal ${id}`);
    return record;
  });
}

function assertMerged(ids, expectedSources) {
  const output = cleanSignals(records(ids));
  assert.equal(output.length, 1, `expected one event for ${ids.join(', ')}`);
  assert.ok(output[0].sourceCount >= expectedSources, `expected at least ${expectedSources} preserved source records`);
  return output[0];
}

// A: same MASEN NOOR PV tender. Bold mathematical digits and letters must
// normalize to the same 350 MW capacity as the second report.
const noor = assertMerged(['sig-li-dfd3812d51333a', 'sig-li-d88f28f47ae64a'], 2);
assert.equal(noor.eventType, 'tender');

// B: a call for projects and later opening of applications are separate
// programme milestones, even though the programme and sponsors are identical.
const gcip = cleanSignals(records(['sig-li-543a40adb63374', 'sig-li-13886fa5a3b5d9']));
assert.equal(gcip.length, 2);
assert.deepEqual(new Set(gcip.map(eventMilestone)), new Set(['programme-call', 'applications-open']));

// C: three differently formatted reports of the same signed MEL/CEBC agreement.
assertMerged(['sig-li-0beff5c55b4154', 'sig-li-863a11c2ce684d', 'sig-li-742240e179b8d0'], 3);

// D: one project family, three distinct events: financing, planned launch,
// and operations start. They must remain separate developments.
const gotion = cleanSignals(records(['sig-li-7dd2a8916124b4', 'sig-76a7f285f97d', 'sig-li-b1b706fc88eb65']));
assert.equal(gotion.length, 3);
assert.deepEqual(new Set(gotion.map(eventMilestone)), new Set(['financing', 'planned-launch', 'operations-start']));
assert.equal(new Set(gotion.map(signal => signal.eventFamilyId)).size, 1);
assert.ok(gotion.every(signal => signal.eventFamilyId), 'all Gotion milestones should share a project family');

// E: repeated reports of the same MASEN solar measurement tender consolidate,
// while the subsequent measurement programme start stays as another milestone.
const measurement = cleanSignals(records([
  'sig-li-16741aba12e606', 'sig-li-88da49d73a9a72', 'sig-li-fb402f10657356', 'sig-li-2f4cbb4805205a',
  'sig-li-fa5ce9fe5bc441', 'sig-li-f9cc5ae65a4c9a'
]));
assert.equal(measurement.length, 2);
assert.deepEqual(new Set(measurement.map(eventMilestone)), new Set(['tender', 'measurement-programme-start']));
assert.deepEqual(measurement.map(signal => signal.sourceCount).sort((a, b) => a - b), [1, 2]);

console.log(`PASS: five repository-backed duplicate/milestone cases; current feed ${currentSignals.length} -> ${cleanSignals(currentSignals).length} developments.`);

