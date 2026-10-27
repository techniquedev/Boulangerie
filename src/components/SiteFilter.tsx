import { useState } from 'react'
import { useApp } from '../store/context'
import { siteShort } from '../data/org'
import { activityDays, SITES } from '../data/direction'
import type { SiteCode } from '../data/types'

// Filtre Direction : vue consolidée des 3 sites ou un site, et jour d'activité (le plus récent par défaut).
export function useSiteFilter(withDay = true) {
  const { user, state } = useApp()
  const allowed = SITES.filter(s => user!.sites.includes(s))
  const days = activityDays(state)
  const [site, setSite] = useState<'all' | SiteCode>('all')
  const [day, setDay] = useState(days[0] || '')
  const scope = site === 'all' ? allowed : [site]
  const bar = (
    <div className="filter-row">
      {(['all', ...allowed] as ('all' | SiteCode)[]).map(k => <button key={k} className={site === k ? 'chip on' : 'chip'} onClick={() => setSite(k)}>{k === 'all' ? 'Vue consolidée (3 sites)' : siteShort(k)}</button>)}
      {withDay && <select className="ref-input" value={day} onChange={e => setDay(e.target.value)}>{days.map(d => <option key={d}>{d}</option>)}</select>}
    </div>
  )
  return { site, scope, day, bar }
}
