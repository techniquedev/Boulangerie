import type { Bdl, SiteCode } from './types'
import type { Trace } from './trace'
import type { AtelierCode } from './stock'
import { daysLeft, shopProduct } from './shop'
import { dayOf, dayStartTs, today } from '../lib/format'

// ——— Paramétrage : lignes de production (extensibles sans redéveloppement) ———
// Ajouter une ligne = ajouter une entrée ici (et ses recettes) : le tableau de bord génère le formulaire, les indicateurs et les filtres.

export type ProdLine = {
  code: string; label: string; atelier: AtelierCode; icon: 'cake' | 'milk' | 'ice'
  products: string[]; yieldTheo: number; unitLabel: string; flavors?: string[]
}
export const PROD_LINES: ProdLine[] = [
  { code: 'P', label: 'Pâtisserie', atelier: 'ATL-P', icon: 'cake', products: ['PF-07', 'PF-08', 'PF-09', 'PF-10'], yieldTheo: 97, unitLabel: 'pièces' },
  { code: 'Y', label: 'Yaourts', atelier: 'ATL-YG', icon: 'milk', products: ['PF-11', 'PF-12', 'PF-13'], yieldTheo: 98, unitLabel: 'pots' },
  { code: 'G', label: 'Crèmes glacées', atelier: 'ATL-YG', icon: 'ice', products: ['PF-14', 'PF-15', 'PF-16'], yieldTheo: 98, unitLabel: 'unités', flavors: ['Vanille', 'Chocolat', 'Fraise', 'Coco'] },
]
export const prodLine = (code: string) => PROD_LINES.find(l => l.code === code)!

// Tolérance (points de rendement / % de consommation) au-delà de laquelle un motif est obligatoire.
export const YIELD_TOLERANCE = 5
export const CONSUMPTION_TOLERANCE = 10

export const REJECT_MOTIFS = ['Cuisson ratée', 'Chute / casse', 'Défaut d’aspect', 'Défaut de remplissage', 'Hygiène / contamination', 'Autre'] as const

// ——— Recettes et nomenclatures (lecture seule pour l'opérateur) ———
// Quantités standard par unité produite, en unités de stock du magasin (farine en sacs de 50 kg, le reste en kg, unités ou litres).

export type Recipe = { code: string; shelf: number; ingredients: [string, number][]; note?: string }
export const RECIPES: Recipe[] = [
  { code: 'PF-07', shelf: 2, ingredients: [['MP-01', 0.0006], ['MP-06', 0.5], ['MP-07', 0.02], ['MP-04', 0.03], ['MP-05', 0.01], ['MP-09', 0.002]] },
  { code: 'PF-08', shelf: 1, ingredients: [['MP-01', 0.0012], ['MP-04', 0.01], ['MP-02', 0.001], ['MP-07', 0.005]] },
  { code: 'PF-09', shelf: 3, ingredients: [['MP-01', 0.006], ['MP-04', 0.25], ['MP-06', 4], ['MP-07', 0.15], ['MP-09', 0.005]] },
  { code: 'PF-10', shelf: 3, ingredients: [['MP-01', 0.016], ['MP-04', 0.6], ['MP-06', 10], ['MP-07', 0.4], ['MP-09', 0.012]] },
  { code: 'PF-11', shelf: 14, ingredients: [['MP-05', 0.02], ['MP-04', 0.012], ['MP-09', 0.0005], ['MP-10', 1]] },
  { code: 'PF-12', shelf: 14, ingredients: [['MP-05', 0.02], ['MP-10', 1]] },
  { code: 'PF-13', shelf: 14, ingredients: [['MP-05', 0.08], ['MP-04', 0.04], ['MP-10', 1]], note: 'Pot de 500 ml compté avec les pots + opercules (MP-10).' },
  { code: 'PF-14', shelf: 182, ingredients: [['MP-05', 0.03], ['MP-04', 0.015], ['MP-09', 0.001], ['MP-11', 1]] },
  { code: 'PF-15', shelf: 182, ingredients: [['MP-05', 0.035], ['MP-04', 0.018], ['MP-09', 0.001], ['MP-11', 1]] },
  { code: 'PF-16', shelf: 182, ingredients: [['MP-05', 0.25], ['MP-04', 0.12], ['MP-09', 0.008], ['MP-11', 1]], note: 'Bac familial compté avec les cônes et pots glace (MP-11).' },
]
export const recipe = (code: string) => RECIPES.find(r => r.code === code)!

// Seuil minimum du stock d'atelier, par ingrédient (alerte et message de réapprovisionnement).
export const ATELIER_MIN: Record<string, number> = {
  'MP-01': 0.5, 'MP-02': 0.5, 'MP-04': 10, 'MP-05': 10, 'MP-06': 60, 'MP-07': 3, 'MP-09': 0.3, 'MP-10': 200, 'MP-11': 100,
}

// ——— Lots de production ———

