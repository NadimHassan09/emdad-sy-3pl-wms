import { normalizeArabicCompare } from '../../../common/utils/arabic-text-normalize';
import hierarchyJson from './syria-address-hierarchy.json';

export type SyriaAddressHierarchy = Record<string, Record<string, string[]>>;

const HIERARCHY = hierarchyJson as SyriaAddressHierarchy;

const LOCATION_ALIASES: Record<string, string> = {
  'deir ez-zor': 'دير الزور',
  'deir-ez-zor': 'دير الزور',
  'deir ezzor': 'دير الزور',
  'al-hasakah': 'الحسكة',
  'al hasakah': 'الحسكة',
  'hasakah': 'الحسكة',
  'al-hasakeh': 'الحسكة',
  'al-qamishli': 'القامشلي',
  'al qamishli': 'القامشلي',
  'qamishli': 'القامشلي',
  'quamishli': 'القامشلي',
  'raqqa': 'الرقة',
  'ar-raqqa': 'الرقة',
  'raqqah': 'الرقة',
  'al-joura': 'الجورة',
  'joura': 'الجورة',
  'al-qusour': 'القصور',
  'qusour': 'القصور',
  'al-muwazafin': 'الموظفين',
  'muwazafin': 'الموظفين',
  'harabesh': 'هرابش',
  'al-tahtouh': 'الطحطوح',
  'tahtouh': 'الطحطوح',
  'al-hamidiyah': 'الحميدية',
  'hamidiyah': 'الحميدية',
  'al-jubaila': 'الجبيلة',
  'jubaila': 'الجبيلة',
  'al-rashidiya': 'الرشدية',
  'rashidiya': 'الرشدية',
  'al-arfi': 'العرفي',
  'arfi': 'العرفي',
  'al-hawiqa': 'الحويقة',
  'hawiqa': 'الحويقة',
  'al-ommal': 'العمال',
  'ommal': 'العمال',
  "al-ba'ajeen": 'البعاجين',
  "ba'ajeen": 'البعاجين',
  'al-ordi': 'العُرَضي',
  'ordi': 'العُرَضي',
  'al-kanamat': 'الكنامات',
  'kanamat': 'الكنامات',
  'al-shouakh': 'الشواخ',
  'shouakh': 'الشواخ',
  'abu abed': 'أبو عابد',
  'ghazi ayyash': 'غازي عياش',
  'al-masaken': 'المساكن',
  'masaken': 'المساكن',
  'al-madinah': 'المدينة',
  'madinah': 'المدينة',
  'al-matar al-shamali': 'المطار الشمالي',
  'matar shamali': 'المطار الشمالي',
  'al-wusta': 'الوسطى',
  'wusta': 'الوسطى',
  'al-malaab al-baladi': 'الملعب البلدي',
  'malaab baladi': 'الملعب البلدي',
  'al-matar al-janoubi': 'المطار الجنوبي',
  'matar janoubi': 'المطار الجنوبي',
  'al-askari': 'العسكري',
  'askari': 'العسكري',
  'al-aziziyah': 'العزيزية',
  'aziziyah': 'العزيزية',
  'al-salehiyah': 'الصالحية',
  'salehiyah': 'الصالحية',
  'al-ghazal': 'الغزل',
  'ghazal': 'الغزل',
  'al-mashfa al-watani': 'المشفى الوطني',
  'mashfa watani': 'المشفى الوطني',
  'al-talaia': 'الطليعة',
  'talaia': 'الطليعة',
  'abou amshah': 'أبو أمشة',
  'al-mufti': 'المفتي',
  'mufti': 'المفتي',
  'ghuwayran': 'غويران',
  'al-madinah al-riyadiyah': 'المدينة الرياضية',
  'madinah riyadiyah': 'المدينة الرياضية',
  'al-thawra': 'الثورة',
  'thawra': 'الثورة',
  'al-taqaddum': 'التقدم',
  'taqaddum': 'التقدم',
  '16 tishreen': '16 تشرين',
  'al-zuhour': 'الزهور',
  'zuhour': 'الزهور',
  'abou bakr': 'أبو بكر',
  'al-nasra': 'الناصرة',
  'nasra': 'الناصرة',
  'tell hajjar': 'تل حجر',
  'al-kallasah': 'الكلاسة',
  'kallasah': 'الكلاسة',
  'al-meshirfah': 'المشيرفة',
  'meshirfah': 'المشيرفة',
  'al-beitra': 'البيرتا',
  'beitra': 'البيرتا',
  'al-mashtal': 'المشتل',
  'mashtal': 'المشتل',
  'al-maaishiyah': 'المعيشة',
  'maaishiyah': 'المعيشة',
  'al-nashwa': 'النشوة',
  'nashwa': 'النشوة',
  'al-rasafah': 'الرصافة',
  'rasafah': 'الرصافة',
  'al-khabour': 'الخابور',
  'khabour': 'الخابور',
  'al-liliyah': 'الليلية',
  'liliyah': 'الليلية',
  'al-villat': 'الفيلات',
  'villat': 'الفيلات',
  'al-zahra (al-wusta)': 'الزهراء (الوسطى)',
  'zahra (wusta)': 'الزهراء (الوسطى)',
  'qudour bek': 'قدور بك',
  'al-gharbiyah': 'الغربية',
  'gharbiyah': 'الغربية',
  'corniche': 'الكورنيش',
  'al-arbawiyah': 'الأربوية',
  'arbawiyah': 'الأربوية',
  'al-ashouriyin': 'الأشوريين',
  'ashouriyin': 'الأشوريين',
  'al-siryan': 'السريان',
  'siryan': 'السريان',
  'al-bashiriyah': 'البشيرية',
  'bashiriyah': 'البشيرية',
  'tay': 'طي',
  'al-golan (berkila)': 'الجولان (بركيلا)',
  'golan (berkila)': 'الجولان (بركيلا)',
  'qanat al-suways': 'قناة السويس',
  'qanat suways': 'قناة السويس',
  'al-antariyah': 'العنترية',
  'antariyah': 'العنترية',
  'maysaloun': 'ميسلون',
  'al-hilaliyah': 'الهلالية',
  'hilaliyah': 'الهلالية',
  'jurnak': 'جرنك',
  'alaiya (hattin)': 'العلايا (حتين)',
  'mahmakiyah': 'محمكية',
  'jumaayah': 'جمعاية',
  'halko': 'حلكو',
  'hettin': 'حتين',
  'al-qadessiyeh': 'القادسية',
  'qadessiyeh': 'القادسية',
  'al-yarmuk': 'اليرموك',
  'yarmuk': 'اليرموك',
  'al-furat': 'الفرات',
  'furat': 'الفرات',
  'hisham bin abdulmalek': 'هشام بن عبد الملك',
  'ammar bin yasser': 'عمار بن ياسر',
  'al-mamoun': 'المأمون',
  'mamoun': 'المأمون',
  'ar-rafiqa': 'الرفيقة',
  'rafiqa': 'الرفيقة',
  'al-mansur': 'المنصور',
  'mansur': 'المنصور',
  'ar-rashid': 'الرشيد',
  'rashid': 'الرشيد',
  'al-mahdi': 'المهدي',
  'mahdi': 'المهدي',
  'al-baath': 'البعث',
  'baath': 'البعث',
  'al-salihiyah': 'الصالحية',
  'salihiyah': 'الصالحية',
  'al-batani': 'الباتاني',
  'batani': 'الباتاني',
  'ath-thawrah': 'الثورة',
  'thawrah': 'الثورة',
  'tishrin': 'تشرين',
  'al-hurriyeh': 'الحرية',
  'hurriyeh': 'الحرية',
  'al-wihdeh': 'الوحدة',
  'wihdeh': 'الوحدة',
  'an-nahda': 'النهضة',
  'nahda': 'النهضة',
  'ad-doura': 'الدورة',
  'doura': 'الدورة',
  'al-amin': 'الأمين',
  'amin': 'الأمين',
  'al-tashih': 'التصحيح',
  'tashih': 'التصحيح',
  'al-andalus': 'الأندلس',
  'andalus': 'الأندلس',
  'al-mishlab': 'المشلب',
  'mishlab': 'المشلب',
  'al-maamoun': 'المأمون',
  'maamoun': 'المأمون',
};

