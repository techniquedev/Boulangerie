import { useState } from 'react'
import { Camera, Check, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { suppliers } from '../../data/partners'
import { can } from '../../data/rbac'
import { traceFor } from '../../data/trace'
import {
  fmtQty, groupOf, matName, nextMoveId, nextReceptionId, siteMat, SITE_MATS, supplierName, unitQty,
  type Movement, type Photo, type Reception, type RecGroup,
} from '../../data/stock'
import { dayOf, dec, nowStamp, today } from '../../lib/format'
import { exportExcel, exportPdf } from '../../lib/export'
import { readPhoto } from '../../lib/photo'
import { cleanNum, toNum, TraceInfo } from '../boulanger/shared'
import { useStore } from './shared'
import { usePeriod } from '../../components/PeriodFilter'

type Row = { mp: string; unit: string; ordered: string; received: string; remark: string }
const blankRow = (): Row => ({ mp: '', unit: '', ordered: '', received: '', remark: '' })
const isoToday = () => today().split('/').reverse().join('-')
const fromIso = (v: string) => v.split('-').reverse().join('/')

const groupStatus = (g?: RecGroup) => g?.partial
  ? <Badge tone="warn">Réception partielle — reliquat : {g.reliquat.map(r => `${matName(r.mp)} ${fmtQty(r.mp, r.qty)}`).join(', ')}</Badge>
  : <Badge tone="ok">Réception complète</Badge>

export function MReceptions() {
  const { state, update, audit, say } = useApp()
  const { user, site, siteName, stock, receptions, groups, movements } = useStore()
  const [form, setForm] = useState({ supplier: '', invoiceNo: '', invoiceRef: '', date: isoToday(), complementOf: '' })
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [done, setDone] = useState<Reception | null>(null)
  const [filter, setFilter] = useState({ supplier: '', mp: '' })
  const per = usePeriod(receptions.map(r => dayOf(r.ts)))
  const [sel, setSel] = useState(receptions[0]?.id)
  const [fix, setFix] = useState({ mp: '', delta: '', motif: '' })

  const partials = groups.filter(g => g.partial)
  const setRow = (i: number, v: Partial<Row>) => setRows(rows.map((r, k) => k === i ? { ...r, ...v } : r))
  const reset = () => { setForm({ supplier: '', invoiceNo: '', invoiceRef: '', date: isoToday(), complementOf: '' }); setRows([blankRow()]); setPhotos([]) }

  // Complément d'une livraison partielle : même facture, lignes pré-remplies avec le reliquat.
  const complement = (key: string) => {
    const g = partials.find(x => x.key === key)
    if (!g) return reset()
    const o = g.origin
    setForm({ supplier: o.supplier, invoiceNo: o.invoiceNo, invoiceRef: o.invoiceRef, date: isoToday(), complementOf: o.id })
    setRows(g.reliquat.map(r => {
      const l = o.lines.find(x => x.mp === r.mp)!
      const q = String(+(r.qty / l.f).toFixed(3)).replace('.', ',')
      return { mp: r.mp, unit: l.unit, ordered: q, received: q, remark: '' }
    }))
  }

  const addPhoto = async (kind: Photo['kind'], files: FileList | null) => {
    if (!files?.length) return
    const added = await Promise.all([...files].map(async f => ({ kind, name: f.name, thumb: await readPhoto(f) })))
    setPhotos([...photos, ...added])
  }

  const lines = rows.filter(r => r.mp && toNum(r.received) > 0).map(r => {
    const f = siteMat(r.mp).units.find(u => u.u === r.unit)?.f ?? 1
    return { mp: r.mp, unit: r.unit || siteMat(r.mp).unit, f, ordered: r.ordered ? toNum(r.ordered) : null, received: toNum(r.received), remark: r.remark.trim() || undefined }
  })
  const error = !form.supplier ? 'Choisissez le fournisseur.' : !form.invoiceNo.trim() ? 'Saisissez le numéro de la facture.' : !form.invoiceRef.trim() ? 'Saisissez la référence (bon de livraison du fournisseur).'
    : !form.date ? 'Saisissez la date de livraison.' : !lines.length ? 'Saisissez au moins une ligne reçue.' : ''
  const previewId = nextReceptionId(state.receptions, site, Date.now())

  const validate = () => {
    if (error) return say(error)
    const ts = Date.now()
    const t = traceFor(user.name, site, state.offline)
    const r: Reception = {
      id: nextReceptionId(state.receptions, site, ts), site, supplier: form.supplier, invoiceNo: form.invoiceNo.trim(), invoiceRef: form.invoiceRef.trim(),
      deliveryDate: fromIso(form.date), ts, lines, photos, complementOf: form.complementOf || undefined, trace: t,
    }
    update(s => {
      const movs: Movement[] = lines.map((l, i) => ({ id: nextMoveId(s.movements, i), site, mp: l.mp, loc: siteMat(l.mp).loc, qty: l.received * l.f, kind: 'Entrée (réception)', ref: r.id, ts, trace: t }))
      return {
        ...s, receptions: [...s.receptions, r], movements: [...s.movements, ...movs],
        queue: s.offline ? [{ id: r.id, text: `Réception ${r.id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }
    })
    audit('Réception fournisseur', `${r.id} — ${supplierName(r.supplier)}, facture ${r.invoiceNo} : ${lines.map(l => `${matName(l.mp)} ${unitQty(l.unit, l.received)}`).join(' · ')}`)
    say(state.offline ? `Réception ${r.id} enregistrée hors-ligne : en attente de synchronisation` : `Réception ${r.id} validée : stock du magasin mis à jour`)
    setDone(r); setSel(r.id); reset()
  }

  // Liste filtrée et fiche détaillée.
  const list = receptions.filter(r => per.match(dayOf(r.ts)) && (!filter.supplier || r.supplier === filter.supplier) && (!filter.mp || r.lines.some(l => l.mp === filter.mp)))
  const r = receptions.find(x => x.id === sel)
  const fixes = r ? movements.filter(m => m.kind === 'Contre-écriture' && m.ref === r.id) : []

  const applyFix = () => {
    if (!r) return
    const delta = Number(fix.delta.replace(',', '.'))
    if (!fix.mp || !delta) return say('Choisissez la matière et la quantité à corriger (ex. -1 ou 2).')
    if (!fix.motif.trim()) return say('Le motif de la contre-écriture est obligatoire.')
    if ((stock[fix.mp] || 0) + delta < 0) return say(`Contre-écriture bloquée : le stock de ${matName(fix.mp)} deviendrait négatif.`)
    const ts = Date.now(), t = traceFor(user.name, site, state.offline)
    update(s => ({ ...s, movements: [...s.movements, { id: nextMoveId(s.movements), site, mp: fix.mp, loc: siteMat(fix.mp).loc, qty: delta, kind: 'Contre-écriture', ref: r.id, ts, trace: t, motif: fix.motif.trim() }] }))
    audit('Contre-écriture de stock', `${r.id} : ${matName(fix.mp)} ${delta > 0 ? '+' : ''}${fmtQty(fix.mp, delta)} — motif : ${fix.motif.trim()} (réception d’origine conservée)`)
    say('Contre-écriture tracée'); setFix({ mp: '', delta: '', motif: '' })
  }

  const exportRows = list.flatMap(x => x.lines.map(l => [dayOf(x.ts), x.id, supplierName(x.supplier), x.invoiceNo, x.invoiceRef, x.deliveryDate, matName(l.mp),
    l.ordered === null ? '' : unitQty(l.unit, l.ordered), unitQty(l.unit, l.received), groupOf(groups, x)?.partial ? 'Réception partielle' : 'Réception complète', x.trace.author, x.trace.device, x.trace.at]))
  const section = { title: 'Réceptions fournisseurs', head: ['Date', 'N° réception', 'Fournisseur', 'Facture', 'Référence', 'Livraison', 'Matière', 'Commandée', 'Reçue', 'Statut', 'Auteur', 'Appareil', 'Horodatage serveur'], rows: exportRows }
  const fileBase = `receptions-${siteName.replace(' ', '')}-${today().replace(/\//g, '-')}`

  return (
    <Screen title="Réceptions fournisseurs" sub={`Livraisons reçues directement au magasin du site ${siteName} — enregistrées sur la base de la facture fournisseur`}>
      {done && <Card title={`Réception ${done.id} validée`} sub="Mouvements d’entrée créés — nouveau stock disponible du magasin" actions={<Big tone="ghost" onClick={() => setDone(null)}>Fermer</Big>}>
        <Table head={['Matière', 'Reçue', 'Nouveau stock disponible']} rows={done.lines.map(l => [matName(l.mp), unitQty(l.unit, l.received), <b>{fmtQty(l.mp, stock[l.mp] || 0)}</b>])} />
      </Card>}

      <Card title="Enregistrer une réception" sub={`N° de réception attribué automatiquement : ${previewId}`}>
        {partials.length > 0 && <label className="field">Compléter une livraison partielle (même facture)
          <select className="ref-input" value={partials.find(g => g.origin.id === form.complementOf)?.key || ''} onChange={e => complement(e.target.value)}>
            <option value="">Nouvelle livraison</option>
            {partials.map(g => <option key={g.key} value={g.key}>{supplierName(g.origin.supplier)} — {g.origin.invoiceNo} (reliquat : {g.reliquat.map(x => `${matName(x.mp)} ${fmtQty(x.mp, x.qty)}`).join(', ')})</option>)}
          </select></label>}
        <div className="form-grid">
          <label className="field">Fournisseur (référentiel)
            <select className="ref-input" value={form.supplier} disabled={!!form.complementOf} onChange={e => setForm({ ...form, supplier: e.target.value })}>
              <option value="">Choisir…</option>{suppliers.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
            </select></label>
          <label className="field">N° de facture<input className="ref-input" value={form.invoiceNo} disabled={!!form.complementOf} placeholder="FAC-FR01-0261" onChange={e => setForm({ ...form, invoiceNo: e.target.value })} /></label>
          <label className="field">Référence (bon de livraison fournisseur)<input className="ref-input" value={form.invoiceRef} placeholder="BL-…" onChange={e => setForm({ ...form, invoiceRef: e.target.value })} /></label>
          <label className="field">Date de livraison (JJ/MM/AAAA)<input className="ref-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
        </div>

        <Table head={['Matière première', 'Unité de réception', 'Commandée', 'Reçue', 'Écart', 'Remarque', '']} rows={rows.map((row, i) => {
          const m = row.mp ? siteMat(row.mp) : null
          const gap = row.ordered && row.received ? toNum(row.received) - toNum(row.ordered) : null
          return [
            <select className="ref-input" value={row.mp} onChange={e => setRow(i, { mp: e.target.value, unit: siteMat(e.target.value)?.units[siteMat(e.target.value).units.length > 1 ? 1 : 0].u || '' })}>
              <option value="">Choisir…</option>{SITE_MATS.map(x => <option key={x.mp} value={x.mp}>{x.name}</option>)}
            </select>,
            m ? <select className="ref-input" value={row.unit} onChange={e => setRow(i, { unit: e.target.value })}>{m.units.map(u => <option key={u.u} value={u.u}>{u.u}</option>)}</select> : '—',
            <input className="num-input sm" inputMode="decimal" placeholder="—" value={row.ordered} onChange={e => setRow(i, { ordered: cleanNum(e.target.value) })} />,
            <input className="num-input sm" inputMode="decimal" placeholder="0" value={row.received} onChange={e => setRow(i, { received: cleanNum(e.target.value) })} />,
            gap === null ? '—' : <b className={gap < 0 ? 'neg' : 'ok-text'}>{gap > 0 ? '+' : ''}{dec(gap, 2)}</b>,
            <input className="ref-input" value={row.remark} placeholder="Remarque" onChange={e => setRow(i, { remark: e.target.value })} />,
            rows.length > 1 ? <button className="icon-btn" title="Retirer la ligne" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={18} /></button> : '',
          ]
        })} />
        <div className="btn-row">
          <Big tone="ghost" onClick={() => setRows([...rows, blankRow()])}><Plus size={20} /> Ajouter une ligne</Big>
          {(['Facture', 'Bon de livraison'] as const).map(k => <label key={k} className="big-btn ghost file-btn"><Camera size={20} /> Photo : {k.toLowerCase()}
            <input type="file" accept="image/*" capture="environment" multiple onChange={e => { void addPhoto(k, e.target.files); e.target.value = '' }} /></label>)}
        </div>
        {photos.length > 0 && <div className="photo-row">{photos.map((p, i) => <figure key={i}><img src={p.thumb} alt={p.name} /><figcaption>{p.kind}</figcaption>
          <button className="link-btn" onClick={() => setPhotos(photos.filter((_, k) => k !== i))}>Retirer</button></figure>)}</div>}
        {rows.some(x => x.ordered && toNum(x.received) < toNum(x.ordered)) && <Notice tone="warn">Quantité reçue inférieure à la commande : la réception sera enregistrée en « Réception partielle » avec un reliquat restant à livrer.</Notice>}
        {error && <Notice tone="warn">{error}</Notice>}
        {state.offline && <Notice tone="warn">Hors-ligne : la réception sera enregistrée sur la tablette puis synchronisée automatiquement.</Notice>}
        <div className="btn-row"><Big disabled={!!error} onClick={validate}><Check size={20} /> Valider la réception</Big></div>
      </Card>

      <Card title="Réceptions enregistrées" sub="Historique intégral conservé pour les audits — non supprimable"
        actions={can.exportStore(user.role) && <div className="btn-row">
          <Big tone="ghost" onClick={() => exportExcel(fileBase, [section])}><FileSpreadsheet size={18} /> Excel</Big>
          <Big tone="ghost" onClick={() => exportPdf(fileBase, `Réceptions fournisseurs — ${siteName}`, `Édité le ${today()} par ${user.name}`, [section])}><FileText size={18} /> PDF</Big>
        </div>}>
        <div className="filter-row">
          {per.bar}
          <select className="ref-input" value={filter.supplier} onChange={e => setFilter({ ...filter, supplier: e.target.value })}><option value="">Tous les fournisseurs</option>{suppliers.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
          <select className="ref-input" value={filter.mp} onChange={e => setFilter({ ...filter, mp: e.target.value })}><option value="">Toutes les matières</option>{SITE_MATS.map(m => <option key={m.mp} value={m.mp}>{m.name}</option>)}</select>
        </div>
        <div className="split">
          <div className="list-col scroll-list">
            {list.map(x => <button key={x.id} className={`list-item ${x.id === r?.id ? 'on' : ''}`} onClick={() => { setSel(x.id); setFix({ mp: '', delta: '', motif: '' }) }}>
              <b>{x.id}</b><small>{supplierName(x.supplier)} · {x.invoiceNo}</small>{groupOf(groups, x)?.partial ? <Badge tone="warn">Partielle</Badge> : <Badge tone="ok">Complète</Badge>}
            </button>)}
            {!list.length && <p className="muted">Aucune réception pour ces filtres.</p>}
          </div>
          {r && <div className="detail">
            <h3>{r.id}{r.complementOf ? ` — complément de ${r.complementOf}` : ''}</h3>
            <p>{supplierName(r.supplier)} · facture <b>{r.invoiceNo}</b> · référence {r.invoiceRef} · livrée le {r.deliveryDate}</p>
            {groupStatus(groupOf(groups, r))}
            <Table head={['Matière', 'Commandée', 'Reçue', 'Écart', 'En stock', 'Remarque']} rows={r.lines.map(l => [matName(l.mp),
              l.ordered === null ? '—' : unitQty(l.unit, l.ordered), <b>{unitQty(l.unit, l.received)}</b>,
              l.ordered === null ? '—' : <span className={l.received < l.ordered ? 'neg' : ''}>{dec(l.received - l.ordered, 2)}</span>,
              fmtQty(l.mp, l.received * l.f), l.remark || '—'])} />
            {r.photos.length > 0 && <div className="photo-row">{r.photos.map((p, i) => <figure key={i}><img src={p.thumb} alt={p.name} /><figcaption>{p.kind}</figcaption></figure>)}</div>}
            <TraceInfo t={r.trace} />
            {fixes.length > 0 && <Table head={['Contre-écriture', 'Matière', 'Quantité', 'Auteur', 'Motif']} rows={fixes.map(m => [m.trace.at || m.trace.localAt, matName(m.mp), fmtQty(m.mp, m.qty), m.trace.author, m.motif || '—'])} />}
            <div className="close-box">
              <b>Corriger par contre-écriture</b>
              <div className="btn-row">
                <select className="ref-input" value={fix.mp} onChange={e => setFix({ ...fix, mp: e.target.value })}><option value="">Matière…</option>{r.lines.map(l => <option key={l.mp} value={l.mp}>{matName(l.mp)}</option>)}</select>
                <label className="unit-input"><input className="num-input sm" inputMode="decimal" placeholder="± qté" value={fix.delta} onChange={e => setFix({ ...fix, delta: e.target.value.replace(/[^\d,.-]/g, '') })} /><span>{fix.mp ? siteMat(fix.mp).unit : ''}</span></label>
              </div>
              <input className="ref-input wide" placeholder="Motif (obligatoire)" value={fix.motif} onChange={e => setFix({ ...fix, motif: e.target.value })} />
              <Big tone="ghost" onClick={applyFix}>Enregistrer la contre-écriture</Big>
            </div>
          </div>}
        </div>
      </Card>
    </Screen>
  )
}
