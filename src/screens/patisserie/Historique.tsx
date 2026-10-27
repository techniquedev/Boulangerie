import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { can } from '../../data/rbac'
import { patFigures, PROD_LINES, prodLine, YIELD_TOLERANCE, type PatLot } from '../../data/patisserie'
import { productName } from '../../data/shop'
import { atelierLabel, BS, fmtQty, matName } from '../../data/stock'
import { dayStartTs, dec, monthOf, num, today, weekOf } from '../../lib/format'
import { exportExcel, exportPdf, type Section } from '../../lib/export'
import { LineIcon, usePat } from './shared'

type Period = 'jour' | 'semaine' | 'mois'
const lotTs = (l: PatLot) => dayStartTs(l.fab) + 12 * 3600000
const keyOf = { jour: (l: PatLot) => l.fab, semaine: (l: PatLot) => `Semaine du ${weekOf(lotTs(l))}`, mois: (l: PatLot) => `Mois ${monthOf(lotTs(l))}` }
// Écart de consommation moyen (en %) d'un lot par rapport à la recette.
const consGap = (f: ReturnType<typeof patFigures>) => f.gaps.length ? f.gaps.reduce((s, g) => s + g.pct, 0) / f.gaps.length : 0

// Évolution du rendement réel par jour, avec le rendement théorique de la recette en repère.
function YieldChart({ data, theo }: { data: { key: string; y: number }[]; theo: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 200, L = 40, B = 26, T = 12, min = 70, max = 105
  const y = (v: number) => T + (H - T - B) * (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min))
  const step = (W - L) / Math.max(1, data.length), bw = Math.max(6, Math.min(26, step - 4))
  const h = hover !== null ? data[hover] : null
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rendement réel par jour">
        {[70, 80, 90, 100].map(v => <g key={v}><line x1={L} x2={W} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="tick" textAnchor="end">{v} %</text></g>)}
        {data.map((d, i) => {
          const x = L + i * step + (step - bw) / 2
          const tone = Math.abs(d.y - theo) <= YIELD_TOLERANCE ? 'ok' : 'danger'
          return <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent" />
            <path d={`M${x},${y(min)} V${y(d.y) + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(min)} Z`} className={`bar ${tone} ${hover === i ? 'hl' : ''}`} />
            <text x={x + bw / 2} y={H - 8} className="tick" textAnchor="middle">{d.key.slice(0, 5)}</text>
          </g>
        })}
        <line x1={L} x2={W} y1={y(theo)} y2={y(theo)} className="threshold" />
        <text x={W - 4} y={y(theo) - 5} className="tick strong" textAnchor="end">Recette {theo} %</text>
      </svg>
      {h && <div className="chart-tip" style={{ left: `${((L + hover! * step + step / 2) / W) * 100}%` }}><b>{h.key}</b><span>Rendement {dec(h.y)} %</span><span>{Math.abs(h.y - theo) <= YIELD_TOLERANCE ? 'Dans la tolérance' : 'Hors tolérance'}</span></div>}
      <div className="chart-key"><span><i className="ok" /> Dans la tolérance (± {YIELD_TOLERANCE} points)</span><span><i className="danger" /> Hors tolérance</span><span><i className="line" /> Rendement théorique</span></div>
    </div>
  )
}

