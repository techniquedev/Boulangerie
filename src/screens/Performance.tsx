import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, FileSpreadsheet, FileText, Mail, X } from 'lucide-react'
import { useApp } from '../store/context'
import { useNav } from '../store/nav'
import { Badge, Big, Card, Notice, Screen, Table } from '../components/ui'
import { roleLabels, siteShort } from '../data/org'
import type { Role, SiteCode } from '../data/types'
import type { ScreenId } from '../data/rbac'
import {
  buckets, CHARGE_LINES, EMPLOYEES, employeePerf, END, growthOf, LEDGER, lossStreak, PERF_PARAMS, PERF_ROLES, PERF_SITES, pnl, prevRange,
  PRODUCT_LINES, rangeLabel, riskTone, ROLE_METRICS, scoreTone, START, statusOf, statusTone, type Employee, type Metric, type PnL, type Range, type Status,
} from '../data/perf'
import { dayOf, dayStartTs, dec, money, num } from '../lib/format'
import { exportExcel, exportPdf, type Section } from '../lib/export'

// ——— Onglet « Performance & Rentabilité » (Directeur Général ; Contrôleur central en lecture seule) ———
// Écran de pilotage en lecture seule : aucune saisie, aucune modification de données.

type Mode = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'plage'
const MODES: [Mode, string][] = [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['trimestre', 'Trimestre'], ['plage', 'Plage']]
const SITE_COLORS: Record<string, string> = { 'SIT-01': '#3b82c4', 'SIT-02': '#8e5ba8', 'SIT-03': '#2a9d8f' }
const SOURCE: Partial<Record<Role, [ScreenId, string]>> = {
  boulanger: ['production', 'Lots de production'], enfourneur: ['cuisson', 'Cuissons et rebuts'], patissier: ['production', 'Lots de production'],
  magasinier: ['magasin', 'Magasins et bons de sortie'], boutiquier: ['bdl', 'Bordereaux (BDL)'], caissiere: ['caisse', 'Sessions de caisse'], livreur: ['tour', 'Tournées'],
}
const D = 86400000
const iso = (t: number) => dayOf(t + 43200000).split('/').reverse().join('-')
const fromIso = (v: string) => dayStartTs(v.split('-').reverse().join('/'))
const DAYS = [...new Set(LEDGER.map(l => l.day))].sort((a, b) => dayStartTs(b) - dayStartTs(a))
const fmtMetric = (m: Metric, v: number) => m.kind === 'amount' ? money(v) : `${dec(v, m.decimals ?? (m.kind === 'rate' ? 1 : 0))}${m.unit ? ` ${m.unit}` : ''}`
const metricTone = (m: Metric, v: number) => m.threshold === undefined ? undefined : (m.good === 'high' ? v >= m.threshold : v <= m.threshold) ? 'ok' : 'danger'
const Pill = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={`pill ${tone}`}><i />{children}</span>

// Valeurs proposées pour chaque mode de période.
function periodOptions(mode: Mode) {
  if (mode === 'jour') return DAYS.map(d => ({ v: d, label: d }))
  if (mode === 'semaine') return [...new Set(DAYS.map(d => { const t = dayStartTs(d), wd = (new Date(t + 3600000).getUTCDay() + 6) % 7; return dayOf(t - wd * D + 43200000) }))].map(d => ({ v: d, label: `Semaine du ${d}` }))
  if (mode === 'mois') return [...new Set(DAYS.map(d => d.slice(3)))].map(m => ({ v: m, label: new Date(Date.UTC(+m.slice(3), +m.slice(0, 2) - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }))
  if (mode === 'trimestre') return [...new Set(DAYS.map(d => `T${Math.ceil(+d.slice(3, 5) / 3)} ${d.slice(6)}`))].map(q => ({ v: q, label: `${q.replace('T', '')}${q.startsWith('T1') ? 'er' : 'e'} trimestre` }))
  return []
}
function rangeOf(mode: Mode, v: string, custom: [string, string]): Range {
  const clampR = (r: Range) => ({ from: Math.max(r.from, dayStartTs(START)), to: Math.min(r.to, dayStartTs(END)) })
  if (mode === 'jour') return { from: dayStartTs(v), to: dayStartTs(v) }
  if (mode === 'semaine') return clampR({ from: dayStartTs(v), to: dayStartTs(v) + 6 * D })
  if (mode === 'mois') { const [m, y] = v.split('/').map(Number); return clampR({ from: Date.UTC(y, m - 1, 1, -1), to: Date.UTC(y, m, 0, -1) }) }
  if (mode === 'trimestre') { const q = +v[1], y = +v.slice(3); return clampR({ from: Date.UTC(y, (q - 1) * 3, 1, -1), to: Date.UTC(y, q * 3, 0, -1) }) }
  return clampR({ from: fromIso(custom[0]), to: fromIso(custom[1]) })
}

// ——— Graphiques (SVG, survol et clic) ———

function Tip({ x, children }: { x: number; children: React.ReactNode }) { return <div className="chart-tip" style={{ left: `${x}%` }}>{children}</div> }

// Barres groupées : une ou plusieurs séries par catégorie, ligne de référence facultative.
function Bars({ cats, series, refLine, onPick, fmt }: { cats: string[]; series: { name: string; color: string | ((v: number) => string); values: number[] }[]; refLine?: { value: number; label: string }; onPick?: (i: number) => void; fmt: (v: number) => string }) {
  const [h, setH] = useState<number | null>(null)
  const W = 640, H = 220, L = 56, B = 30, T = 14
  const all = series.flatMap(s => s.values).concat(refLine ? [refLine.value] : [])
  const max = Math.max(1, ...all), min = Math.min(0, ...all)
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1))
  const step = (W - L) / Math.max(1, cats.length), gw = Math.min(70, step * 0.7), bw = gw / series.length
  return <div className="chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      {[min, (min + max) / 2, max].map(v => <g key={v}><line x1={L} x2={W} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="tick" textAnchor="end">{fmt(v)}</text></g>)}
      <line x1={L} x2={W} y1={y(0)} y2={y(0)} stroke="#3b2a1f55" />
      {cats.map((c, i) => <g key={c} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} onClick={() => onPick?.(i)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
        <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent" />
        {series.map((s, k) => { const v = s.values[i], x = L + i * step + (step - gw) / 2 + k * bw
          return <rect key={k} x={x + 1} width={bw - 2} y={Math.min(y(v), y(0))} height={Math.max(2, Math.abs(y(v) - y(0)))} rx={3} fill={typeof s.color === 'function' ? s.color(v) : s.color} opacity={h === i ? 0.8 : 1} /> })}
        <text x={L + i * step + step / 2} y={H - 10} className="tick" textAnchor="middle">{c}</text>
      </g>)}
      {refLine && <><line x1={L} x2={W} y1={y(refLine.value)} y2={y(refLine.value)} className="threshold" /><text x={W - 4} y={y(refLine.value) - 5} className="tick strong" textAnchor="end">{refLine.label}</text></>}
    </svg>
    {h !== null && <Tip x={((L + h * step + step / 2) / W) * 100}><b>{cats[h]}</b>{series.map(s => <span key={s.name}>{s.name} : {fmt(s.values[h])}</span>)}</Tip>}
  </div>
}

