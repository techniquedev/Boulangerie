import type { PeriodMode } from '../components/PeriodFilter'

// Données fictives de démonstration pour l'espace Directeur général.
// Elles ne complètent un site que lorsque les données réelles de la période sont vides (valeur à 0).

type SiteDemo = {
  ca: number; bags: number; eps: number; lots: number; good: number; rejects: number
  P: number; Y: number; G: number; storeValue: number; pending: number; toTreat: number
  transit: number; gaps: number; rupture: number; lossQty: number; lossValue: number
  tours: { id: string; driver: string; status: string; delivered: string; cash: number; momo: number; balanced: boolean }[]
}

// Chiffres journaliers de référence par site
const BASE: Record<string, SiteDemo> = {
  'SIT-01': {
    ca: 186500, bags: 4, eps: 2260, lots: 4, good: 2190, rejects: 38, P: 140, Y: 96, G: 48, storeValue: 1845000, pending: 1, toTreat: 0,
    transit: 1, gaps: 0, rupture: 1, lossQty: 12, lossValue: 3600,
    tours: [
      { id: 'TRN-101', driver: 'Koffi DOSSOU', status: 'Soldée', delivered: '320/320 · 80/80', cash: 64000, momo: 28500, balanced: true },
      { id: 'TRN-102', driver: 'Rachidi BELLO', status: 'En cours', delivered: '210/260 · 40/50', cash: 31500, momo: 12000, balanced: true },
    ],
  },
  'SIT-02': {
    ca: 142000, bags: 3, eps: 1680, lots: 3, good: 1625, rejects: 31, P: 110, Y: 72, G: 36, storeValue: 1320000, pending: 2, toTreat: 1,
    transit: 0, gaps: 1, rupture: 2, lossQty: 9, lossValue: 2700,
    tours: [
      { id: 'TRN-201', driver: 'Sèna HOUNKPÈ', status: 'Soldée avec écart', delivered: '250/260 · 60/60', cash: 47500, momo: 21000, balanced: false },
    ],
  },
  'SIT-03': {
    ca: 158500, bags: 3, eps: 1590, lots: 3, good: 1540, rejects: 27, P: 95, Y: 84, G: 30, storeValue: 1190000, pending: 0, toTreat: 0,
    transit: 1, gaps: 0, rupture: 0, lossQty: 6, lossValue: 1800,
    tours: [
      { id: 'TRN-301', driver: 'Fidèle AGOSSA', status: 'Soldée', delivered: '280/280 · 70/70', cash: 52000, momo: 26500, balanced: true },
      { id: 'TRN-302', driver: 'Mariam SALIFOU', status: 'Chargée', delivered: '0/240 · 0/40', cash: 0, momo: 0, balanced: true },
    ],
  },
}

const SCALE: Record<PeriodMode, number> = { jour: 1, mois: 26, annee: 310, tout: 310 }

// Variation légère et stable selon la période choisie (même période → mêmes chiffres)
function wobble(key: string) {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return 0.88 + (Math.abs(h) % 25) / 100
}

export function siteDemo(site: string, mode: PeriodMode, value: string) {
  const b = BASE[site]
  if (!b) return undefined
  const k = SCALE[mode] * wobble(`${site}|${mode}|${value}`)
  const r = (n: number) => Math.round(n * k)
  const money = (n: number) => Math.round((n * k) / 500) * 500
  return {
    ca: money(b.ca), bags: r(b.bags), eps: r(b.eps), lots: r(b.lots), good: r(b.good), rejects: r(b.rejects),
    patons: r(b.eps), P: r(b.P), Y: r(b.Y), G: r(b.G),
    storeValue: b.storeValue, pending: b.pending, toTreat: b.toTreat, transit: b.transit, gaps: b.gaps, rupture: b.rupture,
    lossQty: r(b.lossQty), lossValue: money(b.lossValue),
    tours: mode === 'jour' ? b.tours : b.tours.map(t => ({ ...t, cash: money(t.cash), momo: money(t.momo), delivered: '—' })),
  }
}
