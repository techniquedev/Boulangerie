import { useState } from 'react'
import { useApp } from '../store/context'
import { siteShort } from '../data/org'
import { activityDays, SITES } from '../data/direction'
import type { SiteCode } from '../data/types'
import { usePeriod } from './PeriodFilter'

// Filtre Direction : vue consolidée des 3 sites ou un site, et période (jour, mois ou année ; le jour le plus récent par défaut).
// `days` : jours proposés dans le filtre (par défaut, les jours d'activité de production, de vente et de livraison).
export function useSiteFilter(opts: { all?: boolean; days?: string[] } = {}) {
  const { user, state } = useApp()
  const allowed = SITES.filter(s => user!.sites.includes(s))
  const period = usePeriod(opts.days ?? activityDays(state), { all: opts.all ?? false, initial: opts.all ? 'tout' : 'jour' })
  const [site, setSite] = useState<'all' | SiteCode>('all')
  const scope = site === 'all' ? allowed : [site]
  const bar = (
    <div className="filter-row">
      {(['all', ...allowed] as ('all' | SiteCode)[]).map(k => <button key={k} className={site === k ? 'chip on' : 'chip'} onClick={() => setSite(k)}>{k === 'all' ? 'Vue consolidée (3 sites)' : siteShort(k)}</button>)}
      {period.bar}
    </div>
  )
  return { site, scope, period, inP: period.match, label: period.label, bar }
}
