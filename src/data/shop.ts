import type { SiteCode } from './types'
import type { Trace } from './trace'
import { products } from './catalog'
import { dayOf, dayStartTs, today } from '../lib/format'

// ——— Référentiel de la boutique (stock vendant) ———

// `shelf` : durée de vie en jours des produits à date limite (suivis par lot, FEFO) ; `alert` : seuil d'alerte de stock.
export type ShopProduct = { code: string; perishable: boolean; shelf: number; prefix: string; alert: number }
const P = (code: string, alert: number, shelf = 0, prefix = ''): ShopProduct => ({ code, perishable: shelf > 0, shelf, prefix, alert })
export const SHOP_PRODUCTS: ShopProduct[] = [
  P('PF-01', 60), P('PF-02', 40), P('PF-03', 20), P('PF-04', 20), P('PF-05', 15), P('PF-06', 10),
  P('PF-07', 10, 2, 'P'), P('PF-08', 15), P('PF-11', 20, 14, 'Y'), P('PF-12', 10, 14, 'Y'), P('PF-14', 15, 182, 'G'), P('PF-15', 10, 182, 'G'),
]
export const shopProduct = (code: string) => SHOP_PRODUCTS.find(p => p.code === code)
export const product = (code: string) => products.find(p => p.code === code)!
export const productName = (code: string) => { const p = product(code); return `${p.name} ${p.format}` }

// ——— Mouvements du stock vendant : seule source du stock, écritures non modifiables ———

export type ShopMoveKind = 'Stock d’ouverture' | 'Réception BDL' | 'Vente (caisse)' | 'Invendu / perte' | 'Retour client' | 'Contre-écriture'
export const SHOP_KINDS: ShopMoveKind[] = ['Réception BDL', 'Vente (caisse)', 'Invendu / perte', 'Retour client', 'Contre-écriture', 'Stock d’ouverture']
export type ShopMove = { id: string; site: SiteCode; code: string; lot: string; dlc?: string; qty: number; kind: ShopMoveKind; ref: string; ts: number; trace: Trace; motif?: string }

export const nextShopMoveId = (moves: ShopMove[], site: string, offset = 0) =>
  `SMV-S${site.slice(-1)}-${String(moves.filter(m => m.site === site).length + 1 + offset).padStart(6, '0')}`

// Jours restants avant la date limite (0 = dernier jour de vente, négatif = périmé).
export const daysLeft = (dlc: string, now = Date.now()) => Math.round((dayStartTs(dlc) - dayStartTs(dayOf(now))) / 86400000)
export const dlcTag = (d: number | null) => d === null ? '' : d < 0 ? 'Périmé — bloqué à la vente' : d === 0 ? 'Dernier jour (J-0)' : d <= 2 ? `Alerte J-${d}` : ''

export type LotStock = { code: string; lot: string; dlc?: string; qty: number; left: number | null }

// Stock par lot (les produits sans date limite ont un lot unique « »).
export function shopLots(moves: ShopMove[], site: string, now = Date.now()): LotStock[] {
  const m = new Map<string, LotStock>()
  moves.forEach(x => {
    if (x.site !== site || x.ts > now) return
    const k = `${x.code}|${x.lot}`
    const cur = m.get(k) || { code: x.code, lot: x.lot, dlc: x.dlc, qty: 0, left: null }
    cur.qty = +(cur.qty + x.qty).toFixed(4)
    if (x.dlc) cur.dlc = x.dlc
    m.set(k, cur)
  })
  return [...m.values()].filter(l => l.qty > 0).map(l => ({ ...l, left: l.dlc ? daysLeft(l.dlc, now) : null }))
    .sort((a, b) => (a.dlc && b.dlc ? dayStartTs(a.dlc) - dayStartTs(b.dlc) : 0))
}

