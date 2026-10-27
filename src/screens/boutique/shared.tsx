import { useApp } from '../../store/context'
import { Badge } from '../../components/ui'
import { BDL_ST, dlcTag, shopName, shopStock } from '../../data/shop'
import type { Bdl } from '../../data/types'

// Filtrage automatique : le boutiquier ne voit que les bordereaux et le stock vendant de sa propre boutique.
export function useShop() {
  const { user, state } = useApp()
  const u = user!
  const site = u.sites[0]
  return {
    user: u, site, shop: shopName(site),
    bdls: state.bdls.filter(b => b.toSite === site).sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    moves: state.shopMoves.filter(m => m.site === site).sort((a, b) => b.ts - a.ts),
    stock: shopStock(state.shopMoves, site),
    decls: state.declarations.filter(d => d.site === site).sort((a, b) => b.ts - a.ts),
    fixes: state.shopFixes.filter(f => f.site === site).sort((a, b) => b.ts - a.ts),
  }
}

// Statut visible du boutiquier : conforme / avec écart, jamais l'alerte ni les quantités expédiées.
const tone = (s: string) => (s === BDL_ST.gap ? 'danger' : s === BDL_ST.transit || s === BDL_ST.partial ? 'warn' : s === BDL_ST.clos ? 'neutral' : 'ok')
export const BdlBadge = ({ b }: { b: Bdl }) => <Badge tone={tone(b.status)}>{b.status}</Badge>

export const DlcBadge = ({ left }: { left: number | null }) => {
  const t = dlcTag(left)
  return t ? <Badge tone={left! < 0 ? 'danger' : 'warn'}>{t}</Badge> : null
}

// Quantité comptée cumulée d'une ligne (tous les passages de comptage du BDL).
export const countedTotal = (b: Bdl, i: number) => (b.counts || []).reduce((s, c) => s + (c.counts[i] || 0), 0)
export const lastCount = (b: Bdl) => b.counts?.length ? b.counts[b.counts.length - 1] : undefined
