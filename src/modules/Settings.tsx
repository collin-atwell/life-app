import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { Card, Chip, Field } from '../components/ui';
import { notifPermission, requestNotifPermission, sendNotification } from '../lib/notifications';
import {
  cloudSession, cloudSignIn, cloudSignOut, cloudSignUp, getCloudConfig, isDefaultCloud,
  lastSyncAt, pullState, pushState, setCloudConfig,
} from '../lib/cloud';
import type { ActivityLevel } from '../types';

function CloudSyncCard() {
  const { data, update, celebrate } = useApp();
  const [customCloud, setCustomCloud] = useState(!isDefaultCloud());
  const [url, setUrl] = useState(isDefaultCloud() ? '' : getCloudConfig()?.url ?? '');
  const [anonKey, setAnonKey] = useState(isDefaultCloud() ? '' : getCloudConfig()?.anonKey ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    cloudSession().then(s => setUserEmail(s?.user.email ?? null));
  }, [customCloud]);

  const run = async (fn: () => Promise<string | null>, okMsg: string) => {
    setBusy(true); setMsg(null);
    const err = await fn();
    setBusy(false);
    if (err && err !== 'confirm-email') setMsg(`⚠️ ${err}`);
    else if (err === 'confirm-email') setMsg('📧 Check your email to confirm the account, then sign in here.');
    else { setMsg(null); celebrate(okMsg); }
    return err;
  };

  if (!userEmail) {
    return (
      <Card title="Account & sync" action={<span className="badge badge-yellow">SIGNED OUT</span>}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Create a free account to back up your data and sync it across your phone and computer.
          Works instantly — the backend is built in.
        </p>
        <div className="form-row">
          <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        </div>
        <div className="flex mt-8">
          <button className="btn" disabled={busy} onClick={async () => {
            const err = await run(() => cloudSignIn(email, password), '☁️ Signed in');
            if (!err) {
              setUserEmail(email);
              const remote = await pullState().catch(() => null);
              if (remote) {
                update(() => ({ ...remote.data, notifPrefs: remote.data.notifPrefs ?? data.notifPrefs }));
                celebrate('☁️ Pulled your data from the cloud');
              } else {
                await pushState(data);
                celebrate('☁️ First sync complete — data uploaded');
              }
            }
          }}>Sign in</button>
          <button className="btn btn-secondary" disabled={busy} onClick={async () => {
            const err = await run(() => cloudSignUp(email, password), '☁️ Account created — you\'re signed in');
            if (!err) {
              setUserEmail(email);
              await pushState(data);
            }
          }}>Create account</button>
        </div>
        {msg && <p className="small mt-8">{msg}</p>}
        <details className="mt-8">
          <summary className="small muted" style={{ cursor: 'pointer' }}>Advanced: use your own Supabase backend</summary>
          <div className="form-row mt-8">
            <Field label="Supabase project URL"><input value={url} placeholder="https://xxxx.supabase.co" onChange={e => setUrl(e.target.value)} /></Field>
            <Field label="Anon (public) key"><input value={anonKey} placeholder="eyJhbGciOi…" onChange={e => setAnonKey(e.target.value)} /></Field>
          </div>
          <div className="flex mt-8">
            <button className="btn btn-sm btn-secondary" onClick={() => {
              if (!url.startsWith('https://') || !anonKey) { setMsg('⚠️ Enter a valid URL and key'); return; }
              setCloudConfig({ url: url.trim(), anonKey: anonKey.trim() });
              setCustomCloud(true);
              celebrate('☁️ Custom backend set — sign in above');
            }}>Use custom backend</button>
            {customCloud && (
              <button className="btn btn-sm btn-secondary" onClick={() => {
                setCloudConfig(null); setCustomCloud(false); setUrl(''); setAnonKey('');
                celebrate('☁️ Back on the built-in backend');
              }}>Reset to built-in</button>
            )}
          </div>
        </details>
      </Card>
    );
  }

  return (
    <Card title="Account & sync" action={<span className="badge badge-green">SYNCED</span>}>
      <p className="small">
        Signed in as <strong>{userEmail}</strong>
        {lastSyncAt() && <> · last sync {new Date(lastSyncAt()!).toLocaleTimeString()}</>}
        . Changes auto-upload a few seconds after you make them.
      </p>
      <div className="flex mt-8">
        <button className="btn btn-sm" disabled={busy} onClick={() => run(() => pushState(data), '☁️ Pushed to cloud')}>Push now</button>
        <button className="btn btn-sm btn-secondary" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const remote = await pullState();
            if (remote) {
              update(() => ({ ...remote.data, notifPrefs: remote.data.notifPrefs ?? data.notifPrefs }));
              celebrate('☁️ Pulled latest from cloud');
            } else setMsg('No cloud data yet — push first.');
          } catch (e) { setMsg(`⚠️ ${(e as Error).message}`); }
          setBusy(false);
        }}>Pull latest</button>
        <button className="btn btn-sm btn-secondary" disabled={busy} onClick={async () => {
          await cloudSignOut(); setUserEmail(null); celebrate('Signed out — data stays on this device');
        }}>Sign out</button>
      </div>
      {msg && <p className="small mt-8">{msg}</p>}
    </Card>
  );
}

