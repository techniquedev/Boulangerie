import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { dayStartTs } from '../lib/format'

// Filtre de période commun : par jour, par mois ou par année (et « Tout » pour les listes).
// Les valeurs proposées sont celles présentes dans les données (jours au format JJ/MM/AAAA).

export type PeriodMode = 'tout' | 'jour' | 'mois' | 'annee'
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const monthLabel = (mmyyyy: string) => { const [m, y] = mmyyyy.split('/'); return `${MONTHS[Number(m) - 1]} ${y}` }
const MODE_LABELS: Record<PeriodMode, string> = { tout: 'Tout', jour: 'Jour', mois: 'Mois', annee: 'Année' }

export type Period = {
  mode: PeriodMode; value: string; label: string
  match: (day: string) => boolean        // day : JJ/MM/AAAA (ou horodatage « JJ/MM/AAAA HH:MM »)
  last: string                           // dernier jour de la sélection présent dans les données
  bar: React.ReactElement
}

export function usePeriod(days: string[], opts: { all?: boolean; initial?: PeriodMode } = {}): Period {
  const all = opts.all ?? true
  const sorted = [...new Set(days.map(d => d.slice(0, 10)))].filter(Boolean).sort((a, b) => dayStartTs(b) - dayStartTs(a))
  const valuesOf = (m: PeriodMode) => m === 'jour' ? sorted : m === 'mois' ? [...new Set(sorted.map(d => d.slice(3)))] : m === 'annee' ? [...new Set(sorted.map(d => d.slice(6)))] : []
  const [mode, setMode] = useState<PeriodMode>(opts.initial ?? (all ? 'tout' : 'jour'))
  const [value, setValue] = useState(valuesOf(mode)[0] || '')
  const values = valuesOf(mode)
  const v = values.includes(value) ? value : values[0] || ''

  const match = (d: string) => {
    const day = d.slice(0, 10)
    return mode === 'tout' || !v ? true : mode === 'jour' ? day === v : mode === 'mois' ? day.slice(3) === v : day.slice(6) === v
  }
  const label = mode === 'tout' ? 'toutes périodes' : mode === 'jour' ? v : mode === 'mois' ? monthLabel(v) : `année ${v}`
  const last = sorted.find(match) || sorted[0] || ''
  const choose = (m: PeriodMode) => { setMode(m); setValue(valuesOf(m)[0] || '') }

  const bar = (
    <div className="period-filter">
      <CalendarDays size={18} />
      <div className="seg">{(['tout', 'jour', 'mois', 'annee'] as PeriodMode[]).filter(m => all || m !== 'tout').map(m =>
        <button key={m} className={mode === m ? 'on' : ''} onClick={() => choose(m)}>{MODE_LABELS[m]}</button>)}</div>
      {mode !== 'tout' && <select className="ref-input" value={v} onChange={e => setValue(e.target.value)}>
        {values.map(x => <option key={x} value={x}>{mode === 'mois' ? monthLabel(x) : x}</option>)}
      </select>}
    </div>
  )
  return { mode, value: v, label, match, last, bar }
}
