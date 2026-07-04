import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../state/AppContext';
import { Card, Chip, Field, Modal } from '../components/ui';
import { ALL_EQUIPMENT, EXERCISES, EXERCISE_MAP, MUSCLE_GROUPS } from '../data/exercises';
import {
  estimateDayMinutes, muscleRecovery, nextProgramDay, oneRepMax, personalRecords,
  today, workoutVolume,
} from '../lib/calc';
import type {
  ClimbAscent, ClimbWorkout, Equipment, Exercise, LoggedExercise, Program,
  RunWorkout, StrengthWorkout, CircuitWorkout,
} from '../types';

type SubTab = 'log' | 'programs' | 'library' | 'run' | 'circuit' | 'climb' | 'history';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function beep(freq = 880, ms = 150) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
    osc.onended = () => ctx.close();
  } catch { /* audio unavailable */ }
}

// ---------- Rest timer ----------
function RestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState(90);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => {
      if (s <= 1) { beep(660, 400); setRunning(false); return 0; }
      if (s <= 4) beep(880, 100);
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <div className="flex">
      <span className="small" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, minWidth: 44 }}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
      {[60, 90, 120, 180].map(p => (
        <Chip key={p} active={preset === p} onClick={() => setPreset(p)}>{p}s</Chip>
      ))}
      <button className="btn btn-sm" onClick={() => { setSeconds(preset); setRunning(true); }}>Rest</button>
      {running && <button className="btn btn-sm btn-secondary" onClick={() => setRunning(false)}>Stop</button>}
    </div>
  );
}

// ---------- Exercise picker (equipment-aware, recovery-aware) ----------
function ExercisePicker({ onPick, onClose }: { onPick: (ex: Exercise) => void; onClose: () => void }) {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const fatigued = useMemo(
    () => new Set(muscleRecovery(data, today()).filter(m => m.status === 'fatigued').map(m => m.muscle)),
    [data],
  );
  const owned = new Set(data.profile.equipment);
  const results = EXERCISES.filter(ex =>
    ex.equipment.some(e => owned.has(e))
    && (!muscle || ex.primary.includes(muscle as Exercise['primary'][number]))
    && ex.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="Add exercise" onClose={onClose} wide>
      <input placeholder="Search exercises…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <div className="chip-row">
        {MUSCLE_GROUPS.map(m => (
          <Chip key={m.id} active={muscle === m.id} onClick={() => setMuscle(muscle === m.id ? null : m.id)}>
            {m.label}{fatigued.has(m.id as never) ? ' ⚠️' : ''}
          </Chip>
        ))}
      </div>
      <p className="small muted">⚠️ = trained recently / sore — consider a fresh muscle group. Only exercises matching your equipment are shown.</p>
      <div className="list" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {results.map(ex => (
          <div key={ex.id} className="list-item">
            <div className="list-item-main">
              <div className="list-item-title">{ex.name}{ex.primary.some(m => fatigued.has(m)) ? ' ⚠️' : ''}</div>
              <div className="list-item-sub">{ex.primary.join(', ')} · {ex.equipment.join(' / ')}</div>
            </div>
            <button className="btn btn-sm" onClick={() => onPick(ex)}>Add</button>
          </div>
        ))}
        {results.length === 0 && <p className="muted">No matches with your equipment. Update equipment in Settings.</p>}
      </div>
    </Modal>
  );
}

