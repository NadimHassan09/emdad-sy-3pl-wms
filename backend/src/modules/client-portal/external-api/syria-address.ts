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
  'ommal': "العمال",
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
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function findKey(keys: string[], raw: string): string | null {
  const n = norm(raw);
  if (!n) return null;
  const match = keys.find((k) => norm(k) === n);
  if (match) return match;
  const aliased = LOCATION_ALIASES[n];
  if (aliased) {
    const aliasMatch = keys.find((k) => norm(k) === norm(aliased));
    if (aliasMatch) return aliasMatch;
  }
  return null;
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

  const governorate = findKey(Object.keys(HIERARCHY), governorateRaw);
  if (!governorate) {
    return {
      ok: false,
      fields: { governorate: `Unknown governorate "${governorateRaw}". Use a Syria governorate name as in the Client Portal.` },
    };
  }

  const districts = Object.keys(HIERARCHY[governorate] ?? {});
  const city = findKey(districts, cityRaw);
  if (!city) {
    return {
      ok: false,
      fields: { city: `Unknown city/area "${cityRaw}" for ${governorate}.` },
    };
  }

  let neighborhood: string | null = null;
  if (neighborhoodRaw) {
    const neighborhoods = HIERARCHY[governorate]?.[city] ?? [];
    neighborhood = findKey(neighborhoods, neighborhoodRaw);
    if (!neighborhood) {
      return {
        ok: false,
        fields: { neighborhood: `Unknown neighborhood "${neighborhoodRaw}" for ${city}, ${governorate}.` },
      };
    }
  }

  return { ok: true, value: { governorate, city, neighborhood, street } };
}
