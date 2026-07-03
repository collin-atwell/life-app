import { addDays, format, parseISO } from 'date-fns';
import type { AppData, CalendarEvent } from '../types';
import { dayStrain, deloadSuggested, fmtDate, recoveryScore } from './calc';

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

interface Gap { start: number; end: number }

function freeGaps(events: CalendarEvent[], dayStart = 6 * 60, dayEnd = 22 * 60): Gap[] {
  const busy = events
    .filter(e => !e.suggested)
    .map(e => ({ start: toMin(e.start), end: toMin(e.end) }))
    .sort((a, b) => a.start - b.start);
  const gaps: Gap[] = [];
  let cursor = dayStart;
  for (const b of busy) {
    if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, dayEnd) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps.filter(g => g.end - g.start >= 20);
}

export interface DayPlan {
  date: string;
  suggestions: CalendarEvent[];
  notes: string[];           // smart-notification style messages
  busyScore: number;         // meeting-load heuristic
}

/**
 * AI-style schedule generation: reads real calendar events, recovery state,
 * and journal trends, then proposes workout / meal / recovery / sleep blocks
 * in the free gaps with conflict-aware fallbacks.
 */
export function generateDayPlan(data: AppData, date: string): DayPlan {
  const events = data.events.filter(e => e.date === date);
  const gaps = freeGaps(events);
  const suggestions: CalendarEvent[] = [];
  const notes: string[] = [];
  const rec = recoveryScore(data, date);
  const meetings = events.filter(e => e.type === 'meeting');
  const busyScore = meetings.reduce((t, e) => t + (toMin(e.end) - toMin(e.start)), 0) / 60;
  const deload = deloadSuggested(data);

  const mk = (start: number, dur: number, title: string, type: CalendarEvent['type']): CalendarEvent => ({
    id: `sugg-${date}-${type}-${start}`,
    date, start: toTime(start), end: toTime(start + dur), title, type, suggested: true,
  });

  // --- Workout slot ---
  const alreadyTrained = dayStrain(data, date) > 0 || events.some(e => e.type === 'workout');
  if (!alreadyTrained) {
    let dur = busyScore > 5 ? 30 : 60;
    let title = 'Workout';
    if (rec.zone === 'red' || deload) {
      dur = 30;
      title = deload ? 'Deload: light movement + mobility' : 'Active recovery (walk / easy spin)';
    } else if (rec.zone === 'yellow') {
      title = 'Moderate workout (RPE ≤ 7)';
    } else {
      title = busyScore > 5 ? 'Quick high-intensity circuit' : 'Full workout — recovery is green, push it';
    }
    // Prefer morning (before 12), then late afternoon (15:00-18:00).
    const slot =
      gaps.find(g => g.start >= 6 * 60 && g.start < 12 * 60 && g.end - g.start >= dur + 15)
      ?? gaps.find(g => g.start >= 14 * 60 && g.end - g.start >= dur + 15)
      ?? gaps.find(g => g.end - g.start >= dur + 15);
    if (slot) {
      const start = Math.max(slot.start + 5, slot.start);
      suggestions.push(mk(start, dur, title, 'workout'));
      const preMeal = start - 90;
      if (preMeal > 6 * 60) {
        notes.push(`Workout at ${toTime(start)} — eat carbs + protein around ${toTime(preMeal)} to fuel it.`);
      }
      notes.push(`Post-workout: get a protein-forward meal within an hour of ${toTime(start + dur)}.`);
    } else {
      notes.push('No free slot fits a workout today — consider a 15-min bodyweight circuit between meetings, or shift a lower-priority event.');
    }
  }

  // --- Meal anchors (only where a gap exists) ---
  const mealWindows: { label: string; from: number; to: number }[] = [
    { label: 'Breakfast', from: 6 * 60 + 30, to: 9 * 60 },
    { label: 'Lunch', from: 11 * 60 + 30, to: 13 * 60 + 30 },
    { label: 'Dinner', from: 17 * 60 + 30, to: 19 * 60 + 30 },
  ];
  for (const w of mealWindows) {
    if (events.some(e => e.type === 'meal')) break;
    const gap = gaps.find(g => g.end > w.from && g.start < w.to && Math.min(g.end, w.to) - Math.max(g.start, w.from) >= 20);
    if (gap) suggestions.push(mk(Math.max(gap.start, w.from), 30, w.label, 'meal'));
  }

  // --- Recovery block ---
  if (rec.zone !== 'green' || deload) {
    const evening = gaps.find(g => g.start >= 16 * 60 && g.end - g.start >= 25);
    if (evening) {
      suggestions.push(mk(evening.start + 10, 20, 'Stretch + foam roll fatigued muscles', 'recovery'));
      notes.push(`Recovery window available at ${toTime(evening.start + 10)} — 20 min of mobility will speed things up.`);
    }
  }

  // --- Sleep recommendation ---
  const wake = toMin(data.profile.wakeTime || '06:30');
  const needExtra = rec.zone === 'red' ? 45 : rec.zone === 'yellow' ? 20 : 0;
  const bedtime = (wake - 8 * 60 - needExtra + 24 * 60) % (24 * 60);
  suggestions.push({
    id: `sugg-${date}-sleep`, date, start: toTime(bedtime), end: toTime(wake),
    title: needExtra ? `Bedtime (recovery ${rec.zone} — extra ${needExtra} min)` : 'Bedtime',
    type: 'sleep', suggested: true,
  });

  // --- Look-ahead: heavy meeting load tomorrow ---
  const tomorrow = fmtDate(addDays(parseISO(date), 1));
  const tomorrowMeetingHrs = data.events
    .filter(e => e.date === tomorrow && e.type === 'meeting')
    .reduce((t, e) => t + (toMin(e.end) - toMin(e.start)), 0) / 60;
  if (tomorrowMeetingHrs >= 5) {
    notes.push(`Heads up: ${Math.round(tomorrowMeetingHrs)}h of meetings tomorrow (${format(parseISO(tomorrow), 'EEE')}). Prioritize sleep tonight and prep meals ahead.`);
  }
  if (busyScore >= 5) {
    notes.push('Heavy meeting load today — plan shorter, sharper training and keep nutrition simple (pre-logged meals help).');
  }
  if (deload) {
    notes.push('Your journal shows a week of low mood alongside heavy training — a deload week is recommended.');
  }

  return { date, suggestions, notes, busyScore };
}
