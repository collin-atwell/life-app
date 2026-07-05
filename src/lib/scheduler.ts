import { addDays, format, parseISO } from 'date-fns';
import type { AppData, CalendarEvent } from '../types';
import {
  dayStrain, deloadSuggested, estimateDayMinutes, fmtDate, muscleRecovery,
  nextProgramDay, recoveryScore,
} from './calc';

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const DAY_END_MIN = 22 * 60;

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
  // Nothing gets scheduled before the user is awake.
  const wakeMin = toMin(data.profile.wakeTime || '06:30');
  const dayStart = Math.max(6 * 60, wakeMin);
  const gaps = freeGaps(events, dayStart);
  const suggestions: CalendarEvent[] = [];
  const notes: string[] = [];
  const rec = recoveryScore(data, date);
  const meetings = events.filter(e => e.type === 'meeting');
  const busyScore = meetings.reduce((t, e) => t + (toMin(e.end) - toMin(e.start)), 0) / 60;
  const deload = deloadSuggested(data);

  // Suggestions claim time as they're placed so they don't stack on each other.
  const claimed: Gap[] = [];
  const overlapsClaimed = (start: number, end: number) =>
    claimed.some(c => start < c.end && end > c.start);
  const mk = (start: number, dur: number, title: string, type: CalendarEvent['type']): CalendarEvent => {
    claimed.push({ start, end: start + dur });
    return {
      id: `sugg-${date}-${type}-${start}`,
      date, start: toTime(start), end: toTime(start + dur), title, type, suggested: true,
    };
  };
  const findSlot = (dur: number, from: number, to: number): number | null => {
    for (const g of gaps) {
      const lo = Math.max(g.start, from);
      const hi = Math.min(g.end, to);
      for (let s = lo; s + dur <= hi; s += 15) {
        if (!overlapsClaimed(s, s + dur)) return s;
      }
    }
    return null;
  };

  // --- Workout slot: sized and named from the active program's next day ---
  const upNext = nextProgramDay(data);
  const alreadyTrained = dayStrain(data, date) > 0 || events.some(e => e.type === 'workout');
  if (!alreadyTrained) {
    let dur = 60;
    let title = 'Workout';
    if (upNext) {
      const day = upNext.program.days[upNext.dayIdx];
      dur = estimateDayMinutes(day);
      title = `${upNext.program.name}: ${day.name} (~${dur} min)`;
    }
    if (rec.zone === 'red' || deload) {
      dur = 30;
      title = deload ? 'Deload: light movement + mobility (30 min)' : 'Active recovery — walk / easy spin (30 min)';
    } else if (rec.zone === 'yellow') {
      title += ' — keep RPE ≤ 7';
    }
    if (busyScore > 5 && rec.zone === 'green' && dur > 45) {
      notes.push(`Heavy meeting day — if ${dur} min won't fit, swap in a 20-min circuit and keep the program day for tomorrow.`);
    }
    const start =
      findSlot(dur + 15, dayStart + 15, 12 * 60)    // prefer morning, ≥15 min after wake
      ?? findSlot(dur + 15, 14 * 60, 20 * 60)       // then afternoon/evening
      ?? findSlot(dur + 15, dayStart, DAY_END_MIN);
    if (start !== null) {
      suggestions.push(mk(start + 5, dur, title, 'workout'));
      const preMeal = start - 90;
      if (preMeal > dayStart) notes.push(`Workout at ${toTime(start + 5)} — eat carbs + protein around ${toTime(preMeal)} to fuel it.`);
      notes.push(`Post-workout: protein-forward meal within an hour of ${toTime(start + 5 + dur)}.`);
    } else {
      notes.push('No free slot fits a full workout today — consider a 15-min bodyweight circuit between meetings.');
    }
  }

  // --- Meal anchors: each meal gets suggested unless one is already scheduled in its window ---
  const mealWindows: { label: string; from: number; to: number }[] = [
    { label: 'Breakfast', from: Math.max(wakeMin + 15, 6 * 60 + 30), to: Math.max(wakeMin + 15, 6 * 60 + 30) + 180 },
    { label: 'Lunch', from: 11 * 60 + 30, to: 14 * 60 },
    { label: 'Dinner', from: 17 * 60 + 30, to: 20 * 60 },
  ];
  let breakfastEnd: number | null = null;
  for (const w of mealWindows) {
    const alreadyPlanned = events.some(e =>
      e.type === 'meal' && toMin(e.start) < w.to + 60 && toMin(e.end) > w.from - 60);
    if (alreadyPlanned) continue;
    const start = findSlot(30, w.from, w.to);
    if (start !== null) {
      suggestions.push(mk(start, 30, w.label, 'meal'));
      if (w.label === 'Breakfast') breakfastEnd = start + 30;
    }
  }

  // --- Supplements & medications: right after breakfast (or shortly after waking) ---
  const suppStart = breakfastEnd ?? findSlot(5, wakeMin + 15, wakeMin + 150);
  if (suppStart !== null && !overlapsClaimed(suppStart, suppStart + 5)) {
    suggestions.push(mk(suppStart, 5, '💊 Supplements & medications', 'recovery'));
  }

  // --- Recovery schedule: stretching / foam rolling / meditation / rest-day mobility ---
  const alreadyRecovery = events.some(e => e.type === 'recovery');
  if (!alreadyRecovery) {
    const fatigued = muscleRecovery(data, date).filter(m => m.status !== 'fresh').slice(0, 3);
    if (fatigued.length > 0) {
      const start = findSlot(20, 16 * 60, 21 * 60) ?? findSlot(20, 6 * 60, DAY_END_MIN);
      if (start !== null) {
        suggestions.push(mk(start, 20, `Stretch + foam roll: ${fatigued.map(f => f.muscle).join(', ')}`, 'recovery'));
      }
    } else if (alreadyTrained || suggestions.some(s => s.type === 'workout')) {
      // training day → evening mobility to wind down
      const start = findSlot(20, 16 * 60, 21 * 60);
      if (start !== null) suggestions.push(mk(start, 20, 'Mobility flow — hips, shoulders, spine', 'recovery'));
    } else {
      // true rest day
      const start = findSlot(25, 9 * 60, 20 * 60);
      if (start !== null) suggestions.push(mk(start, 25, 'Rest-day yoga / easy walk', 'recovery'));
    }
  }

  // --- Meditation: a daily 10-min wind-down (prioritized when stress runs high) ---
  {
    const journal = data.journal.find(j => j.date === date);
    const stressed = (journal && journal.stress >= 6) || busyScore >= 5;
    const medStart = findSlot(10, stressed ? 12 * 60 : 19 * 60, 21 * 60 + 30) ?? findSlot(10, 12 * 60, 21 * 60 + 30);
    if (medStart !== null) {
      suggestions.push(mk(medStart, 10, '🧘 Meditation / breathwork (10 min)', 'recovery'));
      if (stressed) notes.push('Stress is running high — a 10-minute breathing session measurably drops resting HR.');
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
