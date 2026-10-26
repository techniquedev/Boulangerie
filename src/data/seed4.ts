import type { AuditEntry, Device, Notification } from './types'

const A = (at: string, author: string, device: string, site: string, action: string, detail: string): AuditEntry =>
  ({ at, localAt: at, author, device, site, action, detail })

export const auditBase: AuditEntry[] = [
  A('26/10/2026 06:45', 'Junior AHOUANVOEDO', 'TAB-SIT02', 'SIT-02', 'Connexion', 'Connexion — ouverture de CAISSE-A-20261026 (fond 10 000 FCFA)'),
  A('26/10/2026 07:12', 'Système', 'Serveur', 'SIT-02', 'Alerte', 'AL-2026-0088 générée (écart BDL-2026-0261)'),
  A('26/10/2026 09:05', 'Dr Carine SODJI', 'PC-DIR', 'SIT-01', 'Alerte', 'AL-2026-0088 : Nouvelle → En investigation'),
  A('26/10/2026 16:22', 'Paul HOUNSA', 'TAB-SIT02', 'SIT-02', 'Annulation de vente', 'Ticket TK-A-0106 (300 FCFA) annulé — motif : erreur de saisie'),
  A('26/10/2026 17:40', 'Awa ADJOVI', 'PC-DIR', 'SIT-01', 'Validation de dépense', 'DÉP-2026-0031 validée (15 000 FCFA)'),
  A('26/10/2026 18:30', 'Système', 'Serveur', 'SIT-02', 'Alerte', 'AL-2026-0090 générée (écart de caisse −1 200 FCFA)'),
  A('26/10/2026 18:42', 'Fatima BIO', 'TAB-SIT01', 'SIT-01', 'Contre-écriture de stock', 'Contre-écriture MAG-MP : −1 sac MP-03 — motif : sac éventré (écriture d’origine conservée)'),
]

export const devicesBase: Device[] = [
  { id: 'DEV-01', label: 'Tablette Android — Site central', site: 'SIT-01', status: 'Actif' },
  { id: 'DEV-02', label: 'Tablette Android — Boutique A', site: 'SIT-02', status: 'Actif' },
  { id: 'DEV-03', label: 'Tablette Android — Boutique B', site: 'SIT-03', status: 'Actif' },
  { id: 'DEV-04', label: 'Smartphone livreur — Sani DAOUDA', site: 'Mobile (SIT-01)', status: 'Actif' },
  { id: 'DEV-05', label: 'Tablette Android volée — ancien site', site: 'SIT-04', status: 'Révoqué', note: 'Déclarée volée, accès révoqué' },
]

export const notificationsBase: Notification[] = [
  { id: 'N1', text: 'BDL-2026-0263 en transit : à réceptionner', roles: ['boutiquier', 'caissiere', 'livreur'], at: '26/10/2026 08:30' },
  { id: 'N2', text: 'Dépense DÉP-2026-0032 (65 000 FCFA) à valider', roles: ['direction'], at: '26/10/2026 11:00' },
  { id: 'N3', text: 'Levure MP-02 sous le stock minimum : bon de commande proposé', roles: ['magasinierCentral', 'achats', 'direction'], at: '26/10/2026 07:00' },
  { id: 'N4', text: 'Inventaire INV-2026-006 en attente de validation direction', roles: ['direction', 'controleur'], at: '26/10/2026 14:20' },
  { id: 'N5', text: 'Non-conformité NC-2026-007 : lot Y-20261018 bloqué', roles: ['controleur', 'direction', 'magasinierCentral'], at: '26/10/2026 08:05' },
  { id: 'N6', text: 'Bon de sortie BS-2026-042 confirmé par l’atelier', roles: ['boulanger', 'magasinierCentral', 'patissier'], at: '26/10/2026 02:50' },
]
