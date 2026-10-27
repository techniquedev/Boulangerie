import type { Role, SiteCode, User } from './types'

export type ScreenId =
  | 'dashboard' | 'alerts' | 'production' | 'cuisson' | 'magasin' | 'bdl' | 'pos' | 'caisse' | 'invendus'
  | 'expenses' | 'versements' | 'orders' | 'credit' | 'plan' | 'inventory' | 'quality' | 'purchases' | 'tour'
  | 'catalog' | 'org' | 'reports' | 'treasury' | 'audit' | 'devices' | 'v3' | 'notifications' | 'rbac'
  | 'bHome' | 'bReception' | 'bPetrissee' | 'bLots' | 'bCuisson' | 'bHistory'
  | 'mHome' | 'mReceptions' | 'mSorties' | 'mStocks' | 'mSuivi' | 'mHistory'

export type MenuItem = { id: ScreenId; label: string; group: string }

const M = (id: ScreenId, label: string, group: string): MenuItem => ({ id, label, group })

const all = {
  dashboard: M('dashboard', 'Tableau de bord', 'Pilotage'),
  alerts: M('alerts', 'Alertes', 'Pilotage'),
  reports: M('reports', 'Rapports', 'Pilotage'),
  treasury: M('treasury', 'Trésorerie', 'Pilotage'),
  production: M('production', 'Production', 'Production'),
  cuisson: M('cuisson', 'Cuisson & rebuts', 'Production'),
  plan: M('plan', 'Plan & besoins', 'Production'),
  magasin: M('magasin', 'Magasin & stocks', 'Stocks'),
  bdl: M('bdl', 'Bordereaux (BDL)', 'Stocks'),
  inventory: M('inventory', 'Inventaires', 'Stocks'),
  invendus: M('invendus', 'Invendus & pertes', 'Stocks'),
  quality: M('quality', 'Qualité & froid', 'Stocks'),
  pos: M('pos', 'Vente', 'Boutique'),
  caisse: M('caisse', 'Caisse', 'Boutique'),
  versements: M('versements', 'Remise des recettes', 'Boutique'),
  orders: M('orders', 'Commandes clients', 'Commercial'),
  credit: M('credit', 'Crédit grossistes', 'Commercial'),
  tour: M('tour', 'Tournée livreur', 'Commercial'),
  expenses: M('expenses', 'Dépenses', 'Achats & dépenses'),
  purchases: M('purchases', 'Achats fournisseurs', 'Achats & dépenses'),
  catalog: M('catalog', 'Produits & tarifs', 'Administration'),
  org: M('org', 'Sites, tiers, seuils', 'Administration'),
  rbac: M('rbac', 'Rôles & droits', 'Administration'),
  devices: M('devices', 'Appareils', 'Administration'),
  audit: M('audit', 'Journal d’audit', 'Administration'),
  v3: M('v3', 'IA (V3)', 'Administration'),
  notifications: M('notifications', 'Notifications', 'Pilotage'),
  // Tableau de bord Boulanger (modèle unique, identique sur les 3 sites)
  bHome: M('bHome', 'Accueil', 'Mon atelier'),
  bReception: M('bReception', 'Réception des matières', 'Mon atelier'),
  bPetrissee: M('bPetrissee', 'Nouvelle pétrissée', 'Mon atelier'),
  bLots: M('bLots', 'Mes lots de production', 'Mon atelier'),
  bCuisson: M('bCuisson', 'Rapports de cuisson', 'Mon atelier'),
  bHistory: M('bHistory', 'Historique et rendement', 'Mon atelier'),
  // Tableau de bord Magasinier de site (modèle unique, identique sur les 3 sites, distinct du magasinier central)
  mHome: M('mHome', 'Accueil', 'Mon magasin'),
  mReceptions: M('mReceptions', 'Réceptions fournisseurs', 'Mon magasin'),
  mSorties: M('mSorties', 'Sorties vers les ateliers', 'Mon magasin'),
  mStocks: M('mStocks', 'État des stocks et seuils', 'Mon magasin'),
  mSuivi: M('mSuivi', 'Suivi des bons et rapprochements', 'Mon magasin'),
  mHistory: M('mHistory', 'Historique et piste d’audit', 'Mon magasin'),
}

