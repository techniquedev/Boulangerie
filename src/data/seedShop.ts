import type { AlertItem, Bdl, BdlLine, SiteCode } from './types'
import type { Trace } from './trace'
import { deviceFor } from './trace'
import {
  BDL_ST, fefo, product, productName, shopLots, shopName, shopProduct,
  type DeclLine, type Declaration, type LossDest, type LossMotif, type ShopMove, type ShopMoveKind,
} from './shop'
import { dayOf, demoTs, stampAt } from '../lib/format'

// Données de démonstration des boutiques : même principe sur les 3 sites, données isolées par site.
// Historique simulé sur les 12 jours précédant la journée du 26/10/2026 (livraisons, ventes FEFO, invendus et périmés du soir).

const TEAMS: { site: SiteCode; shop: string; cash: string; store: string; alertId: string }[] = [
  { site: 'SIT-01', shop: 'Junior AHOUANVOEDO', cash: 'Grâce ADECHOKAN', store: 'Yacoubou BALOGO', alertId: 'AL-2026-0086' },
  { site: 'SIT-02', shop: 'Roméo FASSINOU', cash: 'Mariam TOURÉ', store: 'Aïchatou BANKOULÉ', alertId: 'AL-2026-0088' },
  { site: 'SIT-03', shop: 'Ulrich MIGAN', cash: 'Bénédicte SODOGANDJI', store: 'Nadège AÏSSAN', alertId: 'AL-2026-0087' },
]
const DAYS = 12
const GAP_DAY = 4                      // jour de l'historique où la livraison présente un écart (30 pains 150 g manquants)
const STALE_LOT = 'Y-20261011'          // 4 yaourts vanille à DLC 25/10/2026 : périmés et bloqués le 26/10 (déclaration type)

// Taux de vente journalier du stock vendable, par produit.
const SALES: Record<string, number> = {
  'PF-01': 0.95, 'PF-02': 0.94, 'PF-03': 0.9, 'PF-04': 0.92, 'PF-05': 0.9, 'PF-06': 0.88, 'PF-07': 0.8, 'PF-08': 0.9,
  'PF-11': 0.7, 'PF-12': 0.15, 'PF-14': 0.45, 'PF-15': 0.35,
}
const DAILY = ['PF-01', 'PF-02', 'PF-03', 'PF-04', 'PF-05', 'PF-06', 'PF-08']   // produits du jour : le reste du soir part en invendus

const at = (ts: number) => stampAt(new Date(ts))
const trace = (author: string, site: SiteCode, ts: number): Trace => ({ author, site, device: deviceFor(site), at: at(ts), localAt: at(ts), offline: false })
const ymd = (ts: number) => dayOf(ts).split('/').reverse().join('')
const sunday = (ts: number) => new Date(ts + 3600000).getUTCDay() === 0
const addDays = (ts: number, n: number) => dayOf(ts + n * 86400000)

// Ligne de BDL : lot et date limite pour les produits frais (lot fabriqué la veille de la livraison, DLC = fabrication + conservation).
const line = (code: string, sent: number, ts: number): BdlLine => {
  const p = shopProduct(code)!
  return p.perishable
    ? { code, label: productName(code), sent, lot: `${p.prefix}-${ymd(ts - 86400000)}`, dlc: addDays(ts - 86400000, p.shelf) }
    : { code, label: productName(code), sent }
}

