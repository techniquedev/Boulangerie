import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { figures, yieldTone, type ProdLot } from '../../data/boulanger'
import { can } from '../../data/rbac'
import { dayOf, dec, monthOf, num, today, weekOf } from '../../lib/format'
import { exportExcel, exportPdf } from '../../lib/export'
import { useBaker } from './shared'
import { usePeriod } from '../../components/PeriodFilter'

type Period = 'jour' | 'semaine' | 'mois'
const keyOf = { jour: dayOf, semaine: weekOf, mois: monthOf }
const periodLabel = (p: Period, k: string) => (p === 'semaine' ? `Semaine du ${k}` : p === 'mois' ? `Mois ${k}` : k)
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${num(Math.abs(n))}`

type Agg = { key: string; count: number; bags: number; eps: number; perBag: number }
const aggregate = (lots: ProdLot[], keyFn: (ts: number) => string): Agg[] => {
  const m = new Map<string, Agg>()
  lots.forEach(l => {
    const f = figures(l), k = keyFn(l.ts)
    const a = m.get(k) || { key: k, count: 0, bags: 0, eps: 0, perBag: 0 }
    a.count++; a.bags += f.bags; a.eps += f.eps; a.perBag = a.bags ? a.eps / a.bags : 0
    m.set(k, a)
  })
  return [...m.values()]
}

// Évolution du rendement : une barre par jour, colorée selon le seuil (libellé dans l'infobulle et la légende).
function YieldChart({ data, threshold }: { data: Agg[]; threshold: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 220, L = 40, B = 26, T = 12
  const max = Math.ceil(Math.max(threshold * 1.4, ...data.map(d => d.perBag)) / 100) * 100
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const step = (W - L) / Math.max(1, data.length)
  const bw = Math.max(4, Math.min(18, step - 2))
  const ticks = Array.from({ length: max / 100 + 1 }, (_, i) => i * 100).filter(v => v % 200 === 0)
  const h = hover !== null ? data[hover] : null
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rendement journalier en EPS par sac">
        {ticks.map(v => <g key={v}><line x1={L} x2={W} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="tick" textAnchor="end">{v}</text></g>)}
        {data.map((d, i) => {
          const x = L + i * step + (step - bw) / 2
          return <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent" />
            <path d={`M${x},${y(0)} V${y(d.perBag) + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(0)} Z`} className={`bar ${yieldTone(d.perBag, threshold)} ${hover === i ? 'hl' : ''}`} />
            {(i % 5 === 0 || i === data.length - 1) && <text x={x + bw / 2} y={H - 8} className="tick" textAnchor="middle">{d.key.slice(0, 5)}</text>}
          </g>
        })}
        <line x1={L} x2={W} y1={y(threshold)} y2={y(threshold)} className="threshold" />
        <text x={W - 4} y={y(threshold) - 5} className="tick strong" textAnchor="end">Seuil {threshold}</text>
      </svg>
      {h && <div className="chart-tip" style={{ left: `${((L + hover! * step + step / 2) / W) * 100}%` }}>
        <b>{h.key}</b><span>{num(h.perBag)} EPS/sac · {dec(h.bags, 2)} sac(s)</span><span>{h.perBag >= threshold ? 'Au-dessus du seuil' : 'Sous le seuil'}</span>
      </div>}
      <div className="chart-key"><span><i className="ok" /> Au seuil ou au-dessus</span><span><i className="warn" /> Jusqu’à 10 % sous le seuil</span><span><i className="danger" /> Plus de 10 % sous le seuil</span><span><i className="line" /> Seuil {threshold} EPS/sac</span></div>
    </div>
  )
}

export function BHistory() {
  const { user: u } = useApp()
  const { mine: allLots, threshold, siteName, user } = useBaker()
  const per = usePeriod(allLots.map(l => dayOf(l.ts)))
  const mine = allLots.filter(l => per.match(dayOf(l.ts)))
  const [period, setPeriod] = useState<Period>('jour')
  const groups = aggregate(mine, keyOf[period])
  const daily = aggregate([...mine].reverse(), dayOf).slice(-30)
  const ranked = mine.map(l => ({ l, f: figures(l) })).sort((a, b) => b.f.perBag - a.f.perBag)
  const all = aggregate(mine, () => 'all')[0]
  // 7 derniers jours d'activité, comparés aux 7 jours précédents.
  const ref = mine[0]?.ts ?? Date.now()
  const last7 = aggregate(mine.filter(l => ref - l.ts < 7 * 86400000), () => '7')[0]
  const prev7 = aggregate(mine.filter(l => ref - l.ts >= 7 * 86400000 && ref - l.ts < 14 * 86400000), () => 'p')[0]

  const detailRows = mine.map(l => { const f = figures(l); return [l.trace.localAt, l.id, dec(f.bags, 2), num(f.eps), num(f.perBag), signed(f.perBag - l.threshold)] })
  const head = ['Date', 'Lot', 'Sacs', 'EPS', 'EPS/sac', 'Écart au seuil']
  const fileBase = `historique-petrissees-${siteName.replace(' ', '')}-${today().replace(/\//g, '-')}`

  const section = { title: 'Détail des pétrissées', head, rows: detailRows }
  const toExcel = () => exportExcel(fileBase, [section])
  const toPdf = () => exportPdf(fileBase, `Historique des pétrissées — ${user.name} · ${siteName}`, `Édité le ${today()} · seuil ${threshold} EPS/sac · 1 EPS = 146 g`, [section])

  return (
    <Screen title="Historique et rendement" sub={`Mes pétrissées — ${siteName} · rendement = EPS ÷ sacs de farine, comparé au seuil de ${threshold} EPS/sac`}>
      {per.bar}
      {all && <div className="kpi-row">
        <Kpi label="Pétrissées enregistrées" value={num(all.count)} />
        <Kpi label="Rendement moyen global" value={`${num(all.perBag)} EPS/sac`} tone={yieldTone(all.perBag, threshold)} />
        {last7 && <Kpi label="7 derniers jours d’activité" value={`${num(last7.perBag)} EPS/sac`} tone={yieldTone(last7.perBag, threshold)}
          note={prev7 ? `${signed(last7.perBag - prev7.perBag)} EPS/sac par rapport aux 7 jours précédents` : undefined} />}
        <Kpi label="Pétrissées sous le seuil" value={num(ranked.filter(r => r.f.perBag < r.l.threshold).length)} tone="warn" />
      </div>}

      <Card title="Évolution du rendement" sub="30 derniers jours travaillés — rendement moyen du jour">
        {daily.length ? <YieldChart data={daily} threshold={threshold} /> : <Notice>Aucune donnée.</Notice>}
      </Card>

      <Card title="Historique par période" actions={<div className="filter-row">{(['jour', 'semaine', 'mois'] as Period[]).map(p =>
        <button key={p} className={period === p ? 'chip on' : 'chip'} onClick={() => setPeriod(p)}>{p[0].toUpperCase() + p.slice(1)}</button>)}</div>}>
        <Table head={['Période', 'Pétrissées', 'Sacs utilisés', 'EPS', 'Rendement', 'Écart au seuil']} rows={groups.map(g => [
          <b>{periodLabel(period, g.key)}</b>, num(g.count), dec(g.bags, 2), num(g.eps),
          <Badge tone={yieldTone(g.perBag, threshold)}>{num(g.perBag)} EPS/sac</Badge>, <span className={g.perBag < threshold ? 'neg' : 'ok-text'}>{signed(g.perBag - threshold)}</span>])} />
      </Card>

      <div className="recap">
        <Card title="Mes meilleures pétrissées"><Table head={['Lot', 'Date', 'EPS/sac']} rows={ranked.slice(0, 5).map(({ l, f }, i) => [`${i + 1}. ${l.id}`, l.trace.localAt.slice(0, 10), <b className="ok-text">{num(f.perBag)}</b>])} /></Card>
        <Card title="À améliorer" sub="Pétrissées au rendement le plus faible, avec le motif saisi">
          <Table head={['Lot', 'EPS/sac', 'Motif']} rows={ranked.slice(-5).reverse().map(({ l, f }) => [l.id, <b className={f.perBag < l.threshold ? 'neg' : ''}>{num(f.perBag)}</b>, l.motif || '—'])} />
        </Card>
      </div>

      <Card title="Détail des pétrissées" actions={can.exportProduction(u!.role) && <div className="btn-row">
        <Big tone="ghost" onClick={toExcel}><FileSpreadsheet size={18} /> Excel</Big>
        <Big tone="ghost" onClick={toPdf}><FileText size={18} /> PDF</Big>
      </div>}>
        <Table head={head} rows={detailRows.map(r => [r[0], <b>{r[1]}</b>, r[2], r[3], r[4], <span className={r[5].startsWith('−') ? 'neg' : 'ok-text'}>{r[5]}</span>])} />
      </Card>
    </Screen>
  )
}