// Courbes : plusieurs séries sur des points temporels.
function Lines({ labels, series, fmt }: { labels: string[]; series: { name: string; color: string; values: number[]; dashed?: boolean }[]; fmt: (v: number) => string }) {
  const [h, setH] = useState<number | null>(null)
  const W = 640, H = 220, L = 60, B = 28, T = 14
  const all = series.flatMap(s => s.values), max = Math.max(1, ...all), min = Math.min(0, ...all)
  const x = (i: number) => L + (labels.length > 1 ? (i * (W - L - 10)) / (labels.length - 1) : (W - L) / 2)
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1))
  const every = Math.ceil(labels.length / 8)
  return <div className="chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" onMouseLeave={() => setH(null)}>
      {[min, (min + max) / 2, max].map(v => <g key={v}><line x1={L} x2={W} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="tick" textAnchor="end">{fmt(v)}</text></g>)}
      {series.map(s => <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? '6 4' : undefined} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />)}
      {labels.map((l, i) => <g key={i}>
        {(i % every === 0 || i === labels.length - 1) && <text x={x(i)} y={H - 8} className="tick" textAnchor="middle">{l}</text>}
        <rect x={x(i) - (W - L) / labels.length / 2} y={T} width={(W - L) / labels.length} height={H - T - B} fill="transparent" onMouseEnter={() => setH(i)} />
      </g>)}
      {h !== null && <><line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="#3b2a1f55" />{series.map(s => <circle key={s.name} cx={x(h)} cy={y(s.values[h])} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />)}</>}
    </svg>
    {h !== null && <Tip x={(x(h) / W) * 100}><b>{labels[h]}</b>{series.map(s => <span key={s.name}>{s.name} : {fmt(s.values[h])}</span>)}</Tip>}
    <div className="chart-key">{series.map(s => <span key={s.name}><i style={{ background: s.dashed ? 'none' : s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : undefined, height: s.dashed ? 0 : undefined }} /> {s.name}</span>)}</div>
  </div>
}

// Colonnes empilées : contribution de chaque site par sous-période (valeurs positives et négatives séparées).
function Stacked({ labels, series, fmt }: { labels: string[]; series: { name: string; color: string; values: number[] }[]; fmt: (v: number) => string }) {
  const [h, setH] = useState<number | null>(null)
  const W = 640, H = 220, L = 60, B = 28, T = 14
  const pos = labels.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i]), 0)), neg = labels.map((_, i) => series.reduce((a, s) => a + Math.min(0, s.values[i]), 0))
  const max = Math.max(1, ...pos), min = Math.min(0, ...neg)
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1))
  const step = (W - L) / Math.max(1, labels.length), bw = Math.min(46, step * 0.65), every = Math.ceil(labels.length / 8)
  return <div className="chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      {[min, 0, max].map(v => <g key={v}><line x1={L} x2={W} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="tick" textAnchor="end">{fmt(v)}</text></g>)}
      {labels.map((l, i) => { let up = 0, down = 0, cx = L + i * step + (step - bw) / 2
        return <g key={i} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)}>
          <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent" />
          {series.map(s => { const v = s.values[i]; const a = v >= 0 ? up : down, b = a + v; if (v >= 0) up = b; else down = b
            return <rect key={s.name} x={cx} width={bw} y={Math.min(y(a), y(b))} height={Math.max(1, Math.abs(y(a) - y(b)) - 1)} fill={s.color} opacity={h === i ? 0.8 : 1} /> })}
          {(i % every === 0 || i === labels.length - 1) && <text x={cx + bw / 2} y={H - 8} className="tick" textAnchor="middle">{l}</text>}
        </g> })}
    </svg>
    {h !== null && <Tip x={((L + h * step + step / 2) / W) * 100}><b>{labels[h]}</b>{series.map(s => <span key={s.name}>{s.name} : {fmt(s.values[h])}</span>)}</Tip>}
    <div className="chart-key">{series.map(s => <span key={s.name}><i style={{ background: s.color }} /> {s.name}</span>)}</div>
  </div>
}