// ---------- Strength logging ----------
function StrengthLogger() {
  const { data, update, celebrate } = useApp();
  const inProgress = data.workouts.find((w): w is StrengthWorkout => w.kind === 'strength' && !!w.inProgress);
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeProgram = data.programs.find(p => p.id === data.activeProgramId);
  const prsBefore = useRef(new Map(personalRecords(data).map(p => [p.exerciseId, p.e1rm])));

  const startWorkout = (name: string, exercises: LoggedExercise[] = [], programId?: string) => {
    const w: StrengthWorkout = {
      kind: 'strength', id: uid(), date: today(), name, programId,
      exercises, durationMin: 0, inProgress: true,
    };
    prsBefore.current = new Map(personalRecords(data).map(p => [p.exerciseId, p.e1rm]));
    update(d => ({ ...d, workouts: [...d.workouts, w] }));
  };

  const startFromProgramDay = (program: Program, dayIdx: number) => {
    const day = program.days[dayIdx];
    const owned = new Set(data.profile.equipment);
    const exercises: LoggedExercise[] = day.exercises
      .filter(pe => EXERCISE_MAP[pe.exerciseId]?.equipment.some(e => owned.has(e)))
      .map(pe => ({
        exerciseId: pe.exerciseId,
        sets: Array.from({ length: pe.sets }, () => ({ weight: 0, reps: parseInt(pe.reps) || 0 })),
      }));
    startWorkout(day.name, exercises, program.id);
  };

  const patch = (fn: (w: StrengthWorkout) => StrengthWorkout) =>
    update(d => ({ ...d, workouts: d.workouts.map(w => (w.id === inProgress?.id ? fn(w as StrengthWorkout) : w)) }));

  const finish = () => {
    if (!inProgress) return;
    const cleaned: StrengthWorkout = {
      ...inProgress,
      inProgress: false,
      exercises: inProgress.exercises
        .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.reps > 0) }))
        .filter(ex => ex.sets.length > 0),
      durationMin: inProgress.durationMin || 60,
    };
    update(d => ({ ...d, workouts: d.workouts.map(w => (w.id === inProgress.id ? cleaned : w)) }));
    // PR detection → celebration
    for (const ex of cleaned.exercises) {
      for (const set of ex.sets) {
        if (set.weight <= 0) continue;
        const e1rm = oneRepMax(set.weight, set.reps);
        const prev = prsBefore.current.get(ex.exerciseId) ?? 0;
        if (e1rm > prev && prev > 0) {
          celebrate(`🎉 New PR: ${EXERCISE_MAP[ex.exerciseId]?.name} — est. 1RM ${e1rm} lb!`);
          return;
        }
      }
    }
    celebrate('✅ Workout logged — nice work!');
  };

  if (!inProgress) {
    const upNext = nextProgramDay(data);
    return (
      <Card title="Start a workout">
        {activeProgram ? (
          <>
            <p className="small muted mb-8">Active program: <strong>{activeProgram.name}</strong></p>
            {upNext && (
              <div className="up-next mb-8">
                <div className="flex-between">
                  <div>
                    <span className="badge badge-accent">UP NEXT</span>
                    <div className="list-item-title mt-8">{upNext.program.days[upNext.dayIdx].name}</div>
                    <div className="list-item-sub">
                      ~{estimateDayMinutes(upNext.program.days[upNext.dayIdx])} min · based on your last logged {upNext.program.name} session
                    </div>
                  </div>
                  <button className="btn" onClick={() => startFromProgramDay(activeProgram, upNext.dayIdx)}>Start</button>
                </div>
              </div>
            )}
            <p className="small muted mb-8">Not the right day? Pick any:</p>
            <div className="list">
              {activeProgram.days.map((day, i) => (
                <div key={i} className="list-item" style={upNext?.dayIdx === i ? { outline: '2px solid var(--accent)' } : undefined}>
                  <div className="list-item-main">
                    <div className="list-item-title">{day.name}{upNext?.dayIdx === i ? ' ←' : ''}</div>
                    <div className="list-item-sub">~{estimateDayMinutes(day)} min · {day.exercises.map(e => EXERCISE_MAP[e.exerciseId]?.name).filter(Boolean).slice(0, 4).join(', ')}…</div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={() => startFromProgramDay(activeProgram, i)}>Start</button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted mb-8">No active program — pick one in the Programs tab, or start freestyle.</p>
        )}
        <button className="btn btn-secondary mt-8" onClick={() => startWorkout('Freestyle workout')}>Start empty workout</button>
      </Card>
    );
  }

  return (
    <Card
      title={<span>{inProgress.name} <span className="badge badge-accent">in progress · auto-saved</span></span>}
      action={<RestTimer />}
    >
      {inProgress.exercises.map((ex, exIdx) => {
        const def = EXERCISE_MAP[ex.exerciseId];
        return (
          <div key={exIdx} className="mb-8" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <div className="flex-between">
              <strong>{def?.name ?? ex.exerciseId}</strong>
              <div className="flex">
                {def?.videoUrl && <a className="small" href={def.videoUrl} target="_blank" rel="noreferrer">form video ↗</a>}
                <button className="btn-icon" aria-label="Remove exercise" onClick={() =>
                  patch(w => ({ ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) }))}>🗑</button>
              </div>
            </div>
            {def && <p className="small muted" style={{ margin: '2px 0 6px' }}>{def.cues}</p>}
            <table className="data-table">
              <thead><tr><th>Set</th><th>Weight (lb)</th><th>Reps</th><th>RPE</th></tr></thead>
              <tbody>
                {ex.sets.map((set, setIdx) => (
                  <tr key={setIdx}>
                    <td>{setIdx + 1}</td>
                    <td><input type="number" inputMode="decimal" style={{ width: 80 }} value={set.weight || ''} placeholder="0"
                      onChange={e => patch(w => { const c = structuredClone(w); c.exercises[exIdx].sets[setIdx].weight = +e.target.value; return c; })} /></td>
                    <td><input type="number" inputMode="numeric" style={{ width: 64 }} value={set.reps || ''} placeholder="0"
                      onChange={e => patch(w => { const c = structuredClone(w); c.exercises[exIdx].sets[setIdx].reps = +e.target.value; return c; })} /></td>
                    <td><input type="number" inputMode="numeric" style={{ width: 56 }} min={1} max={10} value={set.rpe ?? ''} placeholder="–"
                      onChange={e => patch(w => { const c = structuredClone(w); c.exercises[exIdx].sets[setIdx].rpe = e.target.value ? +e.target.value : undefined; return c; })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex mt-8">
              <button className="btn btn-sm btn-secondary" onClick={() =>
                patch(w => { const c = structuredClone(w); const prev = c.exercises[exIdx].sets.at(-1); c.exercises[exIdx].sets.push({ weight: prev?.weight ?? 0, reps: prev?.reps ?? 0 }); return c; })}>+ Set</button>
              <input placeholder="Exercise notes…" value={ex.notes ?? ''} style={{ maxWidth: 260 }}
                onChange={e => patch(w => { const c = structuredClone(w); c.exercises[exIdx].notes = e.target.value; return c; })} />
            </div>
          </div>
        );
      })}
      <div className="flex mt-8">
        <button className="btn btn-secondary" onClick={() => setPickerOpen(true)}>+ Add exercise</button>
        <Field label="Duration (min)">
          <input type="number" style={{ width: 100 }} value={inProgress.durationMin || ''}
            onChange={e => patch(w => ({ ...w, durationMin: +e.target.value }))} />
        </Field>
        <button className="btn" onClick={finish}>Finish workout</button>
        <button className="btn btn-sm btn-danger" onClick={() =>
          update(d => ({ ...d, workouts: d.workouts.filter(w => w.id !== inProgress.id) }))}>Discard</button>
      </div>
      {pickerOpen && (
        <ExercisePicker onClose={() => setPickerOpen(false)} onPick={ex => {
          patch(w => ({ ...w, exercises: [...w.exercises, { exerciseId: ex.id, sets: [{ weight: 0, reps: 0 }] }] }));
          setPickerOpen(false);
        }} />
      )}
    </Card>
  );
}

// ---------- Programs ----------
function Programs() {
  const { data, update } = useApp();
  const [editing, setEditing] = useState<Program | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const saveEdit = () => {
    if (!editing) return;
    update(d => ({
      ...d,
      programs: d.programs.some(p => p.id === editing.id)
        ? d.programs.map(p => (p.id === editing.id ? editing : p))
        : [...d.programs, editing],
    }));
    setEditing(null);
  };

  return (
    <div className="page">
      <div className="grid grid-2">
        {data.programs.map(p => (
          <Card key={p.id} title={p.name}
            action={data.activeProgramId === p.id
              ? <span className="badge badge-green">ACTIVE</span>
              : <button className="btn btn-sm" onClick={() => update(d => ({ ...d, activeProgramId: p.id }))}>Set active</button>}>
            <p className="small muted">{p.description}</p>
            <p className="small">{p.daysPerWeek} days/week · {p.days.length} distinct days{p.builtIn ? ' · built-in' : ''}</p>
            <div className="flex mt-8">
              <button className="btn btn-sm btn-secondary" onClick={() => setEditing(structuredClone(p))}>Edit</button>
              <button className="btn btn-sm btn-secondary" onClick={() => {
                const copy = structuredClone(p);
                copy.id = uid(); copy.name = `${p.name} (copy)`; copy.builtIn = false;
                update(d => ({ ...d, programs: [...d.programs, copy] }));
              }}>Duplicate</button>
              {!p.builtIn && (
                <button className="btn btn-sm btn-danger" onClick={() =>
                  update(d => ({ ...d, programs: d.programs.filter(x => x.id !== p.id), activeProgramId: d.activeProgramId === p.id ? null : d.activeProgramId }))}>Delete</button>
              )}
            </div>
          </Card>
        ))}
      </div>
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() =>
        setEditing({ id: uid(), name: 'New program', description: '', daysPerWeek: 3, days: [{ name: 'Day 1', exercises: [] }] })}>
        + New program
      </button>

      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)} wide>
          <div className="form-row">
            <Field label="Name"><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Days / week"><input type="number" min={1} max={7} value={editing.daysPerWeek}
              onChange={e => setEditing({ ...editing, daysPerWeek: +e.target.value })} /></Field>
          </div>
          <Field label="Description"><input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
          {editing.days.map((day, di) => (
            <div key={di} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
              <div className="flex-between mb-8">
                <input value={day.name} style={{ maxWidth: 220 }} onChange={e => {
                  const c = structuredClone(editing); c.days[di].name = e.target.value; setEditing(c);
                }} />
                <button className="btn-icon" aria-label="Delete day" onClick={() => {
                  const c = structuredClone(editing); c.days.splice(di, 1); setEditing(c);
                }}>🗑</button>
              </div>
              {day.exercises.map((pe, ei) => (
                <div key={ei} className="flex mb-8">
                  <span style={{ flex: 1, fontSize: '0.88rem' }}>{EXERCISE_MAP[pe.exerciseId]?.name ?? pe.exerciseId}</span>
                  <input type="number" style={{ width: 60 }} value={pe.sets} aria-label="Sets" onChange={e => {
                    const c = structuredClone(editing); c.days[di].exercises[ei].sets = +e.target.value; setEditing(c);
                  }} />
                  <span className="small">×</span>
                  <input style={{ width: 70 }} value={pe.reps} aria-label="Reps" onChange={e => {
                    const c = structuredClone(editing); c.days[di].exercises[ei].reps = e.target.value; setEditing(c);
                  }} />
                  <button className="btn-icon" aria-label="Remove" onClick={() => {
                    const c = structuredClone(editing); c.days[di].exercises.splice(ei, 1); setEditing(c);
                  }}>✕</button>
                </div>
              ))}
              <button className="btn btn-sm btn-secondary" onClick={() => setPickerFor(di)}>+ Exercise</button>
            </div>
          ))}
          <div className="flex">
            <button className="btn btn-secondary" onClick={() => setEditing({ ...editing, days: [...editing.days, { name: `Day ${editing.days.length + 1}`, exercises: [] }] })}>+ Day</button>
            <button className="btn" onClick={saveEdit}>Save program</button>
          </div>
          {pickerFor !== null && (
            <ExercisePicker onClose={() => setPickerFor(null)} onPick={ex => {
              const c = structuredClone(editing);
              c.days[pickerFor].exercises.push({ exerciseId: ex.id, sets: 3, reps: '10' });
              setEditing(c); setPickerFor(null);
            }} />
          )}
        </Modal>
      )}
    </div>
  );
}

