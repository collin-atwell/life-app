import { addDays, format, parseISO } from 'date-fns';
import type { AppData, CalendarEvent } from '../types';
import { getCloudConfig } from './cloud';
import { fmtDate, today } from './calc';

// ---------- iCal (.ics) feed import ----------
// Best-effort parser for the calendar feeds Google/Apple/Outlook publish.
// Supports timed events + DAILY/WEEKLY/MONTHLY recurrence within the sync
// window (UNTIL and EXDATE honored; COUNT and all-day events skipped).

interface RawEvent {
  uid: string;
  summary: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  rrule: Record<string, string> | null;
  exdates: Set<string>;         // yyyy-MM-dd
}

const WINDOW_BACK_DAYS = 7;
const WINDOW_AHEAD_DAYS = 35;

function parseIcalDate(value: string): { date: Date | null; allDay: boolean } {
  // Forms: 20260703 (all-day) · 20260703T090000 (local/TZID) · 20260703T150000Z (UTC)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { date: null, allDay: false };
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return { date: new Date(+y, +mo - 1, +d), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
  // TZID times are treated as local — fine when your calendar tz matches your device.
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +s), allDay: false };
}

export function parseIcs(raw: string): RawEvent[] {
  // Unfold continuation lines, then walk VEVENT blocks.
  const lines = raw.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { uid: '', summary: '(untitled)', start: null, end: null, allDay: false, rrule: null, exdates: new Set() };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.start) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const [keyPart, value] = [line.slice(0, idx), line.slice(idx + 1)];
    const key = keyPart.split(';')[0].toUpperCase();
    if (key === 'UID') cur.uid = value;
    else if (key === 'SUMMARY') cur.summary = value.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim() || '(untitled)';
    else if (key === 'DTSTART') {
      const { date, allDay } = parseIcalDate(value);
      cur.start = date;
      cur.allDay = allDay;
    } else if (key === 'DTEND') {
      cur.end = parseIcalDate(value).date;
    } else if (key === 'RRULE') {
      cur.rrule = Object.fromEntries(value.split(';').map(p => p.split('=') as [string, string]));
    } else if (key === 'EXDATE') {
      value.split(',').forEach(v => {
        const { date } = parseIcalDate(v.trim());
        if (date) cur!.exdates.add(fmtDate(date));
      });
    }
  }
  return events;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const dayDiff = (a: Date, b: Date) => Math.round((a.setHours(0,0,0,0), b.setHours(0,0,0,0), (a.getTime() - b.getTime())) / 86_400_000);

/** Expand one event into concrete occurrences inside the sync window. */
function occurrences(ev: RawEvent, windowStart: Date, windowEnd: Date): Date[] {
  if (!ev.start || ev.allDay) return [];
  const startDay = new Date(ev.start); startDay.setHours(0, 0, 0, 0);

  if (!ev.rrule) {
    return ev.start >= windowStart && ev.start <= windowEnd ? [ev.start] : [];
  }

  const freq = ev.rrule.FREQ;
  const interval = Math.max(1, parseInt(ev.rrule.INTERVAL ?? '1'));
  const until = ev.rrule.UNTIL ? parseIcalDate(ev.rrule.UNTIL).date : null;
  const byday = ev.rrule.BYDAY?.split(',').map(d => DAY_CODES.indexOf(d.slice(-2))).filter(i => i >= 0);
  const out: Date[] = [];

  for (let d = new Date(windowStart); d <= windowEnd; d = addDays(d, 1)) {
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    if (day < startDay) continue;
    if (until && day > until) break;
    if (ev.exdates.has(fmtDate(day))) continue;
    const diff = dayDiff(new Date(day), new Date(startDay));
    let match = false;
    if (freq === 'DAILY') match = diff % interval === 0;
    else if (freq === 'WEEKLY') {
      const days = byday?.length ? byday : [ev.start.getDay()];
      match = days.includes(day.getDay()) && Math.floor(diff / 7) % interval === 0;
    } else if (freq === 'MONTHLY') {
      const months = (day.getFullYear() - startDay.getFullYear()) * 12 + day.getMonth() - startDay.getMonth();
      match = day.getDate() === startDay.getDate() && months % interval === 0;
    }
    if (match) {
      const occ = new Date(day);
      occ.setHours(ev.start.getHours(), ev.start.getMinutes(), 0, 0);
      out.push(occ);
    }
  }
  return out;
}

/** Fetch an ICS feed — direct first, then via the Supabase calendar-proxy function. */
export async function fetchIcs(url: string): Promise<string> {
  const normalized = url.trim().replace(/^webcal:\/\//i, 'https://');
  try {
    const r = await fetch(normalized);
    if (r.ok) {
      const text = await r.text();
      if (text.includes('BEGIN:VCALENDAR')) return text;
    }
    throw new Error('direct');
  } catch {
    const cfg = getCloudConfig();
    if (!cfg) {
      throw new Error('This feed blocks direct browser access (CORS). Connect Supabase in Settings and deploy the calendar-proxy function (SETUP.md Part 3), then retry.');
    }
    const r = await fetch(`${cfg.url}/functions/v1/calendar-proxy?url=${encodeURIComponent(normalized)}`, {
      headers: { Authorization: `Bearer ${cfg.anonKey}`, apikey: cfg.anonKey },
    });
    if (r.status === 401) {
      throw new Error('The calendar-proxy function rejected the request. In the Supabase dashboard: Edge Functions → calendar-proxy → Details → turn OFF "Enforce JWT verification", then retry.');
    }
    if (r.status === 404) {
      throw new Error('The calendar-proxy function isn\'t deployed yet — see SETUP.md Part 3.');
    }
    const body = await r.text();
    if (!r.ok) throw new Error(`Calendar proxy returned ${r.status}${body ? ` — ${body.slice(0, 80)}` : ''}`);
    return body;
  }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Convert a feed into CalendarEvents for the sync window (ids prefixed "ical-"). */
export async function syncCalendarFeed(url: string): Promise<CalendarEvent[]> {
  const raw = await fetchIcs(url);
  const windowStart = parseISO(fmtDate(addDays(parseISO(today()), -WINDOW_BACK_DAYS)));
  const windowEnd = parseISO(fmtDate(addDays(parseISO(today()), WINDOW_AHEAD_DAYS)));
  windowEnd.setHours(23, 59, 59);
  const events: CalendarEvent[] = [];
  for (const ev of parseIcs(raw)) {
    const durMs = ev.end && ev.start ? Math.max(15 * 60_000, ev.end.getTime() - ev.start.getTime()) : 60 * 60_000;
    for (const occ of occurrences(ev, new Date(windowStart), new Date(windowEnd))) {
      const end = new Date(occ.getTime() + durMs);
      events.push({
        id: `ical-${ev.uid || ev.summary}-${format(occ, 'yyyyMMddHHmm')}`,
        date: fmtDate(occ),
        start: hhmm(occ),
        end: hhmm(end.getDate() === occ.getDate() ? end : new Date(occ.getFullYear(), occ.getMonth(), occ.getDate(), 23, 59)),
        title: ev.summary,
        type: 'meeting',
      });
    }
  }
  return events;
}

/** Merge freshly-synced feed events into AppData (replaces previous import). */
export function mergeCalendarEvents(data: AppData, imported: CalendarEvent[]): AppData {
  return {
    ...data,
    events: [...data.events.filter(e => !e.id.startsWith('ical-')), ...imported],
  };
}
