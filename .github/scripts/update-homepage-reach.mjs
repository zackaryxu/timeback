import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const states = [
  'AL Alabama', 'AK Alaska', 'AZ Arizona', 'AR Arkansas', 'CA California', 'CO Colorado',
  'CT Connecticut', 'DE Delaware', 'FL Florida', 'GA Georgia', 'HI Hawaii', 'ID Idaho',
  'IL Illinois', 'IN Indiana', 'IA Iowa', 'KS Kansas', 'KY Kentucky', 'LA Louisiana',
  'ME Maine', 'MD Maryland', 'MA Massachusetts', 'MI Michigan', 'MN Minnesota',
  'MS Mississippi', 'MO Missouri', 'MT Montana', 'NE Nebraska', 'NV Nevada',
  'NH New Hampshire', 'NJ New Jersey', 'NM New Mexico', 'NY New York',
  'NC North Carolina', 'ND North Dakota', 'OH Ohio', 'OK Oklahoma', 'OR Oregon',
  'PA Pennsylvania', 'RI Rhode Island', 'SC South Carolina', 'SD South Dakota',
  'TN Tennessee', 'TX Texas', 'UT Utah', 'VT Vermont', 'VA Virginia', 'WA Washington',
  'WV West Virginia', 'WI Wisconsin', 'WY Wyoming',
].map(entry => [entry.slice(0, 2), entry.slice(3).toLowerCase()])
  .sort(([, first], [, second]) => second.length - first.length);

function normalized(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

const stateCodes = new Map(states.flatMap(([code, name]) => [[code.toLowerCase(), code], [name, code]]));
const regionNames = new Intl.DisplayNames('en', { type: 'region', fallback: 'none' });
const countryCodes = new Map();
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nonCountries = new Set(['EU', 'EZ', 'QO', 'UN', 'XA', 'XB', 'ZZ']);
for (const first of letters) {
  for (const second of letters) {
    const code = first + second;
    if (nonCountries.has(code) || new Intl.Locale(`und-${code}`).region !== code) continue;
    const name = regionNames.of(code);
    if (name) countryCodes.set(normalized(name), code);
  }
}
for (const [name, code] of Object.entries({
  'us': 'US', 'u.s.': 'US', 'usa': 'US', 'u.s.a.': 'US', 'united states of america': 'US',
  'uk': 'GB', 'u.k.': 'GB', 'uae': 'AE', 'czech republic': 'CZ', 'turkey': 'TR',
  'republic of korea': 'KR', 'republic of georgia': 'GE', 'vietnam': 'VN',
})) countryCodes.set(name, code);

// Overrides apply only to the legacy label reviewed for that specific chapter.
const reviewedLocations = {
  'timeback-at-school-bf30dc3ac252': ['taipei', 'TW'],
  'timeback-at-epsom-college-malaysia-66c3e6f95784': ['kuala lumpur', 'MY'],
  'timeback-in-frisco-12618ab97039': ['frisco, united states', 'US', 'TX'],
  'timeback-in-philadelphia-maryland-70032b7c94c5': ['philadelphia maryland, united states', 'US'],
};

function chapterGeography({ id, location }) {
  const parts = location.split(',').map(normalized).filter(Boolean);
  const [reviewedLabel, reviewedCountry, reviewedState] = reviewedLocations[id] || [];
  if (parts.join(', ') === reviewedLabel) return [reviewedCountry, reviewedState];

  const last = parts.at(-1);
  const country = countryCodes.get(last);
  // A bare Georgia suffix can identify either a country or a U.S. state.
  if (last === 'georgia' && parts.length < 3) return [];
  if (country && country !== 'US') return [country];
  if (country === 'US') {
    const region = parts.at(-2);
    if (!region) return ['US'];
    // Some older records combine the city and the full state name.
    const suffix = states.find(([, name]) => region.endsWith(` ${name}`));
    return ['US', stateCodes.get(region) || suffix?.[0]];
  }
  const state = parts.length > 1 ? stateCodes.get(last) : undefined;
  return state ? ['US', state] : [];
}

const countryLabels = { TR: 'Turkey' };
const reachBlock = /<div class="network-reach" aria-label="[^"]*">\s*<strong>[^<]*<\/strong>(?:\s*<span>[^<]*<\/span>)*\s*<\/div>/g;
const escapeHtml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function refreshHomepage(root) {
  const content = join(root, 'chapter-content');
  const readJson = path => JSON.parse(readFileSync(join(content, path), 'utf8'));
  const manifest = readJson('manifest.json');
  if (manifest.schema !== 1 || !manifest.chapters ||
      typeof manifest.chapters !== 'object' || Array.isArray(manifest.chapters)) {
    throw new Error('Unexpected chapter manifest');
  }

  let chapterCount = 0;
  const countries = new Set();
  const usStates = new Set();
  for (const [id, entry] of Object.entries(manifest.chapters)) {
    if (entry.retired) continue;
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid chapter ID: ${id}`);
    const chapter = readJson(`chapters/${id}.json`);
    if (chapter.id !== id || !['official', 'upcoming'].includes(chapter.status) ||
        typeof chapter.location !== 'string') {
      throw new Error(`Unexpected public chapter record: ${id}`);
    }
    if (chapter.status === 'official') chapterCount++;
    // Upcoming registrations contribute to geographic reach, as on the current homepage.
    const [country, state] = chapterGeography(chapter);
    if (country) countries.add(country);
    if (state) usStates.add(state);
  }

  const reach = countries.size + usStates.size;
  const headline = `${chapterCount} ${chapterCount === 1 ? 'chapter' : 'chapters'} across ${reach} states and countries`;
  const labels = [...countries].filter(code => code !== 'US')
    .map(code => countryLabels[code] || regionNames.of(code));
  if (countries.has('US')) labels.unshift('United States');
  const block = [
    `<div class="network-reach" aria-label="${headline}">`,
    `    <strong>${headline}</strong>`,
    ...labels.map(label => `    <span>${escapeHtml(label)}</span>`),
    '  </div>',
  ].join('\n');

  const homepage = join(root, 'index.html');
  const original = readFileSync(homepage, 'utf8');
  if ([...original.matchAll(reachBlock)].length !== 1) {
    throw new Error('Expected one homepage network reach block');
  }
  const updated = original.replace(reachBlock, () => block);
  if (updated !== original) writeFileSync(homepage, updated);
  console.log(headline);
}

refreshHomepage(process.argv[2] || '.');
