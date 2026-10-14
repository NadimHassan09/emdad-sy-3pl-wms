export type SilaAreaRow = {
  id?: string;
  name_ar?: string | null;
  name_en?: string | null;
  level?: string | null;
  is_leaf?: boolean | null;
};

export type SilaAreaHints = {
  province?: string | null;
  city?: string | null;
  district?: string | null;
  neighborhood?: string | null;
};

/** Compare Arabic area labels without hamza, taa marbuta, or a leading حي/ال. */
export function normalizeSilaAreaName(value: string): string {
  return value
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/^حي\s+/u, '')
    .replace(/^ال/u, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function areaName(area: SilaAreaRow): string {
  return normalizeSilaAreaName(area.name_ar || area.name_en || '');
}

function nameMatch(name: string, hint: string): 'exact' | 'partial' | null {
  if (!hint || !name || hint.length < 2) return null;
  if (name === hint) return 'exact';
  if (hint.length >= 4 && (name.includes(hint) || hint.includes(name))) return 'partial';
  return null;
}

function hintTokens(hints: SilaAreaHints): string[] {
  const province = normalizeSilaAreaName(hints.province || '');
  const blobs = [hints.city, hints.district, hints.neighborhood];
  const tokens = new Set<string>();
  for (const blob of blobs) {
    const raw = blob?.trim();
    if (!raw) continue;
    const whole = normalizeSilaAreaName(raw);
    if (whole && whole !== province) tokens.add(whole);
    for (const part of raw.split(/\s*[-–—]\s*/)) {
      const token = normalizeSilaAreaName(part);
      if (token && token !== province && token.length >= 2) tokens.add(token);
    }
  }
  return [...tokens];
}

/**
 * Sila rejects a province area_id ("whole province — pick a child").
 * Choose the city or neighbourhood under that province that matches the address.
 */
export function pickSilaChildArea(
  children: SilaAreaRow[],
  hints: SilaAreaHints,
  excludeNames: string[] = [],
): SilaAreaRow | null {
  const province = normalizeSilaAreaName(hints.province || '');
  const excluded = new Set(
    excludeNames.map((name) => normalizeSilaAreaName(name)).filter((name) => name.length >= 2),
  );
  const tokens = hintTokens(hints).filter((token) => !excluded.has(token));

  let best: { area: SilaAreaRow; score: number; name: string } | null = null;
  for (const area of children) {
    if (!area.id?.trim() || area.level === 'province') continue;
    const name = areaName(area);
    if (!name || (province && name === province)) continue;

    let score = 0;
    for (const token of tokens) {
      const hit = nameMatch(name, token);
      if (hit === 'exact') score += 200;
      else if (hit === 'partial') score += 120;
      const words = name
        .split(' ')
        .filter((word) => word.length >= 4 && token.includes(word) && !excluded.has(word));
      if (words.length > 0) score += 40 + Math.max(...words.map((word) => word.length));
    }
    if (score <= 0) continue;
    if (area.level === 'neighborhood') score += 8;
    else if (area.level === 'city') score += 6;
    if (area.is_leaf) score += 4;

    if (
      !best ||
      score > best.score ||
      (score === best.score && name.length < best.name.length)
    ) {
      best = { area, score, name };
    }
  }
  return best?.area ?? null;
}

/**
 * Walk province → city → neighbourhood. Never returns the province id when a
 * child was required. Stops at the deepest child whose name matches a hint.
 */
export async function walkSilaAreaHierarchy(
  startId: string,
  startLevel: string | null | undefined,
  hints: SilaAreaHints,
  fetchChildren: (parentId: string) => Promise<SilaAreaRow[]>,
  startName?: string | null,
): Promise<{ areaId: string } | { missingLevel: 'city' | 'neighborhood' }> {
  const startedAtProvince = !startLevel || startLevel.toLowerCase() === 'province';
  let currentId = startId;
  let anchor = startName?.trim() || '';
  let descended = !startedAtProvince;
  for (let depth = 0; depth < 4; depth += 1) {
    let children: SilaAreaRow[] = [];
    try {
      children = await fetchChildren(currentId);
    } catch {
      children = [];
    }
    const picked = pickSilaChildArea(children, hints, anchor ? [anchor] : []);
    const nextId = picked?.id?.trim();
    if (!nextId || nextId === currentId) break;
    currentId = nextId;
    anchor = (picked?.name_ar || picked?.name_en || '').trim();
    descended = true;
    if (picked?.is_leaf || picked?.level === 'neighborhood') break;
  }
  if (!descended) {
    return { missingLevel: startedAtProvince ? 'city' : 'neighborhood' };
  }
  return { areaId: currentId };
}
