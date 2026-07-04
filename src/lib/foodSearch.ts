import type { FoodItem } from '../types';

// ---------- Food search ----------
// Token-based fuzzy matching: word order doesn't matter ("butter peanut" finds
// "Peanut Butter"), plurals are normalized, and one typo per word is forgiven
// ("chiken brest" still finds "Chicken Breast"). Results are relevance-ranked.

const normalize = (s: string) =>
  s.toLowerCase().replace(/['’&().,%-]/g, ' ').split(/\s+/).filter(Boolean)
    .map(t => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)); // light singularization

/** Levenshtein distance capped at 2 (early exit keeps it cheap). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > 2) return 3;
  }
  return prev[b.length];
}

/** Best match score for one query token against one name token. */
function tokenScore(q: string, t: string): number {
  if (t === q) return 3;
  if (t.startsWith(q)) return 2.5;
  if (t.includes(q) && q.length >= 3) return 2;
  if (q.length >= 4 && editDistance(q, t) === 1) return 1.5;
  if (q.length >= 6 && editDistance(q, t) === 2) return 1;
  return 0;
}

export function searchFoods(foods: FoodItem[], query: string, limit = 40): FoodItem[] {
  const qTokens = normalize(query);
  if (qTokens.length === 0) return [];
  const scored: { food: FoodItem; score: number }[] = [];
  for (const food of foods) {
    const nTokens = normalize(food.name);
    let total = 0;
    let allMatched = true;
    for (const q of qTokens) {
      let best = 0;
      for (const t of nTokens) best = Math.max(best, tokenScore(q, t));
      if (best === 0) { allMatched = false; break; }
      total += best;
    }
    if (!allMatched) continue;
    // prefer names fully covered by the query (fewer leftover words)
    total -= (nTokens.length - qTokens.length) * 0.05;
    scored.push({ food, score: total });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map(s => s.food);
}