const bakerTabs: ScreenId[] = ['bHome', 'bReception', 'bPetrissee', 'bLots', 'bCuisson', 'bHistory']
const storeTabs: ScreenId[] = ['mHome', 'mReceptions', 'mSorties', 'mStocks', 'mSuivi', 'mHistory']

const pick = (...ids: ScreenId[]) => ids.map(i => all[i])

// Matrice RBAC : menus visibles par rôle (ENF-05 : à doubler côté serveur en production).
export const menuByRole: Record<Role, MenuItem[]> = {
  direction: Object.values(all).filter(m => m.id !== 'pos' && !bakerTabs.includes(m.id) && !storeTabs.includes(m.id)),
  magasinierCentral: pick('magasin', 'bdl', 'purchases', 'inventory', 'notifications'),
  controleur: pick('dashboard', 'alerts', 'inventory', 'quality', 'production', 'bdl', 'reports', 'audit', 'notifications'),
  achats: pick('expenses', 'purchases', 'magasin', 'notifications'),
  boulanger: pick(...bakerTabs),   // saisie production, lecture des rapports de cuisson ; ni alertes ni écrans financiers
  enfourneur: pick('cuisson', 'notifications'),
  magasinier: pick(...storeTabs),   // saisie réceptions et bons de sortie ; ni alertes, ni caisse, ni dépenses, ni prix
  boutiquier: pick('bdl', 'invendus', 'notifications'),
  caissiere: pick('pos', 'caisse', 'versements', 'notifications'),
  patissier: pick('production', 'bReception', 'orders', 'notifications'),
  livreur: pick('tour', 'expenses', 'notifications'),
}

export const homeByRole: Record<Role, ScreenId> = {
  direction: 'dashboard', magasinierCentral: 'magasin', controleur: 'dashboard', achats: 'expenses',
  boulanger: 'bHome', enfourneur: 'cuisson', magasinier: 'mHome', boutiquier: 'bdl',
  caissiere: 'pos', patissier: 'production', livreur: 'tour',
}

// Écrans dont les données appartiennent au SITE 1 (unité de production et magasin central) :
// un compte d'un autre site n'y accède pas (règle : chaque compte reste limité à son site).
export const siteBound: Partial<Record<ScreenId, SiteCode>> = {
  production: 'SIT-01', plan: 'SIT-01', magasin: 'SIT-01',
  inventory: 'SIT-01', purchases: 'SIT-01', orders: 'SIT-01', tour: 'SIT-01',
}

export const hasSite = (u: User, code: SiteCode) => u.sites.includes(code)
export const isCentral = (u: User) => u.group === 'DIRECTION GÉNÉRALE'

// Droits fonctionnels fins.
export const can = {
  seeAlerts: (r: Role) => r === 'direction' || r === 'controleur',               // RG-10
  validateExpense: (r: Role) => r === 'direction',
  submitExpense: (r: Role) => r === 'direction' || r === 'achats' || r === 'livreur',
  cancelSale: (r: Role) => r === 'direction',                                    // RG-08
  confirmVersement: (r: Role) => r === 'direction',
  editPrices: (r: Role) => r === 'direction',                                    // US-15
  saisieProduction: (r: Role) => r === 'boulanger' || r === 'patissier' || r === 'direction',
  saisieCuisson: (r: Role) => r === 'enfourneur',                              // boulanger : lecture seule (US-04)
  exportStore: (r: Role) => r === 'magasinier' || r === 'direction' || r === 'controleur',
  exportProduction: (r: Role) => r === 'boulanger' || r === 'direction' || r === 'controleur',
  setEpsThreshold: (r: Role) => r === 'direction',
  receiveBlind: (r: Role) => r === 'boutiquier',                                 // RG-06
  closeBlind: (r: Role) => r === 'caissiere',                                    // US-28
  emitBdl: (r: Role) => r === 'magasinierCentral',
  seeSentQty: (r: Role) => r !== 'boutiquier' && r !== 'caissiere',              // RG-06
  validateInventory: (r: Role) => r === 'direction',
  runInventory: (r: Role) => r === 'controleur' || r === 'direction',
  derogation: (r: Role) => r === 'direction',                                    // RG-04, US-27
}

export const rbacMatrix: { role: Role; screens: string }[] = (Object.keys(menuByRole) as Role[]).map(role => ({
  role, screens: menuByRole[role].map(m => m.label).join(' · '),
}))
