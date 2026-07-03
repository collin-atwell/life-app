import type { Program } from '../types';

// Built-in starter programs. Users can edit copies; builtIn flag keeps the originals restorable.
export const BUILT_IN_PROGRAMS: Program[] = [
  {
    id: 'strength-531',
    name: 'Foundation Strength',
    description: 'Classic heavy compound work, 4 days/week. Best for raw strength gains.',
    daysPerWeek: 4,
    builtIn: true,
    days: [
      {
        name: 'Day 1 — Squat Focus',
        exercises: [
          { exerciseId: 'squat', sets: 5, reps: '5' },
          { exerciseId: 'rdl', sets: 3, reps: '8' },
          { exerciseId: 'lunge', sets: 3, reps: '10' },
          { exerciseId: 'plank', sets: 3, reps: '45s' },
        ],
      },
      {
        name: 'Day 2 — Bench Focus',
        exercises: [
          { exerciseId: 'bench-press', sets: 5, reps: '5' },
          { exerciseId: 'bb-row', sets: 4, reps: '8' },
          { exerciseId: 'db-shoulder-press', sets: 3, reps: '10' },
          { exerciseId: 'tricep-pushdown', sets: 3, reps: '12' },
        ],
      },
      {
        name: 'Day 3 — Deadlift Focus',
        exercises: [
          { exerciseId: 'deadlift', sets: 5, reps: '3' },
          { exerciseId: 'front-squat', sets: 3, reps: '6' },
          { exerciseId: 'hip-thrust', sets: 3, reps: '10' },
          { exerciseId: 'hanging-leg-raise', sets: 3, reps: '12' },
        ],
      },
      {
        name: 'Day 4 — Overhead Focus',
        exercises: [
          { exerciseId: 'ohp', sets: 5, reps: '5' },
          { exerciseId: 'pullup', sets: 4, reps: '8' },
          { exerciseId: 'incline-db-press', sets: 3, reps: '10' },
          { exerciseId: 'face-pull', sets: 3, reps: '15' },
        ],
      },
    ],
  },
  {
    id: 'hypertrophy-ppl',
    name: 'Hypertrophy Push/Pull/Legs',
    description: 'Volume-driven muscle building, 6 days/week (or run 3 days on repeat).',
    daysPerWeek: 6,
    builtIn: true,
    days: [
      {
        name: 'Push',
        exercises: [
          { exerciseId: 'bench-press', sets: 4, reps: '8-12' },
          { exerciseId: 'incline-db-press', sets: 3, reps: '10-12' },
          { exerciseId: 'db-shoulder-press', sets: 3, reps: '10-12' },
          { exerciseId: 'lateral-raise', sets: 4, reps: '12-15' },
          { exerciseId: 'tricep-pushdown', sets: 3, reps: '12-15' },
          { exerciseId: 'ohte', sets: 3, reps: '12' },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          { exerciseId: 'lat-pulldown', sets: 4, reps: '10-12' },
          { exerciseId: 'seated-cable-row', sets: 3, reps: '10-12' },
          { exerciseId: 'db-row', sets: 3, reps: '10' },
          { exerciseId: 'rear-delt-fly', sets: 3, reps: '15' },
          { exerciseId: 'bb-curl', sets: 3, reps: '10-12' },
          { exerciseId: 'hammer-curl', sets: 3, reps: '12' },
        ],
      },
      {
        name: 'Legs',
        exercises: [
          { exerciseId: 'squat', sets: 4, reps: '8-10' },
          { exerciseId: 'rdl', sets: 3, reps: '10' },
          { exerciseId: 'leg-press', sets: 3, reps: '12' },
          { exerciseId: 'leg-curl', sets: 3, reps: '12' },
          { exerciseId: 'calf-raise', sets: 4, reps: '15' },
          { exerciseId: 'cable-crunch', sets: 3, reps: '15' },
        ],
      },
    ],
  },
  {
    id: 'conditioning',
    name: 'Engine Builder (Conditioning)',
    description: 'CrossFit-style mixed conditioning, 3 days/week plus optional runs.',
    daysPerWeek: 3,
    builtIn: true,
    days: [
      {
        name: 'Day 1 — Intervals',
        exercises: [
          { exerciseId: 'row-erg', sets: 5, reps: '500m' },
          { exerciseId: 'kb-swing', sets: 4, reps: '20' },
          { exerciseId: 'burpee', sets: 4, reps: '15' },
          { exerciseId: 'mountain-climber', sets: 3, reps: '30' },
        ],
      },
      {
        name: 'Day 2 — Strength Circuit',
        exercises: [
          { exerciseId: 'thruster', sets: 5, reps: '10' },
          { exerciseId: 'pullup', sets: 5, reps: 'AMRAP' },
          { exerciseId: 'box-jump', sets: 4, reps: '12' },
          { exerciseId: 'farmer-carry', sets: 3, reps: '40yd' },
        ],
      },
      {
        name: 'Day 3 — Mixed Modal',
        exercises: [
          { exerciseId: 'wall-ball', sets: 5, reps: '20' },
          { exerciseId: 'clean-press', sets: 5, reps: '8' },
          { exerciseId: 'jump-rope', sets: 4, reps: '60s' },
          { exerciseId: 'plank', sets: 3, reps: '60s' },
        ],
      },
    ],
  },
  {
    id: 'calisthenics',
    name: 'Calisthenics Fundamentals',
    description: 'Bodyweight-only strength, 3 days/week. Zero equipment beyond a pull-up bar.',
    daysPerWeek: 3,
    builtIn: true,
    days: [
      {
        name: 'Day A — Push & Core',
        exercises: [
          { exerciseId: 'pushup', sets: 4, reps: '12-20' },
          { exerciseId: 'pike-pushup', sets: 3, reps: '8-12' },
          { exerciseId: 'dips', sets: 3, reps: '8-12' },
          { exerciseId: 'plank', sets: 3, reps: '60s' },
          { exerciseId: 'deadbug', sets: 3, reps: '10' },
        ],
      },
      {
        name: 'Day B — Pull & Grip',
        exercises: [
          { exerciseId: 'pullup', sets: 4, reps: '5-10' },
          { exerciseId: 'chinup', sets: 3, reps: '6-10' },
          { exerciseId: 'inverted-row', sets: 3, reps: '10-15' },
          { exerciseId: 'dead-hang', sets: 3, reps: '30-60s' },
          { exerciseId: 'hanging-leg-raise', sets: 3, reps: '8-12' },
        ],
      },
      {
        name: 'Day C — Legs & Engine',
        exercises: [
          { exerciseId: 'pistol-squat', sets: 3, reps: '5/side' },
          { exerciseId: 'lunge', sets: 3, reps: '12/side' },
          { exerciseId: 'calf-raise', sets: 4, reps: '20' },
          { exerciseId: 'burpee', sets: 3, reps: '12' },
          { exerciseId: 'side-plank', sets: 3, reps: '30s/side' },
        ],
      },
    ],
  },
  {
    id: 'climber-strength',
    name: 'Climber Strength & Antagonist',
    description: 'Supports climbing: pull power, grip, core, plus antagonist push work. 3 days/week.',
    daysPerWeek: 3,
    builtIn: true,
    days: [
      {
        name: 'Day 1 — Pull Power',
        exercises: [
          { exerciseId: 'pullup', sets: 5, reps: '5 (weighted if able)' },
          { exerciseId: 'db-row', sets: 3, reps: '8' },
          { exerciseId: 'dead-hang', sets: 4, reps: '30-45s' },
          { exerciseId: 'hanging-leg-raise', sets: 3, reps: '10' },
        ],
      },
      {
        name: 'Day 2 — Antagonist Push',
        exercises: [
          { exerciseId: 'pushup', sets: 4, reps: '15' },
          { exerciseId: 'db-shoulder-press', sets: 3, reps: '10' },
          { exerciseId: 'face-pull', sets: 3, reps: '15' },
          { exerciseId: 'wrist-curl', sets: 3, reps: '15' },
        ],
      },
      {
        name: 'Day 3 — Core & Legs',
        exercises: [
          { exerciseId: 'goblet-squat', sets: 3, reps: '10' },
          { exerciseId: 'side-plank', sets: 3, reps: '45s/side' },
          { exerciseId: 'ab-wheel', sets: 3, reps: '8' },
          { exerciseId: 'step-up', sets: 3, reps: '10/side' },
        ],
      },
    ],
  },
];