// Jauge circulaire d'un seuil métier.
function Donut({ label, value, threshold, max, good, fmt }: { label: string; value: number; threshold: number; max: number; good: 'high' | 'low'; fmt: (v: number) => string }) {
  const ok = good === 'high' ? value >= threshold : value <= threshold
  const tone = ok ? 'ok' : (good === 'high' ? value >= threshold * 0.9 : value <= threshold * 1.5) ? 'warn' : 'danger'
  const r = 42, c = 2 * Math.PI * r, frac = Math.min(1, Math.max(0, value / max)), tFrac = Math.min(1, threshold / max)
  return <div className="donut">
    <svg viewBox="0 0 110 110"><circle cx="55" cy="55" r={r} className="donut-track" /><circle cx="55" cy="55" r={r} className={`donut-val ${tone}`} strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 55 55)" />
      <line x1={55 + (r - 9) * Math.sin(tFrac * 2 * Math.PI)} y1={55 - (r - 9) * Math.cos(tFrac * 2 * Math.PI)} x2={55 + (r + 9) * Math.sin(tFrac * 2 * Math.PI)} y2={55 - (r + 9) * Math.cos(tFrac * 2 * Math.PI)} stroke="#3b2a1f" strokeWidth="2.5" />
      <text x="55" y="58" textAnchor="middle" className="donut-text">{fmt(value)}</text></svg>
    <b>{label}</b><small>Seuil {fmt(threshold)}</small><Pill tone={tone}>{ok ? 'Atteint' : 'Hors seuil'}</Pill>
  </div>
}