function norm(value: string): string {
  return normalizeArabicCompare(value);
}

/** Classic Levenshtein; fine for short place names. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

function maxSuggestDistance(rawNorm: string): number {
  // Short names: allow 1 typo; longer names: up to 2–3.
  if (rawNorm.length <= 4) return 1;
  if (rawNorm.length <= 8) return 2;
  return 3;
}

/** Best fuzzy matches within the hierarchy keys (normalized compare). */
export function suggestPlaceNames(keys: string[], raw: string, limit = 3): string[] {
  const n = norm(raw);
  if (!n || !keys.length) return [];
  const maxDist = maxSuggestDistance(n);
  const scored: { key: string; dist: number }[] = [];
  for (const key of keys) {
    const kn = norm(key);
    if (!kn) continue;
    // Prefer contains / prefix as distance 0.5 so they rank above pure edits.
    if (kn === n) return [key];
    if (kn.includes(n) || n.includes(kn)) {
      scored.push({ key, dist: 0.5 });
      continue;
    }
    const dist = editDistance(n, kn);
    if (dist <= maxDist) scored.push({ key, dist });
  }
  scored.sort((a, b) => a.dist - b.dist || a.key.localeCompare(b.key, 'ar'));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of scored) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    out.push(s.key);
    if (out.length >= limit) break;
  }
  return out;
}

