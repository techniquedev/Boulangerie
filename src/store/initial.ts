import type { DemoState } from '../data/state'
import { alertBase, bdlBase } from '../data/seed1'
import { sessionA, sessionB } from '../data/seed2'
import { expensesBase, inventoryBase, lossesBase, ncsBase, ordersBase, purchasesBase, readingsBase, versementsBase } from '../data/seed3'
import { auditBase, devicesBase, notificationsBase } from '../data/seed4'
import { rawMaterials } from '../data/catalog'
import { seedSites } from '../data/seedSites'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export const STORAGE_KEY = 'delice-plus-demo-v3'

// Stock vendant STK-VA (boutique A) en fin de journée, après réception de BDL-0261 et ventes.
export const initialStockA: Record<string, number> = {
  'PF-01': 150, 'PF-02': 12, 'PF-05': 20, 'PF-11': 35, 'PF-14': 20, 'PF-09': 3, 'PF-08': 40,
}

export function initialState(): DemoState {
  return {
    alerts: clone(alertBase),
    bdls: clone(bdlBase),
    sessions: clone([sessionA, sessionB]),
    expenses: clone(expensesBase),
    versements: clone(versementsBase),
    losses: clone(lossesBase),
    inventory: clone(inventoryBase),
    ncs: clone(ncsBase),
    readings: clone(readingsBase),
    purchases: clone(purchasesBase),
    orders: clone(ordersBase),
    audit: clone(auditBase),
    devices: clone(devicesBase),
    notifications: clone(notificationsBase),
    matStock: Object.fromEntries(rawMaterials.map(m => [m.code, m.stock])),
    stockA: clone(initialStockA),
    ticketSeq: 107,
    offline: false,
    queue: [],
    ...seedSites(),
  }
}

export function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    return { ...initialState(), ...JSON.parse(raw) }
  } catch {
    return initialState()
  }
}
