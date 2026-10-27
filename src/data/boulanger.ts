import type { AlertItem, SiteCode } from './types'
import type { DemoState } from './state'
import { EPS_GRAMS, MIN_EPS_PER_BAG } from './production'
import { dayOf, dec, nowStamp, num, pnTs, stampAt, today } from '../lib/format'

// ——— Référentiel ———

export type MatKey = 'farine' | 'levure' | 'sel' | 'glace'

// Unités atelier : farine en sacs de 50 kg, le reste en kg. `perCentral` = unités atelier par unité du magasin central.
export const MATS: { key: MatKey; label: string; unit: string; mp: string; perCentral: number }[] = [
  { key: 'farine', label: 'Farine', unit: 'sac', mp: 'MP-01', perCentral: 1 },   // sac de 50 kg
  { key: 'levure', label: 'Levure', unit: 'kg', mp: 'MP-02', perCentral: 5 },    // carton = 5 kg
  { key: 'sel', label: 'Sel', unit: 'kg', mp: 'MP-03', perCentral: 25 },         // sac de 25 kg
  { key: 'glace', label: 'Glace', unit: 'kg', mp: 'MP-08', perCentral: 20 },     // bloc de 20 kg
]
export const matLabel = (k: MatKey) => MATS.find(m => m.key === k)!.label
export const matQty = (k: MatKey, q: number) => k === 'farine' ? `${dec(q, 2)} sac${q > 1 ? 's' : ''}` : `${dec(q, 2)} kg`

export type Stock = Record<MatKey, number>
export const emptyStock = (): Stock => ({ farine: 0, levure: 0, sel: 0, glace: 0 })

// RG : formats gérés ; « 200 g » figure deux fois dans le cahier des charges, il n'est proposé qu'une fois.
export const FORMATS: { label: string; grams: number }[] = [
  { label: 'Pain 50 g', grams: 50 },
  { label: 'Pain 100 g', grams: 100 },
  { label: 'Pain 150 g', grams: 150 },
  { label: 'Pain 200 g', grams: 200 },
  { label: 'Pain découpé 115 FCFA', grams: 115 },
]

export const BAKERY_SITES: SiteCode[] = ['SIT-01', 'SIT-02', 'SIT-03']
export const deviceFor = (site: string) => ({ 'SIT-01': 'DEV-01', 'SIT-02': 'DEV-02', 'SIT-03': 'DEV-03' } as Record<string, string>)[site] || 'DEV-01'
const siteNo = (site: string) => site.slice(-1)

// Heure (Porto-Novo) du rapprochement automatique de fin de journée.
export const END_OF_DAY_HOUR = 20

// ——— Enregistrements ———

// Traçabilité : auteur, site, appareil, horodatage serveur (vide tant que non synchronisé) et heure locale de saisie.
export type Trace = { author: string; site: SiteCode; device: string; at: string; localAt: string; offline: boolean }

export type BonLine = { mat: MatKey; qty: number; received?: number; motif?: string }
export type BonStatus = 'À confirmer' | 'Confirmé' | 'Refusé'
export type BonSortie = {
  id: string; site: SiteCode; ts: number; issuedAt: string; by: string; lines: BonLine[]
  status: BonStatus; ecart?: boolean; refusal?: string; confirm?: Trace; confirmTs?: number
}

export type Line = { label: string; grams: number; qty: number }
export type LotStatus = 'Créé' | 'Remis au four' | 'Cuit' | 'Mis en stock' | 'Clôturé'
export const LOT_FLOW: LotStatus[] = ['Créé', 'Remis au four', 'Cuit', 'Mis en stock', 'Clôturé']

export type RejectReason = 'Brûlé' | 'Déformé' | 'Tombé' | 'Autre'
export const REJECT_REASONS: RejectReason[] = ['Brûlé', 'Déformé', 'Tombé', 'Autre']
export type CuissonReport = { by: string; at: string; received: number; good: number; rejects: { reason: RejectReason; qty: number; photo: boolean }[] }

