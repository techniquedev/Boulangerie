import type { AlertItem, AuditEntry, Bdl, Device, Expense, Notification, Payment, SiteCode } from './types'
import type { ProdLot } from './boulanger'
import type { BonSortie, Movement, Reception } from './stock'

export type SaleLine = { code: string; label: string; qty: number; unit: number }
export type SaleTicket = {
  id: string; at: string; lines: SaleLine[]; payments: Payment[]
  cancelled?: { by: string; reason: string; at: string }
}
export type CashSession = {
  id: string; site: SiteCode; caisse: string; openedBy: string; openedAt: string
  fond: number | null; status: 'Ouverte' | 'Clôturée (comptée)'
  tickets: SaleTicket[]
  summary?: { ca: number; cash: number; momo: number }
  counted?: number; closedAt?: string; closedBy?: string
}
export type Versement = {
  id: string; site: SiteCode; amount: number; by: string; status: string
  flow: string[]; bank?: string; ref?: string
}
export type Loss = { id: string; site: SiteCode; qty: number; label: string; reason: string; destination: string; photo: boolean; at: string }
export type InventoryLine = { code: string; label: string; theoretical: number; counted?: number; unit: number }
export type Inventory = {
  id: string; location: string; status: 'En cours' | 'En attente de validation direction' | 'Validé'
  lines: InventoryLine[]; adjustedBy?: string
}
export type Nc = { id: string; subject: string; status: 'Ouverte' | 'Clôturée'; action?: string; blocks?: string; at: string }
export type Reading = { id: string; place: string; at: string; value: number; min: number; max: number }
export type PurchaseRow = { po: string; supplier: string; ordered: string; received: string; invoice: string; status: 'Conforme' | 'En attente de rapprochement facture' | 'Écart bloquant' }
export type Order = { id: string; client: string; item: string; due: string; deposit: number; total: number; status: string }

export type DemoState = {
  alerts: AlertItem[]
  bdls: Bdl[]
  sessions: CashSession[]
  expenses: Expense[]
  versements: Versement[]
  losses: Loss[]
  inventory: Inventory
  ncs: Nc[]
  readings: Reading[]
  purchases: PurchaseRow[]
  orders: Order[]
  audit: AuditEntry[]
  devices: Device[]
  notifications: Notification[]
  matStock: Record<string, number>
  stockA: Record<string, number>
  ticketSeq: number
  offline: boolean
  queue: { id: string; text: string; at: string }[]
  // Magasins de site et ateliers (données isolées par site)
  epsThreshold: number                              // seuil EPS/sac paramétré par la direction
  movements: Movement[]                             // mouvements de stock des magasins de site (seule source du stock)
  receptions: Reception[]                           // réceptions fournisseurs des magasins de site
  bonsSortie: BonSortie[]                           // bons de sortie magasin de site → ateliers
  workshop: Record<string, Record<string, number>>  // stock des ateliers (site|atelier → matière)
  lots: ProdLot[]
  endOfDay: string[]                                // rapprochements de fin de journée déjà faits (site|jour)
}
