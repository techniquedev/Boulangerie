import { useState } from 'react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { cuissonFigures, figures, lotDay, REJECT_REASONS, type LotStatus, type OvenFix, type RejectReason } from '../../data/boulanger'
import { dec, nowStamp, num } from '../../lib/format'
import { TraceInfo } from '../boulanger/shared'
import { LotBadge, LotSteps, rateTone, useOven } from './shared'
import { usePeriod } from '../../components/PeriodFilter'

const STATUSES: LotStatus[] = ['En cours de cuisson', 'Cuit', 'Mis en stock', 'Clôturé']
type Side = 'Conforme' | RejectReason

export function EMine() {
  const { state, update, audit, say } = useApp()
  const { user, site, mine, threshold } = useOven()
  const period = usePeriod(mine.map(lotDay))
  const [st, setSt] = useState<LotStatus | ''>('')
  const list = mine.filter(l => period.match(lotDay(l)) && (!st || l.status === st))
  const [sel, setSel] = useState(mine[0]?.id)
  const lot = list.find(l => l.id === sel) || list[0]
  const [fix, setFix] = useState<{ format: string; from: Side; to: Side; qty: string; motif: string }>({ format: '', from: 'Conforme', to: 'Brûlé', qty: '', motif: '' })
  const c = lot ? cuissonFigures(lot) : null

  // Contre-écriture : reclassement tracé entre conformes et rebuts, sans toucher au rapport d'origine.
  const applyFix = () => {
    if (!lot || !c) return
    const qty = Number(fix.qty)
    if (!fix.format || !qty || fix.from === fix.to) return say('Choisissez le format, le reclassement et la quantité.')
    if (!fix.motif.trim()) return say('Le motif de la contre-écriture est obligatoire.')
    const avail = fix.from === 'Conforme' ? c.goodBy[fix.format] || 0 : c.rejects.filter(r => r.format === fix.format && r.reason === fix.from).reduce((a, r) => a + r.qty, 0)
    if (qty > avail) return say(`Quantité supérieure à ce qui est enregistré (${avail}).`)
    const f: OvenFix = { at: nowStamp(), by: user.name, motif: fix.motif.trim(), format: fix.format, from: fix.from, to: fix.to, qty, trace: traceFor(user.name, site, state.offline) }
    update(s => ({ ...s, lots: s.lots.map(x => x.id === lot.id && x.site === lot.site ? { ...x, ovenFixes: [...(x.ovenFixes || []), f] } : x) }))
    audit('Contre-écriture de cuisson', `${lot.id} — ${fix.format} : ${qty} reclassé(s) de « ${fix.from} » vers « ${fix.to} » — ${f.motif}`)
    say('Contre-écriture tracée'); setFix({ ...fix, qty: '', motif: '' })
  }

  return (
    <Screen title="Mes cuissons" sub="Lots que j’ai pris en charge et cuits — rapports de cuisson non modifiables">
      <div className="filter-row">
        {period.bar}
        {(['', ...STATUSES] as (LotStatus | '')[]).map(s => <button key={s || 'all'} className={st === s ? 'chip on' : 'chip'} onClick={() => setSt(s)}>{s || 'Tous les statuts'}</button>)}
      </div>
      {!lot ? <Notice>Aucune cuisson pour ces filtres.</Notice> : <div className="split">
        <div className="list-col scroll-list">{list.map(l => { const x = cuissonFigures(l)
          return <button key={l.id} className={`list-item ${l === lot ? 'on' : ''}`} onClick={() => setSel(l.id)}>
            <b>{l.id}</b><small>{l.cuisson ? `${l.cuisson.at} · ${dec(x!.rate, 2)} % de rebuts` : 'En cours de cuisson'}</small><LotBadge s={l.status} />
          </button> })}</div>
        <Card title={`Lot ${lot.id}`} sub={`Boulanger : ${lot.trace.author}${lot.cuisson ? ` · cuisson validée le ${lot.cuisson.at} par ${lot.cuisson.by}` : ''}`} actions={<LotBadge s={lot.status} />}>
          <LotSteps l={lot} />
          {!c ? <Notice tone="warn">Cuisson en cours : le rapport sera disponible après validation.</Notice> : <>
            <div className="kpi-row">
              <Kpi label="Pâtons reçus" value={num(c.received)} />
              <Kpi label="Pains conformes" value={num(c.good)} tone="ok" />
              <Kpi label="Rebuts" value={num(c.rejectTotal)} />
              <Kpi label="Taux de rebut" value={`${dec(c.rate, 2)} %`} tone={rateTone(c.rate, threshold)} note={`Seuil ${dec(threshold, 1)} %`} />
            </div>
            <Table head={['Format', 'Pâtons reçus', 'Conformes', ...REJECT_REASONS]} rows={figures(lot).lines.map(f => [f.label, num(f.qty), num(c.goodBy[f.label] ?? 0),
              ...REJECT_REASONS.map(m => num(c.rejects.filter(r => (r.format === f.label || r.format === 'Tous formats') && r.reason === m).reduce((a, r) => a + r.qty, 0)))])} />
            {lot.cuisson!.rejects.some(r => r.image || r.note) && <div className="photo-row">{lot.cuisson!.rejects.map((r, i) => <figure key={i}>
              {r.image?.thumb ? <img src={r.image.thumb} alt={r.image.name} /> : r.image ? <span className="muted">{r.image.name}</span> : null}
              <figcaption>{r.qty} {r.reason}{r.note ? ` — ${r.note}` : ''}{r.format ? ` (${r.format})` : ''}</figcaption></figure>)}</div>}
            {lot.cuisson!.rateMotif && <Notice tone="warn"><b>Motif complémentaire (taux au-dessus du seuil) :</b> {lot.cuisson!.rateMotif}</Notice>}
            {lot.cuisson!.trace && <TraceInfo t={lot.cuisson!.trace} />}
          </>}
          {lot.motif && <Notice><b>Commentaire du boulanger (pétrissée) :</b> {lot.motif}</Notice>}
          {(lot.anomalies || []).map((a, i) => <div key={i} className="pass"><b>Anomalie signalée — {a.by}, {a.at}</b><p>{a.text}</p>{a.answer && <p className="ok-text">Réponse du boulanger ({a.answer.at}) : {a.answer.text}</p>}</div>)}
          {(lot.ovenFixes || []).length > 0 && <Table head={['Contre-écriture', 'Format', 'Reclassement', 'Quantité', 'Motif']} rows={lot.ovenFixes!.map(f => [`${f.at} · ${f.by}`, f.format, `${f.from} → ${f.to}`, num(f.qty), f.motif])} />}
          {c && lot.status !== 'Clôturé' && <div className="close-box">
            <b>Corriger par contre-écriture</b>
            <div className="btn-row">
              <select className="ref-input" value={fix.format} onChange={e => setFix({ ...fix, format: e.target.value })}><option value="">Format…</option>{Object.keys(c.goodBy).map(f => <option key={f}>{f}</option>)}</select>
              <select className="ref-input" value={fix.from} onChange={e => setFix({ ...fix, from: e.target.value as Side })}>{(['Conforme', ...REJECT_REASONS] as Side[]).map(x => <option key={x}>{x}</option>)}</select>
              <span>→</span>
              <select className="ref-input" value={fix.to} onChange={e => setFix({ ...fix, to: e.target.value as Side })}>{(['Conforme', ...REJECT_REASONS] as Side[]).map(x => <option key={x}>{x}</option>)}</select>
              <input className="num-input sm" inputMode="numeric" placeholder="Qté" value={fix.qty} onChange={e => setFix({ ...fix, qty: e.target.value.replace(/\D/g, '') })} />
            </div>
            <input className="ref-input wide" placeholder="Motif (obligatoire)" value={fix.motif} onChange={e => setFix({ ...fix, motif: e.target.value })} />
            <Big tone="ghost" onClick={applyFix}>Enregistrer la contre-écriture</Big>
            <small className="muted">Un reclassement déplace des pains entre conformes et rebuts : l’égalité pâtons = conformes + rebuts reste respectée.</small>
          </div>}
          {lot.status === 'Clôturé' && <Badge tone="neutral">Lot clôturé</Badge>}
        </Card>
      </div>}
    </Screen>
  )
}