export function seedShop() {
  const shopMoves: ShopMove[] = []
  const bdls: Bdl[] = []
  const declarations: Declaration[] = []
  const alerts: AlertItem[] = []

  TEAMS.forEach(team => {
    const { site, shop, cash, store } = team
    const moves: Omit<ShopMove, 'id'>[] = []
    const siteBdls: Bdl[] = []
    const mv = (code: string, lot: string, dlc: string | undefined, qty: number, kind: ShopMoveKind, ref: string, ts: number, author: string, motif?: string) =>
      moves.push({ site, code, lot, dlc, qty, kind, ref, ts, trace: trace(author, site, ts), motif })
    const lotsAt = (ts: number) => shopLots(moves.map((m, i) => ({ ...m, id: String(i) })), site, ts)

    // Stock d'ouverture (inventaire du contrôleur) : produits frais déjà en boutique.
    const t0 = demoTs(DAYS + 1, 20, 0)
    const open = (code: string, lot: string, dlc: string, qty: number) => mv(code, lot, dlc, qty, 'Stock d’ouverture', 'INV-BOUT-2026-10', t0, 'Carine SODJI')
    open('PF-11', STALE_LOT, '25/10/2026', 4)
    open('PF-11', 'Y-20261012', '26/10/2026', 20)
    open('PF-12', 'Y-20261012', '26/10/2026', 10)
    open('PF-14', 'G-20260901', '30/11/2026', 40)
    open('PF-15', 'G-20260901', '30/11/2026', 20)

    for (let d = DAYS; d >= 1; d--) {
      const day = demoTs(d, 12, 0)
      if (sunday(day)) continue

      // Livraison du matin, reçue et comptée à l'aveugle par le boutiquier.
      const tIssue = demoTs(d, 5, 30), tRecv = demoTs(d, 6, 30)
      const lines = [line('PF-01', 500, tIssue), line('PF-02', 200, tIssue), line('PF-03', 100, tIssue), line('PF-04', 80, tIssue), line('PF-05', 60, tIssue),
        line('PF-06', 40, tIssue), line('PF-07', 30, tIssue), line('PF-08', 50, tIssue), line('PF-11', 60, tIssue),
        ...(d % 2 === 0 ? [line('PF-12', 20, tIssue)] : []), ...(d % 3 === 0 ? [line('PF-14', 40, tIssue), line('PF-15', 20, tIssue)] : [])]
      const counts = lines.map(l => (d === GAP_DAY && l.code === 'PF-01' ? 470 : l.sent))
      const gap = counts.some((c, i) => c !== lines[i].sent)
      const b: Bdl = {
        id: '', to: shopName(site), toSite: site, ts: tIssue, by: store, status: gap ? BDL_ST.gap : BDL_ST.clos,
        lines: lines.map((l, i) => ({ ...l, counted: counts[i] })),
        counts: [{ ts: tRecv, trace: trace(shop, site, tRecv), counts, partial: false, photos: [], remark: gap ? 'Cartons de pains 150 g comptés deux fois' : undefined }],
        requests: gap ? [{ at: at(demoTs(d, 10, 0)), by: 'Carine SODJI (contrôleur central)', text: 'Merci de préciser comment le comptage des pains 150 g a été effectué à l’arrivée.' }] : [],
      }
      siteBdls.push(b)
      lines.forEach((l, i) => mv(l.code!, l.lot || '', l.dlc, counts[i], 'Réception BDL', '', tRecv, shop))

      // Ventes de la journée (caisse), sorties selon la règle FEFO.
      const tSale = demoTs(d, 19, 0)
      const lots = lotsAt(tSale)
      Object.entries(SALES).forEach(([code, rate]) => {
        const avail = lots.filter(l => l.code === code && (l.left === null || l.left >= 0) && l.lot !== STALE_LOT).reduce((s, l) => s + l.qty, 0)
        const q = Math.floor(avail * rate)
        if (q > 0) fefo(lots, code, q, STALE_LOT)!.forEach(x => mv(code, x.lot, x.dlc, -x.qty, 'Vente (caisse)', `VENTES-S${site.slice(-1)}-${ymd(tSale)}`, tSale, cash))
      })

      // Déclaration du soir : invendus du jour, lots arrivés à date limite, casse et retours occasionnels.
      const tDecl = demoTs(d, 19, 30)
      const left = lotsAt(tDecl)
      const decl: DeclLine[] = []
      const add = (code: string, lot: string, qty: number, motif: LossMotif, dest: LossDest) => decl.push({ code, lot, qty, motif, dest,
        photo: motif === 'Périmé' || motif === 'Casse' ? { name: `photo-${code}-${ymd(tDecl)}.jpg`, thumb: '' } : undefined })
      DAILY.forEach(code => left.filter(l => l.code === code).forEach(l => add(code, l.lot, l.qty, 'Invendu', code <= 'PF-04' ? 'Recyclage' : 'Don')))
      left.filter(l => l.dlc && l.left !== null && l.dlc === dayOf(tDecl) && l.lot !== STALE_LOT).forEach(l => add(l.code, l.lot, l.qty, 'Périmé', 'Destruction'))
      const ice = left.find(l => l.code === 'PF-14' && l.qty >= 2 && (l.left ?? 0) >= 0)
      if (d % 5 === 0 && ice) add('PF-14', ice.lot, 2, 'Casse', 'Destruction')
      if (d === 6) decl.push({ code: 'PF-07', lot: `P-${ymd(demoTs(d + 1, 12, 0))}`, qty: 1, motif: 'Retour client', dest: 'Destruction' })
      if (decl.length) {
        const id = `DEC-S${site.slice(-1)}-${ymd(tDecl)}-01`
        declarations.push({ id, site, ts: tDecl, lines: decl, trace: trace(shop, site, tDecl), status: 'Validée' })
        decl.forEach(l => {
          if (l.motif === 'Retour client') mv(l.code, l.lot, undefined, l.qty, 'Retour client', id, tDecl, shop, 'Retour client')
          mv(l.code, l.lot, undefined, -l.qty, 'Invendu / perte', id, tDecl, shop, `${l.motif} → ${l.dest}`)
        })
      }
    }

    // Journée du 26/10/2026 : BDL-2026-0261 (scénario avec écart) et BDL-2026-0262 (scénario conforme), en transit.
    const t1 = demoTs(0, 5, 30), t2 = demoTs(0, 5, 45)
    siteBdls.push(
      { id: 'BDL-2026-0261', to: shopName(site), toSite: site, ts: t1, by: store, status: BDL_ST.transit, counts: [], requests: [],
        lines: [line('PF-01', 500, t1), line('PF-02', 200, t1), line('PF-05', 60, t1), line('PF-11', 60, t1), line('PF-14', 40, t1)] },
      { id: 'BDL-2026-0262', to: shopName(site), toSite: site, ts: t2, by: store, status: BDL_ST.transit, counts: [], requests: [],
        lines: [line('PF-01', 400, t2), line('PF-02', 150, t2), line('PF-07', 50, t2), line('PF-11', 40, t2), line('PF-12', 40, t2)] },
    )

    // Numérotation : l'historique se termine à BDL-2026-0260.
    const hist = siteBdls.filter(b => !b.id).sort((a, b) => a.ts! - b.ts!)
    hist.forEach((b, i) => { b.id = `BDL-2026-0${261 - hist.length + i}` })
    moves.forEach(m => { if (m.kind === 'Réception BDL') m.ref = hist.find(b => b.counts![0].ts === m.ts)!.id })

    // Alerte confidentielle (direction et contrôleur) sur la livraison avec écart.
    const g = hist.find(b => b.status === BDL_ST.gap)!
    alerts.push({
      id: team.alertId, type: 'Écart BDL', severity: 'Haute', value: 30 * product('PF-01').retail,
      detail: `${g.id} (${shopName(site)}) : 30 pains 150 g manquants × ${product('PF-01').retail} FCFA`,
      people: `${store} (magasin du site) / ${shop} (boutiquier)`, status: site === 'SIT-02' ? 'En investigation' : 'Nouvelle',
      ref: { kind: 'BDL', id: g.id, site },
      history: [
        { at: at(g.counts![0].ts + 60000), by: 'Système', text: 'Alerte générée automatiquement à la validation du comptage — statut « Nouvelle ».' },
        ...(site === 'SIT-02' ? [{ at: at(demoTs(GAP_DAY, 9, 5)), by: 'Dr Carine SODJI', text: 'Passée « En investigation ». Vérification du chargement et du comptage en cours.' }] : []),
      ],
    })

    bdls.push(...siteBdls)
    moves.sort((a, b) => a.ts - b.ts)
    shopMoves.push(...moves.map((m, i) => ({ ...m, id: `SMV-S${site.slice(-1)}-${String(i + 1).padStart(6, '0')}` })))
  })

  return { shopMoves, shopBdls: bdls, declarations, shopAlerts: alerts }
}
