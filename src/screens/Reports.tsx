import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { useSiteFilter } from '../components/SiteFilter'
import { siteShort } from '../data/org'
import { bakeryDay, pastryDay, shopSales, shopStatus, toursOf } from '../data/direction'
import { figures } from '../data/boulanger'
import { patFigures, prodLine } from '../data/patisserie'
import { productName } from '../data/shop'
import { fmtQty, siteStock, SITE_MATS } from '../data/stock'
import { dayOf, money, num, today } from '../lib/format'
import { exportExcel, exportPdf, type Section } from '../lib/export'
import { TraceInfo } from './boulanger/shared'

export function Reports() {
  const { state, user, say } = useApp()
  const { scope, day, bar } = useSiteFilter()
  const rows = scope.map(site => ({ site, sales: shopSales(state, site, day), bake: bakeryDay(state, site, day), pat: pastryDay(state, site, day), shop: shopStatus(state, site, day), tours: toursOf(state, site, day) }))
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const file = (name: string) => `${name.toLowerCase()}-${day.replace(/\//g, '-')}`

  // Bibliothèque de rapports : exports des données réelles des sites sélectionnés.
  const reports: [string, string, () => Section][] = [
    ['Production', 'Lots, EPS, rendement, rebuts', () => ({ title: `Production — ${day}`, head: ['Site', 'Lot', 'Type', 'Quantité', 'Rendement', 'Auteur'], rows: [
      ...state.lots.filter(l => scope.includes(l.site) && dayOf(l.ts) === day).map(l => { const f = figures(l); return [siteShort(l.site), l.id, 'Boulangerie', `${f.patons} pâtons`, `${num(f.perBag)} EPS/sac`, l.trace.author] }),
      ...state.patLots.filter(l => scope.includes(l.site) && l.fab === day).map(l => { const f = patFigures(l); return [siteShort(l.site), l.id, prodLine(l.line).label, String(f.produced), `${f.yieldReal.toFixed(1)} %`, l.trace.author] }),
    ] })],
    ['Ventes', 'Ventes boutiques et encaissements des tournées', () => ({ title: `Ventes — ${day}`, head: ['Site', 'Ventes boutique (FCFA)', 'Articles vendus', 'Tournées espèces', 'Tournées Mobile Money', 'Ventes à crédit'],
      rows: rows.map(r => [siteShort(r.site), r.sales.ca, r.sales.qty, r.tours.reduce((a, x) => a + x.f.cash, 0), r.tours.reduce((a, x) => a + x.f.momo, 0), r.tours.reduce((a, x) => a + x.f.credit, 0)]) })],
    ['Stocks', 'Magasins de site, valorisation CMP', () => ({ title: `Stocks des magasins de site au ${today()}`, head: ['Site', 'Matière', 'Stock', 'Minimum', 'Valeur (FCFA)'],
      rows: scope.flatMap(x => { const st = siteStock(state.movements, x); return SITE_MATS.map(m => [siteShort(x), m.name, fmtQty(m.mp, st[m.mp] || 0), fmtQty(m.mp, m.min), Math.round((st[m.mp] || 0) * m.cmp)]) }) })],
    ['BDL', 'Émis, réceptionnés, écarts', () => ({ title: 'Bordereaux de livraison', head: ['Site', 'BDL', 'Destination', 'Statut', 'Expédié', 'Compté'],
      rows: state.bdls.filter(b => b.toSite && scope.includes(b.toSite)).map(b => [siteShort(b.toSite!), b.id, b.to, b.status, b.lines.reduce((a, l) => a + l.sent, 0), b.lines.reduce((a, l) => a + (l.counted ?? 0), 0)]) })],
    ['Caisse', 'Sessions, Z de caisse, écarts', () => ({ title: 'Sessions de caisse', head: ['Site', 'Session', 'Ouverte par', 'Statut', 'Tickets', 'Compté'],
      rows: state.sessions.filter(x => scope.includes(x.site)).map(x => [siteShort(x.site), x.id, x.openedBy, x.status, x.tickets.length, x.counted ?? '']) })],
    ['Tournées', 'Chargements, livraisons, équilibrage, versements', () => ({ title: 'Tournées des livreurs', head: ['Site', 'Tournée', 'Livreur', 'Statut', 'Espèces', 'Mobile Money', 'Versement'],
      rows: scope.flatMap(x => toursOf(state, x).map(({ t, f }) => [siteShort(x), t.id, t.driver, t.status, f.cash, f.momo, t.remit ? t.remit.cash + t.remit.momo : ''])) })],
  ]

  return (
    <Screen title="Rapports" sub="Rapport quotidien des 3 sites et bibliothèque de rapports">
      {bar}
      <Card title={`Rapport quotidien — ${day}`} sub="Envoyé le soir par email / WhatsApp à la Direction">
        <div className="kpi-row">
          <Kpi label="Ventes boutiques consolidées" value={money(sum(r => r.sales.ca))} note={rows.map(r => `${siteShort(r.site)} ${num(r.sales.ca)}`).join(' · ')} />
          <Kpi label="Pains conformes / rebuts" value={`${num(sum(r => r.bake.good))} / ${num(sum(r => r.bake.rejects))}`} />
          <Kpi label="Pertes boutiques" value={money(sum(r => r.shop.lossValue))} />
          <Kpi label="Alertes ouvertes" value={String(state.alerts.filter(x => x.status !== 'Clôturée').length)} />
        </div>
        <Table head={['Site', 'Ventes', 'Pétrissées / rendement', 'Pâtisserie · yaourts · glaces', 'BDL avec écart', 'Tournées']} rows={rows.map(r => [<b>{siteShort(r.site)}</b>, money(r.sales.ca),
          r.bake.bags ? `${r.bake.lots.length} · ${num(r.bake.perBag)} EPS/sac` : '—', `${num(r.pat.P)} · ${num(r.pat.Y)} · ${num(r.pat.G)}`, num(r.shop.gaps), r.tours.map(x => x.t.status).join(', ') || '—'])} />
        <button className="big-btn" onClick={() => say('Rapport envoyé par email et WhatsApp (simulation)')}>Envoyer maintenant</button>
      </Card>
      <Card title="Bibliothèque de rapports"><Table head={['Rapport', 'Contenu', 'Export']} rows={reports.map(([name, content, build]) => [<b>{name}</b>, content,
        <span className="btn-inline">
          <button className="link-btn" onClick={() => exportPdf(file(name), `${name} — ${scope.map(siteShort).join(', ')}`, `Édité le ${today()} par ${user!.name}`, [build()])}>PDF</button> ·{' '}
          <button className="link-btn" onClick={() => exportExcel(file(name), [build()])}>Excel</button>
        </span>])} /></Card>
    </Screen>
  )
}

