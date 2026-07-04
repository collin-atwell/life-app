// Supabase Edge Function: send-reminders
// Runs on a cron schedule (every 15 min). For each push-subscribed user it reads
// their app_state, computes any due reminders in THEIR timezone, and web-pushes
// them — so reminders arrive even with the app fully closed.
//
// Setup (see SETUP.md Part 4):
//   secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (SUPABASE_* are auto-provided)
//   schedule: */15 * * * *

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // server-side only: reads all rows
);

webpush.setVapidDetails(
  'mailto:collinatwell14@icloud.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface Reminder { id: string; title: string; body: string }

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** User-local date parts via their IANA timezone. */
function localNow(tz: string): { date: string; minutes: number; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
    hour,
  };
}

// Mirrors the client-side reminder logic in src/lib/notifications.ts.
// deno-lint-ignore no-explicit-any
function dueReminders(data: any): Reminder[] {
  const prefs = data?.notifPrefs;
  if (!prefs?.enabled) return [];
  const tz = data?.profile?.timezone ?? 'UTC';
  const { date, minutes, hour } = localNow(tz);
  const out: Reminder[] = [];

  if (prefs.hydration && hour >= 10 && hour <= 20 && hour % 2 === 0 && minutes % 60 < 30) {
    const weight = data?.profile?.weightLbs ?? 170;
    const goal = Math.round(weight * 0.6 + 20);
    // deno-lint-ignore no-explicit-any
    const drank = (data?.water ?? []).filter((w: any) => w.date === date).reduce((t: number, w: any) => t + w.oz, 0);
    const expected = goal * ((hour - 7) / 14);
    if (drank < expected * 0.8) {
      out.push({
        id: `hydration-${date}-${hour}`,
        title: '💧 Hydration check',
        body: `${Math.round(drank)} oz so far today — you're behind pace. Grab a glass now.`,
      });
    }
  }

  if (prefs.workout) {
    // deno-lint-ignore no-explicit-any
    for (const e of (data?.events ?? []) as any[]) {
      if (e.date !== date || e.type !== 'workout' || e.suggested) continue;
      const start = toMin(e.start);
      if (minutes >= start - 45 && minutes < start) {
        out.push({
          id: `workout-${date}-${e.id}`,
          title: `🏋️ ${e.title} at ${e.start}`,
          body: 'Starting soon — light carb + protein snack now, and start hydrating.',
        });
      }
    }
  }

  if (prefs.bedtime) {
    const wake = toMin(data?.profile?.wakeTime ?? '06:30');
    const bed = (wake - 8 * 60 + 24 * 60) % (24 * 60);
    if (bed > 12 * 60 && minutes >= bed - 30 && minutes < bed) {
      const h = String(Math.floor(bed / 60)).padStart(2, '0');
      const m = String(bed % 60).padStart(2, '0');
      out.push({
        id: `bedtime-${date}`,
        title: '😴 Wind down',
        body: `Recommended bedtime is ${h}:${m} for a full night before your ${data?.profile?.wakeTime ?? '06:30'} wake-up.`,
      });
    }
  }

  return out;
}

Deno.serve(async () => {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, user_id, subscription, sent');
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0, removed = 0;
  for (const sub of subs ?? []) {
    const { data: stateRow } = await supabase
      .from('app_state').select('data').eq('user_id', sub.user_id).maybeSingle();
    if (!stateRow) continue;

    const sentLog: Record<string, string> = sub.sent ?? {};
    const due = dueReminders(stateRow.data).filter(r => !sentLog[r.id]);
    if (due.length === 0) continue;

    for (const r of due) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({ title: r.title, body: r.body }));
        sentLog[r.id] = new Date().toISOString();
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          removed++;
          break;
        }
      }
    }
    // keep only the last ~50 sent ids to bound row size
    const trimmed = Object.fromEntries(Object.entries(sentLog).slice(-50));
    await supabase.from('push_subscriptions').update({ sent: trimmed }).eq('endpoint', sub.endpoint);
  }
  return new Response(JSON.stringify({ subscriptions: subs?.length ?? 0, sent, removed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