export type PatItem = { code: string; planned: number; produced: number; rejects: number; rejectMotif?: string; flavor?: string; dlc: string }
export type PatFix = { at: string; by: string; motif: string; kind: 'mat' | 'item'; key: string; delta: number }
export type PatLot = {
  id: string; site: SiteCode; line: string; ts: number; fab: string; trace: Trace
  items: PatItem[]; mats: { mp: string; qty: number }[]; yieldTheo: number; motif?: string; corrections: PatFix[]
}
export type PatStatus = 'Créé' | 'Mis en stock' | 'Expédié' | 'Clôturé'
export const PAT_STATUSES: PatStatus[] = ['Créé', 'Mis en stock', 'Expédié', 'Clôturé']

// Consommation théorique de la recette pour des quantités données.
export const theoretical = (items: { code: string; qty: number }[]) => {
  const t: Record<string, number> = {}
  items.forEach(i => recipe(i.code).ingredients.forEach(([mp, q]) => { t[mp] = +((t[mp] || 0) + q * i.qty).toFixed(4) }))
  return t
}

// Valeurs effectives d'un lot (lot d'origine + contre-écritures) et contrôles de rendement.
export function patFigures(l: PatLot) {
  const items = l.items.map(i => ({ ...i, produced: i.produced + l.corrections.filter(c => c.kind === 'item' && c.key === i.code).reduce((s, c) => s + c.delta, 0) }))
  const mats = l.mats.map(m => ({ ...m, qty: +(m.qty + l.corrections.filter(c => c.kind === 'mat' && c.key === m.mp).reduce((s, c) => s + c.delta, 0)).toFixed(4) }))
  const planned = items.reduce((s, i) => s + i.planned, 0)
  const produced = items.reduce((s, i) => s + i.produced, 0)
  const rejects = items.reduce((s, i) => s + i.rejects, 0)
  const theo = theoretical(items.map(i => ({ code: i.code, qty: i.planned })))
  const yieldReal = planned ? (produced / planned) * 100 : 0
  const rejectRate = produced + rejects ? (rejects / (produced + rejects)) * 100 : 0
  const gaps = Object.keys({ ...theo, ...Object.fromEntries(mats.map(m => [m.mp, 0])) }).map(mp => {
    const real = mats.find(m => m.mp === mp)?.qty || 0, t = theo[mp] || 0
    return { mp, theo: t, real, pct: t ? ((real - t) / t) * 100 : real ? 100 : 0 }
  })
  return { items, mats, planned, produced, rejects, theo, gaps, yieldReal, rejectRate, yieldGap: yieldReal - l.yieldTheo }
}
export const needsMotif = (yieldGap: number, gaps: { pct: number }[]) =>
  Math.abs(yieldGap) > YIELD_TOLERANCE || gaps.some(g => Math.abs(g.pct) > CONSUMPTION_TOLERANCE)

// N° de lot : LOT-{ligne}-{AAAAMMJJ}-{n° d'ordre des lots de production du site dans la journée}.
export const nextPatLotId = (line: string, site: string, ts: number, dayLots: number) =>
  `LOT-${line}-${dayOf(ts).split('/').reverse().join('')}-${String(dayLots + 1).padStart(2, '0')}`
// Lot tel qu'il apparaît sur les bordereaux d'expédition des produits frais (préfixe + date de fabrication).
export const shopLotOf = (code: string, fab: string) => `${shopProduct(code)?.prefix || ''}-${fab.split('/').reverse().join('')}`

export const addDaysTo = (day: string, n: number) => dayOf(dayStartTs(day) + 3600000 + n * 86400000)

// ——— Stock de produits finis par lot, après les expéditions du magasin (BDL) ———
// Une ligne de BDL portant un lot est imputée aux lots de même code ; sinon, imputation FEFO sur les lots du produit.

export type PfLot = { lot: PatLot; item: PatItem; shipped: number; remaining: number; lastShip?: number; left: number }
export function pfLots(lots: PatLot[], bdls: Bdl[], site: string, now = Date.now()): PfLot[] {
  const rows: PfLot[] = lots.filter(l => l.site === site).flatMap(l => patFigures(l).items.map(item => ({ lot: l, item, shipped: 0, remaining: item.produced, left: daysLeft(item.dlc, now) })))
    .sort((a, b) => dayStartTs(a.item.dlc) - dayStartTs(b.item.dlc) || a.lot.ts - b.lot.ts)
  bdls.filter(b => b.toSite === site && b.ts && b.ts <= now).sort((a, b) => a.ts! - b.ts!).forEach(b => b.lines.forEach(line => {
    let rest = line.sent
    rows.filter(r => r.item.code === line.code && r.lot.ts < b.ts! && (!line.lot || shopLotOf(r.item.code, r.lot.fab) === line.lot)).forEach(r => {
      const q = Math.min(rest, r.remaining)
      if (q <= 0) return
      r.shipped += q; r.remaining -= q; r.lastShip = b.ts; rest -= q
    })
  }))
  return rows
}

export function patStatus(l: PatLot, pf: PfLot[]): PatStatus {
  if (!l.trace.at) return 'Créé'
  const mine = pf.filter(p => p.lot === l || (p.lot.id === l.id && p.lot.site === l.site))
  if (mine.some(p => p.remaining > 0)) return 'Mis en stock'
  const last = Math.max(...mine.map(p => p.lastShip || 0))
  return last && dayOf(last) === today() ? 'Expédié' : 'Clôturé'
}
