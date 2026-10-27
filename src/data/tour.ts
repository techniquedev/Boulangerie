import type { Bdl, Payment, SiteCode } from './types'
import type { Trace } from './trace'
import { clients } from './partners'
import { product } from './shop'

// ——— Livreurs, appareils et points de livraison ———

export const DRIVERS: Record<string, { name: string; device: string }> = {
  'SIT-01': { name: 'Sani DAOUDA', device: 'DEV-04' },
  'SIT-02': { name: 'Bako MOUSSA', device: 'DEV-06' },
  'SIT-03': { name: 'Issiaka KORA', device: 'DEV-07' },
}

export type ClientKind = 'Client grossiste' | 'Boutique' | 'Client de passage'
export type Stop = { kind: ClientKind; code?: string; name: string }
export const clientName = (code: string) => clients.find(c => c.code === code)?.name || code

export type PayMode = Payment['mode'] | 'Crédit'
export const CASH_MODES: Payment['mode'][] = ['Espèces', 'MTN MoMo', 'Moov Money', 'Celtiis Cash']
export const isMomo = (m: PayMode) => m === 'MTN MoMo' || m === 'Moov Money' || m === 'Celtiis Cash'

// ——— Tournée : chargement issu d'un BDL affecté nommément au livreur ———

export type TourStatus = 'Affectée' | 'En cours' | 'Soldée' | 'Soldée avec écart'
export type TourLine = { code: string; qty: number; lot?: string; dlc?: string }
export type Proof = { kind: 'Photo' | 'Confirmation du client'; name: string; thumb?: string }
export type Delivery = {
  id: string; tourId: string; site: SiteCode; nature: 'Livraison sur commande' | 'Vente directe'; stop: Stop
  lines: { code: string; qty: number }[]; amount: number; mode: PayMode; ref?: string; proof?: Proof; trace: Trace
}
export type Deposit = { id: string; tourId: string; site: SiteCode; orderId: string; amount: number; mode: Payment['mode']; ref?: string; trace: Trace }
export type ReturnLine = { code: string; qty: number; motif: string; trace: Trace }
export type LossLine = { code: string; qty: number; motif: string; photo?: Proof; trace: Trace }
export type TourFix = { id: string; tourId: string; deliveryId: string; code?: string; qtyDelta: number; amountDelta: number; motif: string; trace: Trace }
export type Remittance = { id: string; cash: number; momo: number; trace: Trace; status: 'Transmis au bureau central' | 'Confirmé par le bureau central' }
export type Tour = {
  id: string; site: SiteCode; driver: string; bdl: string; ts: number; stops: Stop[]; lines: TourLine[]
  status: TourStatus; start?: Trace; startTs?: number; close?: Trace
  returns: ReturnLine[]; losses: LossLine[]; noReturns?: boolean; remit?: Remittance; comment?: { at: string; text: string }
}

export const RETURN_MOTIFS = ['Invendu', 'Refus du client', 'Produit abîmé', 'Péremption', 'Erreur de chargement'] as const
export const LOSS_MOTIFS_T = ['Casse', 'Chute', 'Vol', 'Rupture de la chaîne du froid', 'Autre'] as const

// ——— Contrôles d'équilibrage ———

export function tourFigures(t: Tour, deliveries: Delivery[], deposits: Deposit[], fixes: TourFix[]) {
  const ds = deliveries.filter(d => d.tourId === t.id && d.site === t.site)
  const fx = fixes.filter(f => f.tourId === t.id)
  const codes = t.lines.map(l => l.code)
  const sum = (arr: { code?: string; qty: number }[], code: string) => arr.filter(x => x.code === code).reduce((s, x) => s + x.qty, 0)
  const rows = codes.map(code => {
    const loaded = sum(t.lines, code)
    const delivered = ds.reduce((s, d) => s + sum(d.lines, code), 0) + fx.filter(f => f.code === code).reduce((s, f) => s + f.qtyDelta, 0)
    const returned = sum(t.returns, code), lost = sum(t.losses, code)
    return { code, loaded, delivered, returned, lost, remaining: loaded - delivered - returned - lost }
  })
  const amountOf = (d: Delivery) => d.amount + fx.filter(f => f.deliveryId === d.id).reduce((s, f) => s + f.amountDelta, 0)
  const dep = deposits.filter(d => d.tourId === t.id && d.site === t.site)
  const cash = ds.filter(d => d.mode === 'Espèces').reduce((s, d) => s + amountOf(d), 0) + dep.filter(d => d.mode === 'Espèces').reduce((s, d) => s + d.amount, 0)
  const momo = ds.filter(d => isMomo(d.mode)).reduce((s, d) => s + amountOf(d), 0) + dep.filter(d => isMomo(d.mode)).reduce((s, d) => s + d.amount, 0)
  const credit = ds.filter(d => d.mode === 'Crédit').reduce((s, d) => s + amountOf(d), 0)
  const qtyOk = rows.every(r => r.remaining === 0)
  const cashOk = !!t.remit && t.remit.cash === cash && t.remit.momo === momo
  const served = new Set(ds.filter(d => d.nature === 'Livraison sur commande').map(d => d.stop.code || d.stop.name))
  return {
    rows, deliveries: ds, deposits: dep, cash, momo, credit, qtyOk, cashOk,
    // Les deux équations sont « complétées » quand retours/pertes et versement sont déclarés.
    complete: (t.noReturns || t.returns.length > 0 || t.losses.length > 0) && !!t.remit,
    stopsDone: t.stops.filter(s => served.has(s.code || s.name)).length,
  }
}

// Montant d'une vente à crédit : calculé par le système au tarif grossiste (jamais affiché au détail au livreur).
export const creditAmount = (lines: { code: string; qty: number }[]) => lines.reduce((s, l) => s + l.qty * (product(l.code).wholesale ?? product(l.code).retail), 0)

// Encours d'un client grossiste : encours de référence + ventes à crédit enregistrées en tournée.
export const outstandingOf = (code: string, deliveries: Delivery[]) =>
  (clients.find(c => c.code === code)?.outstanding || 0) + deliveries.filter(d => d.mode === 'Crédit' && d.stop.code === code).reduce((s, d) => s + d.amount, 0)

export const tourBdl = (bdls: Bdl[], t: Tour) => bdls.find(b => b.id === t.bdl && b.toSite === t.site && b.kind === 'tournee')
export const nextDeliveryId = (deliveries: Delivery[], t: Tour) => `${t.id.replace('TRN', 'LIV')}-${String(deliveries.filter(d => d.tourId === t.id).length + 1).padStart(2, '0')}`
