/**
 * Merge Babel geo snapshot into the full Syria address hierarchy.
 *
 * Goals:
 * - Keep all 14 Syrian governorates (and non-Babel districts/neighbourhoods)
 *   so other carriers still have coverage.
 * - Overlay Babel city → area → neighbourhood names so Babel-supported places
 *   exist locally in the exact names Babel accepts.
 * - Emit a name→babelNeighbourhoodId index for the Babel shipping adapter.
 *
 * Usage (from repo root or shared/syria-locations):
 *   node merge-babel-into-syria-hierarchy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = __dirname;
const syriaPath = path.join(dir, 'syria-address-hierarchy.json');
const babelPath = path.join(dir, 'babel-geo-snapshot.json');
const outHierarchy = path.join(dir, 'syria-address-hierarchy.json');
const outIndex = path.join(dir, 'babel-address-index.json');
const outReport = path.join(dir, 'babel-syria-merge-report.json');

const copyTargets = [
  path.join(dir, '../../frontend/src/data/syria-address-hierarchy.json'),
  path.join(dir, '../../client-frontend/src/data/syria-address-hierarchy.json'),
  path.join(dir, '../../backend/src/data/syria-locations/syria-address-hierarchy.json'),
  path.join(
    dir,
    '../../backend/src/modules/client-portal/external-api/syria-address-hierarchy.json',
  ),
  path.join(dir, '../../frontend/src/data/babel-address-index.json'),
  path.join(dir, '../../client-frontend/src/data/babel-address-index.json'),
  path.join(dir, '../../backend/src/data/syria-locations/babel-address-index.json'),
];

function uniqSorted(arr) {
  return [...new Set(arr.filter((x) => typeof x === 'string' && x.trim()))].sort((a, b) =>
    a.localeCompare(b, 'ar'),
  );
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const syria = JSON.parse(fs.readFileSync(syriaPath, 'utf8'));
const babel = JSON.parse(fs.readFileSync(babelPath, 'utf8'));

const merged = deepClone(syria);
const index = {};
const report = {
  babelSyncedAt: babel.syncedAt ?? null,
  syriaGovernoratesBefore: Object.keys(syria).length,
  babelCities: babel.cities?.length ?? 0,
  babelAreas: 0,
  babelNeighbourhoods: 0,
  addedGovernorates: [],
  addedDistricts: [],
  addedNeighbourhoods: 0,
  babelCoverageCheck: {
    missingCities: [],
    missingAreas: [],
    missingNeighbourhoods: [],
  },
};

for (const city of babel.cities ?? []) {
  const govName = city.name;
  if (!merged[govName]) {
    merged[govName] = {};
    report.addedGovernorates.push(govName);
  }
  for (const area of city.areas ?? []) {
    report.babelAreas += 1;
    const districtName = area.name;
    if (!merged[govName][districtName]) {
      merged[govName][districtName] = [];
      report.addedDistricts.push(`${govName} › ${districtName}`);
    }
    const hoodSet = new Set(merged[govName][districtName]);
    for (const hood of area.neighbourhoods ?? []) {
      report.babelNeighbourhoods += 1;
      const key = `${govName}\u001f${districtName}\u001f${hood.name}`;
      index[key] = hood.id;
      if (!hoodSet.has(hood.name)) {
        hoodSet.add(hood.name);
        report.addedNeighbourhoods += 1;
      }
    }
    merged[govName][districtName] = uniqSorted([...hoodSet]);
  }
}

// Sort district keys under each governorate for stable output.
for (const gov of Object.keys(merged)) {
  const districts = merged[gov];
  const ordered = {};
  for (const d of Object.keys(districts).sort((a, b) => a.localeCompare(b, 'ar'))) {
    ordered[d] = uniqSorted(districts[d]);
  }
  merged[gov] = ordered;
}

// Coverage verification: every Babel city/area/hood must exist in merged hierarchy.
for (const city of babel.cities ?? []) {
  if (!merged[city.name]) {
    report.babelCoverageCheck.missingCities.push(city.name);
    continue;
  }
  for (const area of city.areas ?? []) {
    if (!merged[city.name][area.name]) {
      report.babelCoverageCheck.missingAreas.push(`${city.name} › ${area.name}`);
      continue;
    }
    const hoods = new Set(merged[city.name][area.name]);
    for (const hood of area.neighbourhoods ?? []) {
      if (!hoods.has(hood.name)) {
        report.babelCoverageCheck.missingNeighbourhoods.push(
          `${city.name} › ${area.name} › ${hood.name}`,
        );
      }
      const key = `${city.name}\u001f${area.name}\u001f${hood.name}`;
      if (index[key] !== hood.id) {
        report.babelCoverageCheck.missingNeighbourhoods.push(
          `INDEX MISMATCH ${key} expected=${hood.id} got=${index[key]}`,
        );
      }
    }
  }
}

report.syriaGovernoratesAfter = Object.keys(merged).length;
report.governorates = Object.keys(merged).sort((a, b) => a.localeCompare(b, 'ar'));
report.indexEntries = Object.keys(index).length;
report.ok =
  report.babelCoverageCheck.missingCities.length === 0 &&
  report.babelCoverageCheck.missingAreas.length === 0 &&
  report.babelCoverageCheck.missingNeighbourhoods.length === 0 &&
  report.syriaGovernoratesAfter >= 14;

fs.writeFileSync(outHierarchy, JSON.stringify(merged, null, 2) + '\n');
fs.writeFileSync(
  outIndex,
  JSON.stringify(
    {
      syncedAt: babel.syncedAt ?? null,
      separator: '\\u001f',
      keyFormat: 'governorate\\u001farea\\u001fneighbourhood',
      entries: index,
    },
    null,
    2,
  ) + '\n',
);
fs.writeFileSync(outReport, JSON.stringify(report, null, 2) + '\n');

for (const target of copyTargets) {
  const abs = path.resolve(target);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (abs.endsWith('babel-address-index.json')) {
    fs.copyFileSync(outIndex, abs);
  } else {
    fs.copyFileSync(outHierarchy, abs);
  }
}

console.log(JSON.stringify({
  ok: report.ok,
  governorates: report.syriaGovernoratesAfter,
  addedDistricts: report.addedDistricts.length,
  addedNeighbourhoods: report.addedNeighbourhoods,
  indexEntries: report.indexEntries,
  missingCities: report.babelCoverageCheck.missingCities.length,
  missingAreas: report.babelCoverageCheck.missingAreas.length,
  missingNeighbourhoods: report.babelCoverageCheck.missingNeighbourhoods.length,
  sampleAdded: report.addedDistricts.filter((x) => x.includes('حلب')).slice(0, 5),
}, null, 2));
