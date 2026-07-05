import { useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../state/AppContext';
import { Card, Chip, Field, Modal, ProgressBar, Stat, zoneOf } from '../components/ui';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { FOODS } from '../data/foods';
import { fmtDate, foodFor, macroTargets, mealMacros, mealsOn, today } from '../lib/calc';
import { getCommunityFoods, publishFood } from '../lib/communityFoods';
import { searchFoods } from '../lib/foodSearch';
import type { DietType, FoodItem, MealSlot } from '../types';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Simple rules-based meal suggester: fills the largest remaining macro gap
// from foods matching the user's diet type.
function suggestMeals(data: ReturnType<typeof useApp>['data'], remaining: { calories: number; protein: number; carbs: number; fat: number }): { food: FoodItem; reason: string }[] {
  const diet = data.profile.dietType;
  const pool = [...FOODS, ...data.customFoods]
    .filter(f => !f.treat) // treats are for logging honestly, not suggesting
    .filter(f => !f.tags || f.tags.includes(diet) || diet === 'balanced');
  const proteinGap = remaining.protein;
  const calGap = remaining.calories;
  if (calGap <= 100) return [];
  const scored = pool.map(f => {
    let score = 0;
    let reason = '';
    if (proteinGap > 30 && f.protein >= 20) { score += 3; reason = `${f.protein}g protein toward your ${Math.round(proteinGap)}g gap`; }
    if (calGap < 500 && f.calories <= calGap * 1.1 && f.calories >= calGap * 0.4) { score += 2; reason ||= `fits your remaining ${Math.round(calGap)} kcal`; }
    if (calGap >= 500 && f.calories >= 350) { score += 2; reason ||= `substantial meal for ${Math.round(calGap)} kcal remaining`; }
    if (data.favoriteFoodIds.includes(f.id)) { score += 1; reason += reason ? ' · a favorite' : 'one of your favorites'; }
    return { food: f, score, reason };
  }).filter(s => s.score >= 2).sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map(({ food, reason }) => ({ food, reason }));
}

function FoodSearch({ onPick, onClose, slot }: { onPick: (f: FoodItem, servings: number) => void; onClose: () => void; slot: MealSlot }) {
  const { data, update, celebrate } = useApp();
  const [q, setQ] = useState('');
  const [servings, setServings] = useState('1');
  const [customOpen, setCustomOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [share, setShare] = useState(true);
  const [custom, setCustom] = useState({ name: '', serving: '1 serving', calories: '', protein: '', carbs: '', fat: '' });
  const all = [...FOODS, ...data.customFoods, ...getCommunityFoods()];
  const favs = all.filter(f => data.favoriteFoodIds.includes(f.id));
  const results = q ? searchFoods(all, q) : favs;

  const addAndLog = async (food: Omit<FoodItem, 'id'>, publish: boolean) => {
    const f: FoodItem = { ...food, id: `custom-${uid()}` };
    update(d => ({ ...d, customFoods: [...d.customFoods, f] }));
    if (publish) {
      const err = await publishFood(food);
      if (!err) celebrate('🌍 Shared with the community — thanks!');
    }
    onPick(f, +servings || 1);
  };

  return (
    <Modal title={`Log ${slot}`} onClose={onClose} wide>
      <div className="form-row">
        <input placeholder="Search foods… (typos & word order are fine)" value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <button className="btn btn-secondary" onClick={() => setScanning(true)} style={{ maxWidth: 110 }}>📷 Scan</button>
        <Field label="Servings"><input type="number" step="0.5" min="0.5" style={{ maxWidth: 90 }} value={servings} onChange={e => setServings(e.target.value)} /></Field>
      </div>
      {!q && favs.length > 0 && <p className="small muted">⭐ Your favorites (search to see everything)</p>}
      <div className="list" style={{ maxHeight: 300, overflowY: 'auto' }}>
        {results.map(f => (
          <div key={f.id} className="list-item">
            <div className="list-item-main">
              <div className="list-item-title">{f.name}</div>
              <div className="list-item-sub">{f.serving} · {f.calories} kcal · P{f.protein} C{f.carbs} F{f.fat}</div>
            </div>
            <button className="btn-icon" aria-label="Toggle favorite" onClick={() =>
              update(d => ({
                ...d,
                favoriteFoodIds: d.favoriteFoodIds.includes(f.id)
                  ? d.favoriteFoodIds.filter(x => x !== f.id)
                  : [...d.favoriteFoodIds, f.id],
              }))}>{data.favoriteFoodIds.includes(f.id) ? '⭐' : '☆'}</button>
            <button className="btn btn-sm" onClick={() => onPick(f, +servings || 1)}>Log</button>
          </div>
        ))}
        {results.length === 0 && <p className="muted">No matches — add it as a custom food below.</p>}
      </div>
      {customOpen ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
          <div className="form-row mb-8">
            <Field label="Name"><input value={custom.name} onChange={e => setCustom({ ...custom, name: e.target.value })} /></Field>
            <Field label="Serving"><input value={custom.serving} onChange={e => setCustom({ ...custom, serving: e.target.value })} /></Field>
          </div>
          <div className="form-row mb-8">
            {(['calories', 'protein', 'carbs', 'fat'] as const).map(k => (
              <Field key={k} label={k}><input type="number" value={custom[k]} onChange={e => setCustom({ ...custom, [k]: e.target.value })} /></Field>
            ))}
          </div>
          <label className="flex small mb-8">
            <input type="checkbox" style={{ width: 'auto' }} checked={share} onChange={e => setShare(e.target.checked)} />
            🌍 Share with all Health Hub users (community database)
          </label>
          <button className="btn btn-sm" onClick={() => {
            if (!custom.name) return;
            addAndLog({
              name: custom.name, serving: custom.serving,
              calories: +custom.calories || 0, protein: +custom.protein || 0, carbs: +custom.carbs || 0, fat: +custom.fat || 0,
            }, share);
          }}>Save & log custom food</button>
        </div>
      ) : (
        <button className="btn btn-secondary btn-sm" onClick={() => setCustomOpen(true)}>+ Custom food / meal builder</button>
      )}
      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onFound={food => { setScanning(false); addAndLog(food, share); }}
        />
      )}
    </Modal>
  );
}

