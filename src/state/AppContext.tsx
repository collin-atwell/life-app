import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import confetti from 'canvas-confetti';
import type { AppData } from '../types';
import { buildDemoData, buildEmptyData } from '../data/demo';
import { autoPush, LOCAL_UPDATED_KEY, pullIfNewer } from '../lib/cloud';
import { refreshCommunityFoods } from '../lib/communityFoods';

const STORAGE_KEY = 'health-hub-data-v1';
const ONBOARD_KEY = 'health-hub-onboarded-v1';

// Storage adapter — localStorage for MVP. Swap `load`/`persist` for a
// Supabase/Firebase client later without touching any component code.
function load(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AppData;
    // migrations for data saved by older versions
    data.notifPrefs ??= { enabled: false, hydration: true, workout: true, bedtime: true };
    data.icalFeeds ??= data.icalUrl ? [{ id: 'default', name: 'My calendar', url: data.icalUrl }] : [];
    delete data.icalUrl;
    data.profile.timezone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
    data.profile.goalSetAt ??= new Date().toISOString().slice(0, 10);
    return data;
  } catch {
    return null;
  }
}

function persist(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(LOCAL_UPDATED_KEY, new Date().toISOString());
    autoPush(data); // no-op unless cloud sync is configured + signed in
  } catch (e) {
    console.error('Failed to persist app data', e);
  }
}

interface AppContextValue {
  data: AppData;
  /** Update any slice of AppData; persisted automatically (debounced). */
  update: (fn: (prev: AppData) => AppData) => void;
  resetToDemo: () => void;
  resetToEmpty: () => void;
  exportJson: () => void;
  importJson: (file: File) => Promise<void>;
  celebrate: (msg: string) => void;
  celebration: string | null;
  /** First-run flow: true until the user picks demo vs fresh. */
  needsOnboarding: boolean;
  completeOnboarding: (mode: 'demo' | 'fresh', name?: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => load() ?? buildDemoData());
  const [celebration, setCelebration] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(() => !localStorage.getItem(ONBOARD_KEY));
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const celebTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(data), 300);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.profile.darkMode ? 'dark' : 'light';
  }, [data.profile.darkMode]);

  // Community food DB: refresh the offline cache in the background (≤1x/day).
  useEffect(() => { refreshCommunityFoods(); }, []);

  // Cloud: on startup, adopt the remote state if another device saved more recently.
  useEffect(() => {
    let cancelled = false;
    pullIfNewer().then(remote => {
      if (remote && !cancelled) {
        remote.notifPrefs ??= { enabled: false, hydration: true, workout: true, bedtime: true };
        setData(remote);
        celebrate('☁️ Synced latest data from the cloud');
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((fn: (prev: AppData) => AppData) => setData(fn), []);
  const resetToDemo = useCallback(() => setData(buildDemoData()), []);
  const resetToEmpty = useCallback(() => setData(buildEmptyData()), []);

  const completeOnboarding = useCallback((mode: 'demo' | 'fresh', name?: string) => {
    localStorage.setItem(ONBOARD_KEY, '1');
    setNeedsOnboarding(false);
    if (mode === 'fresh') {
      const fresh = buildEmptyData();
      if (name) fresh.profile.name = name;
      setData(fresh);
    } else if (name) {
      setData(d => ({ ...d, profile: { ...d.profile, name } }));
    }
  }, []);

  const celebrate = useCallback((msg: string) => {
    setCelebration(msg);
    clearTimeout(celebTimer.current);
    celebTimer.current = setTimeout(() => setCelebration(null), 3500);
    // Big-moment messages get confetti 🎉
    if (/🎉|🎯|PR|streak|goal/i.test(msg) && !msg.startsWith('⚠️')) {
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.25 }, disableForReducedMotion: true });
      setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.4 }, disableForReducedMotion: true }), 180);
      setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.4 }, disableForReducedMotion: true }), 320);
    }
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importJson = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as AppData;
    if (!parsed.profile || !Array.isArray(parsed.workouts)) throw new Error('Not a valid backup file');
    setData(parsed);
  }, []);

  const value = useMemo(
    () => ({ data, update, resetToDemo, resetToEmpty, exportJson, importJson, celebrate, celebration, needsOnboarding, completeOnboarding }),
    [data, update, resetToDemo, resetToEmpty, exportJson, importJson, celebrate, celebration, needsOnboarding, completeOnboarding],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
