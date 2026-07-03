import type { AppData } from '../types';
import { today, waterGoalOz, waterOn } from './calc';
import { generateDayPlan } from './scheduler';

// Local browser notifications — fire while the app is open (including background
// tabs). True OS push with the app fully closed requires a backend push service
// + service worker; this module is the seam where that would plug in.

const FIRED_KEY = 'health-hub-notified-v1';

export const DEFAULT_NOTIF_PREFS = {
  enabled: false, hydration: true, workout: true, bedtime: true,
};

export function notifPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotifPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export function sendNotification(title: string, body: string): boolean {
  if (notifPermission() !== 'granted') return false;
  try {
    new Notification(title, { body, icon: '/favicon.svg' });
    return true;
  } catch {
    return false;
  }
}

interface Reminder { id: string; title: string; body: string }

const firedSet = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]')); } catch { return new Set(); }
};

const markFired = (ids: string[]) => {
  const s = [...firedSet(), ...ids];
  localStorage.setItem(FIRED_KEY, JSON.stringify(s.slice(-200)));
};

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** Reminders due right now that haven't fired yet today. */
export function dueReminders(data: AppData, now = new Date()): Reminder[] {
  const prefs = data.notifPrefs;
  if (!prefs.enabled) return [];
  const date = today();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out: Reminder[] = [];

  // Hydration: on even hours 10:00–20:00, nudge if behind the day's pace.
  if (prefs.hydration) {
    const h = now.getHours();
    if (h >= 10 && h <= 20 && h % 2 === 0) {
      const goal = waterGoalOz(data, date);
      const expected = goal * ((h - 7) / 14); // linear pace 7am → 9pm
      const drank = waterOn(data, date);
      if (drank < expected * 0.8) {
        out.push({
          id: `hydration-${date}-${h}`,
          title: '💧 Hydration check',
          body: `${Math.round(drank)} oz so far — you're behind pace for today's ${goal} oz goal. Grab a glass now.`,
        });
      }
    }
  }

  // Workout: 45-minute heads-up before a scheduled (accepted) workout event.
  if (prefs.workout) {
    for (const e of data.events) {
      if (e.date !== date || e.type !== 'workout') continue;
      const start = toMin(e.start);
      if (nowMin >= start - 45 && nowMin < start) {
        out.push({
          id: `workout-${date}-${e.id}`,
          title: `🏋️ ${e.title} at ${e.start}`,
          body: 'Starting soon — have a light carb + protein snack and start hydrating.',
        });
      }
    }
  }

  // Bedtime: wind-down nudge 30 min before the suggested bedtime.
  if (prefs.bedtime) {
    const sleep = generateDayPlan(data, date).suggestions.find(s => s.type === 'sleep');
    if (sleep) {
      const bed = toMin(sleep.start);
      // bedtimes can be before midnight only (scheduler clamps to same day)
      if (bed > 12 * 60 && nowMin >= bed - 30 && nowMin < bed) {
        out.push({
          id: `bedtime-${date}`,
          title: '😴 Wind down',
          body: `Recommended bedtime tonight is ${sleep.start} for a full recovery. Screens off soon.`,
        });
      }
    }
  }

  const fired = firedSet();
  return out.filter(r => !fired.has(r.id));
}

/** Fire all due reminders; returns what was sent (for in-app fallback display). */
export function fireDueReminders(data: AppData): Reminder[] {
  const due = dueReminders(data);
  if (due.length === 0) return [];
  markFired(due.map(r => r.id));
  for (const r of due) sendNotification(r.title, r.body);
  return due;
}
