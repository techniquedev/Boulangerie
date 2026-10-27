import type { AlertItem, Bdl } from './types'

// BDL des boutiques : voir seedShop.ts (même principe sur les 3 sites). Seul le chargement de tournée reste ici.
export const bdlBase: Bdl[] = [
  { id: 'BDL-2026-0263', to: 'Livreur Sani DAOUDA — tournée (US-26)', toSite: null, status: 'Émis → En transit',
    lines: [{ label: 'Pain standard 150 g', sent: 200 }, { label: 'Yaourt (vanille/nature)', sent: 50 }],
    note: 'Chargement de tournée' },
]

// AL-2026-0086 à 0088 (écarts BDL des boutiques) : voir seedShop.ts.
export const alertBase: AlertItem[] = [
  { id: 'AL-2026-0089', type: 'Péremption (J-2)', severity: 'Moyenne', value: null,
    detail: 'Lot de yaourts Y-20261012 — DLC 28/10/2026 (RG-11, FEFO)',
    people: 'Stock yaourts', status: 'Nouvelle',
    history: [{ at: '26/10/2026 06:00', by: 'Système', text: 'Alerte de péremption J-2 générée.' }] },
  { id: 'AL-2026-0090', type: 'Écart de caisse', severity: 'Moyenne', value: 1200,
    detail: 'CAISSE-A-20261026 : compté 83 800 FCFA, théorique 85 000 FCFA (écart −1 200 FCFA, seuil 1 000 FCFA)',
    people: 'Junior AHOUANVOEDO (boutiquier)', status: 'Nouvelle',
    history: [{ at: '26/10/2026 18:30', by: 'Système', text: 'Alerte générée à la clôture de caisse.' }] },
]

export const alertFlow = ['Nouvelle', 'En investigation', 'Justifiée / Imputée', 'Clôturée']
