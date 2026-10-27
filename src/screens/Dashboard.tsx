import { useApp } from '../store/context'
import { useNav } from '../store/nav'
import { Badge, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { useSiteFilter } from '../components/SiteFilter'
import { siteShort } from '../data/org'
import { bakeryDay, pastryDay, shopSales, shopStatus, storeStatus, toursOf } from '../data/direction'
import { money, num } from '../lib/format'

export function Dashboard() {
  const { user, state } = useApp()
  const go = useNav()
  const { scope, day, bar } = useSiteFilter()
  const full = user!.role === 'direction' || user!.role === 'controleur'

  const rows = scope.map(site => ({
    site, sales: shopSales(state, site, day), bake: bakeryDay(state, site, day), pat: pastryDay(state, site, day),
    store: storeStatus(state, site), shop: shopStatus(state, site, day), tours: toursOf(state, site, day),
  }))
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const bags = sum(r => r.bake.bags), eps = sum(r => r.bake.eps)
  const tourCash = sum(r => r.tours.reduce((a, x) => a + x.f.cash, 0)), tourMomo = sum(r => r.tours.reduce((a, x) => a + x.f.momo, 0))
  const openAlerts = state.alerts.filter(a => a.status !== 'Clôturée')
  const valid = state.expenses.filter(e => e.status !== 'Demandée' && e.status !== 'Refusée').reduce((a, e) => a + e.amount, 0)
  const pending = state.expenses.filter(e => e.status === 'Demandée').reduce((a, e) => a + e.amount, 0)

  return (
    <Screen title="Tableau de bord" sub={`Journée du ${day} — vue consolidée des 3 sites ou par site`}>
      {bar}
      <div className="kpi-row">
        <Kpi label="Ventes boutiques" value={money(sum(r => r.sales.ca))} note={rows.map(r => `${siteShort(r.site)} ${num(r.sales.ca)}`).join(' · ')} />
        <Kpi label="Encaissements tournées (espèces / Mobile Money)" value={`${num(tourCash)} / ${num(tourMomo)} FCFA`} />
        <Kpi label="Rendement boulangerie" value={bags ? `${num(eps / bags)} EPS/sac` : '—'} tone={bags ? (eps / bags >= state.epsThreshold ? 'ok' : 'danger') : undefined} note={`${num(bags)} sacs · seuil ${state.epsThreshold}`} />
        {full && <Kpi label="Alertes ouvertes" value={String(openAlerts.length)} tone={openAlerts.length ? 'warn' : 'ok'} note="Visibles Direction et Contrôleur uniquement" />}
        {full && <Kpi label="Dépenses validées / en attente" value={`${num(valid)} / ${num(pending)} FCFA`} />}
      </div>

      <Card title="Production" sub="Boulangerie, pâtisserie, yaourts et crèmes glacées" actions={<button className="link-btn" onClick={() => go('production')}>Détail</button>}>
        <Table head={['Site', 'Pétrissées', 'Pâtons', 'Rendement', 'Pains conformes / rebuts', 'Pâtisserie', 'Yaourts', 'Glaces']} rows={rows.map(r => [
          <b>{siteShort(r.site)}</b>, num(r.bake.lots.length), num(r.bake.patons),
          r.bake.bags ? <Badge tone={r.bake.perBag >= state.epsThreshold ? 'ok' : 'danger'}>{num(r.bake.perBag)} EPS/sac</Badge> : '—',
          r.bake.good || r.bake.rejects ? `${num(r.bake.good)} / ${num(r.bake.rejects)}` : '—', num(r.pat.P), num(r.pat.Y), num(r.pat.G)])} />
      </Card>

      <Card title="Magasins de site et boutiques" actions={<div className="btn-row"><button className="link-btn" onClick={() => go('magasin')}>Magasins</button><button className="link-btn" onClick={() => go('bdl')}>Bordereaux</button></div>}>
        <Table head={['Site', 'Matières sous le minimum', 'Valeur stock magasin', 'Bons en attente / écarts', 'BDL en transit / avec écart', 'Références en rupture', 'Pertes boutique']} rows={rows.map(r => [
          <b>{siteShort(r.site)}</b>, r.store.low.length ? <Badge tone="warn">{r.store.low.map(m => m.name).join(', ')}</Badge> : <Badge tone="ok">Aucune</Badge>,
          money(r.store.value), `${r.store.pending} / ${r.store.toTreat}`, `${r.shop.transit} / ${r.shop.gaps}`, num(r.shop.rupture),
          r.shop.lossQty ? `${num(r.shop.lossQty)} u. (${money(r.shop.lossValue)})` : '—'])} />
      </Card>

      <Card title="Tournées des livreurs" actions={<button className="link-btn" onClick={() => go('tour')}>Détail</button>}>
        {rows.some(r => r.tours.length) ? <Table head={['Site', 'Tournée', 'Livreur', 'Statut', 'Livré', 'Encaissé', 'Équilibrage']} rows={rows.flatMap(r => r.tours.map(({ t, f }) => [
          siteShort(r.site), t.id, t.driver, <Badge tone={t.status === 'Soldée' ? 'ok' : t.status === 'Soldée avec écart' ? 'danger' : 'warn'}>{t.status}</Badge>,
          f.rows.map(x => `${x.delivered}/${x.loaded}`).join(' · '), `${money(f.cash)} + ${money(f.momo)} MM`,
          t.status.startsWith('Soldée') ? (f.qtyOk && f.cashOk ? 'Équilibrée' : 'Écart') : '—']))} /> : <Notice>Aucune tournée ce jour.</Notice>}
      </Card>

      {full ? <Card title="Alertes ouvertes" sub="Jamais visibles par les opérateurs concernés" actions={<button className="link-btn" onClick={() => go('alerts')}>Traiter</button>}>
        <Table head={['N°', 'Type', 'Gravité', 'Détail', 'Statut']} rows={openAlerts.slice(0, 12).map(a => [
          a.id, a.type, <Badge tone={a.severity === 'Haute' ? 'danger' : 'warn'}>{a.severity}</Badge>, <small>{a.detail}</small>, a.status])} />
      </Card> : <Notice>Les alertes d’écart et de fraude sont réservées aux rôles Contrôleur et Direction.</Notice>}
    </Screen>
  )
}
