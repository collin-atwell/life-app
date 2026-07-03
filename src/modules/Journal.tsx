import { useMemo, useState } from 'react';
import { format, parseISO, subDays, subYears } from 'date-fns';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../state/AppContext';
import { Card, Chip, Field } from '../components/ui';
import { EXERCISE_MAP } from '../data/exercises';
import { fmtDate, journalStreak, today, todaysWorkouts, workoutVolume } from '../lib/calc';
import type { JournalEntry } from '../types';

const MOOD_EMOJI = ['😞', '😟', '🙁', '😐', '🙂', '😊', '😄', '😁', '🤩', '🔥'];

const emptyEntry = (date: string): JournalEntry => ({
  date, text: '', mood: 5, energy: 5, sleepQuality: 5, stress: 5, tags: [],
});

function ScaleInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={`${label}: ${value}/10`}>
      <input type="range" min={1} max={10} value={value} onChange={e => onChange(+e.target.value)} aria-label={label} />
    </Field>
  );
}

function WorkoutSummary({ date }: { date: string }) {
  const { data } = useApp();
  const [open, setOpen] = useState(true);
  const workouts = todaysWorkouts(data, date);
  if (workouts.length === 0) return null;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
      <div className="flex-between" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <strong className="small">🏋️ Auto-pulled training summary</strong>
        <span className="small muted">{open ? '▲' : '▼'}</span>
      </div>
      {open && workouts.map(w => (
        <p key={w.id} className="small muted" style={{ margin: '4px 0' }}>
          {w.kind === 'strength' && <>{w.name}: {w.exercises.map(e => EXERCISE_MAP[e.exerciseId]?.name).filter(Boolean).join(', ')} — {Math.round(workoutVolume(w) / 1000)}k lbs in {w.durationMin} min</>}
          {w.kind === 'run' && <>Run: {w.distanceMi} mi in {w.durationMin} min (↗ {w.elevationFt} ft)</>}
          {w.kind === 'climb' && <>Climbing: {w.ascents.length} problems, best {w.ascents.filter(a => a.result !== 'attempt').map(a => a.grade).sort().at(-1) ?? '—'}</>}
          {w.kind === 'circuit' && <>Circuit: {w.mode.toUpperCase()} — {w.rounds} rounds of {w.workSec}s/{w.restSec}s</>}
        </p>
      ))}
    </div>
  );
}

