import type { SiteCode } from './types'
import type { Trace } from './trace'
import { deviceFor } from './trace'
import { EPS_GRAMS, MIN_EPS_PER_BAG } from './production'
import { figures, lotIdFor, LOT_FLOW, mpOf, patonsOf, type CuissonReport, type Line, type LotStatus, type MatKey, type ProdLot } from './boulanger'
import {
  BS, fmtQty, matName, nextReceptionId, siteMat, SITE_MATS, workshopKey,
  type AtelierCode, type BonSortie, type Movement, type MoveKind, type Reception, type Reconcile, type Treatment,
} from './stock'
import { dayOf, demoTs, stampAt } from '../lib/format'

// Données de démonstration : même principe sur les 3 sites, données isolées par site.
// Journée de démonstration : lundi 26/10/2026 ; historique sur les 30 jours précédents.

const TEAMS: { site: SiteCode; store: string; baker: string; oven: string; pat: string }[] = [
  { site: 'SIT-01', store: 'Yacoubou BALOGO', baker: 'Koffi AGBO', oven: 'Ibrahim MOUSSA', pat: 'Sandrine KPOSSOU' },
  { site: 'SIT-02', store: 'Aïchatou BANKOULÉ', baker: 'Moussa LAWANI', oven: 'Denis GANGNI', pat: 'Édith HOUNNOU' },
  { site: 'SIT-03', store: 'Nadège AÏSSAN', baker: 'Séverin TCHEKPLI', oven: 'Omar GADO', pat: 'Reine AZON' },
]
const HISTORY_DAYS = 30
const LOW_MOTIFS = ['Farine humide, pâte trop molle : pâtons repris', 'Coupure de courant pendant le pétrissage', 'Pâtons trop lourds au façonnage (balance à recalibrer)']

// Stock du magasin de site visé au soir du 25/10/2026 (sucre et glace passent sous le minimum le 26/10).
const TARGET: Record<string, number> = {
  'MP-01': 8, 'MP-02': 12, 'MP-03': 60, 'MP-04': 120, 'MP-05': 70, 'MP-06': 480, 'MP-07': 40,
  'MP-08': 140, 'MP-09': 4, 'MP-10': 2400, 'MP-11': 900, 'MP-12': 1500,
}

const at = (ts: number) => stampAt(new Date(ts))
const trace = (author: string, site: SiteCode, ts: number): Trace => ({ author, site, device: deviceFor(site), at: at(ts), localAt: at(ts), offline: false })
const sunday = (ts: number) => new Date(ts + 3600000).getUTCDay() === 0

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

const flow = (baker: string, oven: string, t0: number, upTo: LotStatus) => {
  const steps: [LotStatus, number, string][] = [
    ['Créé', t0, baker], ['Remis au four', t0 + 60000, baker], ['Cuit', t0 + 150 * 60000, oven],
    ['Mis en stock', t0 + 160 * 60000, oven], ['Clôturé', t0 + 15 * 3600000, 'Système'],
  ]
  return steps.slice(0, LOT_FLOW.indexOf(upTo) + 1).map(([status, ts, by]) => ({ status, at: at(ts), by }))
}

type RecSpec = [mp: string, unit: string, ordered: number | null, received: number, remark?: string]
type BonOpts = { confirmTs?: number; confirmBy?: string; received?: Record<string, number>; motif?: string; refusal?: string; treatment?: Treatment[] }

