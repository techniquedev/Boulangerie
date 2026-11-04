import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Clock, Info, ShoppingBag, TriangleAlert, Truck, X, type LucideIcon } from 'lucide-react'
import { useApp } from '../store/context'
import { useNav } from '../store/nav'
import { Notice, Table } from '../components/ui'
import { useSiteFilter } from '../components/SiteFilter'
import { siteShort } from '../data/org'
import { bakeryDay, pastryDay, shopSales, shopStatus, storeStatus, toursOf } from '../data/direction'
import { fmtQty, siteStock } from '../data/stock'
import type { DemoState } from '../data/state'
import type { AlertItem, SiteCode } from '../data/types'
import { dayStartTs, money, num } from '../lib/format'

// ——— Tableau de bord du Directeur général : écran de pilotage en lecture seule, centré sur les écarts et les décisions ———

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
const pl = (n: number, one: string, many = `${one}s`) => (n > 1 ? many : one)

// Badge de statut : toujours une icône + un texte, la couleur ne porte jamais seule l'information.
const DgBadge = ({ tone = 'neutral', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) =>
  <span className={`dg-badge ${tone}`}>{Icon && <Icon size={14} aria-hidden />}{children}</span>

const DgKpi = ({ label, value, note, badge }: { label: string; value: string; note?: string; badge?: ReactNode }) => (
  <div className="dg-kpi">
    <p className="dg-kpi-label">{label}</p>
    <b className="dg-kpi-value">{value}</b>
    <small className="dg-kpi-note">{note || ' '}</small>
    {badge}
  </div>
)

const DgPanel = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => (
  <section className="dg-panel">
    <div className="dg-panel-head"><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></div>
    <div className="dg-panel-body">{children}</div>
  </section>
)

// Rendement : badge sémantique selon l'objectif (seuil EPS/sac).
const epsBadge = (perBag: number, threshold: number) => perBag >= threshold
  ? <DgBadge tone="ok" icon={CheckCircle2}>{num(perBag)} EPS/sac</DgBadge>
  : <DgBadge tone="danger" icon={TriangleAlert}>{num(perBag)} EPS/sac</DgBadge>

// Rattachement d'une alerte à un site : objet contrôlé, site cité dans le libellé, tournée ou session de caisse concernée.
const alertSite = (a: AlertItem, s: DemoState): SiteCode | undefined => {
  if (a.ref?.site) return a.ref.site
  const m = `${a.detail} ${a.people}`.match(/SIT-0([1-3])|SITE ([1-3])/i)
  if (m) return `SIT-0${m[1] || m[2]}` as SiteCode
  return s.tours.find(t => a.detail.includes(t.id))?.site ?? s.sessions.find(x => a.detail.includes(x.id))?.site
}

// Ancienneté d'une alerte à partir de son premier événement (JJ/MM/AAAA HH:MM, heure de Porto-Novo).
const ageOf = (at?: string) => {
  if (!at) return '—'
  const ts = dayStartTs(at.slice(0, 10)) + (Number(at.slice(11, 13)) || 0) * 3600000 + (Number(at.slice(14, 16)) || 0) * 60000
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000))
  return min < 60 ? `il y a ${min} min` : min < 1440 ? `il y a ${Math.floor(min / 60)} h` : `il y a ${Math.floor(min / 1440)} j`
}

const SEVERITY_RANK = { Haute: 0, Moyenne: 1, Basse: 2 } as const
type TabId = 'production' | 'stocks' | 'tours'
const TABS: { id: TabId; label: string }[] = [{ id: 'production', label: 'Production' }, { id: 'stocks', label: 'Stocks' }, { id: 'tours', label: 'Tournées' }]