export default function Nutrition() {
  const { data, update, celebrate } = useApp();
  const [date, setDate] = useState(today());
  const [logSlot, setLogSlot] = useState<MealSlot | null>(null);
  const [weightInput, setWeightInput] = useState('');

  const target = macroTargets(data, date);
  const meals = mealsOn(data, date);
  const eaten = mealMacros(data, meals);
  const remaining = {
    calories: target.calories - eaten.calories,
    protein: target.protein - eaten.protein,
    carbs: target.carbs - eaten.carbs,
    fat: target.fat - eaten.fat,
  };
  const suggestions = useMemo(() => suggestMeals(data, remaining), [data, remaining.calories, remaining.protein]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekly = useMemo(() => [...Array(7)].map((_, i) => {
    const d = fmtDate(subDays(parseISO(date), 6 - i));
    const m = mealMacros(data, mealsOn(data, d));
    return { day: format(parseISO(d), 'EEE'), calories: Math.round(m.calories), protein: Math.round(m.protein) };
  }), [data, date]);

  const macroPie = [
    { name: 'Protein', value: Math.round(eaten.protein * 4), color: 'var(--accent)' },
    { name: 'Carbs', value: Math.round(eaten.carbs * 4), color: 'var(--green)' },
    { name: 'Fat', value: Math.round(eaten.fat * 9), color: 'var(--yellow)' },
  ].filter(s => s.value > 0);

  const logWeight = () => {
    const w = +weightInput;
    if (!w) return;
    update(d => ({
      ...d,
      weights: [...d.weights.filter(x => x.date !== today()), { date: today(), weightLbs: w }],
      profile: { ...d.profile, weightLbs: w },
    }));
    setWeightInput('');
    const goal = data.profile.goalWeightLbs;
    if ((data.profile.goal === 'lose' && w <= goal) || (data.profile.goal === 'gain' && w >= goal)) {
      celebrate(`🎯 Goal weight reached: ${w} lb!`);
    }
  };

  const paceBadge = target.onPace === 'on-pace' ? 'green' : target.onPace === 'no-data' ? 'yellow' : target.onPace === 'ahead' ? 'green' : 'red';

  return (
    <div className="page">
      <div className="flex-between">
        <h2>Nutrition</h2>
        <input type="date" style={{ maxWidth: 170 }} value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <Card title="Adaptive targets" action={<span className={`badge badge-${paceBadge}`}>{target.onPace.replace('-', ' ').toUpperCase()}</span>}>
        <div className="grid grid-4" style={{ gap: 8 }}>
          <Stat label="Calories" value={target.calories} sub={`${Math.max(0, Math.round(remaining.calories))} left`} zone={zoneOf(Math.min(1, eaten.calories / target.calories))} />
          <Stat label="Protein" value={`${target.protein}g`} sub={`${Math.max(0, Math.round(remaining.protein))}g left`} />
          <Stat label="Carbs" value={`${target.carbs}g`} sub={`${Math.max(0, Math.round(remaining.carbs))}g left`} />
          <Stat label="Fat" value={`${target.fat}g`} sub={`${Math.max(0, Math.round(remaining.fat))}g left`} />
        </div>
        <div className="mt-8">
          <ProgressBar value={eaten.calories} max={target.calories} zone={zoneOf(Math.min(1, eaten.calories / target.calories))} />
        </div>
        <p className="small muted mt-8">
          {target.goalReached ? (
            <>🎯 <strong>Goal weight reached</strong> — targets are holding you steady at maintenance. Set a new goal below whenever you're ready.</>
          ) : (
            <>Goal: <strong>{data.profile.goal}</strong> to {data.profile.goalWeightLbs} lb · <strong>{target.weeksLeft} weeks left</strong> ({Math.abs(target.targetRate).toFixed(1)} lb/wk needed from your current {data.profile.weightLbs} lb).</>
          )}
          {target.weeklyTrend !== null && <> Measured trend: {target.weeklyTrend > 0 ? '+' : ''}{target.weeklyTrend.toFixed(1)} lb/wk.</>}
          {target.adjustment !== 0 && <> Auto-adjustment: <strong>{target.adjustment > 0 ? '+' : ''}{target.adjustment} kcal</strong> from your weight trend.</>}
          {target.workoutBonus > 0 && <> Training bonus today: <strong>+{target.workoutBonus} kcal</strong>.</>}
        </p>
        <div className="flex mt-8">
          <Field label="Today's weigh-in (lb)">
            <input type="number" inputMode="decimal" style={{ width: 120 }} value={weightInput} onChange={e => setWeightInput(e.target.value)} />
          </Field>
          <button className="btn btn-sm" onClick={logWeight}>Log weight</button>
        </div>
      </Card>

      <div className="grid grid-2">
        <Card title="Today's meals">
          {SLOTS.map(slot => {
            const slotMeals = meals.filter(m => m.slot === slot);
            const slotMacros = mealMacros(data, slotMeals);
            return (
              <div key={slot} className="mb-8">
                <div className="flex-between">
                  <strong style={{ textTransform: 'capitalize' }}>{slot}</strong>
                  <div className="flex">
                    {slotMacros.calories > 0 && <span className="small muted">{Math.round(slotMacros.calories)} kcal</span>}
                    <button className="btn btn-sm btn-secondary" onClick={() => setLogSlot(slot)}>+ Add</button>
                  </div>
                </div>
                {slotMeals.map(m => {
                  const f = foodFor(data, m.foodId);
                  return f && (
                    <div key={m.id} className="list-item mt-8">
                      <div className="list-item-main">
                        <div className="list-item-title">{f.name}{m.servings !== 1 ? ` ×${m.servings}` : ''}</div>
                        <div className="list-item-sub">{Math.round(f.calories * m.servings)} kcal · P{Math.round(f.protein * m.servings)} C{Math.round(f.carbs * m.servings)} F{Math.round(f.fat * m.servings)}</div>
                      </div>
                      <button className="btn-icon" aria-label="Remove" onClick={() =>
                        update(d => ({ ...d, meals: d.meals.filter(x => x.id !== m.id) }))}>✕</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Card>

        <div className="page" style={{ gap: 16 }}>
          <Card title="Meal ideas for your remaining macros">
            {suggestions.length === 0 ? (
              <p className="muted">You've hit your targets for the day — nothing more needed. 🎉</p>
            ) : (
              <div className="list">
                {suggestions.map(({ food, reason }) => (
                  <div key={food.id} className="list-item">
                    <div className="list-item-main">
                      <div className="list-item-title">{food.name}</div>
                      <div className="list-item-sub">{food.calories} kcal · {reason}</div>
                    </div>
                    <button className="btn btn-sm" onClick={() => {
                      update(d => ({ ...d, meals: [...d.meals, { id: uid(), date, slot: 'snack', foodId: food.id, servings: 1 }] }));
                    }}>Log</button>
                  </div>
                ))}
              </div>
            )}
            <p className="small muted mt-8">Ideas match your <strong>{data.profile.dietType}</strong> diet and today's remaining macros. Post-workout, protein-forward options rank higher.</p>
          </Card>

          {macroPie.length > 0 && (
            <Card title="Today's macro split (kcal)">
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={macroPie} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {macroPie.map(s => <Cell key={s.name} fill={s.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex" style={{ justifyContent: 'center' }}>
                {macroPie.map(s => <span key={s.name} className="small"><span style={{ color: s.color }}>●</span> {s.name}</span>)}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card title="Last 7 days">
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={weekly} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-dim)" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="calories" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="protein" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Diet preferences">
        <div className="chip-row">
          {(['balanced', 'high-protein', 'vegan', 'vegetarian', 'keto', 'carnivore'] as DietType[]).map(dt => (
            <Chip key={dt} active={data.profile.dietType === dt} onClick={() =>
              update(d => ({ ...d, profile: { ...d.profile, dietType: dt } }))}>{dt}</Chip>
          ))}
        </div>
        <div className="chip-row mt-8">
          {(['lose', 'maintain', 'gain'] as const).map(g => (
            <Chip key={g} active={data.profile.goal === g} onClick={() =>
              update(d => ({ ...d, profile: { ...d.profile, goal: g, goalSetAt: today() } }))}>{g}</Chip>
          ))}
        </div>
        <div className="form-row mt-8">
          <Field label="Goal weight (lb)">
            <input type="number" value={data.profile.goalWeightLbs} onChange={e =>
              update(d => ({ ...d, profile: { ...d.profile, goalWeightLbs: +e.target.value, goalSetAt: today() } }))} />
          </Field>
          <Field label="Timeline (weeks)">
            <input type="number" min={1} value={data.profile.goalWeeks} onChange={e =>
              update(d => ({ ...d, profile: { ...d.profile, goalWeeks: +e.target.value, goalSetAt: today() } }))} />
          </Field>
        </div>
        <p className="small muted mt-8">Changing any goal setting restarts the timeline from today — calories, protein and hydration recalculate everywhere immediately.</p>
      </Card>

      {logSlot && (
        <FoodSearch slot={logSlot} onClose={() => setLogSlot(null)} onPick={(f, servings) => {
          update(d => ({ ...d, meals: [...d.meals, { id: uid(), date, slot: logSlot, foodId: f.id, servings }] }));
          setLogSlot(null);
        }} />
      )}
    </div>
  );
}