export function Performance() {
  const { user, state, audit, say } = useApp()
  const go = useNav()
  const [mode, setMode] = useState<Mode>('mois')
  const [val, setVal] = useState('10/2026')
  const [custom, setCustom] = useState<[string, string]>(['2026-10-01', '2026-10-31'])
  const [site, setSite] = useState<'all' | SiteCode>('all')
  const [role, setRole] = useState<Role | ''>('')
  const [cmpRole, setCmpRole] = useState<Role>('boulanger')
  const [sort, setSort] = useState<'score' | 'risk' | 'name' | 'role'>('score')
  const [open, setOpen] = useState<Employee | null>(null)

  // Journalisation de chaque consultation.
  useEffect(() => { audit('Consultation', 'Onglet Performance & Rentabilité') }, [])

  const opts = periodOptions(mode)
  const v = mode === 'plage' ? '' : opts.some(o => o.v === val) ? val : opts[0]?.v
  const r = rangeOf(mode, v, custom)
  const prev = prevRange(r, mode === 'mois' ? 'mois' : mode === 'trimestre' ? 'trimestre' : 'autre')
  const sites = site === 'all' ? PERF_SITES : [site]
  const label = mode === 'plage' ? rangeLabel(r) : opts.find(o => o.v === v)?.label || ''

  // ——— Rentabilité ———
  const siteRows = PERF_SITES.map(s => {
    const p = pnl([s], r), q = pnl([s], prev), g = growthOf(p.ca, q.ca)
    return { s, p, q, g, status: statusOf(p, g), streak: lossStreak(s, r) }
  })
  const group = pnl(sites, r), groupPrev = pnl(sites, prev), growth = growthOf(group.ca, groupPrev.ca)
  const anyDeficit = siteRows.filter(x => sites.includes(x.s)).some(x => x.status === 'Déficitaire')
  const groupStatus: Status = group.net < 0 ? 'Déficitaire' : anyDeficit || statusOf(group, growth) === 'À surveiller' ? 'À surveiller' : 'Rentable'
  const openAlerts = state.alerts.filter(a => a.status !== 'Clôturée')

  // ——— Employés ———
  const emps = EMPLOYEES.filter(e => sites.includes(e.site) && (!role || e.role === role)).map(e => ({ e, ...employeePerf(e, r) }))
  const sorted = [...emps].sort((a, b) => sort === 'score' ? b.score - a.score : sort === 'risk' ? b.risk - a.risk : sort === 'name' ? a.e.name.localeCompare(b.e.name) : PERF_ROLES.indexOf(a.e.role) - PERF_ROLES.indexOf(b.e.role) || b.score - a.score)
  const cmp = EMPLOYEES.filter(e => e.role === cmpRole).map(e => ({ e, ...employeePerf(e, r) }))
  const m0 = ROLE_METRICS[cmpRole]![0]
  const avg = (rl: Role, key: string, sum = false) => { const xs = EMPLOYEES.filter(e => e.role === rl && sites.includes(e.site)).map(e => employeePerf(e, r).vals[key]); return xs.length ? xs.reduce((a, b) => a + b, 0) / (sum ? 1 : xs.length) : 0 }
  const siteRisk = (s: SiteCode) => { const xs = EMPLOYEES.filter(e => e.site === s).map(e => employeePerf(e, r).risk); return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) }

  // ——— Croissance ———
  const bk = buckets(r)
  let cumCa = 0, cumNet = 0, cumPrev = 0
  const prevBk = buckets(prev).items
  const curve = bk.items.map((b, i) => { const p = pnl(sites, b.range); cumCa += p.ca; cumNet += p.net; cumPrev += prevBk[i] ? pnl(sites, prevBk[i].range).ca : 0; return { label: b.label, ca: cumCa, net: cumNet, prev: cumPrev, perSite: PERF_SITES.map(s => pnl([s], b.range).net), caB: p.ca } })
  const growths = curve.map((c, i) => i ? growthOf(c.caB, curve[i - 1].caB) : 0).slice(1)
  const avgGrowth = growths.length ? growths.reduce((a, b) => a + b, 0) / growths.length : 0
  // Prévision à droit constant : rythme moyen journalier de la période prolongé jusqu'à la fin du mois en cours de la période.
  const lastDataDay = Math.min(r.to, dayStartTs(END)), elapsed = Math.round((lastDataDay - r.from) / D) + 1
  const monthEnd = (() => { const d = new Date(r.to + 3600000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, -1) })()
  const totalDays = Math.round((Math.max(monthEnd, r.to) - r.from) / D) + 1
  const forecast = { ca: (group.ca / elapsed) * totalDays, net: (group.net / elapsed) * totalDays }
  const trend = growth > 1 ? 'hausse' : growth < -1 ? 'baisse' : 'stabilité'
  const deficits = siteRows.filter(x => sites.includes(x.s) && x.status === 'Déficitaire').map(x => siteShort(x.s))
  const sentence = `Croissance cumulée de ${growth >= 0 ? '+' : ''}${dec(growth, 1)} % (${label}) ; ${deficits.length ? `${deficits.join(' et ')} ${deficits.length > 1 ? 'restent déficitaires et font' : 'reste déficitaire et fait'} baisser la rentabilité du groupe.` : 'tous les sites sélectionnés sont bénéficiaires.'}`

  // ——— Décision ———
  const causesOf = (s: SiteCode) => {
    const row = siteRows.find(x => x.s === s)!, p = row.p, out: [number, string][] = []
    const lossShare = p.ca ? (p.chargeLines[1] / p.ca) * 100 : 0
    if (lossShare > 7) out.push([lossShare, `Pertes et rebuts élevés (${dec(lossShare, 1)} % du CA)`])
    const cash = employeePerf(EMPLOYEES.find(e => e.site === s && e.role === 'caissiere')!, r).vals
    if (cash.gaps >= 2) out.push([cash.gaps * 5, `Écarts de caisse répétés (${num(cash.gaps)}, ${money(cash.gapAmount)})`])
    const shop = employeePerf(EMPLOYEES.find(e => e.site === s && e.role === 'boutiquier')!, r).vals
    if (shop.lossRate > 5) out.push([shop.lossRate, `Invendus et pertes en boutique (${dec(shop.lossRate, 1)} %)`])
    const oven = employeePerf(EMPLOYEES.find(e => e.site === s && e.role === 'enfourneur')!, r).vals
    if (oven.rate > 2) out.push([oven.rate * 3, `Rebuts de cuisson au-dessus du seuil (${dec(oven.rate, 2)} %)`])
    if (row.g < 0) out.push([-row.g, `Baisse des ventes (${dec(row.g, 1)} %)`])
    const chargeRate = p.ca ? (p.charges / p.ca) * 100 : 0
    if (chargeRate > 95) out.push([chargeRate - 90, `Charges élevées (${dec(chargeRate, 1)} % du CA)`])
    return out.sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1])
  }
  const recos = siteRows.filter(x => sites.includes(x.s)).flatMap(x => {
    const out: string[] = [], c = causesOf(x.s), n = siteShort(x.s)
    if (c.some(t => t.startsWith('Invendus'))) out.push(`Réduire les invendus du ${n} (ajuster les livraisons aux ventes réelles).`)
    if (c.some(t => t.startsWith('Écarts de caisse'))) out.push(`Investiguer les écarts de caisse répétés du ${n}.`)
    if (c.some(t => t.startsWith('Rebuts'))) out.push(`Contrôler le réglage des fours du ${n} (taux de rebut au-dessus de ${state.rejectThreshold} %).`)
    if (c.some(t => t.startsWith('Pertes'))) out.push(`Analyser les pertes et rebuts valorisés du ${n}.`)
    if (x.status === 'À surveiller') out.push(`Surveiller la marge du ${n} (taux de rentabilité ${dec(x.p.rate, 1)} %, seuil ${PERF_PARAMS.rentableRate} %).`)
    if (x.streak >= 2) out.push(`Plan de redressement urgent pour le ${n} : ${x.streak} mois consécutifs de perte.`)
    return out
  })

  // ——— Exports et envoi ———
  const sections: Section[] = [
    { title: `Synthèse — ${label}`, head: ['Indicateur', 'Valeur'], rows: [['Chiffre d’affaires', money(group.ca)], ['Marge nette', money(group.net)], ['Taux de rentabilité', `${dec(group.rate, 1)} %`], ['Croissance', `${dec(growth, 1)} %`], ['Statut', groupStatus], ['Alertes ouvertes', openAlerts.length]] },
    { title: 'Rentabilité par site', head: ['Site', 'CA', ...PRODUCT_LINES, ...CHARGE_LINES, 'Charges', 'Marge brute', 'Marge nette', 'Taux', 'Statut'],
      rows: siteRows.map(x => [siteShort(x.s), x.p.ca, ...x.p.products, ...x.p.chargeLines, x.p.charges, x.p.gross, x.p.net, `${dec(x.p.rate, 1)} %`, x.status]) },
    { title: 'Performance des employés', head: ['Site', 'Employé', 'Poste', 'Score', 'Risque', 'Indicateurs'],
      rows: sorted.map(x => [siteShort(x.e.site), x.e.name, roleLabels[x.e.role], x.score, x.risk, ROLE_METRICS[x.e.role]!.map(m => `${m.label} : ${fmtMetric(m, x.vals[m.key])}`).join(' ; ')]) },
    { title: 'Synthèse décisionnelle', head: ['Périmètre', 'Statut', 'Croissance', 'Causes'], rows: siteRows.map(x => [siteShort(x.s), x.status, `${dec(x.g, 1)} %`, causesOf(x.s).join(' ; ')]) },
  ]
  const file = `performance-rentabilite-${label.replace(/[\s/→]+/g, '-')}`
  const doExport = (kind: 'PDF' | 'Excel') => {
    if (kind === 'PDF') exportPdf(file, `Performance & Rentabilité — ${label}`, `Édité par ${user!.name}`, sections); else exportExcel(file, sections)
    audit('Export', `Performance & Rentabilité (${kind}) — ${label}`)
  }
  const mail = `mailto:?subject=${encodeURIComponent(`Performance & Rentabilité — ${label}`)}&body=${encodeURIComponent(`${sentence}\n\nCA : ${money(group.ca)} · marge nette : ${money(group.net)} · rentabilité : ${dec(group.rate, 1)} % · statut : ${groupStatus}\n\nRecommandations :\n${recos.map(x => `- ${x}`).join('\n')}`)}`
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <Screen title="Performance & Rentabilité" sub={`Écran de pilotage en lecture seule — ${label} · réservé à la Direction Générale${user!.role === 'controleur' ? ' (consultation du Contrôleur central)' : ''}`}>
      <div className="perf-filters">
        <div className="period-filter">
          <div className="seg">{MODES.map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setVal(periodOptions(k)[0]?.v || '') }}>{l}</button>)}</div>
          {mode === 'plage'
            ? <><input type="date" className="ref-input" min={iso(dayStartTs(START))} max={iso(dayStartTs(END))} value={custom[0]} onChange={e => setCustom([e.target.value, custom[1]])} /><span>→</span>
              <input type="date" className="ref-input" min={iso(dayStartTs(START))} max={iso(dayStartTs(END))} value={custom[1]} onChange={e => setCustom([custom[0], e.target.value])} /></>
            : <select className="ref-input" value={v} onChange={e => setVal(e.target.value)}>{opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select>}
        </div>
        <div className="filter-row">{(['all', ...PERF_SITES] as ('all' | SiteCode)[]).map(k => <button key={k} className={site === k ? 'chip on' : 'chip'} onClick={() => setSite(k)}>{k === 'all' ? 'Tous les sites' : siteShort(k)}</button>)}</div>
        <select className="ref-input" value={role} onChange={e => setRole(e.target.value as Role | '')}><option value="">Tous les postes</option>{PERF_ROLES.map(x => <option key={x} value={x}>{roleLabels[x]}</option>)}</select>
      </div>
      <nav className="anchor-nav">{[['perf-synthese', 'Synthèse'], ['perf-employes', 'Employés'], ['perf-sites', 'Sites'], ['perf-croissance', 'Croissance'], ['perf-decision', 'Décision']].map(([id, l]) => <button key={id} onClick={() => scroll(id)}>{l}</button>)}</nav>
      <div className="legend-row"><Pill tone="ok">Vert : bon / niveau atteint</Pill><Pill tone="warn">Orange : vigilance</Pill><Pill tone="danger">Rouge : risque / déficit</Pill></div>

      {/* SECTION 1 — Synthèse */}
      <section id="perf-synthese" className="perf-section">
        <div className="hero-cards">
          <div className="hero-card"><p>Chiffre d’affaires cumulé</p><b>{money(group.ca)}</b><small>{growth >= 0 ? '+' : ''}{dec(growth, 1)} % vs période précédente ({money(groupPrev.ca)})</small></div>
          <div className="hero-card"><p>Marge nette cumulée</p><b className={group.net < 0 ? 'neg' : ''}>{money(group.net)}</b><small>Précédente : {money(groupPrev.net)}</small></div>
          <div className="hero-card"><p>Taux de rentabilité global</p><b>{dec(group.rate, 1)} %</b><small>Seuil {PERF_PARAMS.rentableRate} % · précédent {dec(groupPrev.rate, 1)} %</small></div>
          <div className="hero-card"><p>Croissance</p><b className={growth >= 0 ? 'ok-text' : 'neg'}>{growth >= 0 ? <ArrowUpRight size={28} /> : <ArrowDownRight size={28} />}{growth >= 0 ? '+' : ''}{dec(growth, 1)} %</b><small>par rapport à la période précédente</small></div>
        </div>
        <div className="btn-row">
          <Pill tone={statusTone(groupStatus)}>Statut global : {groupStatus}</Pill>
          <button className="pill-btn" onClick={() => go('alerts')}><b>{openAlerts.length}</b> alertes ouvertes (BDL, caisse, rendement, tournées…) <ArrowRight size={14} /></button>
        </div>
      </section>

      {/* SECTION 2 — Employés */}
      <section id="perf-employes" className="perf-section">
        <Card title="Performance individuelle des employés" sub="Score de performance et score de risque sur 100 — visibles uniquement dans cet onglet">
          {sites.map(s => <div key={s} className="emp-site">
            <h4>{siteShort(s)}</h4>
            <div className="emp-grid">{sorted.filter(x => x.e.site === s).map(x => <button key={x.e.email} className="emp-card" onClick={() => setOpen(x.e)}>
              <span className="emp-top"><span className="avatar-s">{x.e.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span><span><b>{x.e.name}</b><small>{roleLabels[x.e.role]}</small></span><Pill tone={scoreTone(x.score)}>{x.score}/100</Pill></span>
              <span className="emp-kpis">{ROLE_METRICS[x.e.role]!.slice(0, 4).map(m => <span key={m.key}><small>{m.label}</small><b className={metricTone(m, x.vals[m.key]) === 'danger' ? 'neg' : ''}>{fmtMetric(m, x.vals[m.key])}</b></span>)}</span>
              <span className="emp-risk">Risque <Pill tone={riskTone(x.risk)}>{x.risk}/100</Pill>{x.risk >= PERF_PARAMS.riskRed && <em className="neg">Écarts répétés / comportement atypique</em>}</span>
            </button>)}</div>
          </div>)}
        </Card>

        <div className="recap">
          <Card title="Comparatif d’un même poste sur les trois sites" actions={<select className="ref-input" value={cmpRole} onChange={e => setCmpRole(e.target.value as Role)}>{PERF_ROLES.map(x => <option key={x} value={x}>{roleLabels[x]}</option>)}</select>}>
            <Bars cats={cmp.map(x => `${siteShort(x.e.site)}`)} fmt={x => m0.kind === 'amount' ? `${num(x / 1000)} k` : dec(x, m0.decimals ?? 0)}
              series={[{ name: m0.label, values: cmp.map(x => x.vals[m0.key]), color: (val: number) => metricTone(m0, val) === 'danger' ? '#d64545' : metricTone(m0, val) === 'ok' ? '#2f9e5b' : '#3b82c4' }]}
              refLine={m0.threshold !== undefined ? { value: m0.threshold, label: `Seuil ${dec(m0.threshold, 1)} ${m0.unit}` } : undefined} onPick={i => setOpen(cmp[i].e)} />
            <small className="muted">{m0.label} — cliquez sur une barre pour ouvrir la fiche de l’employé.</small>
          </Card>
          <Card title="Seuils métier (périmètre filtré)">
            <div className="donuts">
              <Donut label="Rendement boulanger" value={avg('boulanger', 'eps')} threshold={state.epsThreshold} max={state.epsThreshold * 1.6} good="high" fmt={x => `${num(x)}`} />
              <Donut label="Taux de rebut cuisson" value={avg('enfourneur', 'rate')} threshold={state.rejectThreshold} max={state.rejectThreshold * 2.5} good="low" fmt={x => `${dec(x, 2)} %`} />
              <Donut label="Écart de caisse" value={avg('caissiere', 'gapAmount', true)} threshold={1000 * sites.length} max={Math.max(3000 * sites.length, avg('caissiere', 'gapAmount', true) * 1.2)} good="low" fmt={x => `${num(x)}`} />
              <Donut label="Taux de perte boutique" value={avg('boutiquier', 'lossRate')} threshold={5} max={12} good="low" fmt={x => `${dec(x, 1)} %`} />
            </div>
          </Card>
        </div>

        <Card title="Tous les employés" sub="Cliquez sur une ligne pour ouvrir la fiche détaillée" actions={<select className="ref-input" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="score">Trier par score</option><option value="risk">Trier par risque</option><option value="role">Trier par poste</option><option value="name">Trier par nom</option></select>}>
          <div className="dtable-wrap"><table className="dtable clickable-rows"><thead><tr><th>Employé</th><th>Site</th><th>Poste</th><th>Score</th><th>Risque</th><th>Indicateur principal</th></tr></thead>
            <tbody>{sorted.map(x => { const m = ROLE_METRICS[x.e.role]![0]
              return <tr key={x.e.email} onClick={() => setOpen(x.e)}><td><b>{x.e.name}</b></td><td>{siteShort(x.e.site)}</td><td>{roleLabels[x.e.role]}</td>
                <td><Pill tone={scoreTone(x.score)}>{x.score}</Pill></td><td><Pill tone={riskTone(x.risk)}>{x.risk}</Pill></td><td>{m.label} : {fmtMetric(m, x.vals[m.key])}</td></tr> })}</tbody></table></div>
        </Card>
      </section>

      {/* SECTION 3 — Rentabilité par site */}
      <section id="perf-sites" className="perf-section">
        <div className="site-cards">{siteRows.filter(x => sites.includes(x.s)).map(x => <div key={x.s} className={`site-card ${statusTone(x.status)}`}>
          <div className="site-card-head"><b>{siteShort(x.s)}</b><Pill tone={statusTone(x.status)}>{x.status === 'Déficitaire' ? 'Déficitaire' : x.status}</Pill></div>
          <dl><dt>Chiffre d’affaires</dt><dd>{money(x.p.ca)}</dd><dt>Total des charges</dt><dd>{money(x.p.charges)}</dd><dt>Marge brute</dt><dd>{money(x.p.gross)}</dd>
            <dt>Marge nette</dt><dd className={x.p.net < 0 ? 'neg' : 'ok-text'}>{money(x.p.net)}</dd><dt>Taux de rentabilité</dt><dd><b>{dec(x.p.rate, 1)} %</b></dd></dl>
          {x.p.net < 0 && <Notice tone="danger">Site déficitaire sur la période.</Notice>}
          {x.streak >= 2 && <Notice tone="danger"><b>Risque de faillite</b> : {x.streak} mois consécutifs de perte. Charges les plus lourdes : {CHARGE_LINES.map((c, i) => [c, x.p.chargeLines[i]] as const).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c, val]) => `${c} (${money(val)})`).join(', ')} ; pertes et rebuts : {dec(x.p.ca ? (x.p.chargeLines[1] / x.p.ca) * 100 : 0, 1)} % du CA.</Notice>}
          <details className="pnl"><summary>Compte de résultat simplifié</summary><PnlTable p={x.p} />
            <div className="btn-row"><button className="link-btn" onClick={() => go('reports')}>Ventes et rapports</button><button className="link-btn" onClick={() => go('expenses')}>Dépenses</button><button className="link-btn" onClick={() => go('invendus')}>Pertes</button></div></details>
        </div>)}</div>
        <Card title="Chiffre d’affaires et marge nette par site" sub="La ligne pointillée marque le seuil de rentabilité (marge nette = 0)">
          <Bars cats={siteRows.filter(x => sites.includes(x.s)).map(x => siteShort(x.s))} fmt={x => `${dec(x / 1_000_000, 1)} M`} refLine={{ value: 0, label: 'Seuil de rentabilité' }}
            series={[{ name: 'Chiffre d’affaires', color: '#6b4423', values: siteRows.filter(x => sites.includes(x.s)).map(x => x.p.ca) },
              { name: 'Marge nette', color: (val: number) => (val < 0 ? '#d64545' : '#2f9e5b'), values: siteRows.filter(x => sites.includes(x.s)).map(x => x.p.net) }]}
            onPick={i => setSite(siteRows.filter(x => sites.includes(x.s))[i].s)} />
          <div className="chart-key"><span><i style={{ background: '#6b4423' }} /> Chiffre d’affaires</span><span><i style={{ background: '#2f9e5b' }} /> Marge nette positive</span><span><i style={{ background: '#d64545' }} /> Marge nette négative</span></div>
          <div className="btn-row"><Big tone="ghost" onClick={() => doExport('PDF')}><FileText size={18} /> Comptes de résultat (PDF)</Big><Big tone="ghost" onClick={() => doExport('Excel')}><FileSpreadsheet size={18} /> Excel</Big></div>
        </Card>
      </section>

      {/* SECTION 4 — Croissance cumulée */}
      <section id="perf-croissance" className="perf-section">
        <div className="hero-cards">
          <div className="hero-card"><p>Taux de croissance cumulé</p><b className={growth >= 0 ? 'ok-text' : 'neg'}>{growth >= 0 ? '+' : ''}{dec(growth, 1)} %</b><small>Tendance : {trend}</small></div>
          <div className="hero-card"><p>Croissance moyenne par {bk.unit}</p><b>{avgGrowth >= 0 ? '+' : ''}{dec(avgGrowth, 1)} %</b><small>{growths.length} variation(s)</small></div>
          <div className="hero-card"><p>Seuil de rentabilité global</p><b className={group.net >= 0 ? 'ok-text' : 'neg'}>{group.net >= 0 ? 'Atteint' : 'Non atteint'}</b><small>Marge nette {money(group.net)}</small></div>
          <div className="hero-card"><p>Prévision fin de période (à droit constant)</p><b>{money(forecast.ca)}</b><small>Marge nette prévue : {money(forecast.net)}</small></div>
        </div>
        <Notice tone={deficits.length ? 'warn' : 'ok'}><b>{sentence}</b></Notice>
        <div className="recap">
          <Card title={`Évolution cumulée par ${bk.unit}`} sub="Chiffre d’affaires et marge nette cumulés, comparés à la période précédente">
            <Lines labels={curve.map(c => c.label)} fmt={x => `${dec(x / 1_000_000, 1)} M`} series={[
              { name: 'CA cumulé', color: '#6b4423', values: curve.map(c => c.ca) },
              { name: 'CA cumulé — période précédente', color: '#9c8b7c', values: curve.map(c => c.prev), dashed: true },
              { name: 'Marge nette cumulée', color: '#2f9e5b', values: curve.map(c => c.net) },
            ]} />
          </Card>
          <Card title="Contribution de chaque site au résultat" sub={`Marge nette par ${bk.unit} (colonnes empilées)`}>
            <Stacked labels={curve.map(c => c.label)} fmt={x => `${num(x / 1000)} k`} series={PERF_SITES.filter(s => sites.includes(s)).map(s => ({ name: siteShort(s), color: SITE_COLORS[s], values: curve.map(c => c.perSite[PERF_SITES.indexOf(s)]) }))} />
          </Card>
        </div>
      </section>

      {/* SECTION 5 — Décision */}
      <section id="perf-decision" className="perf-section">
        <Card title="Synthèse décisionnelle rentabilité / faillite">
          <Table head={['Périmètre', 'Statut', 'Tendance', 'Score de risque', 'Principales causes de dégradation']} rows={[
            ...siteRows.filter(x => sites.includes(x.s)).map(x => [<b>{siteShort(x.s)}</b>, <Pill tone={statusTone(x.status)}>{x.status}{x.streak >= 2 ? ' — risque de faillite' : ''}</Pill>,
              <span className={x.g >= 0 ? 'ok-text' : 'neg'}>{x.g >= 0 ? '↗' : '↘'} {dec(x.g, 1)} %</span>, <Pill tone={riskTone(siteRisk(x.s))}>{siteRisk(x.s)}/100</Pill>, causesOf(x.s).join(' · ') || '—']),
            [<b>Groupe</b>, <Pill tone={statusTone(groupStatus)}>{groupStatus}</Pill>, <span className={growth >= 0 ? 'ok-text' : 'neg'}>{growth >= 0 ? '↗' : '↘'} {dec(growth, 1)} %</span>,
              <Pill tone={riskTone(Math.round(sites.reduce((a, s) => a + siteRisk(s), 0) / sites.length))}>{Math.round(sites.reduce((a, s) => a + siteRisk(s), 0) / sites.length)}/100</Pill>, deficits.length ? `Site(s) déficitaire(s) : ${deficits.join(', ')}` : '—'],
          ]} />
          <h4>Recommandations</h4>
          {recos.length ? <ul className="recos">{recos.map(x => <li key={x}>{x}</li>)}</ul> : <Notice tone="ok">Aucune recommandation : tous les indicateurs sont dans les seuils.</Notice>}
          <div className="btn-row">
            <Big tone="ghost" onClick={() => doExport('PDF')}><FileText size={18} /> Exporter le tableau de bord (PDF)</Big>
            <Big tone="ghost" onClick={() => doExport('Excel')}><FileSpreadsheet size={18} /> Excel</Big>
            <a className="big-btn ghost" href={mail} onClick={() => { audit('Envoi du résumé', `Performance & Rentabilité — ${label}`); say('Résumé préparé dans votre messagerie') }}><Mail size={18} /> Envoyer le résumé par email</a>
          </div>
        </Card>
      </section>

      {open && <EmployeeSheet e={open} r={r} label={label} onClose={() => setOpen(null)} onSource={() => { const s = SOURCE[open.role]; if (s) go(s[0]) }} />}
    </Screen>
  )
}

