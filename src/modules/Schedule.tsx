import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../state/AppContext';
import { Card, Chip, Field, Modal } from '../components/ui';
import { fmtDate, today } from '../lib/calc';
import { generateDayPlan } from '../lib/scheduler';
import { mergeCalendarEvents, syncCalendarFeed } from '../lib/ical';
import type { CalendarEvent, EventType } from '../types';

const PROVIDER_GUIDES: Record<string, { label: string; steps: string[]; looksLike: string }> = {
  apple: {
    label: ' Apple / iCloud',
    steps: [
      'On your iPhone, open the Calendar app',
      'Tap "Calendars" at the bottom of the screen',
      'Find the calendar you want under the ICLOUD heading and tap the ⓘ next to it (only iCloud calendars can be linked — Gmail/work calendars listed in the Apple app won\'t offer this)',
      'Scroll down and turn ON "Public Calendar"',
      'Tap "Share Link…" → "Copy"',
      'Paste it below — webcal:// links work as-is',
    ],
    looksLike: 'webcal://p12-caldav.icloud.com/published/2/…',
  },
  google: {
    label: 'Google',
    steps: [
      'On a computer, open calendar.google.com',
      'Click the ⚙️ gear (top right) → "Settings"',
      'In the left sidebar under "Settings for my calendars", click your calendar\'s name',
      'Scroll down to the "Integrate calendar" section',
      'Copy the "Secret address in iCal format" (click the copy icon next to it)',
    ],
    looksLike: 'https://calendar.google.com/calendar/ical/…/private-…/basic.ics',
  },
  outlook: {
    label: 'Outlook',
    steps: [
      'On a computer, open outlook.com (or outlook.office.com for work)',
      'Click the ⚙️ gear → "Calendar" → "Shared calendars"',
      'Under "Publish a calendar": choose your calendar + "Can view all details", click "Publish"',
      'Copy the ICS link (not the HTML one)',
    ],
    looksLike: 'https://outlook.live.com/owa/calendar/…/calendar.ics',
  },
};

