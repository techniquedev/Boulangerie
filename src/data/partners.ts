import type { Param, Supplier, WholesaleClient } from './types'

export const suppliers: Supplier[] = [
  { code: 'FR-01', name: 'Minoterie du Bénin SA', specialty: 'Farine', terms: 'Achat à facture, échéance J+15' },
  { code: 'FR-02', name: 'Laiterie Sèmè', specialty: 'Lait, yaourt base', terms: 'Comptant' },
  { code: 'FR-03', name: 'Embal Plus SARL', specialty: 'Emballages, pots, cônes', terms: 'J+30' },
  { code: 'FR-04', name: 'Sucre & Négoce Atlantique', specialty: 'Sucre, sel, arômes', terms: 'J+15' },
]

export const clients: WholesaleClient[] = [
  { code: 'CL-G01', name: 'Revendeuse Maman Alice — marché Dantokpa', ceiling: 500000, outstanding: 320000, statement: '1 facture échue de 85 000 FCFA (J-5)' },
  { code: 'CL-G02', name: 'Restaurant Le Ruisseau', ceiling: 300000, outstanding: 90000, statement: 'À jour' },
  { code: 'CL-G03', name: 'Hôtel Laguna Beach', ceiling: 1000000, outstanding: 0, statement: 'À jour' },
  { code: 'CL-G04', name: 'Kiosque Mama Bénédicte — Cotonou', ceiling: 50000, outstanding: 46500, statement: 'Proche du plafond' },
]

export const drivers = [
  { code: 'LV-01', name: 'Sani DAOUDA', note: 'Compte n°8' },
  { code: 'LV-02', name: 'Moussa BAKO', note: 'Second livreur, sans compte de connexion démo' },
]

export const params: Param[] = [
  { label: 'Rendement minimum boulangerie', value: '400 EPS/sac', override: '—' },
  { label: 'Taux de rebut acceptable', value: '2 %', override: '—' },
  { label: 'Tolérance écart BDL', value: '0 unité', override: 'Yaourts : 2 unités par BDL' },
  { label: 'Seuil d’alerte écart de caisse', value: '1 000 FCFA', override: '—' },
  { label: 'Alerte péremption (FEFO)', value: 'J-2 puis J-1', override: '—' },
]
