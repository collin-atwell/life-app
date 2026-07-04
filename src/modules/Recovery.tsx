import { useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../state/AppContext';
import { Card, Field, ProgressBar, Ring, Stat, zoneOf } from '../components/ui';
import { MUSCLE_GROUPS, STRETCHES } from '../data/exercises';
import { fmtDate, muscleRecovery, recoveryScore, today, waterGoalDetail, waterOn } from '../lib/calc';
import type { MuscleGroup } from '../types';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const UNIT_FACTORS = { oz: 1, ml: 0.033814, cups: 8 };

export default function Recovery() {
  const { data, update, celebrate } = useApp();
  const date = today();
  const rec = recoveryScore(data, date);
  const muscles = muscleRecovery(data, date);
  const goal = waterGoalDetail(data, date);
  const drank = waterOn(data, date);
  const [customAmt, setCustomAmt] = useState('');
  const [soreMuscle, setSoreMuscle] = useState<MuscleGroup>('quads');
  const [soreLevel, setSoreLevel] = useState('5');
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('7');
  const [rhr, setRhr] = useState('');
  const [hrv, setHrv] = useState('');

  const unit = data.waterUnit;
  const toUnit = (oz: number) => unit === 'oz' ? Math.round(oz) : unit === 'ml' ? Math.round(oz / UNIT_FACTORS.ml) : Math.round((oz / 8) * 10) / 10;

  const logWater = (oz: number) => {
    const before = drank;
    update(d => ({ ...d, water: [...d.water, { id: uid(), date, oz }] }));
    if (before < goal.oz && before + oz >= goal.oz) celebrate('💧 Hydration goal hit!');
  };

  const trend = useMemo(() => [...Array(14)].map((_, i) => {
    const d = fmtDate(subDays(new Date(), 13 - i));
    return { date: format(parseISO(d), 'M/d'), score: recoveryScore(data, d).score };
  }), [data]);

  const fatigued = muscles.filter(m => m.status !== 'fresh');
  const todaysSleep = data.sleep.find(s => s.date === date);

  return (
    <div className="page">
      <div className="grid grid-2">
        <Card title="Recovery score">
          <div className="flex" style={{ alignItems: 'flex-start' }}>
            <Ring value={rec.score} max={100} size={110} zone={rec.zone} label={`Recovery ${rec.score}`} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <span className={`badge badge-${rec.zone}`}>{rec.zone.toUpperCase()}</span>
              <p className="small mt-8">{rec.recommendation}</p>
            </div>
          </div>
          {data.profile.advancedMode && (
            <table className="data-table mt-8">
              <thead><tr><th>Factor</th><th>Impact</th><th>Detail</th></tr></thead>
              <tbody>
                {rec.factors.map((f, i) => (
                  <tr key={i}>
                    <td>{f.label}</td>
                    <td style={{ color: f.impact < 0 ? 'var(--red)' : 'var(--green)' }}>{f.impact > 0 ? '+' : ''}{f.impact}</td>
                    <td className="small">{f.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!todaysSleep && (
            <>
              <div className="flex mt-8">
                <Field label="Sleep (hrs)"><input type="number" step="0.5" style={{ width: 84 }} value={sleepHours} onChange={e => setSleepHours(e.target.value)} /></Field>
                <Field label="Quality 1-10"><input type="number" min={1} max={10} style={{ width: 84 }} value={sleepQuality} onChange={e => setSleepQuality(e.target.value)} /></Field>
                <Field label="Resting HR"><input type="number" placeholder="opt." style={{ width: 84 }} value={rhr} onChange={e => setRhr(e.target.value)} /></Field>
                <Field label="HRV (ms)"><input type="number" placeholder="opt." style={{ width: 84 }} value={hrv} onChange={e => setHrv(e.target.value)} /></Field>
                <button className="btn btn-sm" onClick={() => {
                  if (!sleepHours) return;
                  update(d => ({ ...d, sleep: [...d.sleep, {
                    date, hours: +sleepHours, quality: +sleepQuality || 7,
                    restingHr: +rhr || undefined, hrv: +hrv || undefined,
                  }] }));
                }}>Log</button>
              </div>
              <p className="small muted mt-8">
                Resting HR and HRV are optional — copy them from your Watch/Health app each morning and the recovery score uses them.
              </p>
            </>
          )}
        </Card>

        <Card title="Hydration">
          <div className="flex-between mb-8">
            <div>
              <div className="stat-value">{toUnit(drank)} / {toUnit(goal.oz)} {unit}</div>
              <div className="stat-sub">adaptive goal for today</div>
            </div>
            <select style={{ width: 90 }} value={unit} aria-label="Water unit" onChange={e =>
              update(d => ({ ...d, waterUnit: e.target.value as typeof unit }))}>
              <option value="oz">oz</option><option value="ml">ml</option><option value="cups">cups</option>
            </select>
          </div>
          <ProgressBar value={drank} max={goal.oz} zone={zoneOf(drank / goal.oz)} />
          <div className="flex mt-8">
            {[8, 12, 16, 24].map(oz => (
              <button key={oz} className="btn btn-sm btn-secondary" onClick={() => logWater(oz)}>+{toUnit(oz)} {unit}</button>
            ))}
            <input type="number" placeholder={unit} style={{ width: 80 }} value={customAmt} onChange={e => setCustomAmt(e.target.value)} />
            <button className="btn btn-sm" onClick={() => {
              const v = +customAmt;
              if (!v) return;
              logWater(unit === 'oz' ? v : unit === 'ml' ? v * UNIT_FACTORS.ml : v * 8);
              setCustomAmt('');
            }}>Log</button>
          </div>
          <div className="mt-8">
            {goal.reasons.map((r, i) => <p key={i} className="small muted" style={{ margin: '2px 0' }}>• {r}</p>)}
          </div>
        </Card>
      </div>

      <Card title="Muscle recovery status">
        {muscles.length === 0 ? (
          <p className="muted">No recent training load — everything is fresh. 💪</p>
        ) : (
          <div className="grid grid-3" style={{ gap: 8 }}>
            {muscles.map(m => (
              <Stat
                key={m.muscle}
                label={MUSCLE_GROUPS.find(g => g.id === m.muscle)?.label ?? m.muscle}
                value={m.status === 'fatigued' ? 'Fatigued' : m.status === 'recovering' ? 'Recovering' : 'Fresh'}
                sub={`${m.hoursSinceTrained !== null ? `trained ${m.hoursSinceTrained}h ago` : 'soreness only'}${m.soreness ? ` · DOMS ${m.soreness}/10` : ''}`}
                zone={m.status === 'fatigued' ? 'red' : m.status === 'recovering' ? 'yellow' : 'green'}
              />
            ))}
          </div>
        )}
        <div className="flex mt-8">
          <Field label="Report soreness (DOMS)">
            <select value={soreMuscle} onChange={e => setSoreMuscle(e.target.value as MuscleGroup)}>
              {MUSCLE_GROUPS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Level 1-10"><input type="number" min={1} max={10} style={{ width: 80 }} value={soreLevel} onChange={e => setSoreLevel(e.target.value)} /></Field>
          <button className="btn btn-sm" onClick={() =>
            update(d => ({ ...d, soreness: [...d.soreness, { date, muscle: soreMuscle, level: +soreLevel || 5 }] }))}>Log</button>
        </div>
      </Card>

      {fatigued.length > 0 && (
        <Card title="Recommended recovery work">
          <div className="list">
            {fatigued.slice(0, 5).flatMap(m =>
              (STRETCHES[m.muscle] ?? []).map(s => (
                <div key={`${m.muscle}-${s.name}`} className="list-item">
                  <div className="list-item-main">
                    <div className="list-item-title">{s.name}</div>
                    <div className="list-item-sub">for {m.muscle} ({m.status})</div>
                  </div>
                  <a className="btn btn-sm btn-secondary" href={s.videoUrl} target="_blank" rel="noreferrer">▶ How-to</a>
                </div>
              )))}
          </div>
          <p className="small mt-8">
            💡 Also good today: {STRETCHES['full-body'].map(s => s.name).join(', ')}.
            {rec.zone !== 'green' && ' Prioritize protein within 2h of training and an early bedtime tonight.'}
          </p>
        </Card>
      )}

      <Card title="Recovery trend (14 days)">
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
