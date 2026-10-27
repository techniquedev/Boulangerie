import { CheckCircle2, CloudOff } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge } from '../../components/ui'
import { siteShort } from '../../data/org'
import { BS, receptionGroups, siteStock, type BonSortie } from '../../data/stock'
import { num } from '../../lib/format'

// Filtrage automatique : le magasinier de site ne voit que son site (réceptions, bons de sortie, stock de son magasin).
export function useStore() {
  const { user, state } = useApp()
  const u = user!
  const site = u.sites[0]
  const receptions = state.receptions.filter(r => r.site === site).sort((a, b) => b.ts - a.ts)
  return {
    user: u, site, siteName: siteShort(site),
    stock: siteStock(state.movements, site),
    movements: state.movements.filter(m => m.site === site).sort((a, b) => b.ts - a.ts),
    receptions,
    groups: receptionGroups(state.receptions, site),
    bons: state.bonsSortie.filter(b => b.site === site).sort((a, b) => b.ts - a.ts),
  }
}

const bonTone = (b: BonSortie) => (b.status === BS.emis ? 'warn' : b.status === BS.refus ? 'danger' : b.status === BS.clos ? 'neutral' : 'ok')
export const BonBadge = ({ b }: { b: BonSortie }) => <span className="badges">
  <Badge tone={bonTone(b)}>{b.status}</Badge>
  {b.ecart && b.status !== BS.refus && <Badge tone="danger">Écart signalé</Badge>}
  {b.reconcile && <Badge tone={b.reconcile.result === 'Conforme' ? 'ok' : 'danger'}>{b.reconcile.result}</Badge>}
</span>

export function SyncBanner() {
  const { state } = useApp()
  const n = state.queue.length
  return state.offline || n
    ? <div className="sync-banner pending"><CloudOff size={20} /> Hors-ligne — données en attente{n ? ` (${num(n)} opération${n > 1 ? 's' : ''})` : ''} · synchronisation automatique au retour du réseau</div>
    : <div className="sync-banner"><CheckCircle2 size={20} /> Synchronisé</div>
}
