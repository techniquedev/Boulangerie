import type { AlertItem, SiteCode } from './types'
import { EPS_GRAMS } from './production'
import { workshopKey } from './stock'
import type { Trace } from './trace'
import { dayOf, dec, num } from '../lib/format'

export { type Trace, deviceFor, traceFor } from './trace'

// ——— Référentiel ———

export type MatKey = 'farine' | 'levure' | 'sel' | 'glace'

// Unités atelier : farine en sacs de 50 kg, le reste en kg (mêmes unités de stock que le magasin du site).
export const MATS: { key: MatKey; label: string; unit: string; mp: string }[] = [
  { key: 'farine', label: 'Farine', unit: 'sac', mp: 'MP-01' },
  { key: 'levure', label: 'Levure', unit: 'kg', mp: 'MP-02' },
  { key: 'sel', label: 'Sel', unit: 'kg', mp: 'MP-03' },
  { key: 'glace', label: 'Glace', unit: 'kg', mp: 'MP-08' },
]
export const matLabel = (k: MatKey) => MATS.find(m => m.key === k)!.label
export const matQty = (k: MatKey, q: number) => k === 'farine' ? `${dec(q, 2)} sac${q > 1 ? 's' : ''}` : `${dec(q, 2)} kg`
export const mpOf = (k: MatKey) => MATS.find(m => m.key === k)!.mp

export type Stock = Record<MatKey, number>
export const emptyStock = (): Stock => ({ farine: 0, levure: 0, sel: 0, glace: 0 })

// Stock de l'atelier boulangerie d'un site (alimenté uniquement par les bons de sortie confirmés).
export const bakerStock = (workshop: Record<string, Record<string, number>>, site: string): Stock => {
  const w = workshop[workshopKey(site, 'ATL-B')] || {}
  return Object.fromEntries(MATS.map(m => [m.key, w[m.mp] || 0])) as Stock
}

// RG : formats gérés ; « 200 g » figure deux fois dans le cahier des charges, il n'est proposé qu'une fois.
export const FORMATS: { label: string; grams: number }[] = [
  { label: 'Pain 50 g', grams: 50 },
  { label: 'Pain 100 g', grams: 100 },
  { label: 'Pain 150 g', grams: 150 },
  { label: 'Pain 200 g', grams: 200 },
  { label: 'Pain découpé 115 FCFA', grams: 115 },
]

export const BAKERY_SITES: SiteCode[] = ['SIT-01', 'SIT-02', 'SIT-03']

// Heure (Porto-Novo) du rapprochement automatique de fin de journée.
export const END_OF_DAY_HOUR = 20

// ——— Lots de production ———

export type Line = { label: string; grams: number; qty: number }
export type LotStatus = 'Créé' | 'Remis au four' | 'En cours de cuisson' | 'Cuit' | 'Mis en stock' | 'Clôturé'
// Frise du cycle de vie (la prise en charge par l'enfourneur reste à l'étape « Remis au four »).
export const LOT_FLOW: LotStatus[] = ['Créé', 'Remis au four', 'Cuit', 'Mis en stock', 'Clôturé']
export const LOT_STATUSES: LotStatus[] = ['Créé', 'Remis au four', 'En cours de cuisson', 'Cuit', 'Mis en stock', 'Clôturé']
export const flowIndex = (s: LotStatus) => (s === 'En cours de cuisson' ? LOT_FLOW.indexOf('Remis au four') : LOT_FLOW.indexOf(s))

export type RejectReason = 'Brûlé' | 'Déformé' | 'Tombé' | 'Autre'
export const REJECT_REASONS: RejectReason[] = ['Brûlé', 'Déformé', 'Tombé', 'Autre']
export type RejectPhoto = { name: string; thumb: string }
// Ligne de rebut : format de pain, motif (texte obligatoire si « Autre ») et photo (obligatoire au-delà du seuil).
export type RejectLine = { reason: RejectReason; qty: number; photo: boolean; format?: string; note?: string; image?: RejectPhoto }
export type CuissonReport = {
  by: string; at: string; received: number; good: number; rejects: RejectLine[]
  goodBy?: Record<string, number>; rateMotif?: string; trace?: Trace
}
// Contre-écriture de cuisson : reclassement de pains entre « Conforme » et un motif de rebut, sur un format.
export type OvenFix = { at: string; by: string; motif: string; format: string; from: 'Conforme' | RejectReason; to: 'Conforme' | RejectReason; qty: number; trace: Trace }
export type Anomaly = { at: string; by: string; text: string; trace: Trace; answer?: { at: string; by: string; text: string } }

// Contre-écriture : la pétrissée d'origine n'est jamais modifiée.
export type Correction = { at: string; by: string; motif: string; kind: 'mat' | 'line'; key: string; delta: number }

