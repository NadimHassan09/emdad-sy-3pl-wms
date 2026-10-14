export type IndexedPlace = {
  governorate: string;
  cityRegion: string;
  townNeighborhood: string;
  lat: number;
  lng: number;
};

export function normalizePlaceName(value: string): string {
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

export function placeCandidates(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const raw = value?.trim();
    if (!raw) continue;
    out.add(normalizePlaceName(raw));
    for (const part of raw.split(/\s*[-–—]\s*/)) {
      const norm = normalizePlaceName(part);
      if (norm.length >= 2) out.add(norm);
    }
  }
  return [...out].filter(Boolean);
}

/**
 * Match free-text address parts against indexed towns in one governorate.
 * Uses the longest indexed name contained in the text. Two equal-length
 * different towns is ambiguous and returns null (no guessed coordinate).
 */
export function matchIndexedTown(
  points: IndexedPlace[],
  governorate: string,
  texts: Array<string | null | undefined>,
): IndexedPlace | null {
  const gov = normalizePlaceName(governorate);
  const candidates = placeCandidates(texts).filter((c) => c !== gov && c.length >= 4);
  if (!gov || candidates.length === 0) return null;
  const local = points.filter((p) => normalizePlaceName(p.governorate) === gov);
  let best: { point: IndexedPlace; score: number } | null = null;
  let tie = false;
  for (const point of local) {
    const town = normalizePlaceName(point.townNeighborhood);
    if (town.length < 4) continue;
    let score = 0;
    if (candidates.includes(town)) score = 1000 + town.length;
    else if (candidates.some((c) => c.includes(town))) score = 100 + town.length;
    else if (candidates.some((c) => town.includes(c) && c.length >= 4)) {
      const hit = candidates.filter((c) => town.includes(c)).sort((a, b) => b.length - a.length)[0];
      score = 80 + (hit?.length ?? 0);
    }
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { point, score };
      tie = false;
    } else if (score === best.score && point.townNeighborhood !== best.point.townNeighborhood) {
      tie = true;
    }
  }
  if (!best || tie) return null;
  return best.point;
}