export function shopStock(moves: ShopMove[], site: string, now = Date.now()) {
  const lots = shopLots(moves, site, now)
  return Object.fromEntries(SHOP_PRODUCTS.map(p => {
    const ls = lots.filter(l => l.code === p.code)
    const total = ls.reduce((s, l) => s + l.qty, 0)
    const sellable = ls.filter(l => l.left === null || l.left >= 0).reduce((s, l) => s + l.qty, 0)
    return [p.code, { total, sellable, blocked: total - sellable, lots: ls }]
  })) as Record<string, { total: number; sellable: number; blocked: number; lots: LotStock[] }>
}

// Règle FEFO : premier périmé, premier sorti ; un lot périmé n'est jamais vendu. Renvoie null si le stock vendable est insuffisant.
export function fefo(lots: LotStock[], code: string, qty: number, skip?: string) {
  const out: { lot: string; dlc?: string; qty: number }[] = []
  let rest = qty
  for (const l of lots.filter(x => x.code === code && (x.left === null || x.left >= 0) && x.lot !== skip)) {
    if (rest <= 0) break
    const q = Math.min(rest, l.qty)
    out.push({ lot: l.lot, dlc: l.dlc, qty: q }); rest -= q
  }
  return rest > 0 ? null : out
}

// ——— Bordereaux de livraison (BDL) reçus à l'aveugle ———

export const BDL_ST = {
  transit: 'En transit', partial: 'Réception partielle', ok: 'Réceptionné conforme', gap: 'Réceptionné avec écart', clos: 'Clôturé',
} as const
export const shopName = (site: string) => `Boutique ${({ 'SIT-01': 'SITE 1', 'SIT-02': 'SITE 2', 'SIT-03': 'SITE 3' } as Record<string, string>)[site] || site}`

// ——— Invendus, pertes et retours ———

export const LOSS_MOTIFS = ['Invendu', 'Périmé', 'Casse', 'Rupture de la chaîne du froid', 'Retour client'] as const
export const LOSS_DESTS = ['Retour atelier', 'Recyclage', 'Don', 'Destruction'] as const
export type LossMotif = typeof LOSS_MOTIFS[number]
export type LossDest = typeof LOSS_DESTS[number]
export type DeclPhoto = { name: string; thumb: string }
export type DeclLine = { code: string; lot: string; qty: number; motif: LossMotif; dest: LossDest; photo?: DeclPhoto }
export type Declaration = { id: string; site: SiteCode; ts: number; lines: DeclLine[]; trace: Trace; status: 'Validée' }

// Photo obligatoire pour une perte (périmé, casse, chaîne du froid) dont la valeur dépasse le seuil fixé par la direction.
export const photoRequired = (l: { code: string; qty: number; motif: LossMotif }, threshold: number) =>
  (l.motif === 'Périmé' || l.motif === 'Casse' || l.motif === 'Rupture de la chaîne du froid') && l.qty * product(l.code).retail >= threshold

export const nextDeclId = (decls: Declaration[], site: string, ts: number) => {
  const d = dayOf(ts)
  const n = decls.filter(x => x.site === site && dayOf(x.ts) === d).length + 1
  return `DEC-S${site.slice(-1)}-${d.split('/').reverse().join('')}-${String(n).padStart(2, '0')}`
}

// ——— Corrections par contre-écriture (validation hiérarchique au-delà du seuil) ———

export const SHOP_FIX_THRESHOLD = 10   // unités : au-delà, la contre-écriture attend la validation de la direction
export type ShopFix = {
  id: string; site: SiteCode; ts: number; ref: string; code: string; lot: string; delta: number; motif: string; trace: Trace
  status: 'Appliquée' | 'En attente de validation' | 'Validée par la direction' | 'Refusée par la direction'; decidedBy?: string
}
export const nextFixId = (fixes: ShopFix[], site: string) => `CE-S${site.slice(-1)}-${String(fixes.filter(f => f.site === site).length + 1).padStart(4, '0')}`

export const isTodayDay = (ts: number) => dayOf(ts) === today()