/** Catch the most common wrong-link pastes before hitting the network. */
function linkProblem(u: string): string | null {
  const url = u.trim();
  if (/icloud\.com\/calendar/i.test(url)) return 'That\'s the iCloud calendar *website* address. You need the Public Calendar share link — it starts with webcal://…caldav.icloud.com/published/. Follow the Apple steps above.';
  if (/calendar\.google\.com/i.test(url) && !/\.ics(\?|$)/i.test(url)) return 'That looks like the Google Calendar *webpage*. You need the "Secret address in iCal format" from the calendar\'s settings — it ends in .ics. Follow the Google steps above.';
  if (/supabase\.co/i.test(url)) return 'That\'s your Supabase address, not a calendar link — paste your calendar\'s iCal feed URL instead.';
  if (!/^(webcal|https?):\/\//i.test(url)) return 'The link should start with webcal:// or https:// — copy the whole address.';
  return null;
}

function CalendarFeedCard() {
  const { data, update, celebrate } = useApp();
  const [url, setUrl] = useState(data.icalUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(data.icalUrl ? null : 'apple');
  const importedCount = data.events.filter(e => e.id.startsWith('ical-')).length;

  const sync = async (feedUrl: string) => {
    const problem = linkProblem(feedUrl);
    if (problem) { setMsg(`⚠️ ${problem}`); return; }
    setBusy(true); setMsg(null);
    try {
      const imported = await syncCalendarFeed(feedUrl);
      update(d => ({ ...mergeCalendarEvents(d, imported), icalUrl: feedUrl }));
      celebrate(`📅 Calendar synced — ${imported.length} events imported`);
      setGuide(null);
    } catch (e) {
      setMsg(`⚠️ ${(e as Error).message}`);
    }
    setBusy(false);
  };

  const g = guide ? PROVIDER_GUIDES[guide] : null;
  return (
    <Card title="Real calendar feed" action={importedCount > 0 ? <span className="badge badge-green">{importedCount} SYNCED</span> : undefined}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Link your real calendar and the planner schedules workouts, meals and recovery around your actual meetings.
        Where is your calendar?
      </p>
      <div className="chip-row mb-8">
        {Object.entries(PROVIDER_GUIDES).map(([id, p]) => (
          <Chip key={id} active={guide === id} onClick={() => setGuide(guide === id ? null : id)}>{p.label}</Chip>
        ))}
      </div>
      {g && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px' }} className="mb-8">
          <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <p className="small muted" style={{ marginBottom: 0 }}>The link looks like: <code style={{ wordBreak: 'break-all' }}>{g.looksLike}</code></p>
        </div>
      )}
      <div className="form-row">
        <input placeholder="Paste your calendar link here (webcal:// or https://…)" value={url} onChange={e => { setUrl(e.target.value); setMsg(null); }} />
        <button className="btn" disabled={busy || !url} onClick={() => sync(url)} style={{ maxWidth: 130 }}>
          {busy ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      {data.icalUrl && (
        <div className="flex mt-8">
          <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => sync(data.icalUrl!)}>Refresh</button>
          <button className="btn btn-sm btn-secondary" onClick={() => {
            update(d => ({ ...d, icalUrl: undefined, events: d.events.filter(e => !e.id.startsWith('ical-')) }));
            setUrl('');
            celebrate('Calendar feed removed');
          }}>Remove feed</button>
        </div>
      )}
      {msg && <p className="small mt-8">{msg}</p>}
      <p className="small muted mt-8">🔒 Your link is stored in your own data only. Treat it like a password — anyone holding it can read that calendar.</p>
    </Card>
  );
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const DAY_START = 6 * 60;
const DAY_END = 22 * 60;
const PX_PER_HOUR = 44;

function Timeline({ events, onAccept, onRemove }: {
  events: CalendarEvent[];
  onAccept: (e: CalendarEvent) => void;
  onRemove: (e: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);
  const visible = events.filter(e => e.type !== 'sleep' && toMin(e.end) > DAY_START && toMin(e.start) < DAY_END);
  return (
    <div className="timeline" style={{ height: hours.length * PX_PER_HOUR }}>
      {hours.map((h, i) => (
        <div key={h} className="timeline-hour" style={{ top: i * PX_PER_HOUR }}>
          <span className="timeline-hour-label">{h > 12 ? h - 12 : h}{h >= 12 ? 'pm' : 'am'}</span>
        </div>
      ))}
      {visible.map(e => {
        const top = ((Math.max(toMin(e.start), DAY_START) - DAY_START) / 60) * PX_PER_HOUR;
        const height = Math.max(20, ((Math.min(toMin(e.end), DAY_END) - Math.max(toMin(e.start), DAY_START)) / 60) * PX_PER_HOUR - 2);
        return (
          <div key={e.id} className={`timeline-event ev-${e.type} ${e.suggested ? 'ev-suggested' : ''}`} style={{ top, height }}>
            <span>{e.start} {e.title}</span>
            {e.suggested ? (
              <button className="btn btn-sm" style={{ marginLeft: 6, padding: '1px 8px' }} onClick={() => onAccept(e)}>✓ accept</button>
            ) : (
              <button className="btn-icon" style={{ padding: '0 4px', float: 'right' }} aria-label="Delete" onClick={() => onRemove(e)}>✕</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Schedule() {
  const { data, update, celebrate } = useApp();
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', start: '09:00', end: '10:00', type: 'meeting' as EventType });

  const plan = useMemo(() => generateDayPlan(data, date), [data, date]);
  const dayEvents = data.events.filter(e => e.date === date);
  const sleepSugg = plan.suggestions.find(s => s.type === 'sleep');
  const merged = [...dayEvents, ...plan.suggestions.filter(s => s.type !== 'sleep' && !dayEvents.some(e => e.type === s.type && e.title === s.title))];

  const accept = (e: CalendarEvent) => {
    update(d => ({ ...d, events: [...d.events, { ...e, id: uid(), suggested: false }] }));
    celebrate(`📅 Added "${e.title}" to your calendar`);
  };

  return (
    <div className="page">
      <div className="flex-between">
        <h2>Schedule</h2>
        <div className="flex">
          <button className="btn btn-sm btn-secondary" onClick={() => setDate(fmtDate(addDays(parseISO(date), -1)))}>←</button>
          <input type="date" style={{ width: 160 }} value={date} onChange={e => setDate(e.target.value)} />
          <button className="btn btn-sm btn-secondary" onClick={() => setDate(fmtDate(addDays(parseISO(date), 1)))}>→</button>
          <button className="btn btn-sm" onClick={() => setAdding(true)}>+ Event</button>
        </div>
      </div>

      <CalendarFeedCard />

      <Card>
        <p className="small muted" style={{ marginTop: 0 }}>
          Dashed blocks are AI suggestions built from your recovery score, training history and free gaps; click <strong>✓ accept</strong> to commit one.
        </p>
        {plan.busyScore >= 5 && <p className="small">⚠️ <strong>{Math.round(plan.busyScore)}h of meetings today</strong> — suggestions favor a shorter workout and simpler meals.</p>}
      </Card>

      <div className="grid grid-2">
        <Card title={format(parseISO(date), 'EEEE, MMM d')}>
          <Timeline
            events={merged}
            onAccept={accept}
            onRemove={e => update(d => ({ ...d, events: d.events.filter(x => x.id !== e.id) }))}
          />
        </Card>

        <div className="page" style={{ gap: 16 }}>
          <Card title="Smart notifications">
            {plan.notes.length === 0 ? <p className="muted">Nothing urgent — the day looks well balanced.</p>
              : plan.notes.map((n, i) => <p key={i} className="small" style={{ margin: '6px 0' }}>💡 {n}</p>)}
            {sleepSugg && (
              <p className="small" style={{ margin: '6px 0' }}>
                😴 Recommended bedtime tonight: <strong>{sleepSugg.start}</strong> (wake {data.profile.wakeTime}).
              </p>
            )}
            <Field label="Your usual wake time">
              <input type="time" style={{ maxWidth: 140 }} value={data.profile.wakeTime}
                onChange={e => update(d => ({ ...d, profile: { ...d.profile, wakeTime: e.target.value } }))} />
            </Field>
          </Card>

          <Card title="Suggested blocks">
            <div className="list">
              {plan.suggestions.map(s => (
                <div key={s.id} className="list-item">
                  <div className="list-item-main">
                    <div className="list-item-title">{s.title}</div>
                    <div className="list-item-sub">{s.start}–{s.end} · {s.type}</div>
                  </div>
                  {s.type !== 'sleep' && <button className="btn btn-sm" onClick={() => accept(s)}>✓</button>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {adding && (
        <Modal title="Add event" onClose={() => setAdding(false)}>
          <Field label="Title"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
          <div className="form-row">
            <Field label="Start"><input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} /></Field>
            <Field label="End"><input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} /></Field>
            <Field label="Type">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as EventType })}>
                {['meeting', 'workout', 'meal', 'recovery', 'personal'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <button className="btn" onClick={() => {
            if (!form.title) return;
            update(d => ({ ...d, events: [...d.events, { id: uid(), date, ...form }] }));
            setAdding(false);
            setForm({ title: '', start: '09:00', end: '10:00', type: 'meeting' });
          }}>Add to {format(parseISO(date), 'MMM d')}</button>
        </Modal>
      )}
    </div>
  );
}