// Contre-écriture : la pétrissée d'origine n'est jamais modifiée.
export type Correction = { at: string; by: string; motif: string; kind: 'mat' | 'line'; key: string; delta: number }

export type ProdLot = {
  id: string; site: SiteCode; ts: number; trace: Trace
  mats: { mat: MatKey; qty: number }[]; lines: Line[]
  threshold: number; motif?: string
  status: LotStatus; history: { status: LotStatus; at: string; by: string }[]
  cuisson?: CuissonReport; corrections: Correction[]
}

// ——— Calculs (RG-01) ———

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

// ——— Identifiants ———

export const nextLotId = (lots: ProdLot[], site: SiteCode, ts: number) => {
  const d = dayOf(ts)
  const n = lots.filter(l => l.site === site && dayOf(l.ts) === d).length + 1
  return `LOT-B-S${siteNo(site)}-${d.split('/').reverse().join('')}-${String(n).padStart(2, '0')}`
}

export const nextAlertId = (alerts: AlertItem[]) => {
  const max = alerts.reduce((m, a) => Math.max(m, Number(a.id.split('-').pop()) || 0), 0)
  return `AL-2026-${String(max + 1).padStart(4, '0')}`
}

export const traceFor = (author: string, site: SiteCode, offline: boolean): Trace => {
  const at = nowStamp()
  return { author, site, device: deviceFor(site), at: offline ? '' : at, localAt: at, offline }
}

// Au retour du réseau : horodatage serveur des saisies faites hors-ligne et vidage de la file d'attente.
export function syncPending(s: DemoState): DemoState {
  const at = nowStamp()
  const stamp = (t: Trace) => (t.at ? t : { ...t, at })
  return {
    ...s, offline: false, queue: [],
    lots: s.lots.map(l => (l.trace.at ? l : { ...l, trace: stamp(l.trace) })),
    bonsSortie: s.bonsSortie.map(b => (b.confirm && !b.confirm.at ? { ...b, confirm: stamp(b.confirm) } : b)),
  }
}

// RG : rapprochement de fin de journée, matières sorties du magasin central / matières déclarées consommées.
// Tout écart génère une alerte réservée à la direction (jamais visible du boulanger).
export function reconcileDay(s: DemoState, day: string): DemoState {
  let next = s
  for (const site of BAKERY_SITES) {
    const key = `${site}|${day}`
    if (next.endOfDay.includes(key)) continue
    const out = emptyStock(), used = emptyStock()
    next.bonsSortie.filter(b => b.site === site && b.status === 'Confirmé' && b.confirmTs && dayOf(b.confirmTs) === day)
      .forEach(b => b.lines.forEach(l => { out[l.mat] += l.qty }))
    next.lots.filter(l => l.site === site && dayOf(l.ts) === day)
      .forEach(l => figures(l).mats.forEach(m => { used[m.mat] += m.qty }))
    const gaps = MATS.filter(m => Math.abs(out[m.key] - used[m.key]) > 1e-9)
    const alerts = gaps.length ? [{
      id: nextAlertId(next.alerts), type: 'Écart matières fin de journée', severity: 'Moyenne' as const, value: null,
      detail: `Atelier boulangerie ${site} — ${day} : ${gaps.map(m => `${m.label} sortie ${matQty(m.key, out[m.key])} / consommée ${matQty(m.key, used[m.key])}`).join(' ; ')}`,
      people: 'Magasinier central / boulanger du site', status: 'Nouvelle' as const,
      history: [{ at: nowStamp(), by: 'Système', text: 'Rapprochement automatique de fin de journée.' }],
    }, ...next.alerts] : next.alerts
    next = { ...next, alerts, endOfDay: [...next.endOfDay, key] }
  }
  return next
}

// ——— Données de démonstration (même principe sur les 3 sites, données isolées par site) ———