function withSuggestions(base: string, suggestions: string[]): string {
  if (!suggestions.length) return base;
  return `${base} Did you mean: ${suggestions.join(', ')}?`;
}

function findKey(keys: string[], raw: string): string | null {
  const n = norm(raw);
  if (!n) return null;
  const match = keys.find((k) => norm(k) === n);
  if (match) return match;
  // Also try plain lowercase alias keys (English spellings in LOCATION_ALIASES).
  const plain = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  const aliased = LOCATION_ALIASES[n] ?? LOCATION_ALIASES[plain];
  if (aliased) {
    const aliasMatch = keys.find((k) => norm(k) === norm(aliased));
    if (aliasMatch) return aliasMatch;
  }
  return null;
}

/**
 * When city is unknown in the stated governorate, search other governorates
 * for the same city name and suggest the correct pairing (B11 example:
 * Damascus + جديدة الفضل → suggest correct governorate).
 */
function suggestGovernorateForCity(cityRaw: string, excludeGov: string): string[] {
  const n = norm(cityRaw);
  if (!n) return [];
  const hits: string[] = [];
  for (const [gov, districts] of Object.entries(HIERARCHY)) {
    if (gov === excludeGov) continue;
    const city = findKey(Object.keys(districts), cityRaw);
    if (city) hits.push(`${gov} / ${city}`);
    if (hits.length >= 3) break;
  }
  return hits;
}

/**
 * Neighbourhood typed under the wrong city: find it elsewhere in the same governorate.
 */
function suggestCityForNeighborhood(
  governorate: string,
  neighborhoodRaw: string,
  excludeCity: string,
): string[] {
  const districts = HIERARCHY[governorate] ?? {};
  const hits: string[] = [];
  for (const [city, neighborhoods] of Object.entries(districts)) {
    if (city === excludeCity) continue;
    const match = findKey(neighborhoods, neighborhoodRaw);
    if (match) hits.push(`${city} / ${match}`);
    if (hits.length >= 3) break;
  }
  return hits;
}

export type ResolvedSyriaAddress = {
  governorate: string;
  city: string;
  neighborhood: string | null;
  street: string | null;
};

export function resolveSyriaAddress(input: {
  governorate?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
}): { ok: true; value: ResolvedSyriaAddress } | { ok: false; fields: Record<string, string> } {
  const governorateRaw = input.governorate?.trim() ?? '';
  const cityRaw = input.city?.trim() ?? '';
  const neighborhoodRaw = input.neighborhood?.trim() || '';
  const street = input.street?.trim() || null;
  const fields: Record<string, string> = {};

  if (!governorateRaw) {
    fields.governorate = 'Governorate is required.';
  }
  if (!cityRaw) {
    fields.city = 'City / area is required.';
  }
  if (Object.keys(fields).length) {
    return { ok: false, fields };
  }

  const governorateKeys = Object.keys(HIERARCHY);
  const governorate = findKey(governorateKeys, governorateRaw);
  if (!governorate) {
    const suggestions = suggestPlaceNames(governorateKeys, governorateRaw);
    return {
      ok: false,
      fields: {
        governorate: withSuggestions(
          `Unknown governorate "${governorateRaw}". Use a Syria governorate name as in the Client Portal.`,
          suggestions,
        ),
      },
    };
  }

  const districts = Object.keys(HIERARCHY[governorate] ?? {});
  const city = findKey(districts, cityRaw);
  if (!city) {
    const local = suggestPlaceNames(districts, cityRaw);
    const elsewhere = suggestGovernorateForCity(cityRaw, governorate);
    const suggestions = [...local, ...elsewhere].slice(0, 3);
    return {
      ok: false,
      fields: {
        city: withSuggestions(`Unknown city/area "${cityRaw}" for ${governorate}.`, suggestions),
      },
    };
  }

  let neighborhood: string | null = null;
  if (neighborhoodRaw) {
    const neighborhoods = HIERARCHY[governorate]?.[city] ?? [];
    neighborhood = findKey(neighborhoods, neighborhoodRaw);
    if (!neighborhood) {
      const local = suggestPlaceNames(neighborhoods, neighborhoodRaw);
      const elsewhere = suggestCityForNeighborhood(governorate, neighborhoodRaw, city);
      const suggestions = [...local, ...elsewhere].slice(0, 3);
      return {
        ok: false,
        fields: {
          neighborhood: withSuggestions(
            `Unknown neighborhood "${neighborhoodRaw}" for ${city}, ${governorate}.`,
            suggestions,
          ),
        },
      };
    }
  }

  return { ok: true, value: { governorate, city, neighborhood, street } };
}