// ---------- Library ----------
function Library() {
  const { data, update } = useApp();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const owned = new Set(data.profile.equipment);
  const results = EXERCISES.filter(ex =>
    (!ownedOnly || ex.equipment.some(e => owned.has(e)))
    && (!muscle || [...ex.primary, ...ex.secondary].includes(muscle as Exercise['primary'][number]))
    && ex.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <Card title="Your equipment">
        <div className="chip-row">
          {ALL_EQUIPMENT.map(eq => (
            <Chip key={eq} active={owned.has(eq)} onClick={() =>
              update(d => ({
                ...d,
                profile: {
                  ...d.profile,
                  equipment: owned.has(eq)
                    ? d.profile.equipment.filter(e => e !== eq)
                    : [...d.profile.equipment, eq as Equipment],
                },
              }))}>{eq}</Chip>
          ))}
        </div>
        <p className="small muted mt-8">Programs and the exercise picker auto-filter to what you have.</p>
      </Card>
      <Card title={`Exercise library (${results.length})`}>
        <div className="form-row mb-8">
          <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
          <label className="flex small"><input type="checkbox" style={{ width: 'auto' }} checked={ownedOnly} onChange={e => setOwnedOnly(e.target.checked)} /> my equipment only</label>
        </div>
        <div className="chip-row mb-8">
          {MUSCLE_GROUPS.map(m => (
            <Chip key={m.id} active={muscle === m.id} onClick={() => setMuscle(muscle === m.id ? null : m.id)}>{m.label}</Chip>
          ))}
        </div>
        <div className="list" style={{ maxHeight: 480, overflowY: 'auto' }}>
          {results.map(ex => (
            <div key={ex.id} className="list-item">
              <div className="list-item-main">
                <div className="list-item-title">{ex.name}</div>
                <div className="list-item-sub">
                  <strong>{ex.primary.join(', ')}</strong>{ex.secondary.length > 0 && <> · {ex.secondary.join(', ')}</>} · {ex.equipment.join(' / ')}
                </div>
                <div className="small muted">{ex.cues}</div>
              </div>
              {ex.videoUrl && <a className="btn btn-sm btn-secondary" href={ex.videoUrl} target="_blank" rel="noreferrer">▶ Demo</a>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------- Run tracker ----------
function RunTracker() {
  const { data, update, celebrate } = useApp();
  const [dist, setDist] = useState('');
  const [dur, setDur] = useState('');
  const [elev, setElev] = useState('');
  const [notes, setNotes] = useState('');
  const runs = data.workouts.filter((w): w is RunWorkout => w.kind === 'run').sort((a, b) => b.date.localeCompare(a.date));
  const chart = [...runs].reverse().map(r => ({
    date: format(parseISO(r.date), 'M/d'),
    pace: r.distanceMi > 0 ? Math.round((r.durationMin / r.distanceMi) * 100) / 100 : 0,
    miles: r.distanceMi,
  }));

  const log = () => {
    const distanceMi = +dist, durationMin = +dur;
    if (!distanceMi || !durationMin) return;
    const pace = durationMin / distanceMi;
    const splits = Array.from({ length: Math.floor(distanceMi) }, () => Math.round(pace * 100) / 100);
    const best = runs.every(r => r.distanceMi < distanceMi);
    update(d => ({
      ...d,
      workouts: [...d.workouts, {
        kind: 'run', id: uid(), date: today(), distanceMi, durationMin,
        elevationFt: +elev || 0, splits, notes: notes || undefined,
      }],
    }));
    if (best && runs.length > 0) celebrate(`🏃 Longest run yet — ${distanceMi} mi!`);
    setDist(''); setDur(''); setElev(''); setNotes('');
  };

  return (
    <div className="page">
      <Card title="Log a run">
        <div className="form-row">
          <Field label="Distance (mi)"><input type="number" inputMode="decimal" value={dist} onChange={e => setDist(e.target.value)} /></Field>
          <Field label="Duration (min)"><input type="number" inputMode="decimal" value={dur} onChange={e => setDur(e.target.value)} /></Field>
          <Field label="Elevation gain (ft)"><input type="number" inputMode="numeric" value={elev} onChange={e => setElev(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it feel?" /></Field>
        <div className="flex mt-8">
          <button className="btn" onClick={log}>Log run</button>
          <span className="small muted">Route maps & live GPS arrive with the mobile/HealthKit integration — splits are estimated evenly for manual entries.</span>
        </div>
      </Card>
      {chart.length > 1 && (
        <Card title="Pace trend (min/mi)">
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <YAxis reversed domain={['dataMin - 0.3', 'dataMax + 0.3']} tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="pace" stroke="var(--accent)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card title="Run history">
        <div className="list">
          {runs.slice(0, 12).map(r => (
            <div key={r.id} className="list-item">
              <div className="list-item-main">
                <div className="list-item-title">{format(parseISO(r.date), 'EEE, MMM d')} — {r.distanceMi} mi in {r.durationMin} min</div>
                <div className="list-item-sub">
                  {(r.durationMin / r.distanceMi).toFixed(2)} min/mi · ↗ {r.elevationFt} ft
                  {r.avgHr ? ` · ${r.avgHr} bpm avg` : ''}
                  {r.splits.length > 0 && ` · splits: ${r.splits.join(', ')}`}
                </div>
                {r.notes && <div className="small muted">{r.notes}</div>}
              </div>
            </div>
          ))}
          {runs.length === 0 && <p className="muted">No runs yet.</p>}
        </div>
      </Card>
    </div>
  );
}

// ---------- Circuit timer ----------
interface CircuitConfig { workSec: number; restSec: number; rounds: number }
const CIRCUIT_PRESETS: Record<'tabata' | 'emom' | 'amrap' | 'custom', CircuitConfig> = {
  tabata: { workSec: 20, restSec: 10, rounds: 8 },
  emom: { workSec: 60, restSec: 0, rounds: 10 },
  amrap: { workSec: 600, restSec: 0, rounds: 1 },
  custom: { workSec: 40, restSec: 20, rounds: 6 },
};

function CircuitTimer() {
  const { update, celebrate } = useApp();
  const [mode, setMode] = useState<keyof typeof CIRCUIT_PRESETS>('tabata');
  const [cfg, setCfg] = useState({ ...CIRCUIT_PRESETS.tabata });
  const [state, setState] = useState<{ phase: 'idle' | 'work' | 'rest' | 'done'; round: number; left: number }>({ phase: 'idle', round: 0, left: 0 });

  useEffect(() => {
    if (state.phase !== 'work' && state.phase !== 'rest') return;
    const t = setInterval(() => setState(s => {
      if (s.left > 1) { if (s.left <= 4) beep(880, 90); return { ...s, left: s.left - 1 }; }
      // phase transition
      if (s.phase === 'work') {
        if (cfg.restSec > 0 && s.round < cfg.rounds) { beep(520, 300); return { phase: 'rest', round: s.round, left: cfg.restSec }; }
        if (s.round < cfg.rounds) { beep(1040, 300); return { phase: 'work', round: s.round + 1, left: cfg.workSec }; }
        beep(1300, 600); return { phase: 'done', round: s.round, left: 0 };
      }
      if (s.round < cfg.rounds) { beep(1040, 300); return { phase: 'work', round: s.round + 1, left: cfg.workSec }; }
      beep(1300, 600); return { phase: 'done', round: s.round, left: 0 };
    }), 1000);
    return () => clearInterval(t);
  }, [state.phase, cfg]);

  useEffect(() => {
    if (state.phase !== 'done') return;
    const durationMin = Math.max(1, Math.round((cfg.rounds * (cfg.workSec + cfg.restSec)) / 60));
    update(d => ({
      ...d,
      workouts: [...d.workouts, {
        kind: 'circuit', id: uid(), date: today(), mode,
        workSec: cfg.workSec, restSec: cfg.restSec, rounds: cfg.rounds, durationMin,
      } satisfies CircuitWorkout],
    }));
    celebrate('🔥 Circuit complete — logged automatically!');
    setState({ phase: 'idle', round: 0, left: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const running = state.phase === 'work' || state.phase === 'rest';
  return (
    <Card title="Circuit timer">
      <div className="chip-row mb-8">
        {(Object.keys(CIRCUIT_PRESETS) as (keyof typeof CIRCUIT_PRESETS)[]).map(m => (
          <Chip key={m} active={mode === m} onClick={() => { setMode(m); setCfg({ ...CIRCUIT_PRESETS[m] }); }}>{m.toUpperCase()}</Chip>
        ))}
      </div>
      <div className="form-row mb-8">
        <Field label="Work (sec)"><input type="number" disabled={running} value={cfg.workSec} onChange={e => setCfg({ ...cfg, workSec: +e.target.value })} /></Field>
        <Field label="Rest (sec)"><input type="number" disabled={running} value={cfg.restSec} onChange={e => setCfg({ ...cfg, restSec: +e.target.value })} /></Field>
        <Field label="Rounds"><input type="number" disabled={running} value={cfg.rounds} onChange={e => setCfg({ ...cfg, rounds: +e.target.value })} /></Field>
      </div>
      {running ? (
        <>
          <div className={`timer-phase ${state.phase}`}>{state.phase} — round {state.round}/{cfg.rounds}</div>
          <div className="timer-display">{Math.floor(state.left / 60)}:{String(state.left % 60).padStart(2, '0')}</div>
          <div className="flex" style={{ justifyContent: 'center' }}>
            <button className="btn btn-danger" onClick={() => setState({ phase: 'idle', round: 0, left: 0 })}>Stop</button>
          </div>
        </>
      ) : (
        <button className="btn" onClick={() => { beep(1040, 300); setState({ phase: 'work', round: 1, left: cfg.workSec }); }}>
          Start {mode.toUpperCase()}
        </button>
      )}
      <p className="small muted mt-8">Audio cues on transitions and final 3 seconds. Completed circuits log automatically and count toward today's strain.</p>
    </Card>
  );
}

// ---------- Climbing ----------
const V_GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];
const ROPE_GRADES = ['5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b'];

function Climbing() {
  const { data, update, celebrate } = useApp();
  const [style, setStyle] = useState<'boulder' | 'rope'>('boulder');
  const [session, setSession] = useState<ClimbAscent[]>([]);
  const [grade, setGrade] = useState('V3');
  const [result, setResult] = useState<ClimbAscent['result']>('send');
  const [attempts, setAttempts] = useState('1');
  const [isProject, setIsProject] = useState(false);
  const [notes, setNotes] = useState('');
  const [durationMin, setDurationMin] = useState('90');

  const climbs = data.workouts.filter((w): w is ClimbWorkout => w.kind === 'climb').sort((a, b) => b.date.localeCompare(a.date));
  const grades = style === 'boulder' ? V_GRADES : ROPE_GRADES;
  const gradeIdx = (g: string) => (g.startsWith('V') ? V_GRADES.indexOf(g) : ROPE_GRADES.indexOf(g));

  const projects = useMemo(() => {
    const map = new Map<string, { grade: string; attempts: number; sent: boolean; lastDate: string }>();
    for (const c of climbs) {
      for (const a of c.ascents) {
        if (!a.isProject) continue;
        const key = `${a.grade}-${a.notes ?? ''}`;
        const cur = map.get(key) ?? { grade: a.grade, attempts: 0, sent: false, lastDate: c.date };
        cur.attempts += a.attempts;
        if (a.result !== 'attempt') cur.sent = true;
        if (c.date > cur.lastDate) cur.lastDate = c.date;
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [climbs]);

  const chart = [...climbs].reverse().map(c => ({
    date: format(parseISO(c.date), 'M/d'),
    best: Math.max(0, ...c.ascents.filter(a => a.result !== 'attempt').map(a => gradeIdx(a.grade))),
  }));

  const finishSession = () => {
    if (session.length === 0) return;
    update(d => ({
      ...d,
      workouts: [...d.workouts, {
        kind: 'climb', id: uid(), date: today(), ascents: session, durationMin: +durationMin || 90,
      } satisfies ClimbWorkout],
    }));
    const bestSend = Math.max(-1, ...session.filter(a => a.result !== 'attempt').map(a => gradeIdx(a.grade)));
    const prevBest = Math.max(-1, ...climbs.flatMap(c => c.ascents.filter(a => a.result !== 'attempt').map(a => gradeIdx(a.grade))));
    if (bestSend > prevBest && prevBest >= 0) celebrate(`🧗 New hardest send: ${grades[bestSend] ?? session[0].grade}!`);
    else celebrate('🧗 Session logged!');
    setSession([]);
  };

  return (
    <div className="page">
      <Card title="Log climbing session">
        <div className="chip-row mb-8">
          <Chip active={style === 'boulder'} onClick={() => { setStyle('boulder'); setGrade('V3'); }}>Bouldering (V-scale)</Chip>
          <Chip active={style === 'rope'} onClick={() => { setStyle('rope'); setGrade('5.10a'); }}>Routes (5.x)</Chip>
        </div>
        <div className="form-row">
          <Field label="Grade">
            <select value={grade} onChange={e => setGrade(e.target.value)}>{grades.map(g => <option key={g}>{g}</option>)}</select>
          </Field>
          <Field label="Result">
            <select value={result} onChange={e => setResult(e.target.value as ClimbAscent['result'])}>
              <option value="flash">Flash</option><option value="send">Send</option><option value="attempt">Attempt (no send)</option>
            </select>
          </Field>
          <Field label="Attempts"><input type="number" min={1} value={attempts} onChange={e => setAttempts(e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <label className="flex small"><input type="checkbox" style={{ width: 'auto' }} checked={isProject} onChange={e => setIsProject(e.target.checked)} /> project</label>
          <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="beta, conditions…" /></Field>
        </div>
        <button className="btn btn-secondary mt-8" onClick={() => {
          setSession([...session, { grade, style, result, attempts: +attempts || 1, isProject, notes: notes || undefined }]);
          setNotes('');
        }}>+ Add to session</button>
        {session.length > 0 && (
          <>
            <div className="list mt-8">
              {session.map((a, i) => (
                <div key={i} className="list-item">
                  <div className="list-item-main">
                    <span className="list-item-title">{a.grade} — {a.result}</span>
                    <span className="list-item-sub"> {a.attempts} att{a.isProject ? ' · PROJECT' : ''}{a.notes ? ` · ${a.notes}` : ''}</span>
                  </div>
                  <button className="btn-icon" onClick={() => setSession(session.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex mt-8">
              <Field label="Session duration (min)"><input type="number" style={{ width: 100 }} value={durationMin} onChange={e => setDurationMin(e.target.value)} /></Field>
              <button className="btn" onClick={finishSession}>Finish session ({session.length})</button>
            </div>
          </>
        )}
        <p className="small muted mt-8">Climbing sessions auto-tag forearms, back, core and shoulders for recovery tracking.</p>
      </Card>

      {projects.length > 0 && (
        <Card title="Projects">
          <div className="list">
            {projects.slice(0, 6).map((p, i) => (
              <div key={i} className="list-item">
                <div className="list-item-main">
                  <div className="list-item-title">{p.grade} {p.sent ? '✅ SENT' : '🔄 in progress'}</div>
                  <div className="list-item-sub">{p.attempts} total attempts · last session {p.lastDate}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {chart.length > 1 && (
        <Card title="Best send per session">
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <YAxis tickFormatter={(v: number) => V_GRADES[v] ?? ''} tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <Tooltip formatter={(v) => V_GRADES[v as number] ?? v} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Line type="stepAfter" dataKey="best" stroke="var(--accent)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="Session history">
        <div className="list">
          {climbs.slice(0, 8).map(c => (
            <div key={c.id} className="list-item">
              <div className="list-item-main">
                <div className="list-item-title">{format(parseISO(c.date), 'EEE, MMM d')} — {c.ascents.length} climbs, {c.durationMin} min</div>
                <div className="list-item-sub">{c.ascents.map(a => `${a.grade}${a.result === 'attempt' ? '✗' : a.result === 'flash' ? '⚡' : '✓'}`).join('  ')}</div>
              </div>
            </div>
          ))}
          {climbs.length === 0 && <p className="muted">No sessions yet.</p>}
        </div>
      </Card>
    </div>
  );
}

// ---------- History & analytics ----------
function History() {
  const { data } = useApp();
  const prs = personalRecords(data);
  const [selected, setSelected] = useState<string>(prs[0]?.exerciseId ?? 'squat');

  const progression = data.workouts
    .filter((w): w is StrengthWorkout => w.kind === 'strength' && !w.inProgress)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => {
      const ex = w.exercises.find(e => e.exerciseId === selected);
      if (!ex) return null;
      const best = Math.max(0, ...ex.sets.map(s => oneRepMax(s.weight, s.reps)));
      return best > 0 ? { date: format(parseISO(w.date), 'M/d'), e1rm: best } : null;
    })
    .filter((x): x is { date: string; e1rm: number } => x !== null);

  const weeklyVolume = useMemo(() => {
    const weeks = new Map<string, number>();
    for (const w of data.workouts) {
      if (w.kind !== 'strength' || w.inProgress) continue;
      const wk = format(parseISO(w.date), "yyyy-'W'II");
      weeks.set(wk, (weeks.get(wk) ?? 0) + workoutVolume(w));
    }
    return [...weeks.entries()].sort().slice(-10).map(([wk, vol]) => ({ week: wk.slice(5), volume: Math.round(vol / 1000) }));
  }, [data.workouts]);

  const recent = [...data.workouts].filter(w => !(w.kind === 'strength' && w.inProgress)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);

  return (
    <div className="page">
      <Card title="Personal records (est. 1RM)">
        <table className="data-table">
          <thead><tr><th>Exercise</th><th>Best set</th><th>Est. 1RM</th><th>Date</th></tr></thead>
          <tbody>
            {prs.slice(0, 10).map(pr => (
              <tr key={pr.exerciseId} style={{ cursor: 'pointer' }} onClick={() => setSelected(pr.exerciseId)}>
                <td>{pr.name}{selected === pr.exerciseId ? ' 📈' : ''}</td>
                <td>{pr.weight} × {pr.reps}</td>
                <td><strong>{pr.e1rm} lb</strong></td>
                <td>{pr.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {progression.length > 1 && (
        <Card title={`Progress — ${EXERCISE_MAP[selected]?.name ?? selected}`}>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={progression} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="e1rm" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      {weeklyVolume.length > 1 && (
        <Card title="Weekly volume (k-lbs)">
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={weeklyVolume} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="volume" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card title="Recent workouts">
        <div className="list">
          {recent.map(w => (
            <div key={w.id} className="list-item">
              <div className="list-item-main">
                <div className="list-item-title">
                  {format(parseISO(w.date), 'EEE, MMM d')} — {w.kind === 'strength' ? w.name : w.kind === 'run' ? `Run ${w.distanceMi} mi` : w.kind === 'climb' ? `Climbing (${w.ascents.length})` : `Circuit ${w.mode.toUpperCase()}`}
                </div>
                <div className="list-item-sub">
                  {w.kind === 'strength' ? `${w.exercises.length} exercises · ${Math.round(workoutVolume(w) / 1000)}k lbs volume` : `${w.durationMin} min`}
                </div>
              </div>
              <span className="badge badge-accent">{w.kind}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------- Module shell ----------
export default function Workouts() {
  const [tab, setTab] = useState<SubTab>('log');
  const tabs: { id: SubTab; label: string }[] = [
    { id: 'log', label: 'Lift' }, { id: 'run', label: 'Run' }, { id: 'circuit', label: 'Circuit' },
    { id: 'climb', label: 'Climb' }, { id: 'programs', label: 'Programs' },
    { id: 'library', label: 'Library' }, { id: 'history', label: 'History' },
  ];
  return (
    <div className="page">
      <div className="chip-row">
        {tabs.map(t => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>)}
      </div>
      {tab === 'log' && <StrengthLogger />}
      {tab === 'run' && <RunTracker />}
      {tab === 'circuit' && <CircuitTimer />}
      {tab === 'climb' && <Climbing />}
      {tab === 'programs' && <Programs />}
      {tab === 'library' && <Library />}
      {tab === 'history' && <History />}
    </div>
  );
}
