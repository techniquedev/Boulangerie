import type { SiteCode } from './types'
import type { Trace } from './trace'
import { rawMaterials } from './catalog'
import { suppliers } from './partners'
import { dayOf, dec } from '../lib/format'

// ——— Ateliers et emplacements du site ———

export type AtelierCode = 'ATL-B' | 'ATL-P' | 'ATL-YG'
export const ATELIERS: { code: AtelierCode; label: string }[] = [
  { code: 'ATL-B', label: 'Atelier boulangerie' },
  { code: 'ATL-P', label: 'Atelier pâtisserie' },
  { code: 'ATL-YG', label: 'Atelier yaourts / crèmes glacées' },
]
export const atelierLabel = (c: string) => ATELIERS.find(a => a.code === c)?.label || c
export const workshopKey = (site: string, atelier: string) => `${site}|${atelier}`

export type Loc = 'MAG' | 'CF'
export const LOC_LABELS: Record<Loc, string> = { MAG: 'Magasin matières', CF: 'Chambre froide' }

// ——— Référentiel des matières (lecture seule pour le magasinier de site) ———

export type UnitConv = { u: string; f: number }   // 1 u = f unités de stock
export type SiteMat = { mp: string; name: string; unit: string; units: UnitConv[]; loc: Loc; min: number; reorder: number; cmp: number; buy: string; main: boolean }

// `buyF` : unités de stock par unité d'achat du catalogue (le CMP du catalogue est exprimé par unité d'achat).
const mat = (mp: string, unit: string, conv: [string, number][], buyF: number, loc: Loc, min: number, reorder: number, main = false): SiteMat => {
  const m = rawMaterials.find(x => x.code === mp)!
  return { mp, name: m.name, unit, units: [{ u: unit, f: 1 }, ...conv.map(([u, f]) => ({ u, f }))], loc, min, reorder, cmp: m.cmp / buyF, buy: m.unit, main }
}

export const SITE_MATS: SiteMat[] = [
  mat('MP-01', 'sac', [['kg', 1 / 50]], 1, 'MAG', 10, 20, true),
  mat('MP-02', 'kg', [['carton', 5], ['sachet 500 g', 0.5], ['g', 0.001]], 5, 'MAG', 20, 30, true),
  mat('MP-03', 'kg', [['sac 25 kg', 25]], 25, 'MAG', 50, 100, true),
  mat('MP-04', 'kg', [['sac 50 kg', 50]], 50, 'MAG', 150, 250, true),
  mat('MP-05', 'kg', [['carton 25 kg', 25]], 25, 'MAG', 50, 100, true),
  mat('MP-06', 'unité', [['plateau 30', 30]], 30, 'CF', 300, 600),
  mat('MP-07', 'kg', [['carton 10 kg', 10]], 10, 'CF', 30, 50),
  mat('MP-08', 'kg', [['bloc 20 kg', 20]], 20, 'CF', 100, 200, true),
  mat('MP-09', 'L', [['ml', 0.001]], 1, 'MAG', 2, 5),
  mat('MP-10', 'unité', [['carton 1 000', 1000]], 1000, 'MAG', 1000, 3000),
  mat('MP-11', 'unité', [['carton 500', 500]], 500, 'MAG', 500, 1500),
  mat('MP-12', 'unité', [['paquet 100', 100]], 100, 'MAG', 1000, 2000),
]
export const siteMat = (mp: string) => SITE_MATS.find(m => m.mp === mp)!
export const matName = (mp: string) => siteMat(mp)?.name || mp

const PLURAL: Record<string, string> = { sac: 'sacs', 'unité': 'unités', carton: 'cartons', 'bloc 20 kg': 'blocs de 20 kg', 'sac 25 kg': 'sacs de 25 kg', 'sac 50 kg': 'sacs de 50 kg', 'carton 25 kg': 'cartons de 25 kg', 'carton 10 kg': 'cartons de 10 kg', 'plateau 30': 'plateaux de 30', 'carton 1 000': 'cartons de 1 000', 'carton 500': 'cartons de 500', 'paquet 100': 'paquets de 100', 'sachet 500 g': 'sachets de 500 g' }
const plural = (u: string, q: number) => (q > 1 ? PLURAL[u] || u : u)
export const unitQty = (u: string, q: number) => `${dec(q, 2)} ${plural(u, q)}`
export const fmtQty = (mp: string, q: number) => unitQty(siteMat(mp)?.unit || '', q)
export const convText = (m: SiteMat) => m.units.slice(1).map(x => x.f >= 1 ? `1 ${x.u} = ${dec(x.f, 3)} ${m.unit}` : `1 ${m.unit} = ${dec(1 / x.f, 3)} ${x.u}`).join(' · ')
export const supplierName = (code: string) => suppliers.find(s => s.code === code)?.name || code

