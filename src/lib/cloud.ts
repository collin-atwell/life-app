import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type { AppData } from '../types';

// ---------- Cloud sync (Supabase) ----------
// Strategy: the whole AppData tree syncs as one JSONB row per user
// (last-write-wins by timestamp). Simple, atomic, and plenty for a
// single-user-many-devices app. See supabase/schema.sql for the table + RLS.

const CONFIG_KEY = 'health-hub-cloud-config-v1';
const LAST_SYNC_KEY = 'health-hub-last-sync-v1';
export const LOCAL_UPDATED_KEY = 'health-hub-updated-at-v1';

export interface CloudConfig { url: string; anonKey: string }

// Built-in backend: the app's own Supabase project, so users just sign up and
// log in. The publishable key is safe to publish (that's its name) — row-level
// security (see supabase/schema.sql) means each account can only ever
// read/write its own row. Note: must be the sb_publishable_ key, not the
// legacy JWT anon key — the Edge Functions gateway rejects legacy keys.
export const DEFAULT_CLOUD: CloudConfig = {
  url: 'https://sqwwdzxpiwjaxsyzajjp.supabase.co',
  anonKey: 'sb_publishable_cuz9jgrtw6_c3WfKDhBQog_gn9vLiFG',
};

/** True when no custom backend override is stored (i.e. using the built-in one). */
export const isDefaultCloud = () => !localStorage.getItem(CONFIG_KEY);

let client: SupabaseClient | null = null;
let clientKey = '';

export function getCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as CloudConfig) : DEFAULT_CLOUD;
  } catch {
    return DEFAULT_CLOUD;
  }
}

export function setCloudConfig(cfg: CloudConfig | null) {
  if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  else {
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }
  client = null;
}

export function cloudClient(): SupabaseClient | null {
  const cfg = getCloudConfig();
  if (!cfg?.url || !cfg?.anonKey) return null;
  const key = cfg.url + cfg.anonKey;
  if (!client || clientKey !== key) {
    client = createClient(cfg.url, cfg.anonKey);
    clientKey = key;
  }
  return client;
}

export async function cloudSession(): Promise<Session | null> {
  const c = cloudClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

export async function cloudSignUp(email: string, password: string): Promise<string | null> {
  const c = cloudClient();
  if (!c) return 'Cloud not configured';
  const { error, data } = await c.auth.signUp({ email, password });
  if (error) return error.message;
  // If email confirmation is on in Supabase, there's no session yet.
  return data.session ? null : 'confirm-email';
}

export async function cloudSignIn(email: string, password: string): Promise<string | null> {
  const c = cloudClient();
  if (!c) return 'Cloud not configured';
  const { error } = await c.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function cloudSignOut() {
  await cloudClient()?.auth.signOut();
}

export function lastSyncAt(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

/** Upload the full state. Returns an error message or null on success. */
export async function pushState(data: AppData): Promise<string | null> {
  const c = cloudClient();
  if (!c) return 'Cloud not configured';
  const { data: sess } = await c.auth.getSession();
  const user = sess.session?.user;
  if (!user) return 'Not signed in';
  const updatedAt = localStorage.getItem(LOCAL_UPDATED_KEY) ?? new Date().toISOString();
  const { error } = await c.from('app_state').upsert({
    user_id: user.id,
    data,
    updated_at: updatedAt,
  });
  if (error) return error.message;
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  return null;
}

export interface RemoteState { data: AppData; updatedAt: string }

/** Download the remote state (or null if none exists yet). Throws on error. */
export async function pullState(): Promise<RemoteState | null> {
  const c = cloudClient();
  if (!c) return null;
  const { data: sess } = await c.auth.getSession();
  if (!sess.session) return null;
  const { data, error } = await c.from('app_state').select('data, updated_at').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  return { data: data.data as AppData, updatedAt: data.updated_at as string };
}

/** On startup: return remote state only if it's newer than what this device has. */
export async function pullIfNewer(): Promise<AppData | null> {
  try {
    const remote = await pullState();
    if (!remote) return null;
    const localUpdated = localStorage.getItem(LOCAL_UPDATED_KEY);
    if (localUpdated && localUpdated >= remote.updatedAt) return null;
    return remote.data;
  } catch {
    return null; // offline or misconfigured — local data wins, sync later
  }
}

// Debounced auto-push: called on every data change; only does work when
// configured + signed in. Waits 4s of quiet before uploading.
let pushTimer: ReturnType<typeof setTimeout> | undefined;
export function autoPush(data: AppData, onResult?: (err: string | null) => void) {
  if (!getCloudConfig()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const sess = await cloudSession();
    if (!sess) return;
    const err = await pushState(data);
    onResult?.(err);
  }, 4000);
}