const TEAMS: { site: SiteCode; baker: string; oven: string; bs: number }[] = [
  { site: 'SIT-01', baker: 'Koffi AGBO', oven: 'Ibrahim MOUSSA', bs: 41 },
  { site: 'SIT-02', baker: 'Moussa LAWANI', oven: 'Denis GANGNI', bs: 51 },
  { site: 'SIT-03', baker: 'Séverin TCHEKPLI', oven: 'Omar GADO', bs: 61 },
]
const CENTRAL = 'Fatima BIO'
const LOW_MOTIFS = ['Farine humide, pâte trop molle : pâtons repris', 'Coupure de courant pendant le pétrissage', 'Pâtons trop lourds au façonnage (balance à recalibrer)']

const at = (ts: number) => stampAt(new Date(ts))
const trace = (author: string, site: SiteCode, ts: number): Trace => ({ author, site, device: deviceFor(site), at: at(ts), localAt: at(ts), offline: false })

// Répartition de la pâte (en poids) entre formats pour atteindre un rendement donné.
const linesFor = (bags: number, perBag: number, with200: boolean): Line[] => {
  const g = bags * perBag * EPS_GRAMS
  const share: [string, number, number][] = with200
    ? [['Pain 150 g', 150, 0.4], ['Pain 100 g', 100, 0.25], ['Pain 50 g', 50, 0.1], ['Pain découpé 115 FCFA', 115, 0.1], ['Pain 200 g', 200, 0.15]]
    : [['Pain 150 g', 150, 0.5], ['Pain 100 g', 100, 0.25], ['Pain 50 g', 50, 0.1], ['Pain découpé 115 FCFA', 115, 0.15]]
  return share.map(([label, grams, p]) => ({ label, grams, qty: Math.round((g * p) / grams) }))
}

const report = (oven: string, ts: number, received: number, burnt: number, deformed: number, fallen: number): CuissonReport => ({
  by: oven, at: at(ts), received, good: received - burnt - deformed - fallen,
  rejects: [{ reason: 'Brûlé', qty: burnt, photo: true }, { reason: 'Déformé', qty: deformed, photo: true }, { reason: 'Tombé', qty: fallen, photo: true }, { reason: 'Autre', qty: 0, photo: false }],
})

const flow = (team: typeof TEAMS[number], t0: number, upTo: LotStatus) => {
  const steps: [LotStatus, number, string][] = [
    ['Créé', t0, team.baker], ['Remis au four', t0 + 60000, team.baker], ['Cuit', t0 + 150 * 60000, team.oven],
    ['Mis en stock', t0 + 160 * 60000, team.oven], ['Clôturé', t0 + 15 * 3600000, 'Système'],
  ]
  return steps.slice(0, LOT_FLOW.indexOf(upTo) + 1).map(([status, ts, by]) => ({ status, at: at(ts), by }))
}

