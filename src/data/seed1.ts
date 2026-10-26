import type { AlertItem, Bdl } from './types'

export const bdlBase: Bdl[] = [
  { id: 'BDL-2026-0261', to: 'Boutique A (SIT-02)', toSite: 'SIT-02', status: 'Réceptionné avec écart',
    lines: [
      { label: 'Pain standard 150 g', sent: 500, counted: 450 }, { label: 'Pain standard 100 g', sent: 200, counted: 200 },
      { label: 'Croissant', sent: 60, counted: 60 }, { label: 'Yaourt vanille', sent: 60, counted: 60 },
      { label: 'Crème glacée cornet', sent: 40, counted: 40 },
    ] },
  { id: 'BDL-2026-0262', to: 'Boutique B (SIT-03)', toSite: 'SIT-03', status: 'Clôturé (réceptionné conforme)',
    lines: [
      { label: 'Pain standard 150 g', sent: 400, counted: 400 }, { label: 'Pain standard 100 g', sent: 150, counted: 150 },
      { label: 'Éclair vanille', sent: 50, counted: 50 }, { label: 'Yaourt (vanille/nature)', sent: 80, counted: 80 },
    ] },
  { id: 'BDL-2026-0263', to: 'Livreur Sani DAOUDA — tournée (US-26)', toSite: null, status: 'Émis → En transit',
    lines: [{ label: 'Pain standard 150 g', sent: 200 }, { label: 'Yaourt (vanille/nature)', sent: 50 }],
    note: 'Chargement de tournée' },
]

export const alertBase: AlertItem[] = [
  { id: 'AL-2026-0088', type: 'Écart BDL', severity: 'Haute', value: 7500,
    detail: 'BDL-2026-0261 : 50 pains 150 g manquants × 150 FCFA',
    people: 'Fatima BIO (magasinière) / Junior AHOUANVOEDO (boutiquier)', status: 'En investigation',
    history: [
      { at: '26/10/2026 07:12', by: 'Système', text: 'Alerte générée automatiquement — statut « Nouvelle ».' },
      { at: '26/10/2026 09:05', by: 'Dr Carine SODJI', text: 'Passée « En investigation ». Premier commentaire : vérification du chargement et du comptage en cours.' },
    ] },
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
