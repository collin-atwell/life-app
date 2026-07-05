import { useRef, useState } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { Modal } from './components/ui';
import { fireDueReminders } from './lib/notifications';
import { useEffect } from 'react';
import Dashboard from './modules/Dashboard';
import Workouts from './modules/Workouts';
import Nutrition from './modules/Nutrition';
import Recovery from './modules/Recovery';
import Journal from './modules/Journal';
import Schedule from './modules/Schedule';
import Settings from './modules/Settings';

const TABS = [
  { id: 'dashboard', icon: '🏠', label: 'Home' },
  { id: 'workouts', icon: '🏋️', label: 'Train' },
  { id: 'nutrition', icon: '🍽', label: 'Eat' },
  { id: 'recovery', icon: '💧', label: 'Recover' },
  { id: 'journal', icon: '📓', label: 'Journal' },
  { id: 'schedule', icon: '📅', label: 'Plan' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* iOS: no haptics for web */ } };

// Spinning radial menu anchored at the bottom-left corner (mobile).
// Drag anywhere to spin the wheel — items tick past the 45° selector with a
// haptic pulse (Android; iOS doesn't expose vibration to web apps). Tap to jump.
function MenuWheel({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rot, setRot] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ a0: number; r0: number; lastTick: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const N = TABS.length;
  const step = 360 / N;
  const R = 132;
  const CX = 26, CY = 26; // wheel origin, px from bottom-left corner

  const openWheel = () => {
    const idx = TABS.findIndex(t => t.id === tab);
    setRot(45 - idx * step); // current tab starts on the selector diagonal
    setOpen(true);
    buzz(12);
  };

  const angleAt = (x: number, y: number) =>
    (Math.atan2(window.innerHeight - CY - y, x - CX) * 180) / Math.PI;

  const onDown = (e: React.PointerEvent) => {
    drag.current = { a0: angleAt(e.clientX, e.clientY), r0: rot, lastTick: Math.round(rot / step), moved: false };
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const next = drag.current.r0 + (angleAt(e.clientX, e.clientY) - drag.current.a0);
    if (Math.abs(next - drag.current.r0) > 5) drag.current.moved = true;
    setRot(next);
    const tick = Math.round(next / step);
    if (tick !== drag.current.lastTick) { drag.current.lastTick = tick; buzz(6); }
  };
  const onUp = () => {
    if (!drag.current) return;
    justDragged.current = drag.current.moved;
    setRot(r => Math.round(r / step) * step); // snap
    setDragging(false);
    drag.current = null;
    if (justDragged.current) buzz(10);
  };

  const pick = (id: string) => { setTab(id); buzz(18); setOpen(false); };

  return (
    <>
      <button className={`wheel-fab ${open ? 'open' : ''}`} aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => (open ? setOpen(false) : openWheel())}>
        {open ? '✕' : TABS.find(t => t.id === tab)?.icon ?? '☰'}
      </button>
      {open && (
        <div
          className="wheel-backdrop"
          role="menu"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onClick={() => { if (!justDragged.current) setOpen(false); justDragged.current = false; }}
        >
          {TABS.map((t, i) => {
            let d = ((i * step + rot) % 360 + 360) % 360;
            if (d > 180) d -= 360;
            const rad = (d * Math.PI) / 180;
            const visible = d > -28 && d < 118;
            const onSelector = Math.abs(d - 45) < step / 2;
            return (
              <button
                key={t.id}
                role="menuitem"
                className={`wheel-item ${t.id === tab ? 'wheel-current' : ''} ${onSelector ? 'wheel-focus' : ''}`}
                style={{
                  left: CX + R * Math.cos(rad),
                  bottom: CY + R * Math.sin(rad),
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transition: dragging ? 'transform 0.15s' : undefined,
                  animationDelay: `${i * 0.03}s`,
                }}
                onClick={e => {
                  e.stopPropagation();
                  // releasing a spin over an item shouldn't select it
                  if (justDragged.current) { justDragged.current = false; return; }
                  pick(t.id);
                }}
              >
                <span className="wheel-emoji" aria-hidden>{t.icon}</span>
                <span className="wheel-label">{t.label}</span>
              </button>
            );
          })}
          <span className="wheel-hint">spin the wheel · tap to jump</span>
        </div>
      )}
    </>
  );
}

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
              onClick={() => setTab(t.id)}>{t.icon} {t.label}</button>
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
      <MenuWheel tab={tab} setTab={setTab} />
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
