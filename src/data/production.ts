export const EPS_GRAMS = 146            // RG-01
export const MIN_EPS_PER_BAG = 400      // seuil global (US-16)
export const REJECT_THRESHOLD = 2       // % rebut acceptable

export type DoughLine = { code: string; label: string; qty: number; grams: number }

export const boulLot = {
  id: 'LOT-B-20261026-01', by: 'Koffi AGBO', at: '26/10/2026 03:40', source: 'BS-2026-041', recipe: 'R-BOUL-01 v2',
  bags: 3, status: 'Créé → Remis au four',
  lines: [
    { code: 'PF-01', label: 'Pain standard 150 g', qty: 800, grams: 150 },
    { code: 'PF-02', label: 'Pain standard 100 g', qty: 600, grams: 100 },
    { code: 'PF-03', label: 'Pain standard 50 g', qty: 500, grams: 50 },
    { code: 'PF-04', label: 'Pain découpé 115 g', qty: 300, grams: 115 },
  ] as DoughLine[],
}

export const doughKg = (lines: DoughLine[]) => lines.reduce((s, l) => s + l.qty * l.grams, 0) / 1000
export const epsOf = (kg: number) => (kg * 1000) / EPS_GRAMS
export const rejectRate = (rejects: number, total: number) => (total ? (rejects / total) * 100 : 0)

export const cuissonLot = {
  id: 'LC-2026-041', by: 'Ibrahim MOUSSA', received: 2200, good: 2168, status: 'Cuit → Mis en stock (STK-PF)',
  rejects: [
    { reason: 'Brûlés', qty: 20, photo: true },
    { reason: 'Déformés', qty: 8, photo: true },
    { reason: 'Tombés', qty: 4, photo: true },
  ],
}

export const otherLots = [
  { id: 'LOT-P-20261026-02', line: 'Pâtisserie', by: 'Grâce DOSSOU', dlc: '—',
    items: [{ code: 'PF-09', label: 'Gâteau moyen 20 cm', qty: 40 }, { code: 'PF-07', label: 'Éclair vanille', qty: 100 }, { code: 'PF-08', label: 'Beignet sucré', qty: 150 }] },
  { id: 'LOT-Y-20261026-03', line: 'Yaourts', by: 'Grâce DOSSOU', dlc: '09/11/2026',
    items: [{ code: 'PF-11', label: 'Yaourt vanille', qty: 300 }, { code: 'PF-12', label: 'Yaourt nature', qty: 200 }] },
  { id: 'LOT-G-20261026-04', line: 'Glaces', by: 'Grâce DOSSOU', dlc: '26/04/2027',
    items: [{ code: 'PF-14', label: 'Crème glacée cornet', qty: 200 }, { code: 'PF-15', label: 'Crème glacée pot', qty: 150 }] },
]

export const receptions = [
  { id: 'REC-2026-10-25-014', date: '25/10/2026', supplier: 'Minoterie du Bénin SA (FR-01)', invoice: 'FAC-FR01-0261', by: 'Fatima BIO',
    lines: 'MP-01 : 20 sacs · MP-02 : 4 cartons', status: 'Réceptionné', note: 'Stock MAG-MP incrémenté, historique conservé pour audit.' },
  { id: 'REC-2026-10-25-015', date: '25/10/2026', supplier: 'Embal Plus SARL (FR-03)', invoice: '—', by: 'Fatima BIO',
    lines: 'Emballages, pots, cônes (MP-10, MP-11)', status: 'En attente de rapprochement facture', note: 'Cycle d’achat US-32.' },
]

export const bonsSortie = [
  { id: 'BS-2026-041', to: 'ATL-B', by: 'Fatima BIO', confirmedBy: 'Koffi AGBO', status: 'Confirmé par l’atelier',
    lines: '3 sacs de farine (150 kg) · 1,5 kg de levure · 1,5 kg de sel · 3 blocs de glace (60 kg)' },
  { id: 'BS-2026-042', to: 'ATL-YG', by: 'Fatima BIO', confirmedBy: 'Grâce DOSSOU', status: 'Confirmé par l’atelier',
    lines: 'Lait en poudre 12 kg · sucre 8 kg · 320 pots MP-10' },
]

export const recipeVersions = [
  { v: 'v2', since: '01/10/2026', note: 'Version active. Pour 1 sac de 50 kg de farine : 0,5 kg levure, 0,5 kg sel, 20 kg glace. Rendement théorique ≥ 400 EPS.' },
  { v: 'v1', since: 'avant le 01/10/2026', note: 'Les lots produits avant le 01/10/2026 restent rattachés à la v1.' },
]
