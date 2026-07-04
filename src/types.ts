// ---------- Unified data model ----------
// All modules read/write a single AppData tree persisted to localStorage.
// Structure is kept flat + serializable so it can later move to Supabase/Firebase.

export type Goal = 'gain' | 'maintain' | 'lose';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type DietType = 'balanced' | 'high-protein' | 'vegan' | 'vegetarian' | 'keto' | 'carnivore';

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'full-body';

export type Equipment =
  | 'bodyweight' | 'dumbbells' | 'barbell' | 'kettlebell' | 'cables'
  | 'machines' | 'bands' | 'pull-up bar' | 'bench' | 'box' | 'rower' | 'treadmill';

export interface UserProfile {
  name: string;
  weightLbs: number;
  goalWeightLbs: number;
  heightIn: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: ActivityLevel;
  goal: Goal;
  goalWeeks: number;            // timeline to reach goal weight
  dietType: DietType;
  equipment: Equipment[];
  advancedMode: boolean;        // progressive disclosure toggle
  darkMode: boolean;
  wakeTime: string;             // "06:30"
}

// ---------- Workouts ----------

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: Equipment[];       // any one of these works
  cues: string;
  videoUrl?: string;
}

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  reps: string;                 // "5", "8-12", "AMRAP"
}

export interface ProgramDay {
  name: string;                 // "Day 1 — Push"
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  days: ProgramDay[];
  builtIn?: boolean;
}

export interface LoggedSet {
  weight: number;               // lbs, 0 for bodyweight
  reps: number;
  rpe?: number;                 // 1-10
}

export interface LoggedExercise {
  exerciseId: string;
  sets: LoggedSet[];
  notes?: string;
}

export interface StrengthWorkout {
  kind: 'strength';
  id: string;
  date: string;                 // yyyy-MM-dd
  name: string;
  programId?: string;
  exercises: LoggedExercise[];
  durationMin: number;
  notes?: string;
  inProgress?: boolean;         // auto-save support
}

export interface RunWorkout {
  kind: 'run';
  id: string;
  date: string;
  distanceMi: number;
  durationMin: number;
  elevationFt: number;
  splits: number[];             // min per mile, one entry per mile
  avgHr?: number;
  notes?: string;
}

export interface CircuitWorkout {
  kind: 'circuit';
  id: string;
  date: string;
  mode: 'tabata' | 'emom' | 'amrap' | 'custom';
  workSec: number;
  restSec: number;
  rounds: number;
  durationMin: number;
  notes?: string;
}

export type ClimbStyle = 'boulder' | 'rope';
export type ClimbResult = 'flash' | 'send' | 'attempt';

export interface ClimbAscent {
  grade: string;                // "V4" or "5.11a"
  style: ClimbStyle;
  result: ClimbResult;
  attempts: number;
  isProject: boolean;
  notes?: string;
}

export interface ClimbWorkout {
  kind: 'climb';
  id: string;
  date: string;
  ascents: ClimbAscent[];
  durationMin: number;
  notes?: string;
}

export type Workout = StrengthWorkout | RunWorkout | CircuitWorkout | ClimbWorkout;

// ---------- Nutrition ----------

export interface FoodItem {
  id: string;
  name: string;
  serving: string;              // "1 cup", "100g"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags?: DietType[];            // which diets it suits
  treat?: boolean;              // loggable but excluded from meal suggestions
  barcode?: string;             // UPC/EAN when added via scanner
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry {
  id: string;
  date: string;
  slot: MealSlot;
  foodId: string;
  servings: number;
}

export interface WeightEntry {
  date: string;
  weightLbs: number;
}

// ---------- Hydration & Recovery ----------

export interface WaterEntry {
  id: string;
  date: string;
  oz: number;
}

export interface SorenessEntry {
  date: string;
  muscle: MuscleGroup;
  level: number;                // 1-10 DOMS
}

export interface SleepEntry {
  date: string;                 // date of the morning you woke up
  hours: number;
  quality: number;              // 1-10
  restingHr?: number;
  hrv?: number;                 // placeholder for wearable integration
}

// ---------- Journal ----------

export interface JournalEntry {
  date: string;                 // one per day
  text: string;
  mood: number;                 // 1-10
  energy: number;
  sleepQuality: number;
  stress: number;
  tags: string[];
}

// ---------- Schedule ----------

export type EventType = 'meeting' | 'workout' | 'meal' | 'recovery' | 'sleep' | 'personal';

export interface CalendarEvent {
  id: string;
  date: string;
  start: string;                // "09:00"
  end: string;
  title: string;
  type: EventType;
  suggested?: boolean;          // AI-generated vs user/imported
}

// ---------- Notifications ----------

export interface NotifPrefs {
  enabled: boolean;      // master switch (requires browser permission)
  hydration: boolean;    // nudges when behind on water
  workout: boolean;      // heads-up before scheduled workout events
  bedtime: boolean;      // wind-down reminder at suggested bedtime
}

// ---------- Root ----------

export interface AppData {
  profile: UserProfile;
  programs: Program[];
  activeProgramId: string | null;
  workouts: Workout[];
  meals: MealEntry[];
  customFoods: FoodItem[];
  favoriteFoodIds: string[];
  weights: WeightEntry[];
  water: WaterEntry[];
  soreness: SorenessEntry[];
  sleep: SleepEntry[];
  journal: JournalEntry[];
  events: CalendarEvent[];
  waterUnit: 'oz' | 'ml' | 'cups';
  notifPrefs: NotifPrefs;
  /** Secret iCal feed URL (Google/Apple/Outlook) — synced via Schedule tab. */
  icalUrl?: string;
}
