import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { Big, Card, Notice, Screen, Table } from '../../components/ui'
import { can } from '../../data/rbac'
import { cuissonFigures, figures, REJECT_REASONS, type ProdLot } from '../../data/boulanger'
import type { Trace } from '../../data/trace'
import { dayStartTs, dec, num, today } from '../../lib/format'
import { exportExcel, exportPdf, type Section } from '../../lib/export'
import { useOven } from './shared'
import { usePeriod } from '../../components/PeriodFilter'

type Kind = 'Prise en charge' | 'Cuisson' | 'Contre-écriture' | 'Anomalie'
type Event = { kind: Kind; lot: ProdLot; detail: string; trace: Trace; day: string }
// « JJ/MM/AAAA HH:MM » → « AAAAMMJJ HH:MM », pour un tri chronologique.
const sortKey = (at: string) => `${at.slice(0, 10).split('/').reverse().join('')} ${at.slice(11)}`
const fallback = (author: string, site: ProdLot['site'], at: string): Trace => ({ author, site, device: '—', at, localAt: at, offline: false })

export function EHistory() {
  const { user, lots, siteName } = useOven()
  const [kind, setKind] = useState<Kind | ''>('')

  // Tous les événements de cuisson du site.
  const events: Event[] = lots.flatMap(l => {
    const c = cuissonFigures(l)
    return [
      ...(l.oven ? [{ kind: 'Prise en charge' as const, lot: l, detail: `Lot pris en charge (${num(figures(l).patons)} pâtons)`, trace: l.oven.trace }] : []),
      ...(l.cuisson && c ? [{ kind: 'Cuisson' as const, lot: l, detail: `${num(l.cuisson.good)} conformes + ${num(l.cuisson.rejects.reduce((a, r) => a + r.qty, 0))} rebuts = ${num(l.cuisson.received)} (${dec(c.rate, 2)} %)`, trace: l.cuisson.trace || fallback(l.cuisson.by, l.site, l.cuisson.at) }] : []),
      ...(l.ovenFixes || []).map(f => ({ kind: 'Contre-écriture' as const, lot: l, detail: `${f.qty} ${f.format} : ${f.from} → ${f.to} — ${f.motif}`, trace: f.trace })),
      ...(l.anomalies || []).map(a => ({ kind: 'Anomalie' as const, lot: l, detail: a.text, trace: a.trace })),
    ].map(e => ({ ...e, day: e.trace.localAt.slice(0, 10) }))
  }).sort((a, b) => sortKey(b.trace.localAt).localeCompare(sortKey(a.trace.localAt)))
  const per = usePeriod(events.map(e => e.day))
  const inPeriod = (d: string) => per.match(d)
  const list = events.filter(e => inPeriod(e.day) && (!kind || e.kind === kind))
  const fixes = events.filter(e => e.kind === 'Contre-écriture' && inPeriod(e.day))
  const cooked = lots.filter(l => l.cuisson && inPeriod(l.cuisson.at.slice(0, 10)))

  const period = per.label
  const sections: Section[] = [
    { title: 'Rapports de cuisson', head: ['Lot', 'Cuisson', 'Enfourneur', 'Pâtons reçus', 'Conformes', 'Rebuts', 'Taux', 'Motif complémentaire'],
      rows: cooked.map(l => { const c = cuissonFigures(l)!; return [l.id, l.cuisson!.at, l.cuisson!.by, c.received, c.good, c.rejectTotal, `${dec(c.rate, 2)} %`, l.cuisson!.rateMotif || ''] }) },
    { title: 'Suivi des rebuts par motif', head: ['Lot', 'Format', 'Motif', 'Quantité', 'Photo'],
      rows: cooked.flatMap(l => cuissonFigures(l)!.rejects.map(r => [l.id, r.format, r.reason, r.qty, l.cuisson!.rejects.find(x => x.reason === r.reason && x.format === r.format)?.image?.name || ''])) },
    { title: 'Totaux par motif', head: ['Motif', 'Quantité'], rows: REJECT_REASONS.map(m => [m, cooked.reduce((a, l) => a + cuissonFigures(l)!.rejects.filter(r => r.reason === m).reduce((b, r) => b + r.qty, 0), 0)]) },
  ]
  const fileBase = `cuissons-${siteName.replace(' ', '')}-${today().replace(/\//g, '-')}`

  return (
    <Screen title="Historique et piste d’audit" sub={`Toutes les cuissons du four de ${siteName} — écritures non modifiables`}>
      <Card title="Filtres">
        <div className="filter-row">
          {per.bar}
          <label className="field">Type<select className="ref-input" value={kind} onChange={e => setKind(e.target.value as Kind | '')}><option value="">Tous les événements</option>
            {(['Prise en charge', 'Cuisson', 'Contre-écriture', 'Anomalie'] as Kind[]).map(k => <option key={k}>{k}</option>)}</select></label>
        </div>
      </Card>

      {can.exportOven(user.role) && <Card title="Exports pour les audits et la direction" sub={`Rapports de cuisson et suivi des rebuts — période : ${period}`}>
        <div className="btn-row">
          <Big tone="ghost" onClick={() => exportExcel(fileBase, sections)}><FileSpreadsheet size={18} /> Excel</Big>
          <Big tone="ghost" onClick={() => exportPdf(fileBase, `Cuissons et rebuts — four de ${siteName}`, `Période : ${period} · édité le ${today()} par ${user.name}`, sections)}><FileText size={18} /> PDF</Big>
        </div>
      </Card>}

      <Card title={`Événements (${list.length})`}>
        <div className="scroll-list"><Table head={['Horodatage serveur', 'Heure locale', 'Type', 'Lot', 'Détail', 'Auteur', 'Appareil', 'Site']} rows={list.map(e => [
          e.trace.at || <em className="pending">en attente de synchronisation</em>, e.trace.localAt, e.kind, <b>{e.lot.id}</b>, <small>{e.detail}</small>, e.trace.author, e.trace.device, e.trace.site])} /></div>
      </Card>

      <Card title="Corrections par contre-écriture" sub="Motif et auteur de chaque correction — le rapport d’origine est conservé">
        {fixes.length ? <Table head={['Date', 'Lot', 'Correction', 'Auteur']} rows={fixes.map(e => [e.trace.localAt, e.lot.id, e.detail, e.trace.author])} /> : <Notice>Aucune contre-écriture sur la période.</Notice>}
      </Card>
    </Screen>
  )
}
