import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import type {
  AppData, MuscleGroup, StrengthWorkout, Workout, MealEntry, FoodItem,
} from '../types';
import { EXERCISE_MAP } from '../data/exercises';
import { FOOD_MAP } from '../data/foods';
import { communityFoodById } from './communityFoods';

export const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');
export const today = () => fmtDate(new Date());

// ---------- Nutrition ----------

const ACTIVITY_MULT: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9,
};

/** Mifflin-St Jeor BMR → TDEE. */
export function tdee(data: AppData): number {
  const p = data.profile;
  const kg = p.weightLbs * 0.4536;
  const cm = p.heightIn * 2.54;
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  return Math.round(bmr * (ACTIVITY_MULT[p.activityLevel] ?? 1.55));
}

/** Average lbs/week change over the trailing `weeks`, from logged weigh-ins. */
export function weightTrend(data: AppData, weeks = 3): number | null {
  const cutoff = fmtDate(subDays(new Date(), weeks * 7));
  const recent = data.weights.filter(w => w.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  if (recent.length < 2) return null;
  const first = recent[0], last = recent[recent.length - 1];
  const days = differenceInCalendarDays(parseISO(last.date), parseISO(first.date));
  if (days < 7) return null;
  return ((last.weightLbs - first.weightLbs) / days) * 7;
}

export interface MacroTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  adjustment: number;         // kcal adjustment applied from weight-trend feedback
  onPace: 'on-pace' | 'ahead' | 'behind' | 'no-data';
  weeklyTrend: number | null; // lbs/week measured
  targetRate: number;         // lbs/week desired
  workoutBonus: number;       // extra kcal added for today's training
  weeksLeft: number;          // remaining goal timeline (counts down from goalSetAt)
  goalReached: boolean;
}

/**
 * Adaptive macro calculator. Base TDEE ± goal deficit/surplus, then a feedback
 * correction from the measured weight trend (≈500 kcal/day per lb/week of error,
 * capped) and a same-day bonus for logged training.
 */
export function macroTargets(data: AppData, date: string): MacroTarget {
  const p = data.profile;
  const base = tdee(data);
  const deltaLbs = p.goalWeightLbs - p.weightLbs;
  // Goal reached (within a pound) → hold steady at maintenance.
  const goalReached = p.goal !== 'maintain' && Math.abs(deltaLbs) < 1;
  // The timeline counts down from when the goal was set, so the required
  // weekly rate stays honest as the deadline approaches.
  const elapsedWeeks = p.goalSetAt
    ? Math.max(0, differenceInCalendarDays(parseISO(date), parseISO(p.goalSetAt)) / 7)
    : 0;
  const weeksLeft = Math.max(1, Math.round((p.goalWeeks - elapsedWeeks) * 10) / 10);
  // Clamp to healthy limits: lose ≤1% BW/week, gain ≤0.5% BW/week.
  const rawRate = goalReached || p.goal === 'maintain' ? 0 : deltaLbs / weeksLeft;
  const targetRate = Math.max(-p.weightLbs * 0.01, Math.min(p.weightLbs * 0.005, rawRate)); // lbs/week (signed)
  let calories = base + (targetRate * 3500) / 7;

  // Feedback loop: compare measured trend to target and nudge.
  const trend = weightTrend(data);
  let adjustment = 0;
  let onPace: MacroTarget['onPace'] = 'no-data';
  if (trend !== null) {
    const err = trend - targetRate; // positive = gaining faster than intended
    if (Math.abs(err) < 0.25) onPace = 'on-pace';
    else onPace = err > 0 ? (p.goal === 'gain' ? 'ahead' : 'behind') : (p.goal === 'gain' ? 'behind' : 'ahead');
    adjustment = Math.max(-300, Math.min(300, Math.round((-err * 3500) / 7 / 2))); // correct half the error, capped
    calories += adjustment;
  }

  // Workout → nutrition integration: hard training day earns extra fuel.
  const strain = dayStrain(data, date);
  const workoutBonus = Math.round(Math.min(500, strain * 3.5));
  calories += workoutBonus;
  calories = Math.round(Math.max(1200, calories));

  // Macro split by diet type; protein anchored to bodyweight.
  let proteinPerLb = 0.8;
  if (p.goal === 'lose' || p.dietType === 'high-protein') proteinPerLb = 1.0;
  if (p.dietType === 'vegan') proteinPerLb = 0.75;
  // Cardio volume today bumps protein for recovery.
  if (todaysWorkouts(data, date).some(w => w.kind === 'run')) proteinPerLb += 0.1;

  const protein = Math.round(p.weightLbs * proteinPerLb);
  let fatPct = 0.28;
  if (p.dietType === 'keto') fatPct = 0.65;
  if (p.dietType === 'carnivore') fatPct = 0.55;
  const fat = Math.round((calories * fatPct) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat, adjustment, onPace, weeklyTrend: trend, targetRate, workoutBonus, weeksLeft, goalReached };
}

