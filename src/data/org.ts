import type { Role, Site, SiteCode, User } from './types'

export const COMPANY = 'Boulangerie-Pâtisserie DÉLICE PLUS Sarl'
export const COMPANY_ACTIVITIES = 'boulangerie, pâtisserie, yaourts, crèmes glacées'
export const DEMO_PASSWORD = 'Demo@2026'

// Chaque site dispose de son magasin, de ses ateliers (boulangerie, pâtisserie, yaourts / glaces), d'un stock de produits finis,
// d'une boutique et d'une caisse ; le magasin central de la Direction Générale est implanté sur SITE 1.
export const sites: Site[] = [
  { code: 'SIT-01', name: 'SITE 1 — Unité de production et magasin central', status: 'Actif',
    locations: ['MAG-MP', 'MAG-S1', 'CF-01', 'ATL-B', 'ATL-P', 'ATL-YG', 'STK-PF', 'STK-V1', 'CAISSE-1'] },
  { code: 'SIT-02', name: 'SITE 2 (Boutique A)', status: 'Actif', locations: ['MAG-S2', 'CF-02', 'ATL-B', 'ATL-P', 'ATL-YG', 'STK-PF', 'STK-VA', 'CF-A', 'CAISSE-A'] },
  { code: 'SIT-03', name: 'SITE 3 (Boutique B)', status: 'Actif', locations: ['MAG-S3', 'CF-03', 'ATL-B', 'ATL-P', 'ATL-YG', 'STK-PF', 'STK-VB', 'CF-B', 'CAISSE-B'] },
  { code: 'SIT-04', name: 'Boutique C', status: 'Désactivé', locations: [], note: 'Historique conservé (US-14)' },
]

export const locationLabels: Record<string, string> = {
  'MAG-MP': 'Magasin central (Direction Générale)', 'MAG-S1': 'Magasin matières du site', 'MAG-S2': 'Magasin matières du site', 'MAG-S3': 'Magasin matières du site',
  'CF-01': 'Chambre froide', 'CF-02': 'Chambre froide', 'CF-03': 'Chambre froide',
  'ATL-B': 'Atelier boulangerie', 'ATL-P': 'Atelier pâtisserie', 'ATL-YG': 'Atelier yaourts/glaces', 'STK-PF': 'Stock produits finis',
  'STK-V1': 'Stock vendant boutique', 'CAISSE-1': 'Caisse boutique',
  'STK-VA': 'Stock vendant A', 'CF-A': 'Chambre froide boutique A', 'CAISSE-A': 'Caisse A',
  'STK-VB': 'Stock vendant B', 'CF-B': 'Chambre froide boutique B', 'CAISSE-B': 'Caisse B',
}

export const siteShort = (code: string) =>
  ({ 'SIT-01': 'SITE 1', 'SIT-02': 'SITE 2', 'SIT-03': 'SITE 3', 'SIT-04': 'Boutique C' } as Record<string, string>)[code] || code

export const roleLabels: Record<Role, string> = {
  direction: 'Directeur Général', magasinierCentral: 'Magasinier central', controleur: 'Contrôleur central',
  achats: 'Responsable Service Achats', boulanger: 'Boulanger', enfourneur: 'Enfourneur', magasinier: 'Magasinier de site',
  boutiquier: 'Boutiquier', caissiere: 'Caissière', patissier: 'Pâtissier / Opératrice yaourts-glaces',
  livreur: 'Livreur',
}

export const GROUPS = ['DIRECTION GÉNÉRALE', 'SITE 1', 'SITE 2', 'SITE 3'] as const

const ALL: SiteCode[] = ['SIT-01', 'SIT-02', 'SIT-03']
const DG = 'DIRECTION GÉNÉRALE'