export function seedBakery() {
  const lots: ProdLot[] = []
  const bons: BonSortie[] = []
  const atelier: Record<string, Stock> = {}

  TEAMS.forEach((team, ti) => {
    const { site, baker, oven } = team
    // Historique : 34 jours, une pétrissée par jour hors dimanche.
    for (let d = 34; d >= 1; d--) {
      const t0 = pnTs(d, 3, 40)
      if (new Date(t0 + 3600000).getUTCDay() === 0) continue
      const bags = d % 3 === 0 ? 4 : 3
      const low = (d + ti) % 9 === 4
      const perBag = low ? 368 + ((d * 7 + ti * 5) % 28) : 455 + Math.round(55 * Math.sin(d * 1.7 + ti) + ((d * 13) % 20) + d * 0.3)
      const lines = linesFor(bags, perBag, d % 4 === 1)
      const total = patonsOf(lines)
      lots.push({
        id: `LOT-B-S${siteNo(site)}-${dayOf(t0).split('/').reverse().join('')}-01`, site, ts: t0, trace: trace(baker, site, t0),
        mats: [{ mat: 'farine', qty: bags }, { mat: 'levure', qty: bags * 0.5 }, { mat: 'sel', qty: bags * 0.5 }, { mat: 'glace', qty: bags * 20 }],
        lines, threshold: MIN_EPS_PER_BAG, motif: low ? LOW_MOTIFS[d % 3] : undefined,
        status: 'Clôturé', history: flow(team, t0, 'Clôturé'),
        cuisson: report(oven, t0 + 150 * 60000, total, Math.round(total * 0.008), Math.round(total * 0.004), Math.round(total * 0.002)),
        corrections: [],
      })
    }

    // Pétrissée de démonstration du jour (exemple chiffré du cahier des charges) : 2 200 pâtons, cuite et mise en stock.
    const t0 = pnTs(0, 3, 40)
    lots.push({
      id: nextLotId(lots, site, t0), site, ts: t0, trace: trace(baker, site, t0),
      mats: [{ mat: 'farine', qty: 3 }, { mat: 'levure', qty: 1.5 }, { mat: 'sel', qty: 1.5 }, { mat: 'glace', qty: 60 }],
      lines: [
        { label: 'Pain 150 g', grams: 150, qty: 800 }, { label: 'Pain 100 g', grams: 100, qty: 600 },
        { label: 'Pain 50 g', grams: 50, qty: 500 }, { label: 'Pain découpé 115 FCFA', grams: 115, qty: 300 },
      ],
      threshold: MIN_EPS_PER_BAG, status: 'Mis en stock', history: flow(team, t0, 'Mis en stock'),
      cuisson: report(oven, t0 + 150 * 60000, 2200, 20, 8, 4), corrections: [],
    })

    // Bons de sortie du magasin central vers l'atelier.
    const b = (n: number, daysAgo: number, hh: number, mm: number) => ({ id: `BS-2026-0${team.bs + n}`, site, ts: pnTs(daysAgo, hh, mm), issuedAt: at(pnTs(daysAgo, hh, mm)), by: CENTRAL })
    const confirmed = (daysAgo: number, hh: number, mm: number) => ({ confirm: trace(baker, site, pnTs(daysAgo, hh, mm)), confirmTs: pnTs(daysAgo, hh, mm) })
    bons.push(
      { ...b(0, 2, 2, 30), status: 'Refusé', refusal: 'Sacs de farine mouillés à la livraison', ...confirmed(2, 2, 45),
        lines: [{ mat: 'farine', qty: 3 }, { mat: 'levure', qty: 5 }] },
      { ...b(1, 1, 2, 30), status: 'Confirmé', ecart: true, ...confirmed(1, 2, 50),
        lines: [{ mat: 'farine', qty: 4, received: 4 }, { mat: 'levure', qty: 5, received: 5 }, { mat: 'glace', qty: 80, received: 60, motif: 'Un bloc de glace fondu à l’arrivée' }] },
      { ...b(2, 0, 2, 30), status: 'Confirmé', ...confirmed(0, 2, 50),
        lines: [{ mat: 'farine', qty: 3, received: 3 }, { mat: 'levure', qty: 5, received: 5 }, { mat: 'sel', qty: 25, received: 25 }, { mat: 'glace', qty: 60, received: 60 }] },
      { ...b(3, 0, 5, 15), status: 'À confirmer',
        lines: [{ mat: 'farine', qty: 4 }, { mat: 'levure', qty: 5 }, { mat: 'glace', qty: 60 }] },
    )
    // Stock atelier après la pétrissée du jour : la farine est épuisée, il faut réceptionner le bon en attente.
    atelier[site] = { farine: 0, levure: 4, sel: 27, glace: 0 }
  })

  // Les journées passées sont réputées déjà rapprochées.
  const endOfDay = BAKERY_SITES.flatMap(site => Array.from({ length: 35 }, (_, d) => `${site}|${dayOf(pnTs(d + 1, 12, 0))}`))
  return { lots, bonsSortie: bons, atelier, endOfDay, epsThreshold: MIN_EPS_PER_BAG }
}

export const isToday = (ts: number) => dayOf(ts) === today()
export const fmtPerBag = (v: number) => `${num(v)} EPS/sac`
