import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { cuissonLot, REJECT_THRESHOLD, rejectRate } from '../data/production'
import { num } from '../lib/format'

export function Cuisson() {
  const { say, audit } = useApp()
  const [rows, setRows] = useState(cuissonLot.rejects)
  const [good, setGood] = useState(String(cuissonLot.good))
  const [closed, setClosed] = useState(true)
  const rejects = rows.reduce((a, r) => a + r.qty, 0)
  const g = Number(good) || 0
  const equal = g + rejects === cuissonLot.received
  const rate = rejectRate(rejects, cuissonLot.received)
  const missingMotive = rows.some(r => r.qty > 0 && !r.reason)

  const tryClose = () => {
    if (!equal) return say(`Clôture bloquée : ${num(g)} + ${num(rejects)} ≠ ${num(cuissonLot.received)} (RG-02).`)
    if (missingMotive) return say('Un motif est obligatoire pour chaque rebut.')
    setClosed(true); audit('Cuisson', `${cuissonLot.id} clôturé : ${g} conformes + ${rejects} rebuts = ${cuissonLot.received}`); say('Lot de cuisson clôturé et mis en stock STK-PF')
  }
  const setQty = (i: number, v: string) => { setClosed(false); setRows(rows.map((r, k) => k === i ? { ...r, qty: Number(v) || 0 } : r)) }

  return (
    <Screen title="Cuisson et rebuts" sub={`${cuissonLot.id} · saisi par ${cuissonLot.by} · RG-02 : pâtons reçus = conformes + rebuts`}>
      <Card title="Contrôle d’égalité" actions={<Badge tone={closed && equal ? 'ok' : 'warn'}>{closed && equal ? cuissonLot.status : 'Non clôturé'}</Badge>}>
        <div className="kpi-row">
          <Kpi label="Pâtons reçus" value={num(cuissonLot.received)} />
          <label className="kpi-tile"><p>Pains conformes</p><input className="num-input" inputMode="numeric" value={good} onChange={e => { setClosed(false); setGood(e.target.value.replace(/\D/g, '')) }} /></label>
          <Kpi label="Rebuts" value={num(rejects)} />
          <Kpi label="Taux de rebut" value={`${rate.toFixed(2).replace('.', ',')} %`} tone={rate <= REJECT_THRESHOLD ? 'ok' : 'danger'} note={`Seuil ${REJECT_THRESHOLD} %`} />
        </div>
        <Notice tone={equal ? 'ok' : 'danger'}>{num(g)} + {num(rejects)} = {num(g + rejects)} {equal ? '= ' : '≠ '}{num(cuissonLot.received)} {equal ? '✓' : '— clôture impossible'}</Notice>
        <Table head={['Motif du rebut', 'Quantité', 'Photo']} rows={rows.map((r, i) => [
          r.reason, <input className="num-input sm" inputMode="numeric" value={r.qty} onChange={e => setQty(i, e.target.value)} />,
          r.photo ? <Badge tone="ok">Photo jointe</Badge> : <Badge tone="warn">Photo requise</Badge>])} />
        <Big onClick={tryClose}>Clôturer le lot de cuisson</Big>
      </Card>
    </Screen>
  )
}