// ——— Mouvements de stock : écritures non modifiables, seule source du stock ———

export type MoveKind = 'Inventaire d’ouverture' | 'Entrée (réception)' | 'Sortie (bon atelier)' | 'Contre-écriture'
export type Movement = { id: string; site: SiteCode; mp: string; loc: Loc; qty: number; kind: MoveKind; ref: string; ts: number; trace: Trace; motif?: string }

export const siteStock = (movs: Movement[], site: string) => {
  const s: Record<string, number> = Object.fromEntries(SITE_MATS.map(m => [m.mp, 0]))
  movs.forEach(x => { if (x.site === site) s[x.mp] = +((s[x.mp] || 0) + x.qty).toFixed(4) })
  return s
}

export const nextMoveId = (movs: Movement[], offset = 0) => `MVT-${String(movs.length + 1 + offset).padStart(6, '0')}`

// ——— Réceptions fournisseurs ———

export type RecLine = { mp: string; unit: string; f: number; ordered: number | null; received: number; remark?: string }
export type Photo = { kind: 'Facture' | 'Bon de livraison'; name: string; thumb: string }
export type Reception = {
  id: string; site: SiteCode; supplier: string; invoiceNo: string; invoiceRef: string; deliveryDate: string; ts: number
  lines: RecLine[]; photos: Photo[]; complementOf?: string; trace: Trace
}

export const nextReceptionId = (recs: Reception[], site: string, ts: number) => {
  const [d, m, y] = dayOf(ts).split('/')
  const n = recs.filter(r => r.site === site && dayOf(r.ts) === dayOf(ts)).length + 1
  return `REC-${y}-${m}-${d}-${String(n).padStart(3, '0')}`
}

// Livraisons partielles : une même facture (fournisseur + n°) regroupe la réception d'origine et ses compléments.
export type RecGroup = { key: string; origin: Reception; recs: Reception[]; reliquat: { mp: string; qty: number }[]; partial: boolean }
export const receptionGroups = (recs: Reception[], site: string): RecGroup[] => {
  const m = new Map<string, Reception[]>()
  recs.filter(r => r.site === site).forEach(r => { const k = `${r.supplier}|${r.invoiceNo}`; m.set(k, [...(m.get(k) || []), r]) })
  return [...m].map(([key, rs]) => {
    const sorted = [...rs].sort((a, b) => a.ts - b.ts)
    const origin = sorted.find(r => !r.complementOf) || sorted[0]
    const reliquat = origin.lines.filter(l => l.ordered !== null).map(l => {
      const got = sorted.flatMap(r => r.lines).filter(x => x.mp === l.mp).reduce((s, x) => s + x.received * x.f, 0)
      return { mp: l.mp, qty: +((l.ordered! * l.f) - got).toFixed(4) }
    }).filter(x => x.qty > 0)
    return { key, origin, recs: sorted, reliquat, partial: reliquat.length > 0 }
  })
}
export const groupOf = (groups: RecGroup[], r: Reception) => groups.find(g => g.recs.some(x => x.id === r.id))

// ——— Bons de sortie vers les ateliers ———

export const BS = { emis: 'Émis', conf: 'Confirmé par l’atelier', refus: 'Refusé par l’atelier', clos: 'Clôturé' } as const
export type BonStatus = typeof BS[keyof typeof BS]
export const BON_FLOW: BonStatus[] = [BS.emis, BS.conf, BS.clos]

export type BonLine = { mp: string; qty: number; received?: number; motif?: string }
export type Reconcile = { at: string; result: 'Conforme' | 'Écart à traiter'; detail: string }
export type Treatment = { at: string; by: string; kind: 'Justification' | 'Contre-écriture'; text: string }
export type BonSortie = {
  id: string; site: SiteCode; atelier: AtelierCode; ts: number; by: string; trace: Trace; lines: BonLine[]
  status: BonStatus; ecart?: boolean; refusal?: string; confirm?: Trace; confirmTs?: number
  reconcile?: Reconcile; treatment?: Treatment[]
}

export const nextBonId = (bons: BonSortie[], site: string) => {
  const max = bons.filter(b => b.site === site).reduce((m, b) => Math.max(m, Number(b.id.split('-').pop()) || 0), 0)
  return `BS-2026-${String(max + 1).padStart(3, '0')}`
}
export const bonDay = (b: BonSortie) => dayOf(b.ts)
export const sameBon = (a: { id: string; site: string }, b: { id: string; site: string }) => a.id === b.id && a.site === b.site
// Bon à traiter par le magasinier : écart signalé par l'atelier ou rapprochement en écart, sans traitement enregistré.
export const needsTreatment = (b: BonSortie) => (b.ecart || b.reconcile?.result === 'Écart à traiter') && !b.treatment?.length
