/*
 * Scanner phase 2: rank items by cosine similarity between a captured frame's
 * embedding and each reference photo's embedding. Brute force is fine at
 * collection sizes in the low thousands.
 */

/**
 * PROVISIONAL: fitted to 24 labelled scans of 3 items on a Galaxy S24+, not
 * yet the 30-item test the handoff requires (see the README).
 *
 * A match needs both a score of at least MATCH_THRESHOLD and a lead of at
 * least MATCH_MIN_GAP over the next item. The lead is what separates
 * look-alikes: a small Rowlet item not in the collection scored 0.814 against
 * a Rowlet plush, only 0.067 ahead of a second Rowlet, while every real match led by 0.12 or more.
 * On those scans this matched 15 of 20 real items with no false matches;
 * the right item ranked first in all 20, so misses still list it first.
 */
export const MATCH_THRESHOLD = 0.65;
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