export default function Journal() {
  const { data, update, celebrate } = useApp();
  const [date, setDate] = useState(today());
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState<'all' | 'low' | 'high'>('all');
  const existing = data.journal.find(j => j.date === date);
  const [draft, setDraft] = useState<JournalEntry>(existing ?? emptyEntry(date));

  // keep draft in sync when switching dates
  const [lastDate, setLastDate] = useState(date);
  if (date !== lastDate) {
    setLastDate(date);
    setDraft(data.journal.find(j => j.date === date) ?? emptyEntry(date));
  }

  const save = () => {
    const isNew = !data.journal.some(j => j.date === date);
    update(d => ({ ...d, journal: [...d.journal.filter(j => j.date !== date), draft] }));
    const streak = journalStreak(data) + (isNew ? 1 : 0);
    if (isNew && streak > 0 && streak % 7 === 0) celebrate(`📓 ${streak}-day journal streak!`);
    else celebrate('📓 Entry saved');
  };

  // Year-over-year: same calendar day in previous years
  const yoy = [1, 2].map(years => {
    const d = fmtDate(subYears(parseISO(date), years));
    return { years, date: d, entry: data.journal.find(j => j.date === d) };
  });

  const filtered = useMemo(() => data.journal
    .filter(j => (!search || j.text.toLowerCase().includes(search.toLowerCase()) || j.tags.some(t => t.includes(search.toLowerCase()))))
    .filter(j => moodFilter === 'all' || (moodFilter === 'low' ? j.mood <= 4 : j.mood >= 7))
    .sort((a, b) => b.date.localeCompare(a.date)), [data.journal, search, moodFilter]);

  const moodTrend = useMemo(() => [...Array(30)].map((_, i) => {
    const d = fmtDate(subDays(new Date(), 29 - i));
    const e = data.journal.find(j => j.date === d);
    return { date: format(parseISO(d), 'M/d'), mood: e?.mood ?? null, energy: e?.energy ?? null };
  }), [data.journal]);

  // Heatmap: last 26 weeks of entries
  const heatmap = useMemo(() => {
    const cells: { date: string; has: boolean; mood: number }[] = [];
    const start = subDays(new Date(), 26 * 7 - 1);
    for (let i = 0; i < 26 * 7; i++) {
      const d = fmtDate(subDays(new Date(), 26 * 7 - 1 - i));
      const e = data.journal.find(j => j.date === d);
      cells.push({ date: d, has: !!e, mood: e?.mood ?? 0 });
    }
    // pad so the grid starts on the right weekday
    const pad = parseISO(fmtDate(start)).getDay();
    return { cells, pad };
  }, [data.journal]);

  return (
    <div className="page">
      <div className="flex-between">
        <h2>Journal <span className="badge badge-accent">{journalStreak(data)}-day streak</span></h2>
        <input type="date" style={{ maxWidth: 170 }} value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <div className="grid grid-2">
        <Card title={format(parseISO(date), 'EEEE, MMMM d, yyyy')}>
          <WorkoutSummary date={date} />
          <textarea
            className="mt-8"
            placeholder="How was today? Wins, struggles, anything worth remembering…"
            value={draft.text}
            onChange={e => setDraft({ ...draft, text: e.target.value })}
            rows={6}
          />
          <div className="flex mb-8 mt-8" role="radiogroup" aria-label="Mood quick select">
            {MOOD_EMOJI.map((e, i) => (
              <button key={i} className="btn-icon" style={{ fontSize: '1.2rem', opacity: draft.mood === i + 1 ? 1 : 0.4 }}
                aria-label={`Mood ${i + 1}`} onClick={() => setDraft({ ...draft, mood: i + 1 })}>{e}</button>
            ))}
          </div>
          <div className="grid grid-2" style={{ gap: 8 }}>
            <ScaleInput label="Mood" value={draft.mood} onChange={v => setDraft({ ...draft, mood: v })} />
            <ScaleInput label="Energy" value={draft.energy} onChange={v => setDraft({ ...draft, energy: v })} />
            <ScaleInput label="Sleep quality" value={draft.sleepQuality} onChange={v => setDraft({ ...draft, sleepQuality: v })} />
            <ScaleInput label="Stress" value={draft.stress} onChange={v => setDraft({ ...draft, stress: v })} />
          </div>
          <Field label="Tags (comma-separated)">
            <input value={draft.tags.join(', ')} onChange={e =>
              setDraft({ ...draft, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
          </Field>
          <div className="flex mt-8">
            <button className="btn" onClick={save}>{existing ? 'Update entry' : 'Save entry'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Print</button>
          </div>
        </Card>

        <div className="page" style={{ gap: 16 }}>
          <Card title="On this day…">
            {yoy.every(y => !y.entry) && <p className="muted">No entries from {format(parseISO(date), 'M/d')} in previous years yet — future-you will love that you journaled today.</p>}
            {yoy.map(y => y.entry && (
              <div key={y.years} className="list-item mb-8">
                <div className="list-item-main">
                  <div className="list-item-title">{y.years} year{y.years > 1 ? 's' : ''} ago — {MOOD_EMOJI[y.entry.mood - 1]} mood {y.entry.mood}/10, energy {y.entry.energy}/10</div>
                  <div className="list-item-sub">{y.entry.text.slice(0, 180)}{y.entry.text.length > 180 ? '…' : ''}</div>
                </div>
              </div>
            ))}
          </Card>

          <Card title="Consistency (26 weeks)">
            <div className="heatmap" role="img" aria-label="Journal consistency heatmap">
              {Array.from({ length: heatmap.pad }, (_, i) => <div key={`p${i}`} className="heat-cell" style={{ visibility: 'hidden' }} />)}
              {heatmap.cells.map(c => (
                <div key={c.date} title={`${c.date}${c.has ? ` — mood ${c.mood}/10` : ''}`}
                  className={`heat-cell ${c.has ? (c.mood >= 7 ? 'heat-3' : c.mood >= 5 ? 'heat-2' : 'heat-1') : ''}`} />
              ))}
            </div>
            <p className="small muted mt-8">Darker = better mood that day.</p>
          </Card>
        </div>
      </div>

      <Card title="Mood & energy — 30 days">
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={moodTrend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="mood" stroke="var(--accent)" strokeWidth={2} connectNulls dot={false} />
              <Line type="monotone" dataKey="energy" stroke="var(--green)" strokeWidth={2} connectNulls dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="small"><span style={{ color: 'var(--accent)' }}>●</span> mood <span style={{ color: 'var(--green)' }}>●</span> energy</p>
      </Card>

      <Card title="Past entries">
        <div className="form-row mb-8">
          <input placeholder="Search text or tags…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="chip-row">
            {(['all', 'high', 'low'] as const).map(f => (
              <Chip key={f} active={moodFilter === f} onClick={() => setMoodFilter(f)}>
                {f === 'all' ? 'All' : f === 'high' ? '😄 Good days' : '😟 Tough days'}
              </Chip>
            ))}
          </div>
        </div>
        <div className="list" style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filtered.slice(0, 30).map(j => (
            <div key={j.date} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setDate(j.date)}>
              <div className="list-item-main">
                <div className="list-item-title">{MOOD_EMOJI[j.mood - 1]} {format(parseISO(j.date), 'EEE, MMM d, yyyy')}</div>
                <div className="list-item-sub">{j.text.slice(0, 120)}{j.text.length > 120 ? '…' : ''}</div>
                {j.tags.length > 0 && <div className="small muted">#{j.tags.join(' #')}</div>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="muted">No entries match.</p>}
        </div>
      </Card>
    </div>
  );
}