export function PHistory() {
  const { user, siteName, mine, bons, stockOf, pf } = usePat()
  const [period, setPeriod] = useState<Period>('jour')
  const [line, setLine] = useState(PROD_LINES[0].code)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const isoTs = (v: string) => dayStartTs(v.split('-').reverse().join('/'))
  const inPeriod = (l: PatLot) => (!from || dayStartTs(l.fab) >= isoTs(from)) && (!to || dayStartTs(l.fab) <= isoTs(to))
  const lots = mine.filter(l => l.line === line)
  const L = prodLine(line)

  const groups = new Map<string, PatLot[]>()
  lots.forEach(l => groups.set(keyOf[period](l), [...(groups.get(keyOf[period](l)) || []), l]))
  const daily = [...new Map(lots.map(l => [l.fab, l])).keys()].sort((a, b) => dayStartTs(a) - dayStartTs(b)).slice(-20).map(d => {
    const fs = lots.filter(l => l.fab === d).map(patFigures)
    const p = fs.reduce((s, f) => s + f.planned, 0), q = fs.reduce((s, f) => s + f.produced, 0)
    return { key: d, y: p ? (q / p) * 100 : 0 }
  })
  const receipts = bons.filter(b => b.confirm)
  const fixes = mine.flatMap(l => l.corrections.map(c => ({ l, c })))

  const prodRows = lots.filter(inPeriod).map(l => { const f = patFigures(l); return [l.fab, l.id, f.items.map(i => `${i.produced} ${productName(i.code)}`).join(' + '), f.produced,
    f.gaps.map(g => `${matName(g.mp)} ${dec(g.theo, 3)} / ${dec(g.real, 3)}`).join(' ; '), `${dec(f.yieldReal)} %`, `${dec(f.yieldGap)} pts`, `${dec(f.rejectRate)} %`] })
  const sections: Section[] = [
    { title: `Productions — ${L.label} (${from ? from.split('-').reverse().join('/') : 'début'} → ${to ? to.split('-').reverse().join('/') : 'aujourd’hui'})`, head: ['Fabrication', 'Lot', 'Produits', 'Quantité produite', 'Consommation théorique / réelle', 'Rendement', 'Écart de rendement', 'Taux de rebut'], rows: prodRows },
    { title: 'État des stocks', head: ['Type', 'Article', 'Lot', 'DLC', 'Quantité'], rows: [
      ...(['ATL-P', 'ATL-YG'] as const).flatMap(a => Object.entries(stockOf(a)).filter(([, q]) => q > 0).map(([mp, q]) => [`Ingrédient — ${atelierLabel(a)}`, matName(mp), '', '', fmtQty(mp, q)])),
      ...pf.filter(p => p.remaining > 0).map(p => ['Produit fini', productName(p.item.code), p.lot.id, p.item.dlc, p.remaining]),
    ] },
  ]
  const fileBase = `productions-${siteName.replace(' ', '')}-${today().replace(/\//g, '-')}`

  return (
    <Screen title="Historique, rendements et piste d’audit" sub={`Mes productions — ${siteName}`}>
      <div className="filter-row">{PROD_LINES.map(l => <button key={l.code} className={line === l.code ? 'chip on' : 'chip'} onClick={() => setLine(l.code)}><LineIcon line={l} size={16} /> {l.label}</button>)}</div>

      <Card title={`Évolution du rendement — ${L.label}`} sub="Rendement réel (quantité obtenue / quantité prévue) par jour de fabrication">
        {daily.length ? <YieldChart data={daily} theo={L.yieldTheo} /> : <Notice>Aucune production sur cette ligne.</Notice>}
      </Card>

      <Card title="Historique par période" actions={<div className="filter-row">{(['jour', 'semaine', 'mois'] as Period[]).map(p =>
        <button key={p} className={period === p ? 'chip on' : 'chip'} onClick={() => setPeriod(p)}>{p[0].toUpperCase() + p.slice(1)}</button>)}</div>}>
        <Table head={['Période', 'Lot', 'Quantité produite', 'Écart de consommation', 'Rendement réel', 'Écart de rendement', 'Taux de rebut']} rows={[...groups].flatMap(([k, ls]) => ls.map((l, i) => {
          const f = patFigures(l), cg = consGap(f)
          return [i === 0 ? <b>{k}</b> : '', l.id, `${num(f.produced)} ${L.unitLabel}`, <span className={Math.abs(cg) > 10 ? 'neg' : ''}>{cg >= 0 ? '+' : ''}{dec(cg)} %</span>,
            `${dec(f.yieldReal)} %`, <Badge tone={Math.abs(f.yieldGap) > YIELD_TOLERANCE ? 'danger' : 'ok'}>{f.yieldGap >= 0 ? '+' : ''}{dec(f.yieldGap)} pts</Badge>, `${dec(f.rejectRate)} %`]
        }))} />
      </Card>

      <div className="recap">
        <Card title="Réceptions de matières à l’atelier">
          <Table head={['Bon', 'Atelier', 'Confirmé le', 'Statut']} rows={receipts.slice(0, 15).map(b => [b.id, atelierLabel(b.atelier), b.confirm!.localAt,
            <Badge tone={b.status === BS.refus ? 'danger' : b.ecart ? 'warn' : 'ok'}>{b.status === BS.refus ? 'Refusé' : b.ecart ? 'Confirmé avec manque' : 'Confirmé'}</Badge>])} />
        </Card>
        <Card title="Corrections par contre-écriture">
          {fixes.length ? <Table head={['Date', 'Lot', 'Ligne', 'Correction', 'Auteur', 'Motif']} rows={fixes.map(({ l, c }) => [c.at, l.id, c.kind === 'mat' ? matName(c.key) : productName(c.key),
            <b>{c.delta > 0 ? '+' : ''}{dec(c.delta, 3)}</b>, c.by, c.motif])} /> : <Notice>Aucune contre-écriture.</Notice>}
        </Card>
      </div>

      {can.exportPat(user.role) && <Card title="Exports" sub={`Productions de la ligne ${L.label.toLowerCase()} et état des stocks`}>
        <div className="btn-row">
          <label className="field">Du<input className="ref-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="field">Au<input className="ref-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <Big tone="ghost" onClick={() => exportExcel(fileBase, sections)}><FileSpreadsheet size={18} /> Excel</Big>
          <Big tone="ghost" onClick={() => exportPdf(fileBase, `Productions et stocks — ${siteName}`, `Édité le ${today()} par ${user.name}`, sections)}><FileText size={18} /> PDF</Big>
        </div>
      </Card>}
    </Screen>
  )
}
