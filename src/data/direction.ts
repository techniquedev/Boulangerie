import type { DemoState } from './state'
import type { SiteCode } from './types'
import { BAKERY_SITES, figures } from './boulanger'
import { patFigures, prodLine } from './patisserie'
import { BDL_ST, product, SHOP_PRODUCTS, shopStock } from './shop'
import { BS, needsTreatment, siteStock, SITE_MATS } from './stock'
import { tourFigures } from './tour'
import { sale } from './seed2'
import { dayOf, dayStartTs } from '../lib/format'

// Vue Direction Générale : consolidation des 3 sites à partir des données réelles de chaque tableau de bord.

export const SITES: SiteCode[] = BAKERY_SITES

// Jours ayant de l'activité (production, ventes, livraisons), du plus récent au plus ancien.
export function activityDays(s: DemoState) {
  const ts = [...s.lots.map(l => l.ts), ...s.patLots.map(l => dayStartTs(l.fab) + 43200000), ...s.shopMoves.filter(m => m.kind === 'Vente (caisse)').map(m => m.ts), ...s.deliveries.map(d => dayStartTs(d.trace.localAt.slice(0, 10)) + 43200000)]
  return [...new Set(ts.map(dayOf))].sort((a, b) => dayStartTs(b) - dayStartTs(a))
}

// Ventes boutique d'un jour : mouvements « Vente (caisse) » valorisés au prix de détail, plus les tickets de caisse
// de démonstration qui n'ont pas de mouvement de stock (session du 26/10).
export function shopSales(s: DemoState, site: string, day: string) {
  const moves = s.shopMoves.filter(m => m.site === site && m.kind === 'Vente (caisse)' && dayOf(m.ts) === day)
  const refs = new Set(moves.map(m => m.ref))
  let ca = moves.reduce((a, m) => a - m.qty * product(m.code).retail, 0)
  let qty = moves.reduce((a, m) => a - m.qty, 0)
  s.sessions.filter(x => x.site === site && x.openedAt.startsWith(day)).forEach(x => {
    x.tickets.filter(t => !refs.has(t.id)).forEach(t => { ca += sale(t); qty += t.cancelled ? 0 : t.lines.reduce((a, l) => a + l.qty, 0) })
    if (!x.tickets.length && x.summary) ca += x.summary.ca
  })
  return { ca, qty }
}

export function bakeryDay(s: DemoState, site: string, day: string) {
  const lots = s.lots.filter(l => l.site === site && dayOf(l.ts) === day)
  const f = lots.map(figures)
  const bags = f.reduce((a, x) => a + x.bags, 0), eps = f.reduce((a, x) => a + x.eps, 0)
  const cooked = lots.filter(l => l.cuisson)
  return {
    lots, bags, eps, perBag: bags ? eps / bags : 0, patons: f.reduce((a, x) => a + x.patons, 0),
    good: cooked.reduce((a, l) => a + l.cuisson!.good, 0), rejects: cooked.reduce((a, l) => a + l.cuisson!.rejects.reduce((b, r) => b + r.qty, 0), 0),
  }
}

export function pastryDay(s: DemoState, site: string, day: string) {
  const lots = s.patLots.filter(l => l.site === site && l.fab === day)
  const byLine = (code: string) => lots.filter(l => l.line === code).reduce((a, l) => a + patFigures(l).produced, 0)
  return { lots, P: byLine('P'), Y: byLine('Y'), G: byLine('G'), unit: (code: string) => prodLine(code).unitLabel }
}

export function storeStatus(s: DemoState, site: string) {
  const st = siteStock(s.movements, site)
  const bons = s.bonsSortie.filter(b => b.site === site)
  return {
    low: SITE_MATS.filter(m => (st[m.mp] || 0) < m.min),
    value: SITE_MATS.reduce((a, m) => a + (st[m.mp] || 0) * m.cmp, 0),
    pending: bons.filter(b => b.status === BS.emis).length,
    toTreat: bons.filter(needsTreatment).length,
  }
}

export function shopStatus(s: DemoState, site: string, day: string) {
  const bdls = s.bdls.filter(b => b.toSite === site && b.kind !== 'tournee')
  const st = shopStock(s.shopMoves, site)
  const losses = s.shopMoves.filter(m => m.site === site && m.kind === 'Invendu / perte' && dayOf(m.ts) === day)
  return {
    transit: bdls.filter(b => b.status === BDL_ST.transit || b.status === BDL_ST.partial).length,
    gaps: bdls.filter(b => b.status === BDL_ST.gap).length,
    rupture: SHOP_PRODUCTS.filter(p => st[p.code].sellable < p.alert).length,
    expired: SHOP_PRODUCTS.reduce((a, p) => a + st[p.code].blocked, 0),
    lossQty: losses.reduce((a, m) => a - m.qty, 0),
    lossValue: losses.reduce((a, m) => a - m.qty * product(m.code).retail, 0),
  }
}

export function toursOf(s: DemoState, site: string, day?: string) {
  return s.tours.filter(t => t.site === site && (!day || dayOf(t.ts) === day)).sort((a, b) => b.ts - a.ts)
    .map(t => ({ t, f: tourFigures(t, s.deliveries, s.tourDeposits, s.tourFixes) }))
}
