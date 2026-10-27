import type { DemoState } from '../data/state'
import { alertBase, bdlBase } from '../data/seed1'
import { sessionA, sessionB } from '../data/seed2'
import { expensesBase, inventoryBase, ncsBase, ordersBase, purchasesBase, readingsBase, versementsBase } from '../data/seed3'
import { auditBase, devicesBase, notificationsBase } from '../data/seed4'
import { rawMaterials } from '../data/catalog'
import { seedSites } from '../data/seedSites'
import { seedShop } from '../data/seedShop'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export const STORAGE_KEY = 'delice-plus-demo-v5'

export function initialState(): DemoState {
  const shop = seedShop()
  return {
    alerts: [...shop.shopAlerts, ...clone(alertBase)].sort((a, b) => b.id.localeCompare(a.id)),
    bdls: [...shop.shopBdls, ...clone(bdlBase)],
    sessions: clone([sessionA, sessionB]),
    expenses: clone(expensesBase),
    versements: clone(versementsBase),
    inventory: clone(inventoryBase),
    ncs: clone(ncsBase),
    readings: clone(readingsBase),
    purchases: clone(purchasesBase),
    orders: clone(ordersBase),
    audit: clone(auditBase),
    devices: clone(devicesBase),
    notifications: clone(notificationsBase),
    matStock: Object.fromEntries(rawMaterials.map(m => [m.code, m.stock])),
    ticketSeq: 107,
    offline: false,
    queue: [],
    ...seedSites(),
    shopMoves: shop.shopMoves,
    declarations: shop.declarations,
    shopFixes: [],
    bdlTolerance: { 'PF-11': 2, 'PF-12': 2, 'PF-13': 2 },
    lossPhotoThreshold: 500,
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
