import { useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { Modal } from './components/ui';
import { fireDueReminders } from './lib/notifications';
import Dashboard from './modules/Dashboard';
import Workouts from './modules/Workouts';
import Nutrition from './modules/Nutrition';
import Recovery from './modules/Recovery';
import Journal from './modules/Journal';
import Schedule from './modules/Schedule';
import Settings from './modules/Settings';

const TABS = [
  { id: 'dashboard', label: '🏠 Home' },
  { id: 'workouts', label: '🏋️ Train' },
  { id: 'nutrition', label: '🍽 Eat' },
  { id: 'recovery', label: '💧 Recover' },
  { id: 'journal', label: '📓 Journal' },
  { id: 'schedule', label: '📅 Plan' },
  { id: 'settings', label: '⚙️' },
];

function Onboarding() {
  const { completeOnboarding } = useApp();
  const [name, setName] = useState('');
  return (
    <Modal title="Welcome to Health Hub ⚡" onClose={() => completeOnboarding('demo')}>
      <p className="small">
        Training, nutrition, recovery, journaling and planning — all in one place, all talking to each other.
        How do you want to start?
      </p>
      <label className="field">
        <span className="field-label">Your name (optional)</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" autoFocus />
      </label>
      <button className="btn" onClick={() => completeOnboarding('fresh', name || undefined)}>
        🌱 Start fresh — my own data from day one
      </button>
      <button className="btn btn-secondary" onClick={() => completeOnboarding('demo', name || undefined)}>
        🧪 Explore with demo data first
      </button>
      <p className="small muted">
        Demo mode pre-loads 8 weeks of realistic history so every chart and insight has something to show.
        You can wipe it any time in Settings → "Start fresh".
      </p>
    </Modal>
  );
}

function Shell() {
  const [tab, setTab] = useState('dashboard');
  const { celebration, data, celebrate, needsOnboarding } = useApp();
  const dataRef = useRef(data);
  dataRef.current = data;

  // Reminder loop: checks once a minute while the app is open; browser
  // notification if permitted, in-app toast either way.
  useEffect(() => {
    const tick = () => {
      for (const r of fireDueReminders(dataRef.current)) celebrate(`${r.title} — ${r.body}`);
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [celebrate]);

  return (
    <div className="app-shell">
      {needsOnboarding && <Onboarding />}
      {celebration && <div className="celebration" role="status">{celebration}</div>}
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo" aria-hidden>⚡</span>
          <h1>Health Hub{data.profile.name ? ` — ${data.profile.name}` : ''}</h1>
        </div>
        <nav className="nav-tabs" aria-label="Main navigation">
          {TABS.map(t => (
            <button key={t.id} className={`nav-tab ${tab === t.id ? 'active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard go={setTab} />}
        {tab === 'workouts' && <Workouts />}
        {tab === 'nutrition' && <Nutrition />}
        {tab === 'recovery' && <Recovery />}
        {tab === 'journal' && <Journal />}
        {tab === 'schedule' && <Schedule go={setTab} />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
