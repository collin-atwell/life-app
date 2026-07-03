import { format, parseISO, subDays } from 'date-fns';
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useApp } from '../state/AppContext';
import { Card, ProgressBar, Ring, Stat, zoneOf } from '../components/ui';
import {
  dayStrain, deloadSuggested, fmtDate, journalStreak, macroTargets, mealMacros, mealsOn,
  recoveryScore, today, todaysWorkouts, waterGoalOz, waterOn, weeklyReport,
} from '../lib/calc';
import { generateDayPlan } from '../lib/scheduler';

export default function Dashboard({ go }: { go: (tab: string) => void }) {
  const { data, update, celebrate } = useApp();
  const date = today();

  const quickWater = (oz: number) => {
    const before = waterOn(data, date);
    update(d => ({ ...d, water: [...d.water, { id: `${Date.now()}-qw`, date, oz }] }));
    if (before < waterGoalOz(data, date) && before + oz >= waterGoalOz(data, date)) celebrate('💧 Hydration goal hit!');
  };

  const shareReport = async () => {
    const report = weeklyReport(data);
    if (navigator.share) {
      try { await navigator.share({ title: 'My week — Health Hub', text: report }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(report);
    celebrate('📋 Weekly report copied to clipboard');
  };
  const rec = recoveryScore(data, date);
  const target = macroTargets(data, date);
  const eaten = mealMacros(data, mealsOn(data, date));
  const water = waterOn(data, date);
  const waterGoal = waterGoalOz(data, date);
  const workouts = todaysWorkouts(data, date);
  const plan = generateDayPlan(data, date);
  const streak = journalStreak(data);
  const deload = deloadSuggested(data);

  const calPct = eaten.calories / target.calories;
  const waterPct = water / waterGoal;

  // Weekly stats
  const weekDates = [...Array(7)].map((_, i) => fmtDate(subDays(new Date(), i)));
  const weekWorkouts = data.workouts.filter(w => weekDates.includes(w.date) && !(w.kind === 'strength' && w.inProgress)).length;
  const weekStrain = weekDates.reduce((t, d) => t + dayStrain(data, d), 0);

  const weightData = data.weights
    .filter(w => w.date >= fmtDate(subDays(new Date(), 56)))
    .map(w => ({ date: format(parseISO(w.date), 'M/d'), weight: w.weightLbs }));

  return (
    <div className="page">
      <div className="grid grid-3">
        <Card title="Recovery">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <Ring value={rec.score} max={100} zone={rec.zone} label={`Recovery score ${rec.score}`} />
            <div style={{ flex: 1, minWidth: 140 }}>
              <span className={`badge badge-${rec.zone}`}>{rec.zone.toUpperCase()}</span>
              <p className="small mt-8">{rec.recommendation}</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm mt-8" onClick={() => go('recovery')}>Details →</button>
        </Card>

        <Card title="Nutrition">
          <div className="flex-between mb-8">
            <span className="small">{Math.round(eaten.calories)} / {target.calories} kcal</span>
            <span className={`badge badge-${zoneOf(Math.min(1, calPct))}`}>{Math.round(calPct * 100)}%</span>
          </div>
          <ProgressBar value={eaten.calories} max={target.calories} zone={zoneOf(Math.min(1, calPct))} />
          <div className="grid grid-3 mt-8" style={{ gap: 8 }}>
            <Stat label="Protein" value={`${Math.round(eaten.protein)}g`} sub={`of ${target.protein}g`} />
            <Stat label="Carbs" value={`${Math.round(eaten.carbs)}g`} sub={`of ${target.carbs}g`} />
            <Stat label="Fat" value={`${Math.round(eaten.fat)}g`} sub={`of ${target.fat}g`} />
          </div>
          {target.workoutBonus > 0 && (
            <p className="small mt-8">🔥 +{target.workoutBonus} kcal added for today's training.</p>
          )}
          <button className="btn btn-secondary btn-sm mt-8" onClick={() => go('nutrition')}>Log food →</button>
        </Card>

        <Card title="Hydration">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <Ring value={Math.min(100, waterPct * 100)} max={100} zone={zoneOf(waterPct)} label={`Hydration ${Math.round(waterPct * 100)}%`} />
            <div style={{ flex: 1, minWidth: 140 }}>
              <div className="stat-value">{Math.round(water)} oz</div>
              <div className="stat-sub">goal {waterGoal} oz today</div>
            </div>
          </div>
          <div className="flex mt-8">
            {[12, 16, 24].map(oz => (
              <button key={oz} className="btn btn-sm btn-secondary" onClick={() => quickWater(oz)}>+{oz} oz</button>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => go('recovery')}>More →</button>
          </div>
        </Card>
      </div>

      {deload && (
        <Card>
          <div className="flex">
            <span className="badge badge-yellow">DELOAD SUGGESTED</span>
            <span className="small">A week of low mood alongside heavy training — consider cutting volume ~40% this week.</span>
          </div>
        </Card>
      )}

      <div className="grid grid-2">
        <Card title="Today's training" action={<button className="btn btn-sm" onClick={() => go('workouts')}>Start workout</button>}>
          {workouts.length === 0 ? (
            <p className="muted">Nothing logged yet. {plan.suggestions.find(s => s.type === 'workout')
              ? `Suggested: ${plan.suggestions.find(s => s.type === 'workout')!.title} at ${plan.suggestions.find(s => s.type === 'workout')!.start}.`
              : 'Rest day — enjoy it.'}</p>
          ) : (
            <div className="list">
              {workouts.map(w => (
                <div key={w.id} className="list-item">
                  <div className="list-item-main">
                    <div className="list-item-title">
                      {w.kind === 'strength' ? w.name
                        : w.kind === 'run' ? `Run — ${w.distanceMi} mi`
                        : w.kind === 'climb' ? `Climbing — ${w.ascents.length} problems`
                        : `Circuit — ${w.mode.toUpperCase()}`}
                    </div>
                    <div className="list-item-sub">{w.durationMin} min · strain contribution {dayStrain(data, date)}</div>
                  </div>
                  <span className="badge badge-accent">{w.kind}</span>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-3 mt-8" style={{ gap: 8 }}>
            <Stat label="Workouts (7d)" value={weekWorkouts} />
            <Stat label="Strain (7d)" value={weekStrain} />
            <Stat label="Journal streak" value={`${streak}d`} />
          </div>
        </Card>

        <Card title="Today's plan" action={<button className="btn btn-secondary btn-sm" onClick={() => go('schedule')}>Full schedule →</button>}>
          <div className="list">
            {[...data.events.filter(e => e.date === date), ...plan.suggestions.filter(s => s.type !== 'sleep')]
              .sort((a, b) => a.start.localeCompare(b.start))
              .slice(0, 6)
              .map(e => (
                <div key={e.id} className="list-item">
                  <div className="list-item-main">
                    <div className="list-item-title">{e.title}</div>
                    <div className="list-item-sub">{e.start}–{e.end}{e.suggested ? ' · suggested' : ''}</div>
                  </div>
                  <span className={`badge badge-${e.type === 'workout' ? 'accent' : e.type === 'meal' ? 'green' : e.type === 'recovery' ? 'yellow' : 'accent'}`}>{e.type}</span>
                </div>
              ))}
          </div>
          {plan.notes.length > 0 && (
            <div className="mt-8">
              {plan.notes.slice(0, 2).map((n, i) => <p key={i} className="small">💡 {n}</p>)}
            </div>
          )}
        </Card>
      </div>

      <Card title="Weekly report" action={<button className="btn btn-sm" onClick={shareReport}>Share / copy</button>}>
        <pre className="small" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{weeklyReport(data)}</pre>
      </Card>

      {weightData.length > 1 && (
        <Card title={`Weight trend — goal ${data.profile.goalWeightLbs} lb`}>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={weightData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <ReferenceLine y={data.profile.goalWeightLbs} stroke="var(--green)" strokeDasharray="6 3" />
                <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="small">
            {target.weeklyTrend !== null
              ? <>Trending {Math.abs(target.weeklyTrend).toFixed(1)} lb/week {target.weeklyTrend < 0 ? 'down' : 'up'} (target {Math.abs(target.targetRate).toFixed(1)} lb/week) — <strong>{target.onPace.replace('-', ' ')}</strong>.
                  {target.adjustment !== 0 && <> Calories auto-adjusted {target.adjustment > 0 ? '+' : ''}{target.adjustment} kcal/day.</>}</>
              : 'Log weigh-ins a few times a week to activate adaptive calorie targets.'}
          </p>
        </Card>
      )}
    </div>
  );
}
