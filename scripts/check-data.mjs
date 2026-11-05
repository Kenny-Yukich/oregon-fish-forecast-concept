// Validate the shipped directory and its related datasets without network access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = file => {
  const window = {};
  new Function('window', readFileSync(new URL('../data/' + file, import.meta.url), 'utf8'))(window);
  return Object.values(window)[0];
};
const data = JSON.parse(readFileSync(new URL('../data/waters.json', import.meta.url), 'utf8'));
assert.deepEqual(load('waters.js'), data, 'waters.js must match waters.json');
const ids = new Set(data.waters.map(w => w.id));
assert.equal(ids.size, data.waters.length, 'Water ids must be unique');
assert.ok(ids.size > 0, 'The directory must contain waters');
for (const water of data.waters) {
  assert.doesNotMatch(water.region, /Washington/i, `${water.id} must not be a Washington water`);
  assert.equal(water.planning.water_id, water.id, `${water.id} planning id must match`);
}
const checkKeys = (label, values, complete = false) => {
  for (const id of Object.keys(values)) assert.ok(ids.has(id), `${label} has unknown water id ${id}`);
  if (complete) for (const id of ids) assert.ok(Object.hasOwn(values, id), `${label} is missing ${id}`);
};
checkKeys('Map', load('map.js').positions, true);
const monitoring = load('monitoring.js');
checkKeys('Monitoring', monitoring, true);
checkKeys('Stocking matches', load('stocking-match.js'));
checkKeys('Flow seasons', load('flow-seasons.js'));
checkKeys('Weather', load('weather.js').waters);
checkKeys('Angler reports', load('angler.js').waters);
const auto = load('auto-reports.js');
checkKeys('Automatic reports', auto.reports);
checkKeys('Automatic rules', auto.rules);
assert.equal(auto.weirs.length, 0, 'Washington tributary weirs must not be published in the Oregon guide');
for (const check of load('field-checks.js').checks) {
  // Field checks also accept plain names for waters outside the directory.
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(check.water)) {
    assert.ok(ids.has(check.water), `Field check has unknown water id ${check.water}`);
  }
}
const countStations = load('count-stations.js');
checkKeys('Fish-count mappings', countStations.waters);
for (const links of Object.values(countStations.waters)) {
  for (const link of links) assert.ok(countStations.stations[link.station], `Unknown fish-count station ${link.station}`);
}
for (const station of Object.keys(load('counts.js').stations)) {
  assert.ok(countStations.stations[station], `Counts have unknown station ${station}`);
}
const gaugeIds = new Set(Object.values(monitoring).map(m => m.station).filter(Boolean));
for (const station of Object.keys(load('conditions.js').stations)) {
  assert.ok(gaugeIds.has(station), `Conditions have unreferenced station ${station}`);
}
console.log(`Data checks passed: ${ids.size} Oregon waters, matching map and monitoring entries, no dangling water or station ids.`);
