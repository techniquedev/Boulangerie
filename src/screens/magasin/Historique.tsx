import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useApp } from '../../store/context'
import { Big, Card, Notice, Screen, Table } from '../../components/ui'
import { can } from '../../data/rbac'
import { atelierLabel, fmtQty, LOC_LABELS, matName, siteStock, SITE_MATS, supplierName, unitQty, type MoveKind } from '../../data/stock'
import { dayOf, money, today } from '../../lib/format'
import { exportExcel, exportPdf, type Section } from '../../lib/export'
import { useStore } from './shared'

const KINDS: MoveKind[] = ['Entrée (réception)', 'Sortie (bon atelier)', 'Contre-écriture', 'Inventaire d’ouverture']
// Début de journée (Porto-Novo, UTC+1) d'une date AAAA-MM-JJ.
const startOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d, -1, 0) }
const fr = (iso: string) => iso.split('-').reverse().join('/')

type Content = 'mouvements' | 'receptions' | 'bons' | 'stock'

export function MHistory() {
  const { state } = useApp()
  const { user, site, siteName, movements, receptions, bons } = useStore()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState<MoveKind | ''>('')
  const [mp, setMp] = useState('')
  const [content, setContent] = useState<Content>('mouvements')

  const lo = from ? startOf(from) : -Infinity
  const hi = to ? startOf(to) + 86400000 : Infinity
  const inPeriod = (ts: number) => ts >= lo && ts < hi
  const list = movements.filter(m => inPeriod(m.ts) && (!kind || m.kind === kind) && (!mp || m.mp === mp))
  const fixes = movements.filter(m => m.kind === 'Contre-écriture' && inPeriod(m.ts))

  const period = `${from ? fr(from) : 'début'} → ${to ? fr(to) : 'aujourd’hui'}`
  const sections: Record<Content, Section> = {
    mouvements: { title: 'Mouvements de stock', head: ['Horodatage serveur', 'Heure locale', 'Type', 'Référence', 'Matière', 'Quantité', 'Emplacement', 'Auteur', 'Appareil', 'Site', 'Motif'],
      rows: list.map(m => [m.trace.at || 'en attente de synchronisation', m.trace.localAt, m.kind, m.ref, matName(m.mp), fmtQty(m.mp, m.qty), LOC_LABELS[m.loc], m.trace.author, m.trace.device, m.site, m.motif || '']) },
    receptions: { title: 'Réceptions fournisseurs', head: ['Date', 'N° réception', 'Fournisseur', 'Facture', 'Matière', 'Commandée', 'Reçue', 'Auteur', 'Appareil', 'Horodatage serveur'],
      rows: receptions.filter(r => inPeriod(r.ts)).flatMap(r => r.lines.map(l => [dayOf(r.ts), r.id, supplierName(r.supplier), r.invoiceNo, matName(l.mp),
        l.ordered === null ? '' : unitQty(l.unit, l.ordered), unitQty(l.unit, l.received), r.trace.author, r.trace.device, r.trace.at])) },
    bons: { title: 'Bons de sortie', head: ['Date', 'N° bon', 'Atelier', 'Matière', 'Sortie', 'Reçue', 'Statut', 'Rapprochement', 'Émis par', 'Confirmé par'],
      rows: bons.filter(b => inPeriod(b.ts)).flatMap(b => b.lines.map(l => [dayOf(b.ts), b.id, atelierLabel(b.atelier), matName(l.mp), fmtQty(l.mp, l.qty),
        l.received === undefined ? '' : fmtQty(l.mp, l.received), b.status, b.reconcile?.result || '', b.by, b.confirm?.author || ''])) },
    stock: (() => {
      const st = siteStock(state.movements.filter(m => m.ts < hi), site)
      return { title: `État des stocks au ${to ? fr(to) : today()}`, head: ['Code', 'Matière', 'Emplacement', 'Stock', 'Minimum', 'Valeur (CMP)'],
        rows: SITE_MATS.map(m => [m.mp, m.name, LOC_LABELS[m.loc], fmtQty(m.mp, st[m.mp] || 0), fmtQty(m.mp, m.min), money((st[m.mp] || 0) * m.cmp)]) }
    })(),
  }
  const fileBase = `${content}-${siteName.replace(' ', '')}-${today().replace(/\//g, '-')}`

  return (
    <Screen title="Historique et piste d’audit" sub={`Tous les mouvements du magasin du site ${siteName} — écritures non modifiables, corrections par contre-écriture`}>
      <Card title="Filtres">
        <div className="filter-row">
          <label className="field">Du<input className="ref-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="field">Au<input className="ref-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <label className="field">Type<select className="ref-input" value={kind} onChange={e => setKind(e.target.value as MoveKind | '')}><option value="">Tous les mouvements</option>{KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Matière<select className="ref-input" value={mp} onChange={e => setMp(e.target.value)}><option value="">Toutes</option>{SITE_MATS.map(m => <option key={m.mp} value={m.mp}>{m.name}</option>)}</select></label>
        </div>
      </Card>

      {can.exportStore(user.role) && <Card title="Exports pour les audits et la direction" sub={`Période : ${period}`}>
        <div className="btn-row">
          <select className="ref-input" value={content} onChange={e => setContent(e.target.value as Content)}>
            <option value="mouvements">Mouvements (filtres appliqués)</option><option value="receptions">Réceptions</option>
            <option value="bons">Bons de sortie</option><option value="stock">État des stocks en fin de période</option>
          </select>
          <Big tone="ghost" onClick={() => exportExcel(fileBase, [sections[content]])}><FileSpreadsheet size={18} /> Excel</Big>
          <Big tone="ghost" onClick={() => exportPdf(fileBase, `${sections[content].title} — magasin ${siteName}`, `Période : ${period} · édité le ${today()} par ${user.name}`, [sections[content]])}><FileText size={18} /> PDF</Big>
        </div>
      </Card>}

      <Card title={`Mouvements (${list.length})`}>
        <div className="scroll-list"><Table head={['Horodatage serveur', 'Type', 'Référence', 'Matière', 'Quantité', 'Emplacement', 'Auteur', 'Appareil', 'Site']} rows={list.map(m => [
          m.trace.at || <em className="pending">en attente de synchronisation</em>, m.kind, <b>{m.ref}</b>, matName(m.mp),
          <b className={m.qty < 0 ? 'neg' : 'ok-text'}>{m.qty > 0 ? '+' : ''}{fmtQty(m.mp, m.qty)}</b>, LOC_LABELS[m.loc], m.trace.author, m.trace.device, m.site])} /></div>
      </Card>

      <Card title="Corrections par contre-écriture" sub="Motif et auteur de chaque correction — l’écriture d’origine est toujours conservée">
        {fixes.length ? <Table head={['Date', 'Référence', 'Matière', 'Correction', 'Auteur', 'Motif']} rows={fixes.map(m => [m.trace.at || m.trace.localAt, m.ref, matName(m.mp),
          <b>{m.qty > 0 ? '+' : ''}{fmtQty(m.mp, m.qty)}</b>, m.trace.author, m.motif || '—'])} /> : <Notice>Aucune contre-écriture sur la période.</Notice>}
      </Card>
    </Screen>
  )
}
