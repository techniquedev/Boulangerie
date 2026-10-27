import type { DemoState } from './state'
import type { Trace } from './trace'
import { BAKERY_SITES, figures, mpOf, nextAlertId } from './boulanger'
import { atelierLabel, ATELIERS, BS, fmtQty, matName, SITE_MATS, siteStock, type BonSortie, type Reconcile } from './stock'
import { patFigures, prodLine } from './patisserie'
import { BDL_ST, productName } from './shop'
import { dayOf, nowStamp } from '../lib/format'

// RG : rapprochement de fin de journée des ateliers (boulangerie, pâtisserie, yaourts / crèmes glacées).
// Matières sorties du magasin du site (bons confirmés du jour) / matières déclarées consommées (pétrissées, lots de production).
// Les bons rapprochés passent « Clôturé » avec le résultat « Conforme » ou « Écart à traiter » (visible du magasinier) ;
// tout écart génère en plus une alerte réservée à la direction et au contrôleur central.
export function reconcileDay(s: DemoState, day: string): DemoState {
  let next = s
  for (const site of BAKERY_SITES) {
    const key = `${site}|${day}`
    if (next.endOfDay.includes(key)) continue
    const at = nowStamp()
    let alerts = next.alerts
    const closed = new Map<BonSortie, Reconcile>()
    for (const atl of ATELIERS.map(a => a.code)) {
      const bons = next.bonsSortie.filter(b => b.site === site && b.atelier === atl && b.status === BS.conf && dayOf(b.ts) === day)
      const out: Record<string, number> = {}, used: Record<string, number> = {}
      bons.forEach(b => b.lines.forEach(l => { out[l.mp] = (out[l.mp] || 0) + l.qty }))
      if (atl === 'ATL-B') next.lots.filter(l => l.site === site && dayOf(l.ts) === day)
        .forEach(l => figures(l).mats.forEach(m => { used[mpOf(m.mat)] = (used[mpOf(m.mat)] || 0) + m.qty }))
      else next.patLots.filter(l => l.site === site && l.fab === day && prodLine(l.line).atelier === atl)
        .forEach(l => patFigures(l).mats.forEach(m => { used[m.mp] = (used[m.mp] || 0) + m.qty }))
      if (!bons.length && !Object.keys(used).length) continue
      const gaps = SITE_MATS.filter(m => Math.abs((out[m.mp] || 0) - (used[m.mp] || 0)) > 1e-6)
      const detail = gaps.length
        ? gaps.map(m => `${matName(m.mp)} : sorti ${fmtQty(m.mp, out[m.mp] || 0)} / consommé ${fmtQty(m.mp, used[m.mp] || 0)}`).join(' ; ')
        : 'Sorties du jour égales aux consommations déclarées.'
      const result = gaps.length ? 'Écart à traiter' as const : 'Conforme' as const
      bons.forEach(b => closed.set(b, { at, result, detail }))
      if (gaps.length) alerts = [{
        id: nextAlertId(alerts), type: 'Écart matières fin de journée', severity: 'Moyenne' as const, value: null,
        detail: `${atelierLabel(atl)} ${site} — ${day} : ${detail}`,
        people: `Magasinier de site / ${atl === 'ATL-B' ? 'boulanger' : 'pâtissier – opératrice yaourts-glaces'} du site`, status: 'Nouvelle' as const,
        history: [{ at, by: 'Système', text: 'Rapprochement automatique de fin de journée.' }],
      }, ...alerts]
    }
    next = {
      ...next, alerts, endOfDay: [...next.endOfDay, key],
      bonsSortie: next.bonsSortie.map(b => closed.has(b) ? { ...b, status: BS.clos, reconcile: closed.get(b) } : b),
      // Boutique : les BDL réceptionnés conformes dans la journée sont clôturés (les BDL avec écart le sont à la clôture de l'alerte).
      bdls: next.bdls.map(b => b.toSite === site && b.status === BDL_ST.ok && b.counts?.length && dayOf(b.counts[b.counts.length - 1].ts) === day ? { ...b, status: BDL_ST.clos } : b),
    }
  }
  return next
}

// Conflits de synchronisation : un stock de site devenu négatif une fois toutes les saisies rejouées.
export function stockConflicts(s: DemoState) {
  return BAKERY_SITES.flatMap(site => {
    const st = siteStock(s.movements, site)
    const lots: Record<string, number> = {}
    s.shopMoves.filter(m => m.site === site).forEach(m => { lots[`${m.code}|${m.lot}`] = (lots[`${m.code}|${m.lot}`] || 0) + m.qty })
    const shop = Object.entries(lots).filter(([, q]) => q < -1e-6).map(([k, q]) => `${site} : ${productName(k.split('|')[0])} (${q})`)
    return [...SITE_MATS.filter(m => st[m.mp] < -1e-6).map(m => `${site} : ${matName(m.mp)} (${fmtQty(m.mp, st[m.mp])})`), ...shop]
  })
}

// Au retour du réseau : horodatage serveur des saisies faites hors-ligne et vidage de la file d'attente.
export function syncPending(s: DemoState): DemoState {
  const at = nowStamp()
  const stamp = <T extends { trace: Trace }>(x: T): T => (x.trace.at ? x : { ...x, trace: { ...x.trace, at } })
  return {
    ...s, offline: false, queue: [],
    lots: s.lots.map(l => {
      const x = stamp(l)
      const st = (t?: Trace) => (t && !t.at ? { ...t, at } : t)
      return {
        ...x,
        oven: x.oven && { ...x.oven, trace: st(x.oven.trace)! },
        cuisson: x.cuisson && { ...x.cuisson, trace: st(x.cuisson.trace) },
        ovenFixes: x.ovenFixes?.map(f => ({ ...f, trace: st(f.trace)! })),
        anomalies: x.anomalies?.map(a => ({ ...a, trace: st(a.trace)! })),
      }
    }),
    deliveries: s.deliveries.map(stamp),
    tourDeposits: s.tourDeposits.map(stamp),
    tourFixes: s.tourFixes.map(stamp),
    patLots: s.patLots.map(stamp),
    shopMoves: s.shopMoves.map(stamp),
    declarations: s.declarations.map(stamp),
    shopFixes: s.shopFixes.map(stamp),
    bdls: s.bdls.map(b => b.counts?.some(c => !c.trace.at) ? { ...b, counts: b.counts.map(c => (c.trace.at ? c : { ...c, trace: { ...c.trace, at } })) } : b),
    receptions: s.receptions.map(stamp),
    movements: s.movements.map(stamp),
    bonsSortie: s.bonsSortie.map(b => {
      const x = stamp(b)
      return x.confirm && !x.confirm.at ? { ...x, confirm: { ...x.confirm, at } } : x
    }),
  }
}