const u = (n: number, group: string, role: Role, name: string, email: string, pin: string, note: string): User => {
  const code: SiteCode = group === 'SITE 2' ? 'SIT-02' : group === 'SITE 3' ? 'SIT-03' : 'SIT-01'
  return {
    n, group, role, name, email, pin, note, title: roleLabels[role], active: true,
    siteLabel: group === DG ? 'Direction Générale' : group,
    sites: group === DG ? ALL : [code],
  }
}

const siteTeam = (start: number, g: 'SITE 1' | 'SITE 2' | 'SITE 3', s: string, pin: number, names: string[]): User[] => {
  const spec: [Role, string, string][] = [
    ['boulanger', 'boulanger', 'Saisie de la production (lots, pâtons) ; confirme les bons de sortie matières'],
    ['enfourneur', 'enfourneur', 'Saisie de la cuisson et des rebuts'],
    ['magasinier', 'magasinier', 'Réceptions fournisseurs du site, bons de sortie vers les ateliers, stock de son magasin'],
    ['boutiquier', 'boutiquier', 'Réception à l’aveugle des bordereaux, invendus et pertes'],
    ['caissiere', 'caissiere', 'Vente, encaissements et clôture de caisse à l’aveugle ; AUCUN bouton de dépense'],
    ['patissier', 'patissier', 'Productions pâtisserie, yaourts et glaces'],
    ['livreur', 'livreur', 'Tournée ; peut seulement soumettre une demande de carburant avec photo'],
  ]
  return spec.map(([role, id, note], i) => u(start + i, g, role, names[i], `${id}.${s}@deliceplus.bj`, String(pin + i + 1), note))
}

export const users: User[] = [
  u(1, DG, 'direction', 'Awa ADJOVI', 'dg@deliceplus.bj', '1001', 'Validation finale des dépenses, prix, seuils ; accès intégral aux 3 sites'),
  u(2, DG, 'magasinierCentral', 'Fatima BIO', 'magasinier.central@deliceplus.bj', '1101', 'Magasin central : réceptions, bordereaux (BDL), sorties matières, réapprovisionnement'),
  u(3, DG, 'controleur', 'Carine SODJI', 'controleur@deliceplus.bj', '1201', 'Alertes, inventaires, contrôles qualité sur les 3 sites'),
  u(4, DG, 'achats', 'Rachel EZIN', 'achats@deliceplus.bj', '1301', 'Dépenses et cycle achats'),
  ...siteTeam(5, 'SITE 1', 'site1', 2100, ['Koffi AGBO', 'Ibrahim MOUSSA', 'Yacoubou BALOGO', 'Junior AHOUANVOEDO', 'Grâce ADECHOKAN', 'Sandrine KPOSSOU', 'Sani DAOUDA']),
  ...siteTeam(12, 'SITE 2', 'site2', 2200, ['Moussa LAWANI', 'Denis GANGNI', 'Aïchatou BANKOULÉ', 'Roméo FASSINOU', 'Mariam TOURÉ', 'Édith HOUNNOU', 'Bako MOUSSA']),
  ...siteTeam(19, 'SITE 3', 'site3', 2300, ['Séverin TCHEKPLI', 'Omar GADO', 'Nadège AÏSSAN', 'Ulrich MIGAN', 'Bénédicte SODOGANDJI', 'Reine AZON', 'Issiaka KORA']),
]

// Anciens comptes ne correspondant à aucun des 25 postes : désactivés, jamais supprimés (historique et audit conservés).
export const deactivated: { name: string; email: string; oldRole: string; reason: string }[] = [
  { name: 'Paul HOUNSA', email: 'gerant@deliceplus.bj', oldRole: 'Gérant multi-sites', reason: 'Poste supprimé de la nouvelle organisation' },
  { name: 'Grâce DOSSOU', email: 'patissier@deliceplus.bj', oldRole: 'Pâtissier / Opératrice yaourts-glaces', reason: 'Ne correspond à aucun des 25 postes (le poste est tenu par Sandrine KPOSSOU, SITE 1)' },
]

export const findUser = (email: string) => users.find(x => x.email.toLowerCase() === email.trim().toLowerCase())
