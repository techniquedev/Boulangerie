import type { Role, SiteCode, User } from './types'
import { users } from './org'
import { dayOf, dayStartTs } from '../lib/format'

// ——— Performance & Rentabilité (Direction Générale) ———
// Données de pilotage consolidées par site et par employé, du 01/08/2026 au 31/10/2026 (démonstration calibrée sur le
// cahier des charges : octobre 2026 = CA 8 450 000 / 6 900 000 / 5 300 000 FCFA, croissance +12,4 % sur septembre).

export const PERF_SITES: SiteCode[] = ['SIT-01', 'SIT-02', 'SIT-03']
export const START = '01/08/2026', END = '31/10/2026'

// Seuils paramétrables par la direction.
export const PERF_PARAMS = {
  rentableRate: 10,      // % : taux de rentabilité au-dessus duquel un site est « Rentable »
  declineGrowth: -5,     // % : baisse du CA au-delà de laquelle un site rentable passe « À surveiller »
  scoreGreen: 85, scoreOrange: 70,   // score de performance : vert ≥ 85, orange ≥ 70, rouge en dessous
  riskOrange: 30, riskRed: 60,       // score de risque : orange ≥ 30, rouge ≥ 60
}

// ——— Compte de résultat : écritures journalières par site ———

export const PRODUCT_LINES = ['Ventes au comptoir', 'Ventes en gros', 'Ventes en tournée', 'Acomptes et autres produits'] as const
export const CHARGE_LINES = ['Matières consommées (recettes × CMP)', 'Pertes et rebuts valorisés', 'Dépenses d’exploitation (carburant, électricité…)', 'Achats divers', 'Charges directes affectées'] as const
type Ledger = { site: SiteCode; day: string; ts: number; products: number[]; charges: number[] }

// Objectifs mensuels [CA, charges] par site : août, septembre, octobre.
const MONTHS: [number, number][] = [[2026, 8], [2026, 9], [2026, 10]]
const TARGETS: Record<SiteCode, [number, number][]> = {
  'SIT-01': [[7_200_000, 5_400_000], [7_620_000, 5_600_000], [8_450_000, 6_120_000]],
  'SIT-02': [[6_000_000, 5_650_000], [6_180_000, 5_900_000], [6_900_000, 6_480_000]],
  'SIT-03': [[4_800_000, 4_750_000], [4_572_000, 4_900_000], [5_300_000, 5_720_000]],
  'SIT-04': [],
}
const PRODUCT_SHARE = [0.6, 0.2, 0.17, 0.03]
const CHARGE_SHARE: Record<string, number[]> = { normal: [0.58, 0.06, 0.2, 0.08, 0.08], 'SIT-03': [0.55, 0.12, 0.18, 0.07, 0.08] }

// Répartition exacte d'un montant sur des poids (le reste d'arrondi va au dernier élément).
const split = (total: number, weights: number[]) => {
  const sum = weights.reduce((a, b) => a + b, 0)
  const out = weights.map(w => Math.round((total * w) / sum))
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0)
  return out
}