export type ProdLot = {
  id: string; site: SiteCode; ts: number; trace: Trace
  mats: { mat: MatKey; qty: number }[]; lines: Line[]
  threshold: number; motif?: string
  status: LotStatus; history: { status: LotStatus; at: string; by: string }[]
  cuisson?: CuissonReport; corrections: Correction[]
  oven?: { by: string; trace: Trace; ts: number }   // prise en charge par l'enfourneur
  anomalies?: Anomaly[]; ovenFixes?: OvenFix[]
}

// ——— Calculs ———

export const kgOf = (lines: Line[]) => lines.reduce((s, l) => s + l.qty * l.grams, 0) / 1000
export const epsOfKg = (kg: number) => (kg * 1000) / EPS_GRAMS
export const perBagOf = (eps: number, bags: number) => (bags > 0 ? eps / bags : 0)
export const patonsOf = (lines: Line[]) => lines.reduce((s, l) => s + l.qty, 0)

// Pâtons attendus au minimum pour un grammage, si toute la pâte attendue au seuil était façonnée dans ce format.
export const forecast = (bags: number, grams: number, threshold: number) =>
  grams > 0 ? Math.floor((bags * threshold * EPS_GRAMS) / grams) : 0

export type Tone = 'ok' | 'warn' | 'danger'
// Vert au seuil ou au-dessus ; orange jusqu'à 10 % sous le seuil ; rouge au-delà.
export const yieldTone = (perBag: number, threshold: number): Tone =>
  perBag >= threshold ? 'ok' : perBag >= threshold * 0.9 ? 'warn' : 'danger'

// Valeurs effectives d'un lot : pétrissée d'origine + contre-écritures.
export function figures(l: ProdLot) {
  const mats = l.mats.map(m => ({ ...m, qty: m.qty + l.corrections.filter(c => c.kind === 'mat' && c.key === m.mat).reduce((s, c) => s + c.delta, 0) }))
  const lines = l.lines.map(x => ({ ...x, qty: x.qty + l.corrections.filter(c => c.kind === 'line' && c.key === x.label).reduce((s, c) => s + c.delta, 0) }))
  const bags = mats.find(m => m.mat === 'farine')?.qty || 0
  const kg = kgOf(lines)
  const eps = epsOfKg(kg)
  return { mats, lines, bags, kg, eps, perBag: perBagOf(eps, bags), patons: patonsOf(lines) }
}

export const lotDay = (l: ProdLot) => dayOf(l.ts)

// Rapport de cuisson effectif (rapport d'origine + contre-écritures) : conformes par format, rebuts par format et motif.
export function cuissonFigures(l: ProdLot) {
  const r = l.cuisson
  if (!r) return null
  const goodBy: Record<string, number> = { ...(r.goodBy || {}) }
  if (!r.goodBy) goodBy['Tous formats'] = r.good
  const rej = new Map<string, number>()   // clé « format|motif »
  r.rejects.forEach(x => { const k = `${x.format || 'Tous formats'}|${x.reason}`; rej.set(k, (rej.get(k) || 0) + x.qty) })
  ;(l.ovenFixes || []).forEach(f => {
    const move = (side: 'Conforme' | RejectReason, d: number) => side === 'Conforme'
      ? (goodBy[f.format] = (goodBy[f.format] || 0) + d)
      : rej.set(`${f.format}|${side}`, (rej.get(`${f.format}|${side}`) || 0) + d)
    move(f.from, -f.qty); move(f.to, f.qty)
  })
  const good = Object.values(goodBy).reduce((a, b) => a + b, 0)
  const rejects = [...rej].map(([k, qty]) => { const [format, reason] = k.split('|'); return { format, reason: reason as RejectReason, qty } }).filter(x => x.qty)
  const rejectTotal = rejects.reduce((a, b) => a + b.qty, 0)
  return { received: r.received, goodBy, good, rejects, rejectTotal, rate: r.received ? (rejectTotal / r.received) * 100 : 0, balance: r.received - good - rejectTotal }
}

// ——— Identifiants ———

// N° de lot : LOT-B-{AAAAMMJJ}-{n° d'ordre des lots de production du site dans la journée} (unique par site).
export const lotIdFor = (ts: number, n: number) =>
  `LOT-B-${dayOf(ts).split('/').reverse().join('')}-${String(n).padStart(2, '0')}`

export const nextLotId = (lots: ProdLot[], patLots: { site: string; fab: string }[], site: SiteCode, ts: number) =>
  lotIdFor(ts, lots.filter(l => l.site === site && dayOf(l.ts) === dayOf(ts)).length + patLots.filter(l => l.site === site && l.fab === dayOf(ts)).length + 1)

export const nextAlertId = (alerts: AlertItem[]) => {
  const max = alerts.reduce((m, a) => Math.max(m, Number(a.id.split('-').pop()) || 0), 0)
  return `AL-2026-${String(max + 1).padStart(4, '0')}`
}

export const isToday = (ts: number) => dayOf(ts) === dayOf(Date.now())
export const fmtPerBag = (v: number) => `${num(v)} EPS/sac`
