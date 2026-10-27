import { Cake, IceCreamCone, Milk } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge } from '../../components/ui'
import { siteShort } from '../../data/org'
import { pfLots, patStatus, type PatLot, type PatStatus, type ProdLine } from '../../data/patisserie'
import { workshopKey, type AtelierCode } from '../../data/stock'

// Filtrage automatique : l'opérateur ne voit que son site et ses propres productions.
export function usePat() {
  const { user, state } = useApp()
  const u = user!
  const site = u.sites[0]
  const all = state.patLots.filter(l => l.site === site)
  const pf = pfLots(all, state.bdls, site)
  const mine = all.filter(l => l.trace.author === u.name).sort((a, b) => b.ts - a.ts)
  const ws = (atl: AtelierCode) => state.workshop[workshopKey(site, atl)] || {}
  return {
    user: u, site, siteName: siteShort(site), mine, pf, all,
    status: (l: PatLot) => patStatus(l, pf),
    stockOf: ws,
    bons: state.bonsSortie.filter(b => b.site === site && (b.atelier === 'ATL-P' || b.atelier === 'ATL-YG')).sort((a, b) => b.ts - a.ts),
  }
}

export const LineIcon = ({ line, size = 20 }: { line: ProdLine; size?: number }) =>
  line.icon === 'cake' ? <Cake size={size} /> : line.icon === 'milk' ? <Milk size={size} /> : <IceCreamCone size={size} />

const tone = (s: PatStatus) => (s === 'Créé' ? 'warn' : s === 'Mis en stock' ? 'ok' : 'neutral')
export const PatBadge = ({ s }: { s: PatStatus }) => <Badge tone={tone(s)}>{s}</Badge>
