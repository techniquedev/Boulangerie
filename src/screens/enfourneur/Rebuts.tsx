import { useState } from 'react'
import { Badge, Card, Notice, Screen, Table } from '../../components/ui'
import { cuissonFigures, REJECT_REASONS, type ProdLot } from '../../data/boulanger'
import { dayStartTs, dec, monthOf, num, weekOf } from '../../lib/format'
import { rateTone, useOven } from './shared'

type Period = 'jour' | 'semaine' | 'mois'
const dayOfLot = (l: ProdLot) => l.cuisson!.at.slice(0, 10)
const keyOf = { jour: (l: ProdLot) => dayOfLot(l), semaine: (l: ProdLot) => `Semaine du ${weekOf(dayStartTs(dayOfLot(l)) + 43200000)}`, mois: (l: ProdLot) => `Mois ${monthOf(dayStartTs(dayOfLot(l)) + 43200000)}` }

// Évolution du taux de rebuts par jour, avec la ligne du seuil acceptable.
function RateChart({ data, threshold }: { data: { key: string; rate: number }[]; threshold: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 200, L = 40, B = 26, T = 12
  const max = Math.max(threshold * 2, ...data.map(d => d.rate)) * 1.1
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const step = (W - L) / Math.max(1, data.length), bw = Math.max(5, Math.min(20, step - 3))
  const ticks = [0, threshold, threshold * 2].filter(v => v <= max)
  const h = hover !== null ? data[hover] : null
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Taux de rebuts par jour">
        {ticks.map(v => <g key={v}><line x1={L} x2={W} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="tick" textAnchor="end">{dec(v, 1)} %</text></g>)}
        {data.map((d, i) => {
          const x = L + i * step + (step - bw) / 2
          return <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent" />
            <path d={`M${x},${y(0)} V${Math.min(y(d.rate) + 4, y(0))} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(0)} Z`} className={`bar ${rateTone(d.rate, threshold)} ${hover === i ? 'hl' : ''}`} />
            {(i % 4 === 0 || i === data.length - 1) && <text x={x + bw / 2} y={H - 8} className="tick" textAnchor="middle">{d.key.slice(0, 5)}</text>}
          </g>
        })}
        <line x1={L} x2={W} y1={y(threshold)} y2={y(threshold)} className="threshold" />
        <text x={W - 4} y={y(threshold) - 5} className="tick strong" textAnchor="end">Seuil {dec(threshold, 1)} %</text>
      </svg>
      {h && <div className="chart-tip" style={{ left: `${((L + hover! * step + step / 2) / W) * 100}%` }}><b>{h.key}</b><span>{dec(h.rate, 2)} % de rebuts</span></div>}
      <div className="chart-key"><span><i className="ok" /> Sous le seuil</span><span><i className="warn" /> Jusqu’à 1,5 fois le seuil</span><span><i className="danger" /> Au-delà</span><span><i className="line" /> Seuil acceptable</span></div>
    </div>
  )
}

export function ERejects() {
  const { lots, threshold, siteName } = useOven()
  const [period, setPeriod] = useState<Period>('jour')
  const cooked = lots.filter(l => l.cuisson).sort((a, b) => b.ts - a.ts)
  const figs = new Map(cooked.map(l => [l, cuissonFigures(l)!]))
  const groups = new Map<string, ProdLot[]>()
  cooked.forEach(l => groups.set(keyOf[period](l), [...(groups.get(keyOf[period](l)) || []), l]))
  const sumBy = (ls: ProdLot[], f: (c: NonNullable<ReturnType<typeof cuissonFigures>>) => number) => ls.reduce((a, l) => a + f(figs.get(l)!), 0)
  const byReason = (ls: ProdLot[], m: string) => sumBy(ls, c => c.rejects.filter(r => r.reason === m).reduce((a, r) => a + r.qty, 0))
  const formats = [...new Set(cooked.flatMap(l => figs.get(l)!.rejects.map(r => r.format)))]
  const daily = [...new Set(cooked.map(dayOfLot))].reverse().map(key => {
    const ls = cooked.filter(l => dayOfLot(l) === key)
    return { key, rate: (sumBy(ls, c => c.rejectTotal) / Math.max(1, sumBy(ls, c => c.received))) * 100 }
  })
  const declarations = cooked.slice(0, 12).flatMap(l => l.cuisson!.rejects.filter(r => r.qty).map(r => ({ l, r })))
  const fixes = cooked.flatMap(l => (l.ovenFixes || []).map(f => ({ l, f })))

  return (
    <Screen title="Suivi détaillé des rebuts" sub={`Four de ${siteName} — données de production uniquement`}>
      <Card title="Évolution du taux de rebuts" sub="Rebuts ÷ pâtons reçus, par jour de cuisson">
        {daily.length ? <RateChart data={daily.slice(-30)} threshold={threshold} /> : <Notice>Aucune cuisson.</Notice>}
      </Card>

      <Card title="Rebuts par période et par motif" actions={<div className="filter-row">{(['jour', 'semaine', 'mois'] as Period[]).map(p =>
        <button key={p} className={period === p ? 'chip on' : 'chip'} onClick={() => setPeriod(p)}>{p[0].toUpperCase() + p.slice(1)}</button>)}</div>}>
        <Table head={['Période', 'Lots', 'Pâtons reçus', ...REJECT_REASONS, 'Total rebuts', 'Taux']} rows={[...groups].map(([k, ls]) => {
          const rec = sumBy(ls, c => c.received), rej = sumBy(ls, c => c.rejectTotal), rate = rec ? (rej / rec) * 100 : 0
          return [<b>{k}</b>, num(ls.length), num(rec), ...REJECT_REASONS.map(m => num(byReason(ls, m))), <b>{num(rej)}</b>, <Badge tone={rateTone(rate, threshold)}>{dec(rate, 2)} %</Badge>]
        })} />
      </Card>

      <Card title="Rebuts par format de pain">
        <Table head={['Format', ...REJECT_REASONS, 'Total']} rows={formats.map(f => {
          const q = (m: string) => cooked.reduce((a, l) => a + figs.get(l)!.rejects.filter(r => r.format === f && r.reason === m).reduce((b, r) => b + r.qty, 0), 0)
          return [<b>{f}</b>, ...REJECT_REASONS.map(m => num(q(m))), <b>{num(REJECT_REASONS.reduce((a, m) => a + q(m), 0))}</b>]
        })} />
      </Card>

      <div className="recap">
        <Card title="Photos et motifs des déclarations" sub="Dernières cuissons">
          <Table head={['Lot', 'Format', 'Motif', 'Quantité', 'Photo']} rows={declarations.map(({ l, r }) => [l.id, r.format || '—', `${r.reason}${r.note ? ` — ${r.note}` : ''}`, num(r.qty),
            r.image?.thumb ? <img className="thumb" src={r.image.thumb} alt={r.image.name} /> : r.image ? <small>{r.image.name}</small> : '—'])} />
        </Card>
        <Card title="Contre-écritures">
          {fixes.length ? <Table head={['Lot', 'Date', 'Reclassement', 'Motif', 'Auteur']} rows={fixes.map(({ l, f }) => [l.id, f.at, `${f.qty} ${f.format} : ${f.from} → ${f.to}`, f.motif, f.by])} />
            : <Notice>Aucune contre-écriture.</Notice>}
        </Card>
      </div>
    </Screen>
  )
}
