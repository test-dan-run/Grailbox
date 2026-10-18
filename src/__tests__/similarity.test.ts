import { cosine, decide, rankItems } from '@/features/scanner/similarity';

const v = (...n: number[]) => new Float32Array(n);

describe('visual matching', () => {
  it('computes cosine similarity', () => {
    expect(cosine(v(1, 0), v(1, 0))).toBeCloseTo(1);
    expect(cosine(v(1, 0), v(0, 1))).toBeCloseTo(0);
    expect(cosine(v(1, 1), v(-1, -1))).toBeCloseTo(-1);
    expect(cosine(v(0, 0), v(1, 0))).toBe(0);
    expect(() => cosine(v(1), v(1, 2))).toThrow();
  });

  it('ranks items by their best reference photo', () => {
    const refs = [
      { item_id: 'a', vector: v(1, 0, 0) },
      { item_id: 'a', vector: v(0.9, 0.1, 0) },
      { item_id: 'b', vector: v(0, 1, 0) },
      { item_id: 'c', vector: v(0.5, 0.5, 0) },
      { item_id: 'd', vector: v(0, 0, 1) },
    ];
    const ranked = rankItems(v(1, 0.05, 0), refs);
    expect(ranked.map((r) => r.item_id)).toEqual(['a', 'c', 'b']);
  });

  it('applies the threshold', () => {
    const ranked = [
      { item_id: 'a', score: 0.91 },
      { item_id: 'b', score: 0.5 },
    ];
    expect(decide(ranked, 0.9)).toEqual({ kind: 'match', match: ranked[0] });
    expect(decide(ranked, 0.95)).toEqual({ kind: 'nomatch', suggestions: ranked });
    expect(decide([], 0.5)).toEqual({ kind: 'nomatch', suggestions: [] });
  });

  it('needs a clear lead over the next item', () => {
    const lookalikes = [
      { item_id: 'a', score: 0.814 },
      { item_id: 'b', score: 0.747 },
    ];
    expect(decide(lookalikes, 0.65, 0.1)).toEqual({ kind: 'nomatch', suggestions: lookalikes });
    const clear = [
      { item_id: 'a', score: 0.785 },
      { item_id: 'b', score: 0.612 },
    ];
    expect(decide(clear, 0.65, 0.1)).toEqual({ kind: 'match', match: clear[0] });
    // A single candidate has nothing to lead.
    expect(decide([clear[0]], 0.65, 0.1)).toEqual({ kind: 'match', match: clear[0] });
  });
});
