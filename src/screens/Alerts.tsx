import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Card, Screen, Steps, Notice, Big } from '../components/ui'
import { money, nowStamp } from '../lib/format'
import { can } from '../data/rbac'
import type { AlertStatus } from '../data/types'
import { BDL_ST } from '../data/shop'
import { usePeriod } from '../components/PeriodFilter'

const FLOW: AlertStatus[] = ['Nouvelle', 'En investigation', 'Justifiée', 'Clôturée']
const stepIndex = (s: AlertStatus) => (s === 'Imputée' ? 2 : FLOW.indexOf(s))

export function Alerts() {
  const { user, state, update, audit, say } = useApp()
  const [sel, setSel] = useState(state.alerts[0]?.id)
  const [comment, setComment] = useState('')
  const [question, setQuestion] = useState('')
  const per = usePeriod(state.alerts.map(x => x.history[0]?.at || ''))
  const alerts = state.alerts.filter(x => per.match(x.history[0]?.at || ''))
  if (!can.seeAlerts(user!.role)) return <Notice tone="danger">Accès refusé : alertes réservées au Contrôleur et à la Direction.</Notice>
  const a = alerts.find(x => x.id === sel) || alerts[0]
  if (!a) return <Screen title="Alertes d’écart et de fraude" sub="Visibles uniquement pour Contrôleur et Direction">{per.bar}<Notice>Aucune alerte sur la période.</Notice></Screen>

  const advance = (status: AlertStatus) => {
    if (!comment.trim()) return say('Un commentaire est obligatoire pour faire avancer l’alerte.')
    update(s => ({
      ...s, alerts: s.alerts.map(x => x.id === a.id ? { ...x, status, history: [...x.history, { at: nowStamp(), by: user!.name, text: `${x.status} → ${status} : ${comment}` }] } : x),
      // Clôture de l'alerte d'écart : le BDL de la boutique passe « Clôturé ».
      bdls: status === 'Clôturée' && a.ref?.kind === 'BDL' ? s.bdls.map(b => b.id === a.ref!.id && b.toSite === a.ref!.site ? { ...b, status: BDL_ST.clos } : b) : s.bdls,
    }))
    audit('Alerte', `${a.id} : ${a.status} → ${status}`)
    setComment(''); say(`Alerte ${a.id} : ${status}`)
  }
  // Demande d'explication au boutiquier : seule la question lui est visible (ni l'alerte, ni les commentaires internes).
  const ask = () => {
    if (!question.trim() || a.ref?.kind !== 'BDL') return say('Saisissez la question à transmettre.')
    const at = nowStamp()
    update(s => ({
      ...s, bdls: s.bdls.map(b => b.id === a.ref!.id && b.toSite === a.ref!.site ? { ...b, requests: [...(b.requests || []), { at, by: user!.name, text: question.trim() }] } : b),
      alerts: s.alerts.map(x => x.id === a.id ? { ...x, history: [...x.history, { at, by: user!.name, text: `Demande d’explication transmise au boutiquier : ${question.trim()}` }] } : x),
    }))
    audit('Demande d’explication', `${a.ref.id} : ${question.trim()}`); setQuestion(''); say('Demande transmise au boutiquier')
  }
  const bdl = a.ref?.kind === 'BDL' ? state.bdls.find(b => b.id === a.ref!.id && b.toSite === a.ref!.site) : undefined
  const next = a.status === 'Nouvelle' ? ['En investigation'] : a.status === 'En investigation' ? ['Justifiée', 'Imputée'] : a.status === 'Justifiée' || a.status === 'Imputée' ? ['Clôturée'] : []

  return (
    <Screen title="Alertes d’écart et de fraude" sub="Visibles uniquement pour Contrôleur et Direction">
      {per.bar}
      {!a ? <Notice>Aucune alerte sur la période.</Notice> : <div className="split">
        <div className="list-col scroll-list">
          {alerts.map(x => <button key={x.id} className={`list-item ${x.id === a.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
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
          {bdl && <div className="close-box">
            <b>Échanges avec le boutiquier ({bdl.id})</b>
            {(bdl.requests || []).map((r, i) => <p key={i}><small>{r.at} · {r.by}</small><br />{r.text}<br />{r.answer ? <em>Réponse de {r.answer.by} ({r.answer.at}) : {r.answer.text}</em> : <em className="muted">En attente de réponse</em>}</p>)}
            {a.status !== 'Clôturée' && <><input className="ref-input wide" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Demander une explication au boutiquier…" />
              <Big tone="ghost" onClick={ask}>Envoyer la demande</Big></>}
          </div>}
          {next.length > 0 ? <>
            <textarea className="area" value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire (obligatoire)" />
            <div className="btn-row">{next.map(n => <Big key={n} onClick={() => advance(n as AlertStatus)}>{n}</Big>)}</div>
          </> : <Notice tone="ok">Alerte clôturée — historique conservé.</Notice>}
        </Card>
      </div>}
    </Screen>
  )
}
