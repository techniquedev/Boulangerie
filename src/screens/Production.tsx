import { useApp } from '../store/context'
import { Badge, Card, Kpi, Screen, Table } from '../components/ui'
import { useSiteFilter } from '../components/SiteFilter'
import { siteShort } from '../data/org'
import { bakeryDay } from '../data/direction'
import { figures, yieldTone } from '../data/boulanger'
import { patFigures, patStatus, pfLots, prodLine } from '../data/patisserie'
import { productName } from '../data/shop'
import { dec, num } from '../lib/format'

// Production des 3 sites : pétrissées (lots boulangerie) et lots pâtisserie / yaourts / glaces.
export function Production() {
  const { state } = useApp()
  const { scope, inP, label, bar } = useSiteFilter()
  // Du plus récent au plus ancien.
  const lots = state.lots.filter(l => scope.includes(l.site) && bakeryDay(state, l.site, inP).lots.includes(l)).sort((a, b) => b.ts - a.ts)
  const pat = state.patLots.filter(l => scope.includes(l.site) && inP(l.fab)).sort((a, b) => b.ts - a.ts)
  const pf = Object.fromEntries(scope.map(s => [s, pfLots(state.patLots.filter(l => l.site === s), state.bdls, s)]))
  const f = lots.map(figures)
  const bags = f.reduce((a, x) => a + x.bags, 0), eps = f.reduce((a, x) => a + x.eps, 0)

  return (
    <Screen title="Production" sub={`Lots — ${label} · EPS = poids total de pâte ÷ 146 g`}>
      {bar}
      <div className="kpi-row">
        <Kpi label="Pétrissées" value={num(lots.length)} note={`${num(bags)} sacs de farine`} />
        <Kpi label="EPS / rendement moyen" value={bags ? `${num(eps)} EPS · ${num(eps / bags)} EPS/sac` : '—'} tone={bags ? yieldTone(eps / bags, state.epsThreshold) : undefined} note={`Seuil ${state.epsThreshold} EPS/sac`} />
        <Kpi label="Lots pâtisserie / yaourts / glaces" value={num(pat.length)} />
      </div>
      <Card title="Boulangerie — pétrissées et lots">
        <Table head={['Site', 'Lot', 'Boulanger', 'Pâtons', 'Pâte', 'Rendement', 'Motif', 'Statut', 'Cuisson (conformes / rebuts)']} rows={lots.map((l, i) => [
          siteShort(l.site), <b>{l.id}</b>, l.trace.author, num(f[i].patons), `${dec(f[i].kg)} kg`,
          <Badge tone={yieldTone(f[i].perBag, l.threshold)}>{num(f[i].perBag)} EPS/sac</Badge>, l.motif || '—', l.status,
          l.cuisson ? `${num(l.cuisson.good)} / ${num(l.cuisson.rejects.reduce((a, r) => a + r.qty, 0))}` : 'En attente'])} />
      </Card>
      <Card title="Pâtisserie, yaourts et crèmes glacées">
        <Table head={['Site', 'Lot', 'Ligne', 'Opérateur', 'Produits', 'Rendement réel / recette', 'DLC', 'Statut']} rows={pat.map(l => {
          const p = patFigures(l)
          return [siteShort(l.site), <b>{l.id}</b>, prodLine(l.line).label, l.trace.author, p.items.map(i => `${num(i.produced)} ${productName(i.code)}`).join(' · '),
            <Badge tone={Math.abs(p.yieldGap) > 5 ? 'danger' : 'ok'}>{dec(p.yieldReal)} % / {l.yieldTheo} %</Badge>, [...new Set(l.items.map(i => i.dlc))].join(', '), patStatus(l, pf[l.site])]
        })} />
      </Card>
    </Screen>
  )
}
