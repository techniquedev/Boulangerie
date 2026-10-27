import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { can } from '../../data/rbac'
import { productName, SHOP_KINDS, SHOP_PRODUCTS, shopStock, type ShopMoveKind } from '../../data/shop'
import { dayOf, num, stampAt, today } from '../../lib/format'
import { exportExcel, exportPdf, type Section } from '../../lib/export'
import { useShop } from './shared'

const startOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d, -1, 0) }
const fr = (iso: string) => iso.split('-').reverse().join('/')
type Content = 'mouvements' | 'receptions' | 'stock'

export function SHistory() {
  const { state } = useApp()
  const { user, site, shop, moves, bdls, fixes } = useShop()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState<ShopMoveKind | ''>('')
  const [code, setCode] = useState('')
  const [content, setContent] = useState<Content>('mouvements')

  const lo = from ? startOf(from) : -Infinity
  const hi = to ? startOf(to) + 86400000 : Infinity
  const inPeriod = (ts: number) => ts >= lo && ts < hi
  const list = moves.filter(m => inPeriod(m.ts) && (!kind || m.kind === kind) && (!code || m.code === code))
  const period = `${from ? fr(from) : 'début'} → ${to ? fr(to) : 'aujourd’hui'}`

  // Exports : les réceptions ne contiennent que les quantités comptées (jamais les quantités expédiées).
  const sections: Record<Content, Section> = {
    mouvements: { title: 'Mouvements du stock vendant', head: ['Horodatage serveur', 'Heure locale', 'Type', 'Référence', 'Produit', 'Lot', 'Quantité', 'Auteur', 'Appareil', 'Site', 'Motif'],
      rows: list.map(m => [m.trace.at || 'en attente de synchronisation', m.trace.localAt, m.kind, m.ref, productName(m.code), m.lot, m.qty, m.trace.author, m.trace.device, m.site, m.motif || '']) },
    receptions: { title: 'Réceptions de la boutique', head: ['N° BDL', 'Émis le', 'Comptage validé le', 'Produit', 'Lot', 'Quantité comptée', 'Statut', 'Auteur', 'Appareil'],
      rows: bdls.flatMap(b => (b.counts || []).filter(c => inPeriod(c.ts)).flatMap(c => b.lines.map((l, i) => [b.id, b.ts ? stampAt(new Date(b.ts)) : '', c.trace.localAt, l.label, l.lot || '', c.counts[i] || 0,
        c.partial ? 'Réception partielle' : b.status, c.trace.author, c.trace.device]))) },
    stock: (() => {
      const st = shopStock(state.shopMoves, site, hi === Infinity ? Date.now() : hi - 1)
      return { title: `État du stock vendant au ${to ? fr(to) : today()}`, head: ['Produit', 'Lot', 'Date limite', 'Quantité'],
        rows: SHOP_PRODUCTS.flatMap(p => st[p.code].lots.map(l => [productName(p.code), l.lot || '—', l.dlc || '—', l.qty])) }
    })(),
  }
  const fileBase = `${content}-${shop.replace(/\s/g, '')}-${today().replace(/\//g, '-')}`

  return (
    <Screen title="Historique et piste d’audit" sub={`Tous les mouvements de la ${shop} — écritures non modifiables`}>
      <Card title="Filtres">
        <div className="filter-row">
          <label className="field">Du<input className="ref-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="field">Au<input className="ref-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <label className="field">Type<select className="ref-input" value={kind} onChange={e => setKind(e.target.value as ShopMoveKind | '')}><option value="">Tous les mouvements</option>{SHOP_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Produit<select className="ref-input" value={code} onChange={e => setCode(e.target.value)}><option value="">Tous</option>{SHOP_PRODUCTS.map(p => <option key={p.code} value={p.code}>{productName(p.code)}</option>)}</select></label>
        </div>
      </Card>

      {can.exportShop(user.role) && <Card title="Exports pour les audits et la direction" sub={`Période : ${period}`}>
        <div className="btn-row">
          <select className="ref-input" value={content} onChange={e => setContent(e.target.value as Content)}>
            <option value="mouvements">Mouvements (filtres appliqués)</option><option value="receptions">Réceptions</option><option value="stock">État du stock en fin de période</option>
          </select>
          <Big tone="ghost" onClick={() => exportExcel(fileBase, [sections[content]])}><FileSpreadsheet size={18} /> Excel</Big>
          <Big tone="ghost" onClick={() => exportPdf(fileBase, `${sections[content].title} — ${shop}`, `Période : ${period} · édité le ${today()} par ${user.name}`, [sections[content]])}><FileText size={18} /> PDF</Big>
        </div>
      </Card>}

      <Card title={`Mouvements (${list.length})`}>
        <div className="scroll-list"><Table head={['Horodatage serveur', 'Type', 'Référence', 'Produit', 'Lot', 'Quantité', 'Auteur', 'Appareil', 'Site']} rows={list.map(m => [
          m.trace.at || <em className="pending">en attente de synchronisation</em>, m.kind, <b>{m.ref}</b>, productName(m.code), m.lot || '—',
          <b className={m.qty < 0 ? 'neg' : 'ok-text'}>{m.qty > 0 ? '+' : ''}{num(m.qty)}</b>, m.trace.author, m.trace.device, m.site])} /></div>
      </Card>

      <Card title="Corrections par contre-écriture" sub="Motif, auteur et statut de validation hiérarchique">
        {fixes.filter(f => inPeriod(f.ts)).length ? <Table head={['N°', 'Date', 'Référence', 'Produit', 'Correction', 'Auteur', 'Motif', 'Statut']} rows={fixes.filter(f => inPeriod(f.ts)).map(f => [
          f.id, dayOf(f.ts), f.ref, productName(f.code), <b>{f.delta > 0 ? '+' : ''}{f.delta}</b>, f.trace.author, f.motif,
          <Badge tone={f.status === 'En attente de validation' ? 'warn' : f.status.startsWith('Refus') ? 'danger' : 'ok'}>{f.status}{f.decidedBy ? ` (${f.decidedBy})` : ''}</Badge>])} />
          : <Notice>Aucune contre-écriture sur la période.</Notice>}
      </Card>
    </Screen>
  )
}
