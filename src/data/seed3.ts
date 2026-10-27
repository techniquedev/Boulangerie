import type { Expense } from './types'
import type { Inventory, Nc, Order, PurchaseRow, Reading, Versement } from './state'

export const expensesBase: Expense[] = [
  { id: 'DÉP-2026-0031', label: 'Demande de carburant livreur', amount: 15000, by: 'Sani DAOUDA', status: 'Rapprochée', photo: true,
    flow: ['Demandée', 'Validée (direction)', 'Payée', 'Rapprochée'] },
  { id: 'DÉP-2026-0032', label: 'Facture d’électricité SBEE', amount: 65000, by: 'Rachel EZIN', status: 'Demandée',
    flow: ['Demandée', 'Validée (direction)', 'Payée', 'Rapprochée'] },
]

export const versementsBase: Versement[] = [
  { id: 'BV-2026-018', site: 'SIT-02', amount: 83800, by: 'Junior AHOUANVOEDO', status: 'Rapprochée banque',
    flow: ['Versée', 'Reçue au bureau central', 'Rapprochée banque'], bank: 'BOA', ref: 'BOA-2610-7741' },
]

export const inventoryBase: Inventory = {
  id: 'INV-2026-006', location: 'MAG-MP — Magasin matières premières', status: 'En attente de validation direction',
  lines: [
    { code: 'MP-01', label: 'Farine de blé type 55 (sacs)', theoretical: 27, counted: 25, unit: 28500 },
    { code: 'MP-02', label: 'Levure boulangère (cartons)', theoretical: 3, counted: 3, unit: 9000 },
    { code: 'MP-03', label: 'Sel alimentaire (sacs)', theoretical: 5, counted: 5, unit: 8000 },
    { code: 'MP-04', label: 'Sucre en poudre (sacs)', theoretical: 6, counted: 6, unit: 32000 },
  ],
}

export const ncsBase: Nc[] = [
  { id: 'NC-2026-007', subject: 'Chambre froide CF-01 : 6,2 °C hors plage (2–4 °C)', status: 'Ouverte', blocks: 'Y-20261018', at: '26/10/2026 08:00' },
  { id: 'NC-2026-005', subject: 'Chambre froide CF-A : 5,1 °C hors plage', status: 'Clôturée', action: 'Dégivrage et recalibrage du thermostat', at: '19/10/2026 08:00' },
]

export const readingsBase: Reading[] = [
  { id: 'REL-01', place: 'CF-01', at: '26/10/2026 08:00', value: 6.2, min: 2, max: 4 },
  { id: 'REL-02', place: 'CF-A', at: '26/10/2026 08:05', value: 3.1, min: 2, max: 4 },
  { id: 'REL-03', place: 'CF-B', at: '26/10/2026 08:10', value: 3.4, min: 2, max: 4 },
]

export const purchasesBase: PurchaseRow[] = [
  { po: 'BC-2026-044', supplier: 'Minoterie du Bénin SA (FR-01)', ordered: '20 sacs MP-01 + 4 cartons MP-02', received: 'REC-2026-10-25-014', invoice: 'FAC-FR01-0261', status: 'Conforme' },
  { po: 'BC-2026-045', supplier: 'Embal Plus SARL (FR-03)', ordered: 'Pots et cônes', received: 'REC-2026-10-25-015', invoice: '—', status: 'En attente de rapprochement facture' },
  { po: 'BC-2026-046', supplier: 'Sucre & Négoce Atlantique (FR-04)', ordered: '5 sacs MP-04', received: 'REC-2026-10-24-012', invoice: 'FAC-FR04-0118', status: 'Écart bloquant' },
]

export const ordersBase: Order[] = [
  { id: 'CMD-2026-017', client: 'M. DOSSOU', item: 'Gâteau 2 étages (PF-10)', due: '28/10/2026 10:00', deposit: 7500, total: 25000, status: 'En production' },
]

export const orderFlow = ['Brouillon', 'Confirmée', 'En production', 'Prête', 'Livrée', 'Soldée']