export function Treasury() {
  const { state } = useApp()
  const { scope, day, bar } = useSiteFilter()
  const split = (site: string, cash: boolean) => state.sessions.filter(x => x.site === site && x.openedAt.startsWith(day)).reduce((a, x) => a + (x.summary
    ? (cash ? x.summary.cash : x.summary.momo)
    : x.tickets.filter(t => !t.cancelled).reduce((b, t) => b + t.payments.filter(p => (p.mode === 'Espèces') === cash).reduce((c, p) => c + p.amount, 0), 0)), 0)
  const rows = scope.map(site => {
    const tours = toursOf(state, site, day)
    return { site, ca: shopSales(state, site, day).ca, cash: split(site, true), momo: split(site, false), tourCash: tours.reduce((a, x) => a + x.f.cash, 0), tourMomo: tours.reduce((a, x) => a + x.f.momo, 0),
      versed: state.versements.filter(v => v.site === site).reduce((a, v) => a + v.amount, 0) }
  })
  const ca = rows.reduce((a, r) => a + r.ca + r.tourCash + r.tourMomo, 0)
  const dep = state.expenses.filter(e => e.status !== 'Demandée' && e.status !== 'Refusée').reduce((x, e) => x + e.amount, 0)
  return (
    <Screen title="Trésorerie et résultat simplifiés" sub={`Vue consolidée ventes / encaissements / dépenses — ${day}`}>
      {bar}
      <div className="kpi-row">
        <Kpi label="Ventes du jour (boutiques + tournées)" value={money(ca)} /><Kpi label="Dépenses validées" value={money(dep)} />
        <Kpi label="Dépenses en attente" value={money(state.expenses.filter(e => e.status === 'Demandée').reduce((x, e) => x + e.amount, 0))} tone="warn" />
        <Kpi label="Résultat simplifié" value={money(ca - dep)} tone={ca - dep >= 0 ? 'ok' : 'danger'} />
      </div>
      <Card title="Par site"><Table head={['Site', 'Ventes boutique', 'Caisse espèces', 'Caisse Mobile Money', 'Tournées espèces', 'Tournées Mobile Money', 'Versements enregistrés']} rows={rows.map(r => [
        <b>{siteShort(r.site)}</b>, money(r.ca), money(r.cash), money(r.momo), money(r.tourCash), money(r.tourMomo), money(r.versed)])} /></Card>
      <Notice>Ventes boutique valorisées au prix de détail à partir des mouvements du stock vendant ; la ventilation espèces / Mobile Money provient des sessions de caisse.</Notice>
    </Screen>
  )
}