export default function Settings() {
  const { data, update, resetToDemo, resetToEmpty, exportJson, importJson, celebrate } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [permTick, setPermTick] = useState(0); // re-render after permission changes
  const p = data.profile;
  const set = (patch: Partial<typeof p>) => update(d => ({ ...d, profile: { ...d.profile, ...patch } }));
  const prefs = data.notifPrefs;
  const setPrefs = (patch: Partial<typeof prefs>) => update(d => ({ ...d, notifPrefs: { ...d.notifPrefs, ...patch } }));
  const perm = notifPermission();
  void permTick;

  return (
    <div className="page">
      <Card title="Profile">
        <div className="form-row">
          <Field label="Name"><input value={p.name} onChange={e => set({ name: e.target.value })} /></Field>
          <Field label="Age"><input type="number" value={p.age} onChange={e => set({ age: +e.target.value })} /></Field>
          <Field label="Sex">
            <select value={p.sex} onChange={e => set({ sex: e.target.value as 'male' | 'female' })}>
              <option value="male">Male</option><option value="female">Female</option>
            </select>
          </Field>
        </div>
        <div className="form-row mt-8">
          <Field label="Weight (lb)"><input type="number" value={p.weightLbs} onChange={e => set({ weightLbs: +e.target.value })} /></Field>
          <Field label="Height (in)"><input type="number" value={p.heightIn} onChange={e => set({ heightIn: +e.target.value })} /></Field>
          <Field label="Activity level">
            <select value={p.activityLevel} onChange={e => set({ activityLevel: e.target.value as ActivityLevel })}>
              {['sedentary', 'light', 'moderate', 'active', 'athlete'].map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Display">
        <div className="chip-row">
          <Chip active={p.darkMode} onClick={() => set({ darkMode: !p.darkMode })}>
            {p.darkMode ? '🌙 Dark mode on' : '☀️ Light mode on'}
          </Chip>
          <Chip active={p.advancedMode} onClick={() => set({ advancedMode: !p.advancedMode })}>
            {p.advancedMode ? '📊 Advanced metrics on' : '🌱 Simple mode on'}
          </Chip>
        </div>
        <p className="small muted mt-8">Simple mode hides recovery-score factor breakdowns and other athlete-level detail.</p>
      </Card>

      <Card title="Notifications">
        {perm === 'unsupported' ? (
          <p className="muted">This browser doesn't support notifications.</p>
        ) : (
          <>
            <div className="chip-row">
              <Chip active={prefs.enabled} onClick={async () => {
                if (!prefs.enabled) {
                  const ok = await requestNotifPermission();
                  setPermTick(t => t + 1);
                  if (!ok) { celebrate('⚠️ Notifications blocked by the browser — reminders will show as in-app toasts only.'); }
                }
                setPrefs({ enabled: !prefs.enabled });
              }}>{prefs.enabled ? '🔔 Reminders on' : '🔕 Reminders off'}</Chip>
              {prefs.enabled && (
                <>
                  <Chip active={prefs.hydration} onClick={() => setPrefs({ hydration: !prefs.hydration })}>💧 Hydration</Chip>
                  <Chip active={prefs.workout} onClick={() => setPrefs({ workout: !prefs.workout })}>🏋️ Workout heads-up</Chip>
                  <Chip active={prefs.bedtime} onClick={() => setPrefs({ bedtime: !prefs.bedtime })}>😴 Bedtime</Chip>
                </>
              )}
              {prefs.enabled && (
                <button className="btn btn-sm btn-secondary" onClick={() => {
                  const ok = sendNotification('⚡ Health Hub', 'Test notification — you\'re all set!');
                  if (!ok) celebrate('⚠️ Browser permission is ' + perm + ' — enable notifications for this site in browser settings.');
                }}>Send test</button>
              )}
            </div>
            <p className="small muted mt-8">
              Hydration nudges fire every 2h (10am–8pm) when you're behind pace; workout heads-ups 45 min before
              scheduled workout events; bedtime wind-down 30 min before your suggested bedtime.
              Reminders fire while the app is open (background tabs included). Push with the app fully closed
              requires the future backend + service worker.
              {perm === 'denied' && <strong> Browser permission is currently denied — reminders fall back to in-app toasts.</strong>}
            </p>
          </>
        )}
      </Card>

      <CloudSyncCard />

      <Card title="Data">
        <div className="flex">
          <button className="btn btn-secondary" onClick={exportJson}>⬇ Export backup (JSON)</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>⬆ Import backup</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
            onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { await importJson(f); } catch { alert('Invalid backup file'); }
              e.target.value = '';
            }} />
        </div>
        <div className="flex mt-8">
          <button className="btn btn-secondary" onClick={() => { if (confirm('Replace all current data with the demo dataset?')) resetToDemo(); }}>
            Load demo data
          </button>
          <button className="btn btn-danger" onClick={() => { if (confirm('Erase everything and start fresh?')) resetToEmpty(); }}>
            Start fresh (erase all)
          </button>
        </div>
        <p className="small muted mt-8">
          All data lives in your browser (localStorage). The storage layer is a single adapter in
          <code> src/state/AppContext.tsx</code>, ready to swap for Supabase/Firebase sync.
          Integration placeholders: Apple Health / Google Fit / Oura (sleep, HR, HRV), calendar providers, and a barcode-scanner food API.
        </p>
      </Card>
    </div>
  );
}