export function foodFor(data: AppData, id: string): FoodItem | undefined {
  return FOOD_MAP[id] ?? data.customFoods.find(f => f.id === id) ?? communityFoodById(id);
}

export function mealMacros(data: AppData, meals: MealEntry[]) {
  return meals.reduce(
    (acc, m) => {
      const f = foodFor(data, m.foodId);
      if (!f) return acc;
      acc.calories += f.calories * m.servings;
      acc.protein += f.protein * m.servings;
      acc.carbs += f.carbs * m.servings;
      acc.fat += f.fat * m.servings;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export const mealsOn = (data: AppData, date: string) => data.meals.filter(m => m.date === date);

// ---------- Workouts ----------

export const todaysWorkouts = (data: AppData, date: string): Workout[] =>
  data.workouts.filter(w => w.date === date && !(w.kind === 'strength' && w.inProgress));

/** Epley 1RM estimate. */
export const oneRepMax = (weight: number, reps: number) =>
  reps <= 1 ? weight : Math.round(weight * (1 + reps / 30));

export function workoutVolume(w: StrengthWorkout): number {
  return w.exercises.reduce(
    (t, ex) => t + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
}

/** Strain 0-100+ for a given day, from all logged workouts. Drives recovery + nutrition. */
export function dayStrain(data: AppData, date: string): number {
  let strain = 0;
  for (const w of todaysWorkouts(data, date)) {
    if (w.kind === 'strength') {
      strain += Math.min(60, workoutVolume(w) / 400 + w.exercises.length * 3);
    } else if (w.kind === 'run') {
      strain += Math.min(60, w.distanceMi * 8 + w.elevationFt / 100);
    } else if (w.kind === 'circuit') {
      strain += Math.min(50, w.durationMin * 1.6);
    } else if (w.kind === 'climb') {
      strain += Math.min(50, w.ascents.length * 4 + w.durationMin / 3);
    }
  }
  return Math.round(strain);
}

/** Muscle groups trained on a date (primary + half-weight secondary). */
export function musclesWorked(data: AppData, date: string): Map<MuscleGroup, number> {
  const map = new Map<MuscleGroup, number>();
  const add = (m: MuscleGroup, amt: number) => map.set(m, (map.get(m) ?? 0) + amt);
  for (const w of todaysWorkouts(data, date)) {
    if (w.kind === 'strength') {
      for (const ex of w.exercises) {
        const def = EXERCISE_MAP[ex.exerciseId];
        if (!def) continue;
        def.primary.forEach(m => add(m, ex.sets.length));
        def.secondary.forEach(m => add(m, ex.sets.length * 0.5));
      }
    } else if (w.kind === 'run') {
      add('quads', 3); add('calves', 3); add('hamstrings', 2);
    } else if (w.kind === 'climb') {
      add('forearms', w.ascents.length); add('back', w.ascents.length * 0.6);
      add('core', w.ascents.length * 0.4); add('shoulders', w.ascents.length * 0.4);
    } else if (w.kind === 'circuit') {
      add('full-body', 4);
    }
  }
  return map;
}

export interface MuscleRecoveryState {
  muscle: MuscleGroup;
  load: number;            // recent training load, recovery-decayed
  soreness: number;        // latest manual DOMS input (0 if none)
  status: 'fresh' | 'recovering' | 'fatigued';
  hoursSinceTrained: number | null;
}

/** 72-hour linear-decay recovery model per muscle group + manual soreness override. */
export function muscleRecovery(data: AppData, date: string): MuscleRecoveryState[] {
  const ref = parseISO(date);
  const loads = new Map<MuscleGroup, { load: number; hours: number | null }>();
  for (let back = 0; back <= 3; back++) {
    const d = fmtDate(subDays(ref, back));
    const worked = musclesWorked(data, d);
    const hours = back * 24;
    const decay = Math.max(0, 1 - hours / 72);
    worked.forEach((sets, m) => {
      const cur = loads.get(m) ?? { load: 0, hours: null };
      cur.load += sets * decay;
      if (cur.hours === null || hours < cur.hours) cur.hours = hours;
      loads.set(m, cur);
    });
  }
  const cutoff = fmtDate(subDays(ref, 2));
  const sorenessMap = new Map<MuscleGroup, number>();
  data.soreness.filter(s => s.date >= cutoff && s.date <= date)
    .forEach(s => sorenessMap.set(s.muscle, Math.max(sorenessMap.get(s.muscle) ?? 0, s.level)));

  const all = new Set<MuscleGroup>([...loads.keys(), ...sorenessMap.keys()]);
  return [...all].map(muscle => {
    const l = loads.get(muscle) ?? { load: 0, hours: null };
    const soreness = sorenessMap.get(muscle) ?? 0;
    const score = l.load + soreness * 1.2;
    const status: MuscleRecoveryState['status'] = score >= 8 ? 'fatigued' : score >= 3 ? 'recovering' : 'fresh';
    return {
      muscle, load: Math.round(l.load * 10) / 10, soreness, status,
      hoursSinceTrained: l.hours,
    };
  }).sort((a, b) => (b.load + b.soreness) - (a.load + a.soreness));
}

// ---------- Recovery score ----------

export interface RecoveryScore {
  score: number;                       // 0-100
  zone: 'red' | 'yellow' | 'green';
  factors: { label: string; impact: number; detail: string }[];
  recommendation: string;
}

/**
 * WHOOP-inspired composite: sleep (duration + quality), yesterday's strain,
 * muscle soreness, hydration adherence, and journal-reported stress.
 */
export function recoveryScore(data: AppData, date: string): RecoveryScore {
  const factors: RecoveryScore['factors'] = [];
  let score = 100;

  const sleep = data.sleep.find(s => s.date === date);
  const journal = data.journal.find(j => j.date === date);
  const sleepQuality = sleep?.quality ?? journal?.sleepQuality;
  if (sleep) {
    const hoursPenalty = Math.max(0, (8 - sleep.hours)) * 6;
    const qualPenalty = Math.max(0, (7 - sleep.quality)) * 3;
    // Journal → recovery: poor self-reported sleep quality weights the score harder.
    const penalty = Math.round(hoursPenalty + qualPenalty);
    score -= penalty;
    factors.push({ label: 'Sleep', impact: -penalty, detail: `${sleep.hours}h, quality ${sleep.quality}/10` });
    if (sleep.hrv) {
      const hrvBonus = Math.round(Math.max(-8, Math.min(8, (sleep.hrv - 55) / 3)));
      score += hrvBonus;
      factors.push({ label: 'HRV', impact: hrvBonus, detail: `${sleep.hrv} ms` });
    }
    if (sleep.restingHr) {
      const rhrPenalty = Math.max(0, Math.round((sleep.restingHr - 60) / 1.5));
      score -= rhrPenalty;
      factors.push({ label: 'Resting HR', impact: -rhrPenalty, detail: `${sleep.restingHr} bpm` });
    }
  } else if (sleepQuality !== undefined) {
    const penalty = Math.max(0, (7 - sleepQuality)) * 4;
    score -= penalty;
    factors.push({ label: 'Sleep (journal)', impact: -penalty, detail: `quality ${sleepQuality}/10` });
  } else {
    score -= 10;
    factors.push({ label: 'Sleep', impact: -10, detail: 'no data logged' });
  }

  const yStrain = dayStrain(data, fmtDate(subDays(parseISO(date), 1)));
  const strainPenalty = Math.round(yStrain * 0.45);
  if (strainPenalty) {
    score -= strainPenalty;
    factors.push({ label: "Yesterday's strain", impact: -strainPenalty, detail: `strain ${yStrain}` });
  }

  const fatigued = muscleRecovery(data, date).filter(m => m.status === 'fatigued');
  if (fatigued.length) {
    const p = Math.min(15, fatigued.length * 5);
    score -= p;
    factors.push({ label: 'Muscle fatigue', impact: -p, detail: fatigued.map(f => f.muscle).join(', ') });
  }

  // Hydration → recovery integration (yesterday's adherence).
  const yesterday = fmtDate(subDays(parseISO(date), 1));
  const yGoal = waterGoalOz(data, yesterday);
  const yDrank = waterOn(data, yesterday);
  if (yDrank > 0 && yDrank < yGoal * 0.6) {
    score -= 8;
    factors.push({ label: 'Hydration', impact: -8, detail: `only ${Math.round(yDrank)}/${yGoal} oz yesterday` });
  }

  if (journal && journal.stress >= 7) {
    const p = (journal.stress - 6) * 3;
    score -= p;
    factors.push({ label: 'Stress', impact: -p, detail: `self-reported ${journal.stress}/10` });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const zone = score >= 67 ? 'green' : score >= 34 ? 'yellow' : 'red';
  const recommendation =
    zone === 'green' ? 'Fully recovered — great day to push intensity or chase a PR.'
    : zone === 'yellow' ? 'Moderately recovered — train, but keep RPE ≤ 7 or hit fresh muscle groups.'
    : 'Low recovery — prioritize sleep, hydration and light movement. Swap today\'s session for active recovery.';
  return { score, zone, factors, recommendation };
}

// ---------- Hydration ----------

export const waterOn = (data: AppData, date: string) =>
  data.water.filter(w => w.date === date).reduce((t, w) => t + w.oz, 0);

export interface WaterGoal { oz: number; reasons: string[] }

/** Adaptive goal: 0.6 oz/lb base + training and diet modifiers. */
export function waterGoalDetail(data: AppData, date: string): WaterGoal {
  const reasons: string[] = [];
  let oz = data.profile.weightLbs * 0.6;
  reasons.push(`Base: ${Math.round(oz)} oz (0.6 oz × ${data.profile.weightLbs} lb)`);

  const strain = dayStrain(data, date);
  if (strain > 0) {
    const extra = Math.min(40, Math.round(strain * 0.7));
    oz += extra;
    reasons.push(`Training today (+${extra} oz for strain ${strain})`);
  } else if (hasPlannedWorkout(data, date)) {
    oz += 20;
    reasons.push('Workout scheduled today (+20 oz)');
  }
  if (data.profile.dietType === 'high-protein' || data.profile.dietType === 'carnivore' || data.profile.goal === 'gain') {
    oz += 12;
    reasons.push('High-protein diet (+12 oz)');
  }
  if (['active', 'athlete'].includes(data.profile.activityLevel)) {
    oz += 10;
    reasons.push('High baseline activity (+10 oz)');
  }
  return { oz: Math.round(oz / 5) * 5, reasons };
}

export const waterGoalOz = (data: AppData, date: string) => waterGoalDetail(data, date).oz;

const hasPlannedWorkout = (data: AppData, date: string) =>
  data.events.some(e => e.date === date && e.type === 'workout');

// ---------- Journal / streaks ----------

export function journalStreak(data: AppData): number {
  let streak = 0;
  let d = new Date();
  // today counts if present, otherwise start from yesterday
  if (!data.journal.some(j => j.date === fmtDate(d))) d = subDays(d, 1);
  while (data.journal.some(j => j.date === fmtDate(d))) {
    streak++;
    d = subDays(d, 1);
  }
  return streak;
}

/** Journal → training integration: detect sustained low mood while training hard. */
export function deloadSuggested(data: AppData): boolean {
  const cutoff = fmtDate(subDays(new Date(), 7));
  const recent = data.journal.filter(j => j.date >= cutoff);
  if (recent.length < 4) return false;
  const avgMood = recent.reduce((t, j) => t + j.mood, 0) / recent.length;
  const weekStrain = [...Array(7)].reduce<number>((t, _, i) => t + dayStrain(data, fmtDate(subDays(new Date(), i))), 0);
  return avgMood <= 4.5 && weekStrain > 150;
}

// ---------- Program day tracking ----------

export interface UpNext { program: import('../types').Program; dayIdx: number }

/**
 * Which program day is up next? Defaults to the day after the most recently
 * logged workout from the active program (wrapping), starting at day 0.
 */
export function nextProgramDay(data: AppData): UpNext | null {
  const program = data.programs.find(p => p.id === data.activeProgramId);
  if (!program || program.days.length === 0) return null;
  const last = [...data.workouts]
    .filter((w): w is StrengthWorkout => w.kind === 'strength' && !w.inProgress && w.programId === program.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .at(-1);
  if (!last) return { program, dayIdx: 0 };
  const lastIdx = program.days.findIndex(d => d.name === last.name);
  return { program, dayIdx: lastIdx >= 0 ? (lastIdx + 1) % program.days.length : 0 };
}

/** Estimated session length for a program day: warm-up + per-set work & rest. */
export function estimateDayMinutes(day: import('../types').ProgramDay): number {
  const sets = day.exercises.reduce((t, e) => t + e.sets, 0);
  return Math.round((10 + sets * 2.6) / 5) * 5; // 10 min warm-up, ~2.6 min per set
}

// ---------- Weekly report ----------

/** Plain-text summary of the trailing 7 days, for sharing/copying. */
export function weeklyReport(data: AppData): string {
  const start = subDays(new Date(), 6);
  const dates = [...Array(7)].map((_, i) => fmtDate(subDays(new Date(), 6 - i)));
  const workouts = data.workouts.filter(w => dates.includes(w.date) && !(w.kind === 'strength' && w.inProgress));
  const lifts = workouts.filter((w): w is StrengthWorkout => w.kind === 'strength');
  const runs = workouts.filter(w => w.kind === 'run');
  const climbs = workouts.filter(w => w.kind === 'climb');
  const volume = lifts.reduce((t, w) => t + workoutVolume(w), 0);
  const miles = runs.reduce((t, w) => t + (w.kind === 'run' ? w.distanceMi : 0), 0);
  const journals = data.journal.filter(j => dates.includes(j.date));
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const avgMood = avg(journals.map(j => j.mood));
  const avgEnergy = avg(journals.map(j => j.energy));
  const weighIns = data.weights.filter(w => dates.includes(w.date)).sort((a, b) => a.date.localeCompare(b.date));
  const deltaW = weighIns.length >= 2 ? Math.round((weighIns[weighIns.length - 1].weightLbs - weighIns[0].weightLbs) * 10) / 10 : null;
  const kcals = dates.map(d => mealMacros(data, mealsOn(data, d)).calories).filter(c => c > 0);
  const avgKcal = avg(kcals);
  const recToday = recoveryScore(data, today());

  const lines = [
    `⚡ Health Hub — week of ${format(start, 'MMM d')}–${format(new Date(), 'MMM d, yyyy')}`,
    `🏋️ Training: ${workouts.length} sessions (${lifts.length} lifts · ${runs.length} runs · ${climbs.length} climbs)`,
  ];
  if (volume > 0) lines.push(`📊 Lifting volume: ${Math.round(volume / 1000)}k lbs`);
  if (miles > 0) lines.push(`🏃 Running: ${Math.round(miles * 10) / 10} mi`);
  if (deltaW !== null) lines.push(`⚖️ Weight: ${deltaW > 0 ? '+' : ''}${deltaW} lb this week (now ${weighIns[weighIns.length - 1].weightLbs} lb, goal ${data.profile.goalWeightLbs})`);
  if (avgKcal !== null) lines.push(`🍽 Avg intake: ${Math.round(avgKcal)} kcal/day on logged days`);
  if (avgMood !== null) lines.push(`📓 Mood ${avgMood}/10 · energy ${avgEnergy}/10 across ${journals.length} journal entries`);
  lines.push(`💚 Recovery today: ${recToday.score}/100 (${recToday.zone})`);
  return lines.join('\n');
}

// ---------- Personal records ----------

export interface PR { exerciseId: string; name: string; e1rm: number; weight: number; reps: number; date: string }

export function personalRecords(data: AppData): PR[] {
  const best = new Map<string, PR>();
  for (const w of data.workouts) {
    if (w.kind !== 'strength' || w.inProgress) continue;
    for (const ex of w.exercises) {
      const def = EXERCISE_MAP[ex.exerciseId];
      if (!def) continue;
      for (const set of ex.sets) {
        if (set.weight <= 0) continue;
        const e1rm = oneRepMax(set.weight, set.reps);
        const cur = best.get(ex.exerciseId);
        if (!cur || e1rm > cur.e1rm) {
          best.set(ex.exerciseId, { exerciseId: ex.exerciseId, name: def.name, e1rm, weight: set.weight, reps: set.reps, date: w.date });
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm);
}
