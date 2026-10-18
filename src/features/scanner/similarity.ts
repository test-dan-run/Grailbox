/*
 * Scanner phase 2: rank items by cosine similarity between a captured frame's
 * embedding and each reference photo's embedding. Brute force is fine at
 * collection sizes in the low thousands.
 *
 * The embedding model and the confidence threshold are NOT chosen yet: the
 * handoff requires measuring accuracy on real plush photos from new angles
 * before setting a threshold. Until then no threshold is shipped and the
 * scanner uses phase 1 (barcodes) only.
 */

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

/** Above the threshold: the top match. Below: no match, with the 3 closest as suggestions. */
export function decide(ranked: RankedMatch[], threshold: number): VisualResult {
  const top = ranked[0];
  if (top && top.score >= threshold) return { kind: 'match', match: top };
  return { kind: 'nomatch', suggestions: ranked.slice(0, 3) };
}
