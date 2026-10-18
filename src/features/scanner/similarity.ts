/*
 * Scanner phase 2: rank items by cosine similarity between a captured frame's
 * embedding and each reference photo's embedding. Brute force is fine at
 * collection sizes in the low thousands.
 */

/**
 * Fitted on a Galaxy S24+ (see docs/IMPLEMENTATION.md): 24 labelled scans of 3
 * items, then the 74 reference photos of 30 items replayed with each photo,
 * and then each whole item, left out.
 *
 * A match needs both a score of at least MATCH_THRESHOLD and a lead of at
 * least MATCH_MIN_GAP over the next item. The lead is what separates
 * look-alikes: a Rowlet not in the collection scored 0.831, 0.089 ahead of the
 * next item, so the lead stays at 0.10. The threshold rose from 0.65 to 0.70
 * because two left-out items scored 0.681 and 0.676 with leads over 0.10.
 * On the 30 items this matched 40 of 67 known photos with no wrong or false
 * matches; the right item ranked first in 60, so misses usually list it first.
 */
export const MATCH_THRESHOLD = 0.7;
export const MATCH_MIN_GAP = 0.1;

export interface ReferenceVector {
  item_id: string;
  vector: Float32Array;
}

export interface RankedMatch {
  item_id: string;
  score: number;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Best score per item (an item can have several reference photos), highest
 * first, top `k`.
 */
export function rankItems(query: Float32Array, refs: ReferenceVector[], k = 3): RankedMatch[] {
  const best = new Map<string, number>();
  for (const r of refs) {
    const s = cosine(query, r.vector);
    if (s > (best.get(r.item_id) ?? -Infinity)) best.set(r.item_id, s);
  }
  return [...best.entries()]
    .map(([item_id, score]) => ({ item_id, score }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}

export type VisualResult =
  | { kind: 'match'; match: RankedMatch }
  | { kind: 'nomatch'; suggestions: RankedMatch[] };

/**
 * The top match when it scores at least `threshold` and leads the next item by
 * at least `minGap`. Otherwise no match, with the 3 closest as suggestions.
 */
export function decide(ranked: RankedMatch[], threshold: number, minGap = 0): VisualResult {
  const [top, next] = ranked;
  if (top && top.score >= threshold && top.score - (next?.score ?? -1) >= minGap) return { kind: 'match', match: top };
  return { kind: 'nomatch', suggestions: ranked.slice(0, 3) };
}
