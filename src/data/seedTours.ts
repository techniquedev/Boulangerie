import type { AlertItem, Bdl, SiteCode } from './types'
import type { Trace } from './trace'
import { clientName, creditAmount, DRIVERS, type Delivery, type Stop, type Tour } from './tour'
import { productName } from './shop'
import { dayOf, demoTs, stampAt } from '../lib/format'

// Tournées de démonstration : même principe sur les 3 sites, données isolées par site et par livreur.
// Journée du 26/10/2026 : BDL-2026-0263 affecté au livreur (200 pains 150 g, 50 yaourts vanille), à prendre en charge.
// Historique : trois tournées soldées et, la semaine précédente, une tournée « Soldée avec écart » (3 pains non justifiés).

const STORES: Record<string, string> = { 'SIT-01': 'Yacoubou BALOGO', 'SIT-02': 'Aïchatou BANKOULÉ', 'SIT-03': 'Nadège AÏSSAN' }
const ALERT_IDS: Record<string, string> = { 'SIT-01': 'AL-2026-0083', 'SIT-02': 'AL-2026-0084', 'SIT-03': 'AL-2026-0085' }
const at = (ts: number) => stampAt(new Date(ts))
const ymd = (ts: number) => dayOf(ts).split('/').reverse().join('')

export const STOPS: Stop[] = [
  { kind: 'Client grossiste', code: 'CL-G01', name: clientName('CL-G01') },
  { kind: 'Boutique', name: 'Boutique Chez Fifamè — Akpakpa' },
  { kind: 'Client grossiste', code: 'CL-G02', name: clientName('CL-G02') },
  { kind: 'Client grossiste', code: 'CL-G04', name: clientName('CL-G04') },
]

export function seedTours() {
  const tours: Tour[] = [], deliveries: Delivery[] = [], bdls: Bdl[] = [], alerts: AlertItem[] = []

  ;(['SIT-01', 'SIT-02', 'SIT-03'] as SiteCode[]).forEach(site => {
    const { name: driver, device } = DRIVERS[site]
    const tr = (ts: number, author = driver): Trace => ({ author, site, device: author === driver ? device : 'PC-DIR', at: at(ts), localAt: at(ts), offline: false })
    const bdl = (id: string, ts: number, status: string): Bdl => ({
      id, kind: 'tournee', driver, to: `Livreur ${driver} — tournée`, toSite: site, ts, by: STORES[site], status, note: 'Chargement de tournée',
      lines: [{ code: 'PF-01', label: productName('PF-01'), sent: 200 }, { code: 'PF-11', label: productName('PF-11'), sent: 50, lot: `Y-${ymd(ts - 86400000)}`, dlc: dayOf(ts - 86400000 + 14 * 86400000) }],
    })
    const tourOf = (b: Bdl): Tour => ({
      id: `TRN-S${site.slice(-1)}-${ymd(b.ts!)}-01`, site, driver, bdl: b.id, ts: b.ts!, stops: STOPS, status: 'Affectée', returns: [], losses: [],
      lines: b.lines.map(l => ({ code: l.code!, qty: l.sent, lot: l.lot, dlc: l.dlc })),
    })

    // Historique : d jours avant le 26/10.
    ;([[7, 'BDL-2026-0247'], [6, 'BDL-2026-0248'], [5, 'BDL-2026-0249'], [3, 'BDL-2026-0250']] as [number, string][]).forEach(([d, id]) => {
      const gap = d === 7
      const b = bdl(id, demoTs(d, 5, 50), 'Tournée soldée')
      const t = tourOf(b)
      const t0 = demoTs(d, 6, 30)
      const ds: Omit<Delivery, 'id' | 'tourId' | 'site'>[] = [
        { nature: 'Livraison sur commande', stop: STOPS[0], lines: [{ code: 'PF-01', qty: 60 }, { code: 'PF-11', qty: 10 }], amount: 9500, mode: 'Espèces', trace: tr(t0 + 40 * 60000), proof: { kind: 'Confirmation du client', name: 'Signature de Maman Alice' } },
        { nature: 'Livraison sur commande', stop: STOPS[1], lines: [{ code: 'PF-01', qty: 50 }, { code: 'PF-11', qty: 15 }], amount: 7000, mode: 'MTN MoMo', ref: `MOMO${ymd(t0)}L${site.slice(-1)}1`, trace: tr(t0 + 90 * 60000) },
        { nature: 'Livraison sur commande', stop: STOPS[2], lines: [{ code: 'PF-01', qty: 40 }, { code: 'PF-11', qty: 10 }], amount: 0, mode: 'Crédit', trace: tr(t0 + 150 * 60000) },
        { nature: 'Vente directe', stop: { kind: 'Client de passage', name: 'Comptoir mobile — marché' }, lines: [{ code: 'PF-01', qty: gap ? 27 : 30 }, { code: 'PF-11', qty: 10 }], amount: gap ? 5550 : 6000, mode: 'Espèces', trace: tr(t0 + 200 * 60000) },
      ]
      ds.forEach((x, i) => deliveries.push({ ...x, amount: x.mode === 'Crédit' ? creditAmount(x.lines) : x.amount, id: `${t.id.replace('TRN', 'LIV')}-${String(i + 1).padStart(2, '0')}`, tourId: t.id, site }))
      const cash = ds.filter(x => x.mode === 'Espèces').reduce((s, x) => s + x.amount, 0)
      const tEnd = demoTs(d, 13, 0)
      Object.assign(t, {
        status: gap ? 'Soldée avec écart' : 'Soldée', start: tr(t0), startTs: t0, close: tr(tEnd + 30 * 60000),
        returns: [{ code: 'PF-01', qty: 20, motif: 'Invendu', trace: tr(tEnd) }, { code: 'PF-11', qty: 5, motif: 'Invendu', trace: tr(tEnd) }],
        remit: { id: `BV-L-S${site.slice(-1)}-${ymd(tEnd)}`, cash, momo: 7000, trace: tr(tEnd + 20 * 60000), status: 'Confirmé par le bureau central' },
        comment: gap ? { at: at(tEnd + 25 * 60000), text: '3 pains écrasés dans le panier pendant la tournée, oubliés dans la déclaration de pertes.' } : undefined,
      })
      tours.push(t); bdls.push(b)
      if (gap) alerts.push({
        id: ALERT_IDS[site], type: 'Écart de tournée', severity: 'Moyenne', value: 3 * 150, status: 'En investigation',
        detail: `${t.id} (${b.id}) : 3 pains 150 g non justifiés (chargé 200 = livré 177 + retourné 20 + pertes 0)`,
        people: `${driver} (livreur)`,
        history: [
          { at: at(tEnd + 30 * 60000), by: 'Système', text: 'Alerte générée à la clôture de la tournée « Soldée avec écart ».' },
          { at: at(demoTs(d - 1, 9, 0)), by: 'Dr Carine SODJI', text: 'Passée « En investigation » : vérification du chargement avec le magasin.' },
        ],
      })
    })

    // Journée du 26/10/2026 : tournée affectée, en attente de prise en charge.
    const b = bdl('BDL-2026-0263', demoTs(0, 5, 50), 'Émis → affecté au livreur')
    bdls.push(b); tours.push(tourOf(b))
  })

  return { tours, deliveries, tourBdls: bdls, tourAlerts: alerts }
}
