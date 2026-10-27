import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Badge, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { figures, lotDay } from '../../data/boulanger'
import { num } from '../../lib/format'
import { StatusBadge, useBaker } from './shared'
import { usePeriod } from '../../components/PeriodFilter'

export function BCuisson() {
  const { mine } = useBaker()
  const sent = mine.filter(l => l.status !== 'Créé')
  const [sel, setSel] = useState(sent[0]?.id)
  const period = usePeriod(sent.map(lotDay))
  const list = sent.filter(l => period.match(lotDay(l)))
  const lot = list.find(l => l.id === sel) || list[0]
  const r = lot?.cuisson
  const rejects = r ? r.rejects.reduce((s, x) => s + x.qty, 0) : 0
  const equal = r ? r.good + rejects === r.received : false

  return (
    <Screen title="Rapports de cuisson" sub="Établis par l’enfourneur — consultation uniquement · règle : pâtons reçus = pains conformes + rebuts">
      <Notice><Lock size={14} /> Lecture seule : ces données sont saisies par l’enfourneur et ne peuvent pas être modifiées depuis votre poste.</Notice>
      <div className="filter-row">
        {period.bar}
      </div>
      {!lot ? <Notice>Aucun lot remis au four.</Notice> : <div className="split">
        <div className="list-col scroll-list">
          {list.map(l => <button key={l.id} className={`list-item ${l.id === lot.id ? 'on' : ''}`} onClick={() => setSel(l.id)}>
            <b>{l.id}</b><small>{l.trace.localAt}</small>
            {l.cuisson ? <StatusBadge s={l.status} /> : <Badge tone="warn">En attente du rapport</Badge>}
          </button>)}
        </div>
        <Card title={`Lot ${lot.id}`} sub={r ? `Rapport de cuisson de ${r.by} — ${r.at}` : 'Lot au four : rapport non encore établi par l’enfourneur'} actions={<StatusBadge s={lot.status} />}>
          {!r ? <Notice tone="warn">{num(figures(lot).patons)} pâtons remis au four. Le rapport apparaîtra ici dès sa clôture par l’enfourneur.</Notice> : <>
            <div className="kpi-row">
              <Kpi label="Pâtons reçus" value={num(r.received)} />
              <Kpi label="Pains conformes" value={num(r.good)} tone="ok" />
              <Kpi label="Rebuts déclarés" value={num(rejects)} tone={rejects ? 'warn' : 'ok'} />
            </div>
            <div className={`equality ${equal ? 'ok' : 'danger'}`}>
              <span>{num(r.received)}</span><i>=</i><span>{num(r.good)}</span><i>+</i><span>{num(rejects)}</span>
              <b>{equal ? '✓ Contrôle d’égalité respecté' : '✗ Écart : contrôle d’égalité non respecté'}</b>
              <small>pâtons reçus = conformes + rebuts</small>
            </div>
            <Table head={['Motif du rebut', 'Quantité']} rows={r.rejects.map(x => [x.reason, <b>{num(x.qty)}</b>])} />
          </>}
        </Card>
      </div>}
    </Screen>
  )
}
