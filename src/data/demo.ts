import { addDays, format, subDays } from 'date-fns';
import type {
  AppData, CalendarEvent, JournalEntry, MealEntry, SleepEntry, SorenessEntry,
  Workout, WaterEntry, WeightEntry,
} from '../types';
import { BUILT_IN_PROGRAMS } from './programs';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
let seed = 42;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const jitter = (base: number, spread: number) => base + (rand() - 0.5) * 2 * spread;

/**
 * ~8 weeks of demo history for a user cutting from 192 → 180 lbs:
 * 4 lifting days + 1 run + 1 climbing session per week, journals most days,
 * water/sleep/meal logs, and a work calendar including one very busy day.
 */
export function buildDemoData(): AppData {
  const now = new Date();
  const workouts: Workout[] = [];
  const weights: WeightEntry[] = [];
  const water: WaterEntry[] = [];
  const sleep: SleepEntry[] = [];
  const journal: JournalEntry[] = [];
  const meals: MealEntry[] = [];
  const soreness: SorenessEntry[] = [];
  const events: CalendarEvent[] = [];

  const DAYS = 56;
  const startWeight = 192;
  const strength = BUILT_IN_PROGRAMS[0]; // Foundation Strength
  let programDayIdx = 0;
  const liftBase: Record<string, number> = {
    squat: 225, 'bench-press': 185, deadlift: 275, ohp: 115, 'bb-row': 155,
    rdl: 185, 'front-squat': 155, 'hip-thrust': 245, pullup: 0, 'db-shoulder-press': 50,
    'incline-db-press': 60, 'tricep-pushdown': 60, 'face-pull': 40, lunge: 30,
    plank: 0, 'hanging-leg-raise': 0,
  };

  for (let i = DAYS; i >= 0; i--) {
    const d = subDays(now, i);
    const date = fmt(d);
    const dow = d.getDay(); // 0 Sun ... 6 Sat
    const progress = (DAYS - i) / DAYS;

    // Weigh-in ~4x/week, trending down.
    if ([1, 3, 5, 6].includes(dow)) {
      weights.push({ date, weightLbs: Math.round(jitter(startWeight - 9 * progress, 0.8) * 10) / 10 });
    }

    // Lifting Mon/Tue/Thu/Fri
    if ([1, 2, 4, 5].includes(dow) && i > 0) {
      const day = strength.days[programDayIdx % strength.days.length];
      programDayIdx++;
      workouts.push({
        kind: 'strength',
        id: `demo-w-${date}`,
        date,
        name: day.name,
        programId: strength.id,
        durationMin: Math.round(jitter(62, 8)),
        exercises: day.exercises.map(pe => {
          const base = liftBase[pe.exerciseId] ?? 50;
          const w = base === 0 ? 0 : Math.round((base * (1 + 0.08 * progress)) / 5) * 5;
          const repTarget = parseInt(pe.reps) || 8;
          return {
            exerciseId: pe.exerciseId,
            sets: Array.from({ length: pe.sets }, (_, si) => ({
              weight: w,
              reps: Math.max(1, repTarget - (si === pe.sets - 1 && rand() < 0.4 ? 1 : 0)),
              rpe: Math.round(jitter(7.5, 1)),
            })),
          };
        }),
      });
      // occasional DOMS report the day after
      if (rand() < 0.35) {
        const muscle = pick(['quads', 'chest', 'hamstrings', 'back', 'glutes'] as const);
        soreness.push({ date: fmt(addDays(d, 1)), muscle, level: Math.round(jitter(5.5, 2)) });
      }
    }

    // Run on Wednesdays
    if (dow === 3 && i > 0) {
      const dist = Math.round(jitter(3.5 + 1.5 * progress, 0.6) * 10) / 10;
      const paceMin = jitter(9.2 - 0.6 * progress, 0.3);
      workouts.push({
        kind: 'run',
        id: `demo-r-${date}`,
        date,
        distanceMi: dist,
        durationMin: Math.round(dist * paceMin),
        elevationFt: Math.round(jitter(180, 90)),
        splits: Array.from({ length: Math.floor(dist) }, () => Math.round(jitter(paceMin, 0.35) * 100) / 100),
        avgHr: Math.round(jitter(152, 6)),
        notes: pick(['Felt smooth', 'Legs heavy from squats', 'Negative split!', 'Hot out today']),
      });
    }

    // Climbing on Saturdays
    if (dow === 6 && i > 0) {
      const maxV = 4 + Math.floor(progress * 2);
      workouts.push({
        kind: 'climb',
        id: `demo-c-${date}`,
        date,
        durationMin: Math.round(jitter(95, 15)),
        ascents: Array.from({ length: 3 + Math.floor(rand() * 3) }, () => {
          const v = Math.max(1, maxV - Math.floor(rand() * 3));
          const isProject = v >= maxV;
          return {
            grade: `V${v}`,
            style: 'boulder' as const,
            result: isProject ? (rand() < 0.3 ? 'send' as const : 'attempt' as const) : (rand() < 0.5 ? 'flash' as const : 'send' as const),
            attempts: isProject ? 2 + Math.floor(rand() * 5) : 1 + Math.floor(rand() * 2),
            isProject,
            notes: isProject ? 'Project — crux is the sloper move' : undefined,
          };
        }),
      });
    }

    // Sleep every day
    sleep.push({
      date,
      hours: Math.round(jitter(dow === 0 ? 8.3 : 7.2, 0.7) * 10) / 10,
      quality: Math.max(3, Math.min(10, Math.round(jitter(7, 1.5)))),
      restingHr: Math.round(jitter(58 - 2 * progress, 2)),
      hrv: Math.round(jitter(62 + 6 * progress, 8)),
    });

    // Water most days
    if (rand() < 0.9) {
      const total = jitter(88, 18);
      let logged = 0;
      let n = 0;
      while (logged < total) {
        const amt = pick([12, 16, 20, 24]);
        water.push({ id: `demo-h2o-${date}-${n++}`, date, oz: amt });
        logged += amt;
      }
    }

    // Journal ~85% of days
    if (rand() < 0.85) {
      const trainedHard = [1, 2, 4, 5].includes(dow);
      journal.push({
        date,
        mood: Math.max(2, Math.min(10, Math.round(jitter(7, 1.6)))),
        energy: Math.max(2, Math.min(10, Math.round(jitter(trainedHard ? 6.5 : 7.2, 1.4)))),
        sleepQuality: Math.max(3, Math.min(10, Math.round(jitter(7, 1.4)))),
        stress: Math.max(1, Math.min(10, Math.round(jitter(dow === 1 ? 6 : 4.5, 1.6)))),
        tags: rand() < 0.3 ? [pick(['training', 'work', 'family', 'climbing', 'goals'])] : [],
        text: pick([
          'Solid session today. Squats moved well and the cut is going smoothly.',
          'Busy day at work but got the workout in. Energy dipped in the afternoon.',
          'Climbing gym with friends — so close on the project. Fingers are cooked.',
          'Rest day. Meal prepped for the week and got a long walk in.',
          'Slept badly, dragged all day. Kept the workout short and easy.',
          'Feeling stronger every week. Weight trending down right on schedule.',
          'Stressful deadline at work. Journaling to clear my head before bed.',
          'Great run this morning, legs finally feel recovered from Monday.',
        ]),
      });
    }

    // Meals ~85% of days: breakfast/lunch/dinner/snack
    if (rand() < 0.85) {
      const plan: [string, string, number][] = [
        ['breakfast', pick(['overnight-oats', 'eggs', 'protein-smoothie', 'greek-yogurt'])!, 1],
        ['breakfast', 'banana', 1],
        ['lunch', pick(['chicken-rice-bowl', 'turkey-sandwich', 'burrito-bowl', 'tofu-stirfry'])!, 1],
        ['dinner', pick(['salmon-plate', 'chicken-breast', 'steak-eggs', 'lentil-curry'])!, 1],
        ['dinner', pick(['white-rice', 'sweet-potato', 'mixed-greens-salad'])!, 1],
        ['snack', pick(['protein-bar', 'apple', 'trail-mix', 'cottage-cheese'])!, 1],
      ];
      plan.forEach(([slot, foodId, servings], n) =>
        meals.push({ id: `demo-m-${date}-${n}`, date, slot: slot as MealEntry['slot'], foodId, servings }));
    }
  }

  // ---- Calendar: work week around today ----
  const mkEvent = (dayOffset: number, start: string, end: string, title: string, type: CalendarEvent['type']): CalendarEvent => {
    const date = fmt(addDays(now, dayOffset));
    return { id: `demo-ev-${date}-${start}-${title.slice(0, 8)}`, date, start, end, title, type };
  };
  for (let off = -2; off <= 5; off++) {
    const d = addDays(now, off);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // weekends free
    events.push(mkEvent(off, '09:00', '09:30', 'Team standup', 'meeting'));
    events.push(mkEvent(off, '13:00', '14:00', '1:1 with manager', 'meeting'));
    if (dow === 2) { // Tuesdays are brutal — demo of "busy day" adaptation
      events.push(mkEvent(off, '10:00', '12:00', 'Quarterly planning', 'meeting'));
      events.push(mkEvent(off, '14:30', '16:00', 'Design review', 'meeting'));
      events.push(mkEvent(off, '16:30', '17:30', 'Client call', 'meeting'));
    }
    if (dow === 4) events.push(mkEvent(off, '15:00', '16:00', 'Sprint retro', 'meeting'));
  }
  events.push(mkEvent(1, '19:00', '21:00', 'Dinner with friends', 'personal'));

  return {
    profile: {
      name: 'Demo User',
      weightLbs: weights[weights.length - 1]?.weightLbs ?? 183,
      goalWeightLbs: 180,
      heightIn: 70,
      age: 29,
      sex: 'male',
      activityLevel: 'active',
      goal: 'lose',
      goalWeeks: 8,
      dietType: 'high-protein',
      equipment: ['barbell', 'dumbbells', 'bench', 'pull-up bar', 'cables', 'bodyweight', 'kettlebell'],
      advancedMode: true,
      darkMode: false,
      wakeTime: '06:30',
    },
    programs: BUILT_IN_PROGRAMS,
    activeProgramId: 'strength-531',
    workouts, meals, weights, water, sleep, journal, soreness, events,
    customFoods: [],
    favoriteFoodIds: ['protein-smoothie', 'chicken-rice-bowl', 'greek-yogurt', 'salmon-plate'],
    waterUnit: 'oz',
    notifPrefs: { enabled: false, hydration: true, workout: true, bedtime: true },
  };
}

/** Blank slate for users who skip the demo. */
export function buildEmptyData(): AppData {
  return {
    profile: {
      name: '', weightLbs: 170, goalWeightLbs: 170, heightIn: 68, age: 30, sex: 'male',
      activityLevel: 'moderate', goal: 'maintain', goalWeeks: 12, dietType: 'balanced',
      equipment: ['bodyweight', 'dumbbells'], advancedMode: false, darkMode: false, wakeTime: '06:30',
    },
    programs: BUILT_IN_PROGRAMS,
    activeProgramId: null,
    workouts: [], meals: [], weights: [], water: [], sleep: [], journal: [], soreness: [], events: [],
    customFoods: [], favoriteFoodIds: [], waterUnit: 'oz',
    notifPrefs: { enabled: false, hydration: true, workout: true, bedtime: true },
  };
}