export function seedSites() {
  const lots: ProdLot[] = []
  const bons: BonSortie[] = []
  const receptions: Reception[] = []
  const movements: Movement[] = []
  const workshop: Record<string, Record<string, number>> = {}
  const endOfDay: string[] = []

  TEAMS.forEach((team, ti) => {
    const { site, store, baker, oven, pat } = team
    const siteMoves: Omit<Movement, 'id'>[] = []
    const siteBons: BonSortie[] = []
    const inv: Record<string, number> = { 'FR-01': 240, 'FR-02': 88, 'FR-03': 70, 'FR-04': 120 }

    const move = (mp: string, qty: number, kind: MoveKind, ref: string, ts: number, author: string, motif?: string) =>
      siteMoves.push({ site, mp, loc: siteMat(mp).loc, qty, kind, ref, ts, trace: trace(author, site, ts), motif })
    const ws = (atl: string, mp: string, q: number) => {
      const k = workshopKey(site, atl)
      workshop[k] = { ...(workshop[k] || {}), [mp]: +(((workshop[k] || {})[mp] || 0) + q).toFixed(4) }
    }

    const addRec = (ts: number, supplier: string, specs: RecSpec[], opts: { invoiceNo?: string; complementOf?: string } = {}) => {
      const invoiceNo = opts.invoiceNo || `FAC-${supplier.replace('-', '')}-${String(++inv[supplier]).padStart(4, '0')}`
      const r: Reception = {
        id: nextReceptionId(receptions, site, ts), site, supplier, invoiceNo, invoiceRef: `BL-${supplier.replace('-', '')}-${(ts / 60000) % 9000 | 0}`,
        deliveryDate: dayOf(ts), ts, complementOf: opts.complementOf, photos: [], trace: trace(store, site, ts),
        lines: specs.map(([mp, unit, ordered, received, remark]) => ({ mp, unit, f: siteMat(mp).units.find(u => u.u === unit)!.f, ordered, received, remark })),
      }
      receptions.push(r)
      r.lines.forEach(l => move(l.mp, l.received * l.f, 'Entrée (réception)', r.id, ts, store))
      return r
    }

    const addBon = (ts: number, atelier: AtelierCode, lines: [string, number][], o: BonOpts = {}) => {
      const b: BonSortie = {
        id: '', site, atelier, ts, by: store, trace: trace(store, site, ts), status: BS.emis,
        lines: lines.map(([mp, qty]) => ({ mp, qty })),
      }
      lines.forEach(([mp, qty]) => move(mp, -qty, 'Sortie (bon atelier)', '', ts, store))
      if (o.confirmTs) {
        b.lines = b.lines.map(l => {
          const received = o.refusal ? 0 : o.received?.[l.mp] ?? l.qty
          ws(atelier, l.mp, received)
          return { ...l, received, motif: received < l.qty ? o.motif : undefined }
        })
        b.status = o.refusal ? BS.refus : BS.conf
        b.ecart = b.lines.some(l => (l.received ?? l.qty) < l.qty)
        b.refusal = o.refusal
        b.confirm = trace(o.confirmBy || (atelier === 'ATL-B' ? baker : pat), site, o.confirmTs)
        b.confirmTs = o.confirmTs
      }
      b.treatment = o.treatment
      siteBons.push(b)
      return b
    }

    const addLot = (t0: number, mats: [MatKey, number][], lines: Line[], upTo: LotStatus, motif?: string, rej = [0.008, 0.004, 0.002]) => {
      const total = patonsOf(lines)
      const lot: ProdLot = {
        id: lotIdFor(site, t0, 1), site, ts: t0, trace: trace(baker, site, t0),
        mats: mats.map(([mat, qty]) => ({ mat, qty })), lines, threshold: MIN_EPS_PER_BAG, motif,
        status: upTo, history: flow(baker, oven, t0, upTo),
        cuisson: report(oven, t0 + 150 * 60000, total, Math.round(total * rej[0]), Math.round(total * rej[1]), Math.round(total * rej[2])),
        corrections: [],
      }
      lots.push(lot)
      mats.forEach(([m, q]) => ws('ATL-B', mpOf(m), -q))
      return lot
    }

    // Rapprochement de fin de journée des bons boulangerie confirmés (jours passés).
    const closeDay = (d: number, dayBons: BonSortie[], lot: ProdLot) => {
      const out: Record<string, number> = {}, used: Record<string, number> = {}
      dayBons.forEach(b => b.lines.forEach(l => { out[l.mp] = (out[l.mp] || 0) + l.qty }))
      figures(lot).mats.forEach(m => { used[mpOf(m.mat)] = (used[mpOf(m.mat)] || 0) + m.qty })
      const gaps = SITE_MATS.filter(m => Math.abs((out[m.mp] || 0) - (used[m.mp] || 0)) > 1e-6)
      const rec: Reconcile = {
        at: at(demoTs(d, 20, 0)), result: gaps.length ? 'Écart à traiter' : 'Conforme',
        detail: gaps.length ? gaps.map(m => `${matName(m.mp)} : sorti ${fmtQty(m.mp, out[m.mp] || 0)} / consommé ${fmtQty(m.mp, used[m.mp] || 0)}`).join(' ; ') : 'Sorties du jour égales aux consommations déclarées.',
      }
      dayBons.forEach(b => { b.status = BS.clos; b.reconcile = rec })
      endOfDay.push(`${site}|${dayOf(demoTs(d, 12, 0))}`)
    }

    // ——— Historique ———
    for (let d = HISTORY_DAYS; d >= 1; d--) {
      if (sunday(demoTs(d, 12, 0))) continue
      const bags = d % 3 === 0 ? 4 : 3
      const mats: [MatKey, number][] = [['farine', bags], ['levure', bags * 0.5], ['sel', bags * 0.5], ['glace', bags * 20]]
      const dayBons: BonSortie[] = []

      if (d === 2) addBon(demoTs(d, 2, 20), 'ATL-B', [['MP-01', 3], ['MP-02', 5]], {
        confirmTs: demoTs(d, 2, 30), refusal: 'Sacs de farine mouillés à la livraison',
        treatment: [{ at: at(demoTs(d, 9, 0)), by: store, kind: 'Contre-écriture', text: 'Retour au magasin des 3 sacs et 5 kg de levure (sacs mis à sécher, contrôle qualité demandé)' }],
      })
      // Écart signalé par l'atelier : un bloc de glace fondu (traité le 13e jour, en attente le 6e).
      const meltDay = d === 6 || d === 13
      dayBons.push(addBon(demoTs(d, 2, 40), 'ATL-B', [['MP-01', bags], ['MP-02', bags * 0.5], ['MP-03', bags * 0.5], ['MP-08', bags * 20 + (meltDay ? 20 : 0)]], {
        confirmTs: demoTs(d, 2, 50), received: meltDay ? { 'MP-08': bags * 20 } : undefined, motif: 'Un bloc de glace fondu à l’arrivée',
        treatment: d === 13 ? [{ at: at(demoTs(d - 1, 8, 30)), by: store, kind: 'Justification', text: 'Bloc fondu pendant le transport : perte constatée, fournisseur de glace prévenu' }] : undefined,
      }))

      const low = (d + ti) % 9 === 4
      const perBag = low ? 368 + ((d * 7 + ti * 5) % 28) : 455 + Math.round(55 * Math.sin(d * 1.7 + ti) + ((d * 13) % 20) + d * 0.3)
      const t0 = demoTs(d, 3, 40)
      const lot = addLot(t0, mats, linesFor(bags, perBag, d % 4 === 1), 'Clôturé', low ? LOW_MOTIFS[d % 3] : undefined)
      closeDay(d, dayBons, lot)

      if (d % 7 === 2) addBon(demoTs(d, 6, 0), 'ATL-P', [['MP-01', 1], ['MP-04', 10], ['MP-06', 60], ['MP-07', 5]], { confirmTs: demoTs(d, 6, 20) })
      if (d % 7 === 4) addBon(demoTs(d, 6, 10), 'ATL-YG', [['MP-05', 12], ['MP-04', 8], ['MP-10', 320]], { confirmTs: demoTs(d, 6, 30) })

      if (d % 7 === 0) addRec(demoTs(d, 7, 30), 'FR-01', [['MP-01', 'sac', 20, 20], ['MP-02', 'carton', 2, 2]])
      if (d % 14 === 3) addRec(demoTs(d, 8, 0), 'FR-04', [['MP-04', 'sac 50 kg', 1, 1], ['MP-03', 'sac 25 kg', 1, 1]])
      if (d % 7 === 5) addRec(demoTs(d, 8, 30), 'FR-02', [['MP-05', 'carton 25 kg', 1, 1], ['MP-06', 'plateau 30', 2, 2]])
      if (d % 7 === 1 || d % 7 === 5) addRec(demoTs(d, 9, 0), 'FR-02', [['MP-08', 'bloc 20 kg', 16, 16]])
      if (d === 10) addRec(demoTs(d, 10, 0), 'FR-04', [['MP-04', 'sac 50 kg', 2, 1, 'Le camion n’avait qu’un sac : le second livré plus tard']], { invoiceNo: 'FAC-FR04-0131' })
      if (d === 9) addRec(demoTs(d, 10, 0), 'FR-04', [['MP-04', 'sac 50 kg', 1, 1, 'Complément de la facture FAC-FR04-0131']], { invoiceNo: 'FAC-FR04-0131', complementOf: receptions.find(r => r.site === site && r.invoiceNo === 'FAC-FR04-0131')!.id })
      if (d === 4) addRec(demoTs(d, 10, 30), 'FR-03', [['MP-11', 'carton 500', 2, 1, 'Rupture chez le fournisseur : 1 carton en reliquat']], { invoiceNo: 'FAC-FR03-0077' })
    }

    // ——— Journée du 26/10/2026 (exemples chiffrés du cahier des charges) ———
    const d0 = (hh: number, mm: number) => demoTs(0, hh, mm)
    addBon(d0(2, 30), 'ATL-B', [['MP-01', 3], ['MP-02', 1.5], ['MP-03', 1.5], ['MP-08', 60]], { confirmTs: d0(2, 50) })
    addBon(d0(5, 0), 'ATL-YG', [['MP-05', 12], ['MP-04', 8], ['MP-10', 320]])
    addLot(d0(3, 40), [['farine', 3], ['levure', 1.5], ['sel', 1.5], ['glace', 60]], [
      { label: 'Pain 150 g', grams: 150, qty: 800 }, { label: 'Pain 100 g', grams: 100, qty: 600 },
      { label: 'Pain 50 g', grams: 50, qty: 500 }, { label: 'Pain découpé 115 FCFA', grams: 115, qty: 300 },
    ], 'Mis en stock', undefined, [20 / 2200, 8 / 2200, 4 / 2200])
    addRec(d0(6, 30), 'FR-04', [['MP-03', 'sac 25 kg', 2, 2]])
    addRec(d0(7, 0), 'FR-03', [['MP-10', 'carton 1 000', 2, 1, 'Second carton annoncé pour la semaine prochaine']])
    addRec(d0(7, 30), 'FR-01', [['MP-01', 'sac', 20, 20], ['MP-02', 'carton', 4, 4]], { invoiceNo: 'FAC-FR01-0261' })
    // Bon complémentaire en attente : permet à l'atelier boulangerie de confirmer une réception puis de saisir une pétrissée.
    addBon(d0(8, 0), 'ATL-B', [['MP-01', 4], ['MP-02', 5], ['MP-03', 5], ['MP-08', 60]])

    // Numérotation : l'historique se termine à BS-2026-040, la journée du 26/10 commence à BS-2026-041.
    const hist = siteBons.filter(b => b.ts < demoTs(0, 0, 0)).sort((a, b) => a.ts - b.ts)
    const today = siteBons.filter(b => b.ts >= demoTs(0, 0, 0)).sort((a, b) => a.ts - b.ts)
    hist.forEach((b, i) => { b.id = `BS-2026-${String(41 - hist.length + i).padStart(3, '0')}` })
    today.forEach((b, i) => { b.id = `BS-2026-${String(41 + i).padStart(3, '0')}` })
    bons.push(...siteBons)
    // Les sorties référencent leur bon (même instant, même site).
    siteMoves.forEach(m => { if (m.kind === 'Sortie (bon atelier)') m.ref = siteBons.find(b => b.ts === m.ts)!.id })
    // Retour au magasin après le bon refusé (contre-écriture tracée).
    const refused = siteBons.find(b => b.status === BS.refus)!
    refused.lines.forEach(l => siteMoves.push({ site, mp: l.mp, loc: siteMat(l.mp).loc, qty: l.qty, kind: 'Contre-écriture', ref: refused.id, ts: demoTs(2, 9, 0), trace: trace(store, site, demoTs(2, 9, 0)), motif: 'Retour au magasin des matières refusées par l’atelier' }))

    // Inventaire d'ouverture : couvre tout l'historique sans stock négatif et atteint le niveau visé au 25/10.
    siteMoves.sort((a, b) => a.ts - b.ts)
    const opening: Record<string, number> = {}
    SITE_MATS.forEach(m => {
      let run = 0, min = 0, net25 = 0
      siteMoves.filter(x => x.mp === m.mp).forEach(x => { run += x.qty; min = Math.min(min, run); if (x.ts < demoTs(0, 0, 0)) net25 += x.qty })
      opening[m.mp] = +Math.max(-min, TARGET[m.mp] - net25).toFixed(4)
    })
    const t0 = demoTs(HISTORY_DAYS + 1, 18, 0)
    SITE_MATS.forEach(m => siteMoves.unshift({ site, mp: m.mp, loc: m.loc, qty: opening[m.mp], kind: 'Inventaire d’ouverture', ref: 'INV-OUV-2026-09', ts: t0, trace: trace(store, site, t0) }))
    movements.push(...siteMoves.map((m, i) => ({ ...m, id: `MVT-S${site.slice(-1)}-${String(i + 1).padStart(5, '0')}` })))
  })

  return { lots, bonsSortie: bons, receptions, movements, workshop, endOfDay, epsThreshold: MIN_EPS_PER_BAG }
}