// Tournées des livreurs des 3 sites : chargement, livraisons, équilibrage et versements (vue Direction).
export function Tour() {
  const { state } = useApp()
  const { scope, bar } = useSiteFilter(false)
  const list = scope.flatMap(x => toursOf(state, x))
  const [sel, setSel] = useState<string | null>(null)
  const cur = list.find(x => `${x.t.id}` === sel) || list[0]
  return (
    <Screen title="Tournées des livreurs" sub="Chargé = livré + retourné + pertes · encaissé attendu = versé">
      {bar}
      {!cur ? <Notice>Aucune tournée.</Notice> : <div className="split">
        <div className="list-col scroll-list">{list.map(({ t }) => <button key={t.id} className={`list-item ${t === cur.t ? 'on' : ''}`} onClick={() => setSel(t.id)}>
          <b>{t.id}</b><small>{siteShort(t.site)} · {t.driver} · {t.bdl}</small><Badge tone={t.status === 'Soldée' ? 'ok' : t.status === 'Soldée avec écart' ? 'danger' : 'warn'}>{t.status}</Badge>
        </button>)}</div>
        <Card title={`${cur.t.id} — ${cur.t.driver}`} sub={`${siteShort(cur.t.site)} · ${cur.t.bdl} · ${cur.f.stopsDone} / ${cur.t.stops.length} points livrés`}
          actions={<Badge tone={cur.f.qtyOk && cur.f.cashOk ? 'ok' : 'warn'}>{cur.f.qtyOk && cur.f.cashOk ? 'Équilibrée' : cur.t.status.startsWith('Soldée') ? 'Écart' : 'En cours'}</Badge>}>
          <Table head={['Article', 'Chargé', 'Livré / vendu', 'Retourné', 'Pertes', 'Contrôle']} rows={cur.f.rows.map(r => [productName(r.code), num(r.loaded), num(r.delivered), num(r.returned), num(r.lost),
            <b className={r.remaining ? 'neg' : 'ok-text'}>{r.loaded} {r.remaining ? '≠' : '='} {r.delivered} + {r.returned} + {r.lost}</b>])} />
          <div className="kpi-row">
            <Kpi label="Encaissé attendu (espèces / MM)" value={`${num(cur.f.cash)} / ${num(cur.f.momo)} FCFA`} />
            <Kpi label="Versé au bureau central" value={cur.t.remit ? `${num(cur.t.remit.cash)} / ${num(cur.t.remit.momo)} FCFA` : '—'} tone={cur.t.remit ? (cur.f.cashOk ? 'ok' : 'danger') : undefined} />
            <Kpi label="Ventes à crédit" value={money(cur.f.credit)} />
          </div>
          <Table head={['Livraison', 'Client', 'Produits', 'Règlement']} rows={cur.f.deliveries.map(d => [d.id, d.stop.name, d.lines.map(l => `${l.qty} ${productName(l.code)}`).join(', '), d.mode === 'Crédit' ? `Crédit ${money(d.amount)}` : `${money(d.amount)} · ${d.mode}${d.ref ? ` (${d.ref})` : ''}`])} />
          {cur.t.comment && <Notice tone="warn">Remarque du livreur : {cur.t.comment.text}</Notice>}
          {cur.t.start && <TraceInfo t={cur.t.start} />}
        </Card>
      </div>}
    </Screen>
  )
}

export function Notifications() {
  const { user, state } = useApp()
  const mine = state.notifications.filter(n => n.roles.includes(user!.role))
  return (
    <Screen title="Centre de notifications">
      {mine.length === 0 ? <Notice>Aucune notification.</Notice> : <Card>{mine.map(n => <div key={n.id} className="note-line"><b>{n.text}</b><small>{n.at}</small></div>)}</Card>}
    </Screen>
  )
}
