import { useState } from 'react'
import { useApp } from '../../store/context'
import { Big, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { figures, LOT_STATUSES, lotDay, matLabel, matQty, mpOf, yieldTone, type Correction, type LotStatus, type MatKey } from '../../data/boulanger'
import { workshopKey } from '../../data/stock'
import { dec, nowStamp, num } from '../../lib/format'
import { LotFrise, StatusBadge, TraceInfo, useBaker } from './shared'
import { usePeriod } from '../../components/PeriodFilter'

export function BLots() {
  const { update, audit, say } = useApp()
  const { user, site, mine, stock } = useBaker()
  const [status, setStatus] = useState<LotStatus | ''>('')
  const [sel, setSel] = useState(mine[0]?.id)
  const [fix, setFix] = useState({ target: '', delta: '', motif: '' })
  const [reply, setReply] = useState<Record<number, string>>({})

  const period = usePeriod(mine.map(lotDay))
  const list = mine.filter(l => period.match(lotDay(l)) && (!status || l.status === status))
  const lot = list.find(l => l.id === sel) || list[0]
  const f = lot && figures(lot)

  // Contre-écriture : la pétrissée d'origine reste intacte ; les pâtons ne se corrigent plus une fois le lot cuit.
  const canFixLines = lot && (lot.status === 'Créé' || lot.status === 'Remis au four')
  const targets = lot ? [...lot.mats.map(m => ({ id: `mat:${m.mat}`, label: `Matière — ${matLabel(m.mat)}` })),
    ...(canFixLines ? lot.lines.map(l => ({ id: `line:${l.label}`, label: `Pâtons — ${l.label}` })) : [])] : []
  const applyFix = () => {
    if (!lot || !f) return
    const [kind, key] = fix.target.split(':') as ['mat' | 'line', string]
    const delta = Number(fix.delta.replace(',', '.'))
    if (!fix.target || !delta) return say('Choisissez la ligne et la quantité à corriger (ex. -1 ou 0,5).')
    if (!fix.motif.trim()) return say('Le motif de la contre-écriture est obligatoire.')
    const cur = kind === 'mat' ? f.mats.find(m => m.mat === key)!.qty : f.lines.find(l => l.label === key)!.qty
    if (cur + delta < 0) return say('Correction impossible : la quantité corrigée deviendrait négative.')
    if (kind === 'mat' && delta > stock[key as keyof typeof stock]) return say('Stock atelier insuffisant pour cette contre-écriture : le stock ne peut jamais devenir négatif.')
    const c: Correction = { at: nowStamp(), by: user.name, motif: fix.motif.trim(), kind, key, delta }
    const k = workshopKey(site, 'ATL-B')
    update(s => ({
      ...s,
      lots: s.lots.map(l => l.id === lot.id && l.site === lot.site ? { ...l, corrections: [...l.corrections, c] } : l),
      workshop: kind === 'mat' ? { ...s.workshop, [k]: { ...s.workshop[k], [mpOf(key as MatKey)]: +(((s.workshop[k] || {})[mpOf(key as MatKey)] || 0) - delta).toFixed(4) } } : s.workshop,
    }))
    audit('Contre-écriture de pétrissée', `${lot.id} : ${kind === 'mat' ? matLabel(key as never) : key} ${delta > 0 ? '+' : ''}${dec(delta, 2)} — motif : ${c.motif} (écriture d’origine conservée)`)
    say('Contre-écriture tracée'); setFix({ target: '', delta: '', motif: '' })
  }

  const answer = (i: number) => {
    const text = reply[i]?.trim()
    if (!lot || !text) return say('Saisissez votre réponse.')
    update(s => ({ ...s, lots: s.lots.map(l => l.id === lot.id && l.site === lot.site
      ? { ...l, anomalies: (l.anomalies || []).map((a, k) => k === i ? { ...a, answer: { at: nowStamp(), by: user.name, text } } : a) } : l) }))
    audit('Réponse à une anomalie de lot', `${lot.id} : ${text}`)
    say('Réponse transmise à l’enfourneur'); setReply({ ...reply, [i]: '' })
  }

  return (
    <Screen title="Mes lots de production" sub="Lots issus de mes pétrissées — données non modifiables, corrections par contre-écriture tracée">
      <div className="filter-row">
        {period.bar}
        {(['', ...LOT_STATUSES] as (LotStatus | '')[]).map(s => <button key={s || 'all'} className={status === s ? 'chip on' : 'chip'} onClick={() => setStatus(s)}>{s || 'Tous les statuts'}</button>)}
      </div>
      {!lot ? <Notice>Aucun lot pour ces filtres.</Notice> : <div className="split">
        <div className="list-col scroll-list">
          {list.map(l => <button key={l.id} className={`list-item ${l.id === lot.id ? 'on' : ''}`} onClick={() => { setSel(l.id); setFix({ target: '', delta: '', motif: '' }) }}>
            <b>{l.id}</b><small>{l.trace.localAt} · {num(figures(l).patons)} pâtons</small><StatusBadge s={l.status} />
          </button>)}
        </div>
        <Card title={`Lot ${lot.id}`} sub={`Pétrissée du ${lot.trace.localAt} par ${lot.trace.author}`} actions={<StatusBadge s={lot.status} />}>
          <LotFrise lot={lot} />
          <div className="kpi-row">
            <Kpi label="Pâtons remis au four" value={num(f!.patons)} />
            <Kpi label="Pâte façonnée" value={`${dec(f!.kg)} kg`} />
            <Kpi label="EPS" value={`${num(f!.eps)} EPS`} />
            <Kpi label="Rendement" value={`${num(f!.perBag)} EPS/sac`} tone={yieldTone(f!.perBag, lot.threshold)} note={`Seuil au moment de la saisie : ${num(lot.threshold)}`} />
          </div>
          {lot.motif && <Notice tone="warn"><b>Motif (rendement sous seuil) :</b> {lot.motif}</Notice>}
          <div className="recap">
            <Table head={['Matière consommée', 'Quantité']} rows={f!.mats.map(m => [matLabel(m.mat), <b>{matQty(m.mat, m.qty)}</b>])} />
            <Table head={['Format', 'Pâtons']} rows={f!.lines.map(l => [l.label, <b>{num(l.qty)}</b>])} />
          </div>
          <TraceInfo t={lot.trace} />
          {(lot.anomalies || []).map((a, i) => <div key={i} className="close-box">
            <b>Anomalie signalée par l’enfourneur — {a.by}, {a.at}</b>
            <p>{a.text}</p>
            {a.answer ? <Notice tone="ok">Votre réponse ({a.answer.at}) : {a.answer.text}</Notice> : <>
              <input className="ref-input wide" value={reply[i] || ''} onChange={e => setReply({ ...reply, [i]: e.target.value })} placeholder="Votre réponse (tracée)" />
              <Big tone="ghost" onClick={() => answer(i)}>Répondre</Big>
            </>}
          </div>)}
          <h4>Historique du lot</h4>
          <ul className="timeline">{lot.history.map((h, i) => <li key={i}><small>{h.at} · {h.by}</small><span>{h.status}</span></li>)}</ul>

          {lot.corrections.length > 0 && <>
            <h4>Contre-écritures</h4>
            <Table head={['Date', 'Auteur', 'Ligne', 'Correction', 'Motif']} rows={lot.corrections.map(c => [c.at, c.by,
              c.kind === 'mat' ? matLabel(c.key as never) : c.key, <b>{c.delta > 0 ? '+' : ''}{dec(c.delta, 2)}</b>, c.motif])} />
          </>}

          {lot.status !== 'Clôturé' && <div className="close-box">
            <b>Corriger par contre-écriture</b>
            <div className="btn-row">
              <select className="ref-input" value={fix.target} onChange={e => setFix({ ...fix, target: e.target.value })}>
                <option value="">Ligne à corriger…</option>{targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <input className="num-input sm" inputMode="decimal" placeholder="± qté" value={fix.delta} onChange={e => setFix({ ...fix, delta: e.target.value.replace(/[^\d,.-]/g, '') })} />
            </div>
            <input className="ref-input wide" placeholder="Motif (obligatoire)" value={fix.motif} onChange={e => setFix({ ...fix, motif: e.target.value })} />
            <Big tone="ghost" onClick={applyFix}>Enregistrer la contre-écriture</Big>
            {!canFixLines && <small className="muted">Lot déjà cuit : seules les matières peuvent être corrigées.</small>}
          </div>}
        </Card>
      </div>}
      <Notice>Les lots sont visibles par l’enfourneur de votre site, qui ne peut pas modifier les quantités.</Notice>
    </Screen>
  )
}
