import { Flame, TriangleAlert } from 'lucide-react'
import { useNav } from '../../store/nav'
import { Big, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { cuissonFigures, figures } from '../../data/boulanger'
import { dayOf, num, today } from '../../lib/format'
import { SyncBanner } from '../magasin/shared'
import { handedAt, LotBadge, RateGauge, useOven } from './shared'

export function EHome() {
  const go = useNav()
  const { lots, queue, siteName, threshold } = useOven()
  const day = today()
  // Lots remis au four aujourd'hui ; cuissons validées aujourd'hui.
  const received = lots.filter(l => dayOf(l.ts) === day && l.status !== 'Créé')
  const cooked = lots.filter(l => l.cuisson && l.cuisson.at.startsWith(day)).map(l => ({ l, c: cuissonFigures(l)! }))
  const patons = received.reduce((a, l) => a + figures(l).patons, 0)
  const good = cooked.reduce((a, x) => a + x.c.good, 0), rejects = cooked.reduce((a, x) => a + x.c.rejectTotal, 0)
  const rate = good + rejects ? (rejects / (good + rejects)) * 100 : 0

  return (
    <Screen title="Accueil" sub={`Four de ${siteName} — journée du ${day}`}>
      <SyncBanner />
      <div className="quick-actions">
        <button className="quick-btn" onClick={() => go('eCuisson')}><Flame size={34} /><span>Ouvrir un lot à cuire</span>
          {queue.length > 0 && <em className="count-pill">{queue.length} en attente</em>}</button>
        <button className="quick-btn alt" onClick={() => go('eCuisson', 'rebuts')}><TriangleAlert size={34} /><span>Déclarer des rebuts</span></button>
      </div>

      <Card title="Indicateurs du jour">
        <div className="kpi-row">
          <Kpi label="Lots reçus du boulanger" value={num(received.length)} />
          <Kpi label="Lots en attente de cuisson" value={num(queue.length)} tone={queue.length ? 'warn' : 'ok'} />
          <Kpi label="Lots cuits et clôturés" value={num(cooked.length)} />
          <Kpi label="Pâtons reçus" value={num(patons)} />
          <Kpi label="Pains conformes" value={num(good)} tone="ok" />
          <Kpi label="Rebuts" value={num(rejects)} tone={rejects ? 'warn' : 'ok'} />
        </div>
        <div className="gauge-box"><p>Taux de rebut moyen de la journée</p>{cooked.length ? <RateGauge rate={rate} threshold={threshold} /> : <p className="muted">Aucune cuisson validée aujourd’hui.</p>}</div>
      </Card>

      <Card title="File d’attente des lots à cuire" sub="Lots « Remis au four » à traiter en priorité, du plus ancien au plus récent">
        {queue.length ? <Table head={['Lot', 'Remis au four le', 'Boulanger', 'Pâtons', 'Statut', '']} rows={queue.map(l => [
          <b>{l.id}</b>, handedAt(l), l.trace.author, num(figures(l).patons), <LotBadge s={l.status} />,
          <Big onClick={() => go('eCuisson', l.id)}><Flame size={18} /> Cuire</Big>])} /> : <Notice tone="ok">Aucun lot en attente de cuisson.</Notice>}
      </Card>
    </Screen>
  )
}
