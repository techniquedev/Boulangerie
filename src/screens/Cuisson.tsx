import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { REJECT_THRESHOLD, rejectRate } from '../data/production'
import { figures, REJECT_REASONS, type RejectReason } from '../data/boulanger'
import { siteShort } from '../data/org'
import { can } from '../data/rbac'
import { nowStamp, num } from '../lib/format'

type Rej = { reason: RejectReason; qty: string; photo: boolean }
const blank = (): Rej[] => REJECT_REASONS.map(reason => ({ reason, qty: '', photo: false }))

// Lots remis au four par le boulanger du site : l'enfourneur saisit la cuisson sans pouvoir modifier les pâtons reçus.
export function Cuisson() {
  const { user, state, update, say, audit } = useApp()
  const u = user!
  const lots = state.lots.filter(l => u.sites.includes(l.site) && l.status !== 'Créé').sort((a, b) => b.ts - a.ts).slice(0, 40)
  const [sel, setSel] = useState(lots.find(l => l.status === 'Remis au four')?.id || lots[0]?.id)
  const [good, setGood] = useState('')
  const [rows, setRows] = useState<Rej[]>(blank)
  const lot = lots.find(l => l.id === sel) || lots[0]
  if (!lot) return <Screen title="Cuisson et rebuts"><Notice>Aucun lot remis au four pour votre site.</Notice></Screen>

  const received = figures(lot).patons
  const r = lot.cuisson
  const editing = !r && lot.status === 'Remis au four' && can.saisieCuisson(u.role)
  const g = r ? r.good : Number(good) || 0
  const rejects = r ? r.rejects.reduce((a, x) => a + x.qty, 0) : rows.reduce((a, x) => a + (Number(x.qty) || 0), 0)
  const equal = g + rejects === received
  const rate = rejectRate(rejects, received)

  const pick = (id: string) => { setSel(id); setGood(''); setRows(blank()) }
  const tryClose = () => {
    if (!equal) return say(`Clôture bloquée : ${num(g)} + ${num(rejects)} ≠ ${num(received)}.`)
    const at = nowStamp()
    const report = { by: u.name, at, received, good: g, rejects: rows.map(x => ({ reason: x.reason, qty: Number(x.qty) || 0, photo: x.photo })) }
    update(s => ({ ...s, lots: s.lots.map(l => l.id === lot.id ? { ...l, cuisson: report, status: 'Mis en stock',
      history: [...l.history, { status: 'Cuit', at, by: u.name }, { status: 'Mis en stock', at, by: u.name }] } : l) }))
    audit('Cuisson', `${lot.id} : ${g} conformes + ${rejects} rebuts = ${received} pâtons reçus`)
    say('Lot cuit et mis en stock STK-PF')
  }

  return (
    <Screen title="Cuisson et rebuts" sub="Pâtons reçus = conformes + rebuts — les pâtons reçus proviennent du lot du boulanger et ne sont pas modifiables">
      <div className="split">
        <div className="list-col scroll-list">
          {lots.map(l => <button key={l.id} className={`list-item ${l.id === lot.id ? 'on' : ''}`} onClick={() => pick(l.id)}>
            <b>{l.id}</b><small>{l.trace.localAt} · {siteShort(l.site)} · {l.trace.author}</small>
            <Badge tone={l.status === 'Remis au four' ? 'warn' : 'ok'}>{l.status}</Badge>
          </button>)}
        </div>
        <Card title={`Lot ${lot.id}`} sub={r ? `Cuisson saisie par ${r.by} le ${r.at}` : `Remis au four par ${lot.trace.author}`}
          actions={<Badge tone={r ? 'ok' : 'warn'}>{lot.status}</Badge>}>
          <Table head={['Format', 'Pâtons reçus']} rows={figures(lot).lines.map(l => [l.label, <b>{num(l.qty)}</b>])} />
          <div className="kpi-row">
            <Kpi label="Pâtons reçus" value={num(received)} />
            {editing
              ? <label className="kpi-tile"><p>Pains conformes</p><input className="num-input" inputMode="numeric" value={good} placeholder="0" onChange={e => setGood(e.target.value.replace(/\D/g, ''))} /></label>
              : <Kpi label="Pains conformes" value={num(g)} />}
            <Kpi label="Rebuts" value={num(rejects)} />
            <Kpi label="Taux de rebut" value={`${rate.toFixed(2).replace('.', ',')} %`} tone={rate <= REJECT_THRESHOLD ? 'ok' : 'danger'} note={`Seuil ${REJECT_THRESHOLD} %`} />
          </div>
          <Notice tone={equal ? 'ok' : 'danger'}>{num(g)} + {num(rejects)} = {num(g + rejects)} {equal ? '= ' : '≠ '}{num(received)} {equal ? '✓' : '— clôture impossible'}</Notice>
          <Table head={['Motif du rebut', 'Quantité', 'Photo']} rows={editing
            ? rows.map((x, i) => [x.reason,
              <input className="num-input sm" inputMode="numeric" value={x.qty} placeholder="0" onChange={e => setRows(rows.map((y, k) => k === i ? { ...y, qty: e.target.value.replace(/\D/g, '') } : y))} />,
              <label className="check"><input type="checkbox" checked={x.photo} onChange={e => setRows(rows.map((y, k) => k === i ? { ...y, photo: e.target.checked } : y))} /> Photo jointe</label>])
            : (r?.rejects ?? []).map(x => [x.reason, <b>{num(x.qty)}</b>, x.photo ? <Badge tone="ok">Photo jointe</Badge> : '—'])} />
          {!r && !editing && <Notice tone="warn">Cuisson en attente de saisie par l’enfourneur.</Notice>}
          {editing && <Big onClick={tryClose}>Clôturer la cuisson et mettre en stock</Big>}
        </Card>
      </div>
    </Screen>
  )
}
