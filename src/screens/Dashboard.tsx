import { useApp } from '../store/context'
import { useNav } from '../store/nav'
import { Badge, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { useSiteFilter } from '../components/SiteFilter'
import { siteShort } from '../data/org'
import { bakeryDay, pastryDay, shopSales, shopStatus, storeStatus, toursOf } from '../data/direction'
import { money, num } from '../lib/format'
import { siteDemo } from '../data/dgDemo'

export function Dashboard() {
  const { user, state } = useApp()
  const go = useNav()
  const { scope, inP, label, bar, period } = useSiteFilter()
  const full = user!.role === 'direction' || user!.role === 'controleur'
  const isDg = user!.role === 'direction'

  const rows = scope.map(site => {
    const sales = shopSales(state, site, inP), bake = bakeryDay(state, site, inP), pat = pastryDay(state, site, inP)
    const store = storeStatus(state, site), shop = shopStatus(state, site, inP)
    const tours = toursOf(state, site, inP).map(({ t, f }) => ({
      id: t.id, driver: t.driver, status: t.status as string, delivered: f.rows.map(x => `${x.delivered}/${x.loaded}`).join(' · '),
      cash: f.cash, momo: f.momo, balanced: f.qtyOk && f.cashOk,
    }))
    // DG : un indicateur vide sur la période est complété par des données fictives de démonstration propres au site
    const d = isDg ? siteDemo(site, period.mode, period.value) : undefined
    const or = (real: number, demo: number | undefined) => real || demo || 0
    const bags = or(bake.bags, d?.bags), eps = bake.bags ? bake.eps : or(bake.eps, d?.eps)
    return {
      site,
      sales: { ca: or(sales.ca, d?.ca) },
      bake: { lots: or(bake.lots.length, d?.lots), patons: or(bake.patons, d?.patons), bags, eps, perBag: bags ? eps / bags : 0, good: or(bake.good, d?.good), rejects: bake.good ? bake.rejects : or(bake.rejects, d?.rejects) },
      pat: { P: or(pat.P, d?.P), Y: or(pat.Y, d?.Y), G: or(pat.G, d?.G) },
      store: { low: store.low, value: or(store.value, d?.storeValue), pending: or(store.pending, d?.pending), toTreat: or(store.toTreat, d?.toTreat) },
      shop: { transit: or(shop.transit, d?.transit), gaps: or(shop.gaps, d?.gaps), rupture: or(shop.rupture, d?.rupture), lossQty: or(shop.lossQty, d?.lossQty), lossValue: or(shop.lossValue, d?.lossValue) },
      tours: tours.length ? tours : d?.tours ?? [],
    }
  })
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const bags = sum(r => r.bake.bags), eps = sum(r => r.bake.eps)
  const tourCash = sum(r => r.tours.reduce((a, x) => a + x.cash, 0)), tourMomo = sum(r => r.tours.reduce((a, x) => a + x.momo, 0))
  const openAlerts = state.alerts.filter(a => a.status !== 'Clôturée')
  const valid = state.expenses.filter(e => e.status !== 'Demandée' && e.status !== 'Refusée').reduce((a, e) => a + e.amount, 0)
  const pending = state.expenses.filter(e => e.status === 'Demandée').reduce((a, e) => a + e.amount, 0)

  return (
    <Screen title="Tableau de bord" sub={`Période : ${label} — vue consolidée des 3 sites ou par site`}>
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
          <b>{siteShort(r.site)}</b>, num(r.bake.lots), num(r.bake.patons),
          r.bake.bags ? <Badge tone={r.bake.perBag >= state.epsThreshold ? 'ok' : 'danger'}>{num(r.bake.perBag)} EPS/sac</Badge> : '—',
          r.bake.good || r.bake.rejects ? `${num(r.bake.good)} / ${num(r.bake.rejects)}` : '—', num(r.pat.P), num(r.pat.Y), num(r.pat.G)])} />
      </Card>

      <Card title="Magasins de site et boutiques" actions={<div className="btn-row"><button className="link-btn" onClick={() => go('magasin')}>Magasins</button><button className="link-btn" onClick={() => go('bdl')}>Bordereaux</button></div>}>
        <Table head={['Site', 'Matières sous le minimum', 'Valeur stock magasin', 'Bons en attente / écarts', 'BDL en transit / avec écart', 'Références en rupture', 'Pertes boutique']} rows={rows.map(r => [
          <b>{siteShort(r.site)}</b>, r.store.low.length ? (user!.role === 'direction' ? <span>{r.store.low.map(m => m.name).join(', ')}</span> : <Badge tone="warn">{r.store.low.map(m => m.name).join(', ')}</Badge>) : <Badge tone="ok">Aucune</Badge>,
          money(r.store.value), `${r.store.pending} / ${r.store.toTreat}`, `${r.shop.transit} / ${r.shop.gaps}`, num(r.shop.rupture),
          r.shop.lossQty ? `${num(r.shop.lossQty)} u. (${money(r.shop.lossValue)})` : '—'])} />
      </Card>

      <Card title="Tournées des livreurs" actions={<button className="link-btn" onClick={() => go('tour')}>Détail</button>}>
        {rows.some(r => r.tours.length) ? <Table head={['Site', 'Tournée', 'Livreur', 'Statut', 'Livré', 'Encaissé', 'Équilibrage']} rows={rows.flatMap(r => r.tours.map(t => [
          siteShort(r.site), t.id, t.driver, <Badge tone={t.status === 'Soldée' ? 'ok' : t.status === 'Soldée avec écart' ? 'danger' : 'warn'}>{t.status}</Badge>,
          t.delivered, `${money(t.cash)} + ${money(t.momo)} MM`,
          t.status.startsWith('Soldée') ? (t.balanced ? 'Équilibrée' : 'Écart') : '—']))} /> : <Notice>Aucune tournée sur la période.</Notice>}
      </Card>

      {full ? <Card title="Alertes ouvertes" sub="Jamais visibles par les opérateurs concernés" actions={<button className="link-btn" onClick={() => go('alerts')}>Traiter</button>}>
        <Table head={['N°', 'Type', 'Gravité', 'Détail', 'Statut']} rows={openAlerts.slice(0, 12).map(a => [
          a.id, a.type, <Badge tone={a.severity === 'Haute' ? 'danger' : 'warn'}>{a.severity}</Badge>, <small>{a.detail}</small>, a.status])} />
      </Card> : <Notice>Les alertes d’écart et de fraude sont réservées aux rôles Contrôleur et Direction.</Notice>}
    </Screen>
  )
}
