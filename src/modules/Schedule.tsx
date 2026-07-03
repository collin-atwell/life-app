import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../state/AppContext';
import { Card, Field, Modal } from '../components/ui';
import { fmtDate, today } from '../lib/calc';
import { generateDayPlan } from '../lib/scheduler';
import { mergeCalendarEvents, syncCalendarFeed } from '../lib/ical';
import type { CalendarEvent, EventType } from '../types';

function CalendarFeedCard() {
  const { data, update, celebrate } = useApp();
  const [url, setUrl] = useState(data.icalUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const importedCount = data.events.filter(e => e.id.startsWith('ical-')).length;

  const sync = async (feedUrl: string) => {
    setBusy(true); setMsg(null);
    try {
      const imported = await syncCalendarFeed(feedUrl);
      update(d => ({ ...mergeCalendarEvents(d, imported), icalUrl: feedUrl }));
      celebrate(`📅 Calendar synced — ${imported.length} events imported`);
    } catch (e) {
      setMsg(`⚠️ ${(e as Error).message}`);
    }
    setBusy(false);
  };

  return (
    <Card title="Real calendar feed" action={importedCount > 0 ? <span className="badge badge-green">{importedCount} SYNCED</span> : undefined}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Paste your calendar's <strong>secret iCal address</strong> and your real meetings flow into the planner.
        Google: calendar Settings → "Secret address in iCal format" · Apple: iCloud calendar → share → Public Calendar
        · Outlook: Settings → Shared calendars → ICS link. (SETUP.md Part 3 has details.)
      </p>
      <div className="form-row">
        <input placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value={url} onChange={e => setUrl(e.target.value)} />
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