export const LEDGER: Ledger[] = PERF_SITES.flatMap((site, si) => MONTHS.flatMap(([y, m], mi) => {
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const w = Array.from({ length: days }, (_, d) => 1 + 0.18 * Math.sin((d + 1) * 1.3 + si) + (new Date(Date.UTC(y, m - 1, d + 1)).getUTCDay() === 6 ? 0.25 : 0))
  const [ca, ch] = TARGETS[site][mi]
  const caDays = split(ca, w), chDays = split(ch, w)
  const prodCols = PRODUCT_SHARE.map(sh => split(Math.round(ca * sh), w))
  const chargeShare = CHARGE_SHARE[site] || CHARGE_SHARE.normal
  const chCols = chargeShare.map(sh => split(Math.round(ch * sh), w))
  // Ajustement des colonnes pour retomber exactement sur les totaux journaliers.
  return caDays.map((_, d) => {
    const products = prodCols.map(c => c[d]), charges = chCols.map(c => c[d])
    products[0] += caDays[d] - products.reduce((a, b) => a + b, 0)
    charges[0] += chDays[d] - charges.reduce((a, b) => a + b, 0)
    const day = `${String(d + 1).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    return { site, day, ts: dayStartTs(day), products, charges }
  })
}))

// ——— Période ———

export type Range = { from: number; to: number }   // bornes incluses : début du premier jour, début du dernier jour
// Période précédente : mois ou trimestre calendaire précédent, sinon période de même durée juste avant.
export const prevRange = (r: Range, unit: 'mois' | 'trimestre' | 'autre' = 'autre'): Range => {
  if (unit !== 'autre') {
    const d = new Date(r.from + 3600000), n = unit === 'mois' ? 1 : 3
    return { from: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1, -1), to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0, -1) }
  }
  const len = r.to - r.from + 86400000
  return { from: r.from - len, to: r.from - 86400000 }
}
export const rangeLabel = (r: Range) => r.from === r.to ? dayOf(r.from + 43200000) : `${dayOf(r.from + 43200000)} → ${dayOf(r.to + 43200000)}`

export type PnL = { ca: number; charges: number; products: number[]; chargeLines: number[]; gross: number; net: number; rate: number }
export function pnl(sites: SiteCode[], r: Range): PnL {
  const rows = LEDGER.filter(l => sites.includes(l.site) && l.ts >= r.from && l.ts <= r.to)
  const products = PRODUCT_LINES.map((_, i) => rows.reduce((a, l) => a + l.products[i], 0))
  const chargeLines = CHARGE_LINES.map((_, i) => rows.reduce((a, l) => a + l.charges[i], 0))
  const ca = products.reduce((a, b) => a + b, 0), charges = chargeLines.reduce((a, b) => a + b, 0)
  const gross = ca - chargeLines[0] - chargeLines[1], net = ca - charges
  return { ca, charges, products, chargeLines, gross, net, rate: ca ? (net / ca) * 100 : 0 }
}

// Pertes répétées : nombre de mois consécutifs déficitaires jusqu'au mois de fin de période.
export function lossStreak(site: SiteCode, r: Range) {
  const [, m, y] = dayOf(r.to + 43200000).split('/').map(Number)
  let streak = 0
  for (let k = 0; k < 6; k++) {
    const mm = m - k, yy = y + Math.floor((mm - 1) / 12), mo = ((mm - 1) % 12 + 12) % 12 + 1
    const from = Date.UTC(yy, mo - 1, 1, -1), to = Date.UTC(yy, mo, 0, -1)
    const p = pnl([site], { from, to })
    if (!p.ca || p.net >= 0) break
    streak++
  }
  return streak
}

export type Status = 'Rentable' | 'À surveiller' | 'Déficitaire'
export const statusOf = (p: PnL, growth: number): Status =>
  p.net < 0 ? 'Déficitaire' : p.rate < PERF_PARAMS.rentableRate || growth < PERF_PARAMS.declineGrowth ? 'À surveiller' : 'Rentable'
export const statusTone = (s: Status) => (s === 'Rentable' ? 'ok' : s === 'À surveiller' ? 'warn' : 'danger')
export const growthOf = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : 0)

// Découpage de la période pour les courbes : par jour (≤ 31 j), par semaine (≤ 120 j) ou par mois.
export function buckets(r: Range) {
  const days = Math.round((r.to - r.from) / 86400000) + 1
  const unit = days <= 31 ? 'jour' : days <= 120 ? 'semaine' : 'mois'
  const out: { label: string; range: Range }[] = []
  let t = r.from
  while (t <= r.to) {
    const d = new Date(t + 3600000)
    let end: number
    if (unit === 'jour') end = t
    else if (unit === 'semaine') end = Math.min(r.to, t + (6 - ((d.getUTCDay() + 6) % 7)) * 86400000)
    else end = Math.min(r.to, Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, -1))
    out.push({ label: unit === 'mois' ? dayOf(t + 43200000).slice(3) : dayOf(t + 43200000).slice(0, 5), range: { from: t, to: end } })
    t = end + 86400000
  }
  return { unit, items: out }
}

// ——— Performance individuelle ———

export type Metric = { key: string; label: string; unit: string; kind: 'count' | 'rate' | 'amount'; good: 'high' | 'low'; threshold?: number; decimals?: number }
export const ROLE_METRICS: Partial<Record<Role, Metric[]>> = {
  boulanger: [
    { key: 'eps', label: 'Rendement moyen', unit: 'EPS/sac', kind: 'rate', good: 'high', threshold: 400 },
    { key: 'petrissees', label: 'Pétrissées', unit: '', kind: 'count', good: 'high' },
    { key: 'consoGap', label: 'Écart de consommation', unit: '%', kind: 'rate', good: 'low', decimals: 1 },
    { key: 'alerts', label: 'Alertes le concernant', unit: '', kind: 'count', good: 'low' },
  ],
  enfourneur: [
    { key: 'rate', label: 'Taux de rebut moyen', unit: '%', kind: 'rate', good: 'low', threshold: 2, decimals: 2 },
    { key: 'lots', label: 'Lots cuits', unit: '', kind: 'count', good: 'high' },
    { key: 'equality', label: 'Égalité pâtons = conformes + rebuts', unit: '%', kind: 'rate', good: 'high' },
    { key: 'alerts', label: 'Alertes', unit: '', kind: 'count', good: 'low' },
  ],
  patissier: [
    { key: 'yieldGap', label: 'Écart au rendement recette', unit: 'pts', kind: 'rate', good: 'low', decimals: 1 },
    { key: 'rejectRate', label: 'Taux de rebut', unit: '%', kind: 'rate', good: 'low', threshold: 2, decimals: 1 },
    { key: 'lots', label: 'Lots produits', unit: '', kind: 'count', good: 'high' },
    { key: 'expired', label: 'Lots arrivés à péremption', unit: '', kind: 'count', good: 'low' },
  ],
  magasinier: [
    { key: 'moves', label: 'Réceptions et bons de sortie', unit: '', kind: 'count', good: 'high' },
    { key: 'gaps', label: 'Écarts de rapprochement', unit: '', kind: 'count', good: 'low' },
    { key: 'unconfirmed', label: 'Bons non confirmés', unit: '', kind: 'count', good: 'low' },
    { key: 'ruptures', label: 'Ruptures de stock', unit: '', kind: 'count', good: 'low' },
  ],
  boutiquier: [
    { key: 'bdlGaps', label: 'Écarts de réception BDL', unit: '', kind: 'count', good: 'low' },
    { key: 'lossRate', label: 'Taux d’invendus et pertes', unit: '%', kind: 'rate', good: 'low', threshold: 5, decimals: 1 },
    { key: 'blind', label: 'Qualité des réceptions à l’aveugle', unit: '%', kind: 'rate', good: 'high' },
  ],
  caissiere: [
    { key: 'ca', label: 'Chiffre d’affaires encaissé', unit: 'FCFA', kind: 'amount', good: 'high' },
    { key: 'gapAmount', label: 'Écarts de caisse (montant)', unit: 'FCFA', kind: 'amount', good: 'low', threshold: 1000 },
    { key: 'gaps', label: 'Écarts de caisse (nombre)', unit: '', kind: 'count', good: 'low' },
    { key: 'cancels', label: 'Annulations de vente', unit: '', kind: 'count', good: 'low' },
    { key: 'closures', label: 'Clôtures régulières', unit: '%', kind: 'rate', good: 'high' },
  ],
  livreur: [
    { key: 'tourGaps', label: 'Écarts de tournée', unit: '', kind: 'count', good: 'low' },
    { key: 'returnRate', label: 'Taux de retour', unit: '%', kind: 'rate', good: 'low', decimals: 1 },
    { key: 'remit', label: 'Versements conformes', unit: '%', kind: 'rate', good: 'high' },
    { key: 'fuel', label: 'Demandes de carburant', unit: '', kind: 'count', good: 'low' },
  ],
}
export const PERF_ROLES = Object.keys(ROLE_METRICS) as Role[]

type Vals = Record<string, number>
// Formules paramétrables : score de performance (100 = parfait) et score de risque (0 = aucun risque).
const SCORE: Partial<Record<Role, (v: Vals) => number>> = {
  boulanger: v => 70 + Math.min(25, (v.eps - 400) / 6) - 2 * v.consoGap - 5 * v.alerts,
  enfourneur: v => 100 - 8 * v.rate - (100 - v.equality) - 4 * v.alerts,
  patissier: v => 100 - 2 * v.yieldGap - 4 * v.rejectRate - 5 * v.expired,
  magasinier: v => 100 - 8 * v.gaps - 4 * v.unconfirmed - 6 * v.ruptures,
  boutiquier: v => 100 - 8 * v.bdlGaps - 4 * v.lossRate - 0.5 * (100 - v.blind),
  caissiere: v => 100 - 10 * v.gaps - v.gapAmount / 200 - 3 * v.cancels - 0.5 * (100 - v.closures),
  livreur: v => 100 - 10 * v.tourGaps - 1.5 * Math.max(0, v.returnRate - 10) - (100 - v.remit),
}
const RISK: Partial<Record<Role, (v: Vals) => number>> = {
  boulanger: v => 20 * v.alerts + 5 * v.consoGap,
  enfourneur: v => 20 * v.alerts + 5 * (100 - v.equality) + 10 * Math.max(0, v.rate - 2),
  patissier: v => 8 * v.expired + 10 * Math.max(0, v.rejectRate - 2) + 3 * v.yieldGap,
  magasinier: v => 10 * v.gaps + 8 * v.unconfirmed + 5 * v.ruptures,
  boutiquier: v => 10 * v.bdlGaps + 6 * Math.max(0, v.lossRate - 3),
  caissiere: v => 15 * v.gaps + v.gapAmount / 300 + 4 * v.cancels,
  livreur: v => 20 * v.tourGaps + 3 * (100 - v.remit),
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// Valeurs d'octobre 2026 par poste et par site [SITE 1, SITE 2, SITE 3] (SITE 3 : écarts répétés, pertes élevées).
const OCT: Partial<Record<Role, Record<string, [number, number, number]>>> = {
  boulanger: { eps: [547, 468, 402], petrissees: [26, 25, 24], consoGap: [1.25, 2.8, 6.5], alerts: [0, 1, 3] },
  enfourneur: { rate: [1.45, 1.9, 3.6], lots: [26, 25, 24], equality: [100, 100, 96], alerts: [0, 0, 2] },
  patissier: { yieldGap: [0.8, 2.5, 6], rejectRate: [1.2, 1.8, 3.5], lots: [93, 90, 84], expired: [0, 1, 4] },
  magasinier: { moves: [60, 57, 56], gaps: [1, 2, 5], unconfirmed: [0, 1, 3], ruptures: [0, 1, 3] },
  boutiquier: { bdlGaps: [1, 2, 5], lossRate: [2.1, 3.4, 9.2], blind: [99, 97, 90] },
  caissiere: { ca: [5_070_000, 4_140_000, 3_180_000], gapAmount: [1200, 800, 4200], gaps: [1, 1, 4], cancels: [2, 1, 5], closures: [96, 100, 85] },
  livreur: { tourGaps: [0, 1, 3], returnRate: [10, 12, 18], remit: [100, 98, 90], fuel: [1, 1, 2] },
}

// Valeurs mensuelles : septembre et août dérivés d'octobre (SITE 3 se dégrade, SITE 1 et 2 progressent).
function monthValues(role: Role, si: number, mi: number): Vals {
  const k = mi === 2 ? 1 : si === 2 ? (mi === 1 ? 0.85 : 0.7) : (mi === 1 ? 1.08 : 1.15)
  const out: Vals = {}
  ROLE_METRICS[role]!.forEach(m => {
    const v = OCT[role]![m.key][si]
    out[m.key] = m.kind === 'count' && m.good === 'high' ? Math.round(v * (mi === 2 ? 1 : 0.95))
      : m.kind === 'amount' && m.good === 'high' ? Math.round(v * [0.85, 0.9, 1][mi])
      : m.good === 'low' ? +(v * k).toFixed(2) : m.unit === '%' ? Math.min(100, +(v / (k > 1 ? 1 + (k - 1) * 0.05 : 1)).toFixed(1)) : +(v * (2 - k) ** 0.2).toFixed(1)
    if (m.good === 'low' && m.kind === 'count') out[m.key] = Math.round(out[m.key])
  })
  return out
}

export type Employee = User & { site: SiteCode }
export const EMPLOYEES: Employee[] = users.filter(u => PERF_ROLES.includes(u.role) && u.group !== 'DIRECTION GÉNÉRALE').map(u => ({ ...u, site: u.sites[0] }))

// Indicateurs d'un employé sur une période : moyenne pondérée des mois couverts (nombres et montants au prorata des jours).
export function employeePerf(e: Employee, r: Range) {
  const si = PERF_SITES.indexOf(e.site)
  const parts = MONTHS.map(([y, m], mi) => {
    const from = Date.UTC(y, m - 1, 1, -1), to = Date.UTC(y, m, 0, -1)
    const overlap = Math.max(0, (Math.min(to, r.to) - Math.max(from, r.from)) / 86400000 + 1)
    return { mi, share: overlap / ((to - from) / 86400000 + 1), days: overlap }
  }).filter(p => p.days > 0)
  const metrics = ROLE_METRICS[e.role]!
  const vals: Vals = {}
  const totalDays = parts.reduce((a, p) => a + p.days, 0)
  metrics.forEach(m => {
    vals[m.key] = m.kind === 'rate'
      ? parts.reduce((a, p) => a + monthValues(e.role, si, p.mi)[m.key] * p.days, 0) / Math.max(1, totalDays)
      : parts.reduce((a, p) => a + monthValues(e.role, si, p.mi)[m.key] * p.share, 0)
  })
  const score = parts.length ? clamp(SCORE[e.role]!(vals)) : 0
  const risk = parts.length ? clamp(RISK[e.role]!(vals)) : 0
  const history = MONTHS.map(([y, m], mi) => ({ label: `${String(m).padStart(2, '0')}/${y}`, score: clamp(SCORE[e.role]!(monthValues(e.role, si, mi))) }))
  return { vals, score, risk, history, hasData: parts.length > 0 }
}
export const scoreTone = (s: number) => (s >= PERF_PARAMS.scoreGreen ? 'ok' : s >= PERF_PARAMS.scoreOrange ? 'warn' : 'danger')
export const riskTone = (r: number) => (r >= PERF_PARAMS.riskRed ? 'danger' : r >= PERF_PARAMS.riskOrange ? 'warn' : 'ok')
