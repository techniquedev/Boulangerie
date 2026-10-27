import type { DemoState } from './state'
import type { Trace } from './trace'
import { BAKERY_SITES, figures, mpOf, nextAlertId } from './boulanger'
import { BS, fmtQty, matName, SITE_MATS, siteStock } from './stock'
import { dayOf, nowStamp } from '../lib/format'

// RG : rapprochement de fin de journée de l'atelier boulangerie.
// Matières sorties du magasin du site (bons confirmés du jour) / matières déclarées consommées dans les pétrissées.
// Les bons rapprochés passent « Clôturé » avec le résultat « Conforme » ou « Écart à traiter » (visible du magasinier) ;
// tout écart génère en plus une alerte réservée à la direction et au contrôleur central.
export function reconcileDay(s: DemoState, day: string): DemoState {
  let next = s
  for (const site of BAKERY_SITES) {
    const key = `${site}|${day}`
    if (next.endOfDay.includes(key)) continue
    const bons = next.bonsSortie.filter(b => b.site === site && b.atelier === 'ATL-B' && b.status === BS.conf && dayOf(b.ts) === day)
    const out: Record<string, number> = {}, used: Record<string, number> = {}
    bons.forEach(b => b.lines.forEach(l => { out[l.mp] = (out[l.mp] || 0) + l.qty }))
    next.lots.filter(l => l.site === site && dayOf(l.ts) === day)
      .forEach(l => figures(l).mats.forEach(m => { used[mpOf(m.mat)] = (used[mpOf(m.mat)] || 0) + m.qty }))
    const gaps = SITE_MATS.filter(m => Math.abs((out[m.mp] || 0) - (used[m.mp] || 0)) > 1e-6)
    const detail = gaps.length
      ? gaps.map(m => `${matName(m.mp)} : sorti ${fmtQty(m.mp, out[m.mp] || 0)} / consommé ${fmtQty(m.mp, used[m.mp] || 0)}`).join(' ; ')
      : 'Sorties du jour égales aux consommations déclarées.'
    const at = nowStamp()
    const result = gaps.length ? 'Écart à traiter' as const : 'Conforme' as const
    const alerts = gaps.length ? [{
      id: nextAlertId(next.alerts), type: 'Écart matières fin de journée', severity: 'Moyenne' as const, value: null,
      detail: `Atelier boulangerie ${site} — ${day} : ${detail}`,
      people: 'Magasinier de site / boulanger du site', status: 'Nouvelle' as const,
      history: [{ at, by: 'Système', text: 'Rapprochement automatique de fin de journée.' }],
    }, ...next.alerts] : next.alerts
    next = {
      ...next, alerts, endOfDay: [...next.endOfDay, key],
      bonsSortie: next.bonsSortie.map(b => bons.includes(b) ? { ...b, status: BS.clos, reconcile: { at, result, detail } } : b),
    }
  }
  return next
}

// Conflits de synchronisation : un stock de site devenu négatif une fois toutes les saisies rejouées.
export function stockConflicts(s: DemoState) {
  return BAKERY_SITES.flatMap(site => {
    const st = siteStock(s.movements, site)
    return SITE_MATS.filter(m => st[m.mp] < -1e-6).map(m => `${site} : ${matName(m.mp)} (${fmtQty(m.mp, st[m.mp])})`)
  })
}

// Au retour du réseau : horodatage serveur des saisies faites hors-ligne et vidage de la file d'attente.
export function syncPending(s: DemoState): DemoState {
  const at = nowStamp()
  const stamp = <T extends { trace: Trace }>(x: T): T => (x.trace.at ? x : { ...x, trace: { ...x.trace, at } })
  return {
    ...s, offline: false, queue: [],
    lots: s.lots.map(stamp),
    receptions: s.receptions.map(stamp),
    movements: s.movements.map(stamp),
    bonsSortie: s.bonsSortie.map(b => {
      const x = stamp(b)
      return x.confirm && !x.confirm.at ? { ...x, confirm: { ...x.confirm, at } } : x
    }),
  }
}
