import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Card, Screen, Steps, Notice, Big } from '../components/ui'
import { money, nowStamp } from '../lib/format'
import { can } from '../data/rbac'
import type { AlertStatus } from '../data/types'

const FLOW: AlertStatus[] = ['Nouvelle', 'En investigation', 'Justifiée', 'Clôturée']
const stepIndex = (s: AlertStatus) => (s === 'Imputée' ? 2 : FLOW.indexOf(s))

export function Alerts() {
  const { user, state, update, audit, say } = useApp()
  const [sel, setSel] = useState(state.alerts[0]?.id)
  const [comment, setComment] = useState('')
  if (!can.seeAlerts(user!.role)) return <Notice tone="danger">Accès refusé : alertes réservées au Contrôleur et à la Direction (RG-10).</Notice>
  const a = state.alerts.find(x => x.id === sel) || state.alerts[0]

  const advance = (status: AlertStatus) => {
    if (!comment.trim()) return say('Un commentaire est obligatoire pour faire avancer l’alerte.')
    update(s => ({ ...s, alerts: s.alerts.map(x => x.id === a.id ? { ...x, status, history: [...x.history, { at: nowStamp(), by: user!.name, text: `${x.status} → ${status} : ${comment}` }] } : x) }))
    audit('Alerte', `${a.id} : ${a.status} → ${status}`)
    setComment(''); say(`Alerte ${a.id} : ${status}`)
  }
  const next = a.status === 'Nouvelle' ? ['En investigation'] : a.status === 'En investigation' ? ['Justifiée', 'Imputée'] : a.status === 'Justifiée' || a.status === 'Imputée' ? ['Clôturée'] : []

  return (
    <Screen title="Alertes d’écart et de fraude" sub="Visibles uniquement pour Contrôleur et Direction (RG-10) — circuit US-34">
      <div className="split">
        <div className="list-col">
          {state.alerts.map(x => <button key={x.id} className={`list-item ${x.id === a.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
            <b>{x.id}</b><span>{x.type}</span>
            <Badge tone={x.severity === 'Haute' ? 'danger' : 'warn'}>{x.severity}</Badge><small>{x.status}</small>
          </button>)}
        </div>
        <Card title={`${a.id} — ${a.type}`} sub={a.detail}>
          <Steps steps={['Nouvelle', 'En investigation', 'Justifiée / Imputée', 'Clôturée']} current={stepIndex(a.status)} />
          <p><b>Gravité :</b> {a.severity} &nbsp; <b>Valeur :</b> {a.value ? money(a.value) : '—'}</p>
          <p><b>Personnes concernées :</b> {a.people}</p>
          <h4>Historique et commentaires</h4>
          <ul className="timeline">{a.history.map((h, i) => <li key={i}><small>{h.at} · {h.by}</small><span>{h.text}</span></li>)}</ul>
          {next.length > 0 ? <>
            <textarea className="area" value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire (obligatoire)" />
            <div className="btn-row">{next.map(n => <Big key={n} onClick={() => advance(n as AlertStatus)}>{n}</Big>)}</div>
          </> : <Notice tone="ok">Alerte clôturée — historique conservé (RG-03).</Notice>}
        </Card>
      </div>
    </Screen>
  )
}
