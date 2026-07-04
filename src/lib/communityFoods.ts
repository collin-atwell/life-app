import type { FoodItem } from '../types';
import { cloudClient, cloudSession } from './cloud';

// ---------- Community food database ----------
// A shared `community_foods` table on Supabase: anyone can read, signed-in
// users can add. The whole set is cached in localStorage so search and
// logging work offline; it refreshes in the background once a day.

const CACHE_KEY = 'health-hub-community-foods-v1';
const REFRESH_MS = 24 * 60 * 60 * 1000;

interface Cache { at: number; foods: FoodItem[] }

let memory: FoodItem[] | null = null;

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

/** Synchronous access for search/logging — served from cache. */
export function getCommunityFoods(): FoodItem[] {
  if (memory) return memory;
  memory = readCache()?.foods ?? [];
  return memory;
}

export function communityFoodById(id: string): FoodItem | undefined {
  return getCommunityFoods().find(f => f.id === id);
}

export function communityFoodByBarcode(barcode: string): FoodItem | undefined {
  return getCommunityFoods().find(f => f.barcode === barcode);
}

interface CommunityRow {
  id: string; name: string; serving: string;
  calories: number; protein: number; carbs: number; fat: number;
  barcode: string | null;
}

/** Background refresh — call on app start. No-op when cache is fresh or offline. */
export async function refreshCommunityFoods(force = false): Promise<number> {
  const cache = readCache();
  if (!force && cache && Date.now() - cache.at < REFRESH_MS) return cache.foods.length;
  const c = cloudClient();
  if (!c) return cache?.foods.length ?? 0;
  try {
    const { data, error } = await c.from('community_foods')
      .select('id, name, serving, calories, protein, carbs, fat, barcode')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error || !data) return cache?.foods.length ?? 0;
    const foods: FoodItem[] = (data as CommunityRow[]).map(r => ({
      id: `cf-${r.id}`,
      name: r.name,
      serving: r.serving,
      calories: Number(r.calories), protein: Number(r.protein),
      carbs: Number(r.carbs), fat: Number(r.fat),
      barcode: r.barcode ?? undefined,
    }));
    memory = foods;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), foods } satisfies Cache));
    return foods.length;
  } catch {
    return cache?.foods.length ?? 0;
  }
}

/** Publish a food for all users. Requires being signed in. */
export async function publishFood(food: Omit<FoodItem, 'id'>): Promise<string | null> {
  const c = cloudClient();
  if (!c) return 'Cloud not configured';
  const session = await cloudSession();
  if (!session) return 'Sign in (Settings → Account & sync) to share foods with everyone';
  const { error } = await c.from('community_foods').insert({
    name: food.name, serving: food.serving,
    calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat,
    barcode: food.barcode ?? null,
    created_by: session.user.id,
  });
  if (error) return error.message;
  refreshCommunityFoods(true); // pick up our own addition
  return null;
}
