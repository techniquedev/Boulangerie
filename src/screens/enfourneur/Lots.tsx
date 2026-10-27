import { useState } from 'react'
import { Flame, Hand, Lock, MessageSquareWarning } from 'lucide-react'
import { useApp } from '../../store/context'
import { useNav } from '../../store/nav'
import { Big, Card, Notice, Screen, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { figures, LOT_STATUSES, type LotStatus, type ProdLot } from '../../data/boulanger'
import { nowStamp, num } from '../../lib/format'
import { TraceInfo } from '../boulanger/shared'
import { handedAt, LotBadge, LotSteps, useOven } from './shared'

// Prise en charge d'un lot par l'enfourneur : « Remis au four » → « En cours de cuisson ».
export function useTakeCharge() {
  const { state, update, audit, say } = useApp()
  const { user, site } = useOven()
  return (l: ProdLot) => {
    const t = traceFor(user.name, site, state.offline), at = nowStamp()
    update(s => ({
      ...s, lots: s.lots.map(x => x.id === l.id && x.site === l.site ? { ...x, status: 'En cours de cuisson', oven: { by: user.name, trace: t, ts: Date.now() },
        history: [...x.history, { status: 'En cours de cuisson', at, by: user.name }] } : x),
      queue: s.offline ? [{ id: l.id, text: `Prise en charge ${l.id}`, at }, ...s.queue] : s.queue,
    }))
    audit('Prise en charge de lot', `${l.id} pris en charge par ${user.name} (en cours de cuisson)`)
    say(`Lot ${l.id} pris en charge`)
  }
}

export function ELots() {
  const { state, update, audit, say } = useApp()
  const go = useNav()
  const { user, site, lots } = useOven()
  const take = useTakeCharge()
  const [st, setSt] = useState<LotStatus | ''>('')
  const list = lots.filter(l => l.status !== 'Créé' && (!st || l.status === st))
  const [sel, setSel] = useState((lots.find(l => l.status === 'Remis au four') || lots[0])?.id)
  const lot = list.find(l => l.id === sel) || list[0]
  const [text, setText] = useState('')

  // Anomalie : commentaire tracé au boulanger et à la hiérarchie, sans jamais modifier les pâtons.
  const report = () => {
    if (!lot || !text.trim()) return say('Décrivez l’anomalie constatée.')
    const t = traceFor(user.name, site, state.offline)
    update(s => ({
      ...s, lots: s.lots.map(x => x.id === lot.id && x.site === lot.site ? { ...x, anomalies: [...(x.anomalies || []), { at: nowStamp(), by: user.name, text: text.trim(), trace: t }] } : x),
      notifications: [{ id: `N-${Date.now()}`, text: `Anomalie signalée par ${user.name} sur ${lot.id} : ${text.trim()}`, roles: ['boulanger', 'direction', 'controleur'], at: nowStamp() }, ...s.notifications],
    }))
    audit('Anomalie de lot', `${lot.id} : ${text.trim()}`)
    say('Anomalie signalée au boulanger et à la hiérarchie'); setText('')
  }

  return (
    <Screen title="Lots de pâtons reçus du boulanger" sub="Quantités en lecture seule — saisies par le boulanger">
      <div className="filter-row">{(['', ...LOT_STATUSES.slice(1)] as (LotStatus | '')[]).map(s => <button key={s || 'all'} className={st === s ? 'chip on' : 'chip'} onClick={() => setSt(s)}>{s || 'Tous les lots du site'}</button>)}</div>
      {!lot ? <Notice>Aucun lot.</Notice> : <div className="split">
        <div className="list-col scroll-list">{list.map(l => <button key={l.id} className={`list-item ${l === lot ? 'on' : ''}`} onClick={() => { setSel(l.id); setText('') }}>
          <b>{l.id}</b><small>Remis le {handedAt(l)} · {num(figures(l).patons)} pâtons</small><LotBadge s={l.status} />
        </button>)}</div>
        <Card title={`Lot ${lot.id}`} sub={`Remis au four le ${handedAt(lot)} par ${lot.trace.author}`} actions={<LotBadge s={lot.status} />}>
          <LotSteps l={lot} />
          <Notice><Lock size={14} /> Les quantités de pâtons ne sont pas modifiables. En cas d’écart avec le lot reçu, signalez une anomalie.</Notice>
          <Table head={['Format', 'Pâtons']} rows={[...figures(lot).lines.map(x => [x.label, <b>{num(x.qty)}</b>]), [<b>Total</b>, <b>{num(figures(lot).patons)}</b>]]} />
          {lot.oven && <><p className="trace">Pris en charge par {lot.oven.by}</p><TraceInfo t={lot.oven.trace} /></>}
          <div className="btn-row">
            {lot.status === 'Remis au four' && <Big onClick={() => take(lot)}><Hand size={20} /> Prendre en charge le lot</Big>}
            {lot.status === 'En cours de cuisson' && <Big onClick={() => go('eCuisson', lot.id)}><Flame size={20} /> Saisir la cuisson</Big>}
          </div>
          {(lot.anomalies || []).map((a, i) => <div key={i} className="pass"><b>Anomalie signalée — {a.by}, {a.at}</b><p>{a.text}</p>
            {a.answer ? <p className="ok-text">Réponse de {a.answer.by} ({a.answer.at}) : {a.answer.text}</p> : <small className="muted">En attente de réponse du boulanger</small>}</div>)}
          <div className="close-box">
            <b>Signaler une anomalie</b>
            <textarea className="area" value={text} onChange={e => setText(e.target.value)} placeholder="Ex. : 12 pâtons de 100 g en moins sur la grille reçue" />
            <Big tone="ghost" onClick={report}><MessageSquareWarning size={18} /> Envoyer au boulanger et à la hiérarchie</Big>
          </div>
        </Card>
      </div>}
    </Screen>
  )
}
