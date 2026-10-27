import { ClipboardCheck, PackageCheck, Plus } from 'lucide-react'
import { useNav } from '../../store/nav'
import { Badge, Card, Kpi, Screen, Table } from '../../components/ui'
import { emptyStock, figures, FORMATS, isToday, LOT_FLOW, MATS, matQty } from '../../data/boulanger'
import { dec, num, today } from '../../lib/format'
import { StatusBadge, useBaker, YieldGauge } from './shared'

export function BHome() {
  const go = useNav()
  const { mine, bons, stock, threshold, siteName } = useBaker()
  const lots = mine.filter(l => isToday(l.ts))
  const figs = lots.map(figures)
  const bags = figs.reduce((s, f) => s + f.bags, 0)
  const kg = figs.reduce((s, f) => s + f.kg, 0)
  const eps = figs.reduce((s, f) => s + f.eps, 0)
  const perBag = bags ? eps / bags : 0

  // Pâtons façonnés du jour par format (formats ajoutés regroupés sous leur libellé).
  const byFormat = new Map<string, number>(FORMATS.map(f => [f.label, 0]))
  figs.forEach(f => f.lines.forEach(l => byFormat.set(l.label, (byFormat.get(l.label) || 0) + l.qty)))

  const sentToOven = lots.filter(l => l.status !== 'Créé')
  const pending = bons.filter(b => b.status === 'À confirmer')
  const receivedToday = emptyStock()
  bons.filter(b => b.status === 'Confirmé' && b.confirmTs && isToday(b.confirmTs))
    .forEach(b => b.lines.forEach(l => { receivedToday[l.mat] += l.received ?? l.qty }))

  return (
    <Screen title="Accueil" sub={`Atelier boulangerie ${siteName} — journée du ${today()}`}>
      <div className="quick-actions">
        <button className="quick-btn" onClick={() => go('bPetrissee')}><Plus size={34} /><span>Nouvelle pétrissée</span></button>
        <button className="quick-btn alt" onClick={() => go('bReception')}>
          <ClipboardCheck size={34} /><span>Confirmer une réception de matières</span>
          {pending.length > 0 && <em className="count-pill">{pending.length} à confirmer</em>}
        </button>
      </div>

      <Card title="Mes indicateurs du jour">
        <div className="kpi-row">
          <Kpi label="Pétrissées saisies" value={num(lots.length)} />
          <Kpi label="Sacs de farine consommés" value={`${dec(bags, 2)} sac${bags > 1 ? 's' : ''}`} note={`${num(bags * 50)} kg`} />
          <Kpi label="Pâte façonnée" value={`${dec(kg)} kg`} />
          <Kpi label="EPS total" value={`${num(eps)} EPS`} note="Poids total ÷ 146 g" />
        </div>
        <div className="gauge-box"><p>Rendement moyen du jour</p>{bags ? <YieldGauge perBag={perBag} threshold={threshold} big /> : <p className="muted">Aucune pétrissée aujourd’hui.</p>}</div>
      </Card>

      <Card title="Pâtons façonnés du jour par format">
        <div className="format-grid">{[...byFormat].map(([label, n]) => <div key={label} className="format-tile"><span>{label}</span><b>{num(n)}</b></div>)}</div>
      </Card>

      <Card title="Lots remis à l’enfourneur" sub={`${num(sentToOven.length)} lot(s) aujourd’hui`}
        actions={<div className="btn-row">{LOT_FLOW.slice(1).map(s => <Badge key={s} tone="neutral">{s} : {lots.filter(l => l.status === s).length}</Badge>)}</div>}>
        {lots.length ? <Table head={['Lot', 'Heure', 'Pâtons', 'Statut']} rows={lots.map(l => [<b>{l.id}</b>, l.trace.localAt.slice(11), num(figures(l).patons), <StatusBadge s={l.status} />])} />
          : <p className="muted">Aucun lot aujourd’hui.</p>}
      </Card>

      <Card title="Matières" sub="Reçues aujourd’hui (bons de sortie confirmés) et stock disponible à l’atelier"
        actions={<button className="link-btn" onClick={() => go('bReception')}><PackageCheck size={14} /> Réceptions</button>}>
        <Table head={['Matière', 'Reçue aujourd’hui', 'Stock atelier']} rows={MATS.map(m => [
          <b>{m.label}</b>, matQty(m.key, receivedToday[m.key]), stock[m.key] > 0 ? <b>{matQty(m.key, stock[m.key])}</b> : <Badge tone="warn">Épuisé</Badge>])} />
      </Card>
    </Screen>
  )
}
