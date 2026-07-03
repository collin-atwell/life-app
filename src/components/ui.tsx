import type { CSSProperties, ReactNode } from 'react';

export function Card({ title, action, children, className = '' }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-header">
          {title && <h3>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, zone }: {
  label: string; value: ReactNode; sub?: string; zone?: 'green' | 'yellow' | 'red';
}) {
  return (
    <div className={`stat ${zone ? `zone-${zone}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, zone }: { value: number; max: number; zone?: 'green' | 'yellow' | 'red' }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <div className={`progress-fill ${zone ? `fill-${zone}` : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, max, size = 96, label, zone }: {
  value: number; max: number; size?: number; label?: string; zone?: 'green' | 'yellow' | 'red';
}) {
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = zone === 'red' ? 'var(--red)' : zone === 'yellow' ? 'var(--yellow)' : 'var(--green)';
  return (
    <svg width={size} height={size} className="ring" role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text">
        {Math.round(value)}
      </text>
    </svg>
  );
}

export function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Chip({ children, active, onClick, style }: {
  children: ReactNode; active?: boolean; onClick?: () => void; style?: CSSProperties;
}) {
  return (
    <button type="button" className={`chip ${active ? 'chip-active' : ''}`} onClick={onClick} style={style} aria-pressed={active}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export const zoneOf = (pct: number): 'green' | 'yellow' | 'red' =>
  pct >= 0.85 ? 'green' : pct >= 0.5 ? 'yellow' : 'red';