export function Dashboard() {
  const { user, state } = useApp()
  const go = useNav()
  const { site, scope, period, inP, label, bar } = useSiteFilter()
  const full = user!.role === 'direction' || user!.role === 'controleur'
  const [tab, setTab] = useState<TabId>('production')
  const [lowSite, setLowSite] = useState<SiteCode | null>(null)

  useEffect(() => {
    if (!lowSite) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLowSite(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lowSite])

  const rows = scope.map(s => ({
    site: s, sales: shopSales(state, s, inP), bake: bakeryDay(state, s, inP), pat: pastryDay(state, s, inP),
    store: storeStatus(state, s), shop: shopStatus(state, s, inP), tours: toursOf(state, s, inP),
  }))
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const bags = sum(r => r.bake.bags), eps = sum(r => r.bake.eps), perBag = bags ? eps / bags : 0
  const tourCash = sum(r => r.tours.reduce((a, x) => a + x.f.cash, 0)), tourMomo = sum(r => r.tours.reduce((a, x) => a + x.f.momo, 0))
  const tourCount = sum(r => r.tours.length)
  const salesTotal = sum(r => r.sales.ca), salesQty = sum(r => r.sales.qty)
  const openAlerts = state.alerts.filter(a => a.status !== 'Clôturée')
  const highAlerts = openAlerts.filter(a => a.severity === 'Haute').length
  const valid = state.expenses.filter(e => e.status !== 'Demandée' && e.status !== 'Refusée').reduce((a, e) => a + e.amount, 0)
  const pending = state.expenses.filter(e => e.status === 'Demandée').reduce((a, e) => a + e.amount, 0)

  const alertsOf = (s: SiteCode) => openAlerts.filter(a => alertSite(a, state) === s)
  const unattached = openAlerts.filter(a => !alertSite(a, state)).length
  const priority = [...openAlerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.id.localeCompare(a.id)).slice(0, 5)

  const subTitle = `${site === 'all' ? `Vue consolidée des ${scope.length} sites` : siteShort(site)} — ${period.mode === 'jour' ? period.value : label}`
  const lowRow = lowSite ? rows.find(r => r.site === lowSite) : undefined
  const lowStock = lowSite ? siteStock(state.movements, lowSite) : {}
  const detailLink = tab === 'production' ? 'production' : tab === 'stocks' ? 'magasin' : 'tour'

  return (
    <div className="dg">
      <div className="dg-head"><h2>Tableau de bord</h2><p>{subTitle}</p></div>
      {bar}

      <div className="dg-kpis">
        <DgKpi label="Ventes boutiques" value={money(salesTotal)} note={rows.map(r => `${siteShort(r.site)} : ${num(r.sales.ca)}`).join(' · ')}
          badge={<DgBadge icon={ShoppingBag}>{num(salesQty)} {pl(salesQty, 'article vendu', 'articles vendus')}</DgBadge>} />
        <DgKpi label="Encaissements des tournées" value={`${num(tourCash)} / ${num(tourMomo)} FCFA`} note="Espèces / Mobile Money"
          badge={<DgBadge icon={Truck}>{num(tourCount)} {pl(tourCount, 'tournée')}</DgBadge>} />
        <DgKpi label="Rendement boulangerie" value={bags ? `${num(perBag)} EPS/sac` : '—'} note={`Objectif ${num(state.epsThreshold)} · ${num(bags)} ${pl(bags, 'sac')}`}
          badge={bags
            ? perBag >= state.epsThreshold ? <DgBadge tone="ok" icon={CheckCircle2}>Au-dessus de l’objectif</DgBadge> : <DgBadge tone="danger" icon={TriangleAlert}>Sous l’objectif</DgBadge>
            : <DgBadge icon={Info}>Aucune pétrissée</DgBadge>} />
        {full && <DgKpi label="Alertes ouvertes" value={String(openAlerts.length)} note="Non clôturées"
          badge={highAlerts
            ? <DgBadge tone="danger" icon={TriangleAlert}>{highAlerts} {pl(highAlerts, 'haute priorité', 'hautes priorités')}</DgBadge>
            : openAlerts.length ? <DgBadge tone="warn" icon={Clock}>Aucune haute priorité</DgBadge> : <DgBadge tone="ok" icon={CheckCircle2}>Aucune alerte</DgBadge>} />}
        {full && <DgKpi label="Dépenses" value={money(valid)} note="validées"
          badge={pending ? <DgBadge tone="warn" icon={Clock}>{money(pending)} en attente</DgBadge> : <DgBadge tone="ok" icon={CheckCircle2}>Rien en attente</DgBadge>} />}
      </div>

      <div className="dg-grid">
        <DgPanel title="Performance des sites" sub={`Ventes, rendement, stock, pertes${full ? ' et alertes' : ''} — ${label}`}>
          <Table head={['Site', 'Ventes', 'Rendement', 'Valeur du stock', 'Pertes', ...(full ? ['Alertes'] : [])]} rows={[
            ...rows.map(r => {
              const al = alertsOf(r.site), hi = al.filter(a => a.severity === 'Haute').length
              return [
                <b>{siteShort(r.site)}</b>, money(r.sales.ca), r.bake.bags ? epsBadge(r.bake.perBag, state.epsThreshold) : '—', money(r.store.value),
                r.shop.lossQty ? <>{money(r.shop.lossValue)}<div className="dg-cell-sub">{num(r.shop.lossQty)} u.</div></> : '—',
                ...(full ? [al.length ? <DgBadge tone={hi ? 'danger' : 'warn'} icon={TriangleAlert}>{al.length}</DgBadge> : '0'] : []),
              ]
            }),
            ...(rows.length > 1 ? [[
              <b>Consolidé</b>, <b>{money(salesTotal)}</b>, bags ? epsBadge(perBag, state.epsThreshold) : '—', <b>{money(sum(r => r.store.value))}</b>,
              <b>{money(sum(r => r.shop.lossValue))}</b>, ...(full ? [<b>{openAlerts.length}</b>] : []),
            ]] : []),
          ]} />
          {full && unattached > 0 && <small className="dg-note">{unattached} {pl(unattached, 'alerte ouverte n’est', 'alertes ouvertes ne sont')} pas rattachée{unattached > 1 ? 's' : ''} à un site précis.</small>}
        </DgPanel>

        {full ? <DgPanel title="Actions prioritaires" sub="Les alertes les plus urgentes — jamais visibles par les opérateurs concernés">
          {priority.length ? <ul className="dg-alerts">{priority.map(a => {
            const s = alertSite(a, state)
            return <li key={a.id} className="dg-alert">
              <div className="dg-alert-top"><b>{a.type}</b>
                <DgBadge tone={a.severity === 'Haute' ? 'danger' : a.severity === 'Moyenne' ? 'warn' : 'neutral'} icon={a.severity === 'Basse' ? Info : TriangleAlert}>{a.severity}</DgBadge></div>
              <span className="dg-alert-meta">{s ? siteShort(s) : 'Tous sites'} · {ageOf(a.history[0]?.at)} · {a.id} · {a.status}</span>
            </li>
          })}</ul> : <div className="dg-empty"><CheckCircle2 size={20} aria-hidden /> Aucune alerte ouverte</div>}
          <button className="dg-btn" onClick={() => go('alerts')}>{openAlerts.length > 1 ? `Voir les ${openAlerts.length} alertes` : 'Voir les alertes'} <ChevronRight size={16} aria-hidden /></button>
        </DgPanel> : <DgPanel title="Actions prioritaires"><Notice>Les alertes d’écart et de fraude sont réservées aux rôles Contrôleur et Direction.</Notice></DgPanel>}
      </div>

      <section className="dg-panel">
        <div className="dg-panel-head">
          <div><h3>Activité opérationnelle</h3><p>{label}</p></div>
          <button className="dg-link" onClick={() => go(detailLink)}>Voir le détail <ChevronRight size={16} aria-hidden /></button>
        </div>
        <div className="dg-tabs" role="tablist" aria-label="Activité opérationnelle">
          {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className="dg-tab" onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <div className="dg-panel-body" role="tabpanel">
          {tab === 'production' && <Table head={['Site', 'Pétrissées', 'Pâtons', 'Rendement', 'Pains conformes / rebuts', 'Pâtisserie', 'Yaourts', 'Glaces']} rows={rows.map(r => [
            <b>{siteShort(r.site)}</b>, num(r.bake.lots.length), num(r.bake.patons), r.bake.bags ? epsBadge(r.bake.perBag, state.epsThreshold) : '—',
            r.bake.good || r.bake.rejects ? `${num(r.bake.good)} / ${num(r.bake.rejects)}` : '—', num(r.pat.P), num(r.pat.Y), num(r.pat.G)])} />}

          {tab === 'stocks' && <Table head={['Site', 'Matières sous le minimum', 'Valeur du stock', 'Bons en attente / écarts', 'BDL en transit / avec écart', 'Références en rupture', 'Pertes boutique']} rows={rows.map(r => [
            <b>{siteShort(r.site)}</b>,
            r.store.low.length
              ? <button className="dg-cell-btn" onClick={() => setLowSite(r.site)}>{r.store.low.length} {pl(r.store.low.length, 'matière')} sous le seuil <ChevronRight size={14} aria-hidden /></button>
              : <DgBadge tone="ok" icon={CheckCircle2}>Aucune</DgBadge>,
            money(r.store.value), `${r.store.pending} / ${r.store.toTreat}`, `${r.shop.transit} / ${r.shop.gaps}`, num(r.shop.rupture),
            r.shop.lossQty ? `${num(r.shop.lossQty)} u. (${money(r.shop.lossValue)})` : '—'])} />}

          {tab === 'tours' && (tourCount
            ? <Table head={['Site', 'Tournée', 'Livreur', 'Statut', 'Livré', 'Encaissé', 'Équilibrage']} rows={rows.flatMap(r => r.tours.map(({ t, f }) => [
              siteShort(r.site), t.id, t.driver,
              t.status === 'Soldée' ? <DgBadge tone="ok" icon={CheckCircle2}>{t.status}</DgBadge>
                : t.status === 'Soldée avec écart' ? <DgBadge tone="danger" icon={TriangleAlert}>{t.status}</DgBadge> : <DgBadge tone="warn" icon={Clock}>{t.status}</DgBadge>,
              f.rows.map(x => `${x.delivered}/${x.loaded}`).join(' · '), `${money(f.cash)} + ${money(f.momo)} MM`,
              t.status.startsWith('Soldée') ? (f.qtyOk && f.cashOk ? 'Équilibrée' : <span className="neg">Écart</span>) : '—']))} />
            : <div className="dg-empty"><Truck size={20} aria-hidden /> Aucune tournée sur la période</div>)}
        </div>
      </section>

      {lowSite && lowRow && <div className="sheet-backdrop" onClick={() => setLowSite(null)}>
        <aside className="sheet dg-sheet" role="dialog" aria-modal="true" aria-label={`Matières sous le seuil — ${siteShort(lowSite)}`} onClick={e => e.stopPropagation()}>
          <div className="dg-panel-head">
            <div><h3>Matières sous le seuil — {siteShort(lowSite)}</h3><p>{lowRow.store.low.length} {pl(lowRow.store.low.length, 'matière')} sous le minimum · stock valorisé {money(lowRow.store.value)}</p></div>
            <button className="dg-close" onClick={() => setLowSite(null)} aria-label="Fermer"><X size={18} /></button>
          </div>
          <div className="dg-panel-body">
            <Table head={['Matière', 'Stock', 'Minimum', 'Manque']} rows={lowRow.store.low.map(m => {
              const q = lowStock[m.mp] || 0
              return [<b>{m.name}</b>, <span className="neg">{fmtQty(m.mp, q)}</span>, fmtQty(m.mp, m.min), fmtQty(m.mp, Math.max(0, m.min - q))]
            })} />
            <button className="dg-btn ghost" onClick={() => { setLowSite(null); go('magasin') }}>Ouvrir Magasin & stocks <ChevronRight size={16} aria-hidden /></button>
          </div>
        </aside>
      </div>}
    </div>
  )
}