function PnlTable({ p }: { p: PnL }) {
  return <Table head={['Poste', 'Montant']} rows={[
    ...PRODUCT_LINES.map((l, i) => [l, money(p.products[i])]), [<b>Produits</b>, <b>{money(p.ca)}</b>],
    ...CHARGE_LINES.map((l, i) => [l, `− ${money(p.chargeLines[i])}`]), [<b>Charges</b>, <b>− {money(p.charges)}</b>],
    [<b>Marge brute</b>, <b>{money(p.gross)}</b>], [<b>Marge nette</b>, <b className={p.net < 0 ? 'neg' : 'ok-text'}>{money(p.net)}</b>], ['Taux de rentabilité', `${dec(p.rate, 1)} %`],
  ]} />
}

// Fiche détaillée de l'employé : indicateurs, évolution du score et accès aux enregistrements d'origine.
function EmployeeSheet({ e, r, label, onClose, onSource }: { e: Employee; r: Range; label: string; onClose: () => void; onSource: () => void }) {
  const p = employeePerf(e, r)
  const src = SOURCE[e.role]
  return <div className="sheet-backdrop" onClick={onClose}>
    <div className="sheet" onClick={ev => ev.stopPropagation()}>
      <div className="block-head"><div><h3>{e.name}</h3><p>{roleLabels[e.role]} · {siteShort(e.site)} · {label}</p></div><button className="icon-btn" onClick={onClose} title="Fermer"><X size={18} /></button></div>
      <div className="block-body">
        <div className="btn-row"><Pill tone={scoreTone(p.score)}>Performance {p.score}/100</Pill><Pill tone={riskTone(p.risk)}>Risque {p.risk}/100</Pill></div>
        <Table head={['Indicateur', 'Valeur', 'Seuil']} rows={ROLE_METRICS[e.role]!.map(m => [m.label, <b className={metricTone(m, p.vals[m.key]) === 'danger' ? 'neg' : ''}>{fmtMetric(m, p.vals[m.key])}</b>, m.threshold !== undefined ? fmtMetric(m, m.threshold) : '—'])} />
        <h4>Évolution du score de performance</h4>
        <Lines labels={p.history.map(h => h.label)} fmt={x => `${num(x)}`} series={[{ name: 'Score de performance', color: '#3b82c4', values: p.history.map(h => h.score) }]} />
        {src && <Big tone="ghost" onClick={onSource}>Ouvrir les enregistrements d’origine : {src[1]} <ArrowRight size={16} /></Big>}
      </div>
    </div>
  </div>
}
