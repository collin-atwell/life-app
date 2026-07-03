# Health Hub ⚡

An all-in-one personal health platform: workout tracking & programming, adaptive nutrition,
hydration & recovery, daily journaling, and intelligent schedule planning — with every module
feeding the others.

Built with **React 19 + TypeScript + Vite**, **Recharts** for visualization, **date-fns** for
scheduling math, and **localStorage** persistence (cloud-sync-ready architecture).

## Running it

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
```

> **Note:** this folder's name contains `:` characters, which break the PATH entries npm
> creates for `node_modules/.bin`. The npm scripts therefore invoke the tool JS entrypoints
> via `node` directly — don't "simplify" them back to bare `vite`/`tsc`. The same issue is
> why `vite.config.ts` sets `server.fs.strict: false`.

On first launch an **onboarding modal** asks whether to start fresh or explore with the
**demo dataset** (~8 weeks of a user cutting 192 → 180 lb: 4 lifting days + 1 run + 1
climbing session/week, journals, meals, sleep, hydration, and a work calendar with one
deliberately over-booked day). Switch any time via **Settings → Start fresh / Load demo data**.

**No backend required** — the app is fully functional offline in the browser. A backend
becomes useful only for: multi-device sync, real calendar/wearable integrations, and OS push
notifications while the app is closed.

### PWA + hosting + optional backend

- **PWA**: installable to the home screen (manifest + icons + service worker with
  network-first offline caching). The SW registers in production builds only.
- **Hosting**: push to GitHub and the included workflow
  (`.github/workflows/deploy.yml`) auto-deploys to GitHub Pages.
- **Backend**: optional Supabase cloud sync (Settings → Cloud sync & backup) — email
  sign-in, whole-state last-write-wins sync, auto-push a few seconds after changes,
  newest-copy-wins on launch. Schema + RLS policies in `supabase/schema.sql`;
  client code in `src/lib/cloud.ts`.

**→ See [SETUP.md](SETUP.md) for the step-by-step guide to both (≈20 min, $0/month).**

### Notifications

Settings → Notifications enables local reminders (browser Notification API, with in-app
toast fallback when permission is denied): hydration nudges every 2h when behind pace,
a 45-minute heads-up before scheduled workout events, and a wind-down reminder 30 minutes
before the suggested bedtime. They fire while the app is open (background tabs included);
`src/lib/notifications.ts` is the seam where a service-worker push backend would plug in.

The dashboard also has **one-tap water logging** and a **shareable weekly report**
(Web Share API on mobile, clipboard elsewhere).

## Architecture

```
src/
  types.ts              # unified AppData schema — single JSON tree, all modules
  state/AppContext.tsx  # React Context + debounced localStorage persistence,
                        #   export/import JSON, celebration toasts.
                        #   Swap load()/persist() for Supabase/Firebase later.
  lib/
    calc.ts             # the cross-module brain: TDEE/adaptive macros, weight-trend
                        #   feedback loop, day strain, muscle recovery decay model,
                        #   WHOOP-style recovery score, adaptive water goals,
                        #   1RM/PRs, journal streaks, deload detection
    scheduler.ts        # AI-style day planner: free-gap detection, workout/meal/
                        #   recovery/sleep suggestions, conflict fallbacks,
                        #   busy-day + look-ahead notifications
  data/
    exercises.ts        # 60+ exercise library (muscles, equipment, cues, video links)
    programs.ts         # 5 built-in editable programs
    foods.ts            # seed food DB (FoodItem shape matches a future 50k+ food API)
    demo.ts             # deterministic demo-data generator
  components/ui.tsx     # Card, Stat, Ring, ProgressBar, Modal, Chip, Field
  modules/              # one file per tab: Dashboard, Workouts, Nutrition,
                        #   Recovery, Journal, Schedule, Settings
```

## Cross-module integrations (all live)

- **Workout → Nutrition**: today's strain adds a calorie bonus (`workoutBonus`); logging a
  run bumps protein targets.
- **Weight trend → Nutrition**: weekly weigh-in trend vs. target rate auto-adjusts calories
  (±300 kcal cap, corrects half the error) and reports on-pace / ahead / behind.
- **Workout → Recovery**: trained muscle groups decay over 72h; manual DOMS input overlays;
  the exercise picker flags fatigued groups with ⚠️.
- **Recovery → Workout/Schedule**: red/yellow recovery swaps the suggested block for active
  recovery or RPE-capped training; sleep suggestion shifts bedtime earlier.
- **Hydration → Recovery**: under-drinking yesterday dings today's recovery score; strain
  and diet type raise today's water goal.
- **Journal → everything**: self-reported sleep quality and stress feed the recovery score;
  a week of low mood + high strain triggers a deload recommendation on the dashboard.
- **Schedule → all**: ≥5h of meetings shortens the suggested workout and simplifies meal
  guidance; a heavy day tomorrow produces a "prioritize sleep tonight" notification.

## Integration placeholders (structured, mocked)

- **Wearables** (Apple Health / Google Fit / Oura): `SleepEntry` already carries
  `restingHr`/`hrv`; demo data mocks them, recovery score consumes them.
- **Calendars** (Google / Apple / Outlook): external events map onto `CalendarEvent`.
- **Food API + barcode scanner**: `FoodItem` is the adapter shape; seed DB stands in.
- **Run GPS / route maps**: manual entry now; `RunWorkout.splits` ready for real data.
