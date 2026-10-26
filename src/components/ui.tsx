import type { ReactNode } from 'react'

export const Badge = ({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'danger' | 'neutral'; children: ReactNode }) =>
  <em className={`badge ${tone}`}>{children}</em>

export const Card = ({ title, sub, actions, children }: { title?: string; sub?: string; actions?: ReactNode; children: ReactNode }) => (
  <div className="card block-card">
    {(title || actions) && <div className="block-head"><div>{title && <h3>{title}</h3>}{sub && <p>{sub}</p>}</div>{actions}</div>}
    {children}
  </div>
)

export const Kpi = ({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'ok' | 'warn' | 'danger' }) => (
  <div className={`kpi-tile ${tone || ''}`}><p>{label}</p><b>{value}</b>{note && <small>{note}</small>}</div>
)

export const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="dtable-wrap"><table className="dtable">
    <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
  </table></div>
)

export const Big = ({ onClick, children, tone, disabled }: { onClick: () => void; children: ReactNode; tone?: 'ghost' | 'danger'; disabled?: boolean }) =>
  <button className={`big-btn ${tone || ''}`} onClick={onClick} disabled={disabled}>{children}</button>

export const Notice = ({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'danger' | 'neutral'; children: ReactNode }) =>
  <div className={`notice ${tone}`}>{children}</div>

export const Steps = ({ steps, current }: { steps: string[]; current: number }) => (
  <div className="steps">{steps.map((s, i) => <span key={s} className={i < current ? 'done' : i === current ? 'now' : ''}><i>{i + 1}</i>{s}</span>)}</div>
)

export const Screen = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => (
  <div className="screen"><div className="screen-head"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{children}</div>
)
