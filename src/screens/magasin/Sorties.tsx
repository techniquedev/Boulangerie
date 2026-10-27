import { useState } from 'react'
import { Check, Croissant, IceCreamCone, Plus, Trash2, Wheat } from 'lucide-react'
import { useApp } from '../../store/context'
import { Big, Card, Notice, Screen, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { ATELIERS, atelierLabel, bonDay, BS, fmtQty, matName, nextBonId, nextMoveId, siteMat, SITE_MATS, unitQty, type AtelierCode, type BonSortie, type Movement } from '../../data/stock'
import { dayOf, nowStamp, num, today } from '../../lib/format'
import { cleanNum, toNum } from '../boulanger/shared'
import { BonBadge, useStore } from './shared'

type Row = { mp: string; unit: string; qty: string }
const blankRow = (): Row => ({ mp: '', unit: '', qty: '' })
const ICONS = { 'ATL-B': Wheat, 'ATL-P': Croissant, 'ATL-YG': IceCreamCone }

export function MSorties() {
  const { state, update, audit, say } = useApp()
  const { user, site, siteName, stock, bons } = useStore()
  const [atelier, setAtelier] = useState<AtelierCode | ''>('')
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const days = Array.from(new Set([today(), ...bons.map(bonDay)]))
  const [day, setDay] = useState(bons.some(b => bonDay(b) === today()) ? today() : bons[0] ? bonDay(bons[0]) : today())
  const [open, setOpen] = useState<string | null>(null)

  const setRow = (i: number, v: Partial<Row>) => setRows(rows.map((r, k) => k === i ? { ...r, ...v } : r))
  const qtyOf = (r: Row) => r.mp ? toNum(r.qty) * (siteMat(r.mp).units.find(u => u.u === r.unit)?.f ?? 1) : 0
  // Stock restant estimé après sortie, en tenant compte des lignes précédentes sur la même matière.
  const remaining = (i: number) => rows[i].mp ? (stock[rows[i].mp] || 0) - rows.slice(0, i + 1).filter(r => r.mp === rows[i].mp).reduce((s, r) => s + qtyOf(r), 0) : 0
  const blocked = rows.map((r, i) => !!r.mp && qtyOf(r) > 0 && remaining(i) < -1e-6)
  const lines = rows.filter(r => r.mp && qtyOf(r) > 0)
  const error = !atelier ? 'Choisissez l’atelier destinataire.' : !lines.length ? 'Saisissez au moins une matière et sa quantité.'
    : blocked.some(Boolean) ? 'Quantité supérieure au stock disponible : sortie bloquée.' : ''

  const emit = () => {
    if (error || !atelier) return say(error)
    const ts = Date.now(), t = traceFor(user.name, site, state.offline)
    // Lignes regroupées par matière, en unité de stock.
    const merged = new Map<string, number>()
    lines.forEach(r => merged.set(r.mp, +((merged.get(r.mp) || 0) + qtyOf(r)).toFixed(4)))
    const b: BonSortie = {
      id: nextBonId(state.bonsSortie, site), site, atelier, ts, by: user.name, trace: t, status: BS.emis,
      lines: [...merged].map(([mp, qty]) => ({ mp, qty })),
    }
    update(s => {
      const movs: Movement[] = b.lines.map((l, i) => ({ id: nextMoveId(s.movements, i), site, mp: l.mp, loc: siteMat(l.mp).loc, qty: -l.qty, kind: 'Sortie (bon atelier)', ref: b.id, ts, trace: t }))
      return {
        ...s, bonsSortie: [...s.bonsSortie, b], movements: [...s.movements, ...movs],
        queue: s.offline ? [{ id: b.id, text: `Bon de sortie ${b.id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }
    })
    audit('Bon de sortie émis', `${b.id} → ${atelierLabel(atelier)} : ${b.lines.map(l => `${matName(l.mp)} ${fmtQty(l.mp, l.qty)}`).join(' · ')}`)
    say(state.offline ? `Bon ${b.id} enregistré hors-ligne : en attente de synchronisation` : `Bon ${b.id} émis : en attente de confirmation par l’atelier`)
    setAtelier(''); setRows([blankRow()]); setDay(today()); setOpen(b.id)
  }

  // Vue journalière consolidée : total par matière et par atelier.
  const dayBons = bons.filter(b => bonDay(b) === day)
  const counted = dayBons.filter(b => b.status !== BS.refus)
  const mps = SITE_MATS.filter(m => counted.some(b => b.lines.some(l => l.mp === m.mp)))
  const total = (mp: string, atl?: string) => counted.filter(b => !atl || b.atelier === atl).reduce((s, b) => s + b.lines.filter(l => l.mp === mp).reduce((a, l) => a + l.qty, 0), 0)

  return (
    <Screen title="Sorties journalières vers les ateliers" sub={`Toute matière qui quitte le magasin du site ${siteName} fait l’objet d’un bon de sortie daté, confirmé ensuite par l’atelier`}>
      <Card title="Nouveau bon de sortie" sub={`Daté du ${today()} · N° attribué à l’émission : ${nextBonId(state.bonsSortie, site)}`}>
        <div className="atelier-pick">{ATELIERS.map(a => {
          const Icon = ICONS[a.code]
          return <button key={a.code} className={`atelier-btn ${atelier === a.code ? 'on' : ''}`} onClick={() => setAtelier(a.code)}><Icon size={30} /><span>{a.label}</span></button>
        })}</div>
        <Table head={['Matière', 'Unité', 'Quantité sortie', 'Stock disponible', 'Stock restant estimé', '']} rows={rows.map((r, i) => {
          const m = r.mp ? siteMat(r.mp) : null
          return [
            <select className="ref-input" value={r.mp} onChange={e => setRow(i, { mp: e.target.value, unit: siteMat(e.target.value)?.unit || '' })}>
              <option value="">Choisir…</option>{SITE_MATS.map(x => <option key={x.mp} value={x.mp}>{x.name}</option>)}
            </select>,
            m ? <select className="ref-input" value={r.unit} onChange={e => setRow(i, { unit: e.target.value })}>{m.units.map(u => <option key={u.u} value={u.u}>{u.u}</option>)}</select> : '—',
            <input className="num-input sm" inputMode="decimal" placeholder="0" value={r.qty} onChange={e => setRow(i, { qty: cleanNum(e.target.value) })} />,
            m ? fmtQty(r.mp, stock[r.mp] || 0) : '—',
            m ? <b className={blocked[i] ? 'neg' : remaining(i) < m.min ? 'warn-text' : ''}>{fmtQty(r.mp, remaining(i))}</b> : '—',
            rows.length > 1 ? <button className="icon-btn" title="Retirer la ligne" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={18} /></button> : '',
          ]
        })} />
        {blocked.map((b, i) => b && <Notice key={i} tone="danger">
          Sortie bloquée : {matName(rows[i].mp)} — demandé {fmtQty(rows[i].mp, qtyOf(rows[i]))}, disponible {fmtQty(rows[i].mp, Math.max(0, remaining(i) + qtyOf(rows[i])))}.
          Le stock ne peut jamais devenir négatif ; une sortie supérieure nécessite une dérogation explicite de la direction.
        </Notice>)}
        <div className="btn-row"><Big tone="ghost" onClick={() => setRows([...rows, blankRow()])}><Plus size={20} /> Ajouter une ligne</Big></div>
        {error && !blocked.some(Boolean) && <Notice tone="warn">{error}</Notice>}
        <Notice>À l’émission, le stock du magasin est décrémenté et le bon passe « Émis ». Les quantités entrent dans le stock de l’atelier dès sa confirmation de réception.</Notice>
        <div className="btn-row"><Big disabled={!!error} onClick={emit}><Check size={20} /> Émettre le bon de sortie</Big></div>
      </Card>

      <Card title="Vue journalière consolidée" sub="Total des matières sorties par atelier et par matière, avec les bons du jour"
        actions={<select className="ref-input" value={day} onChange={e => setDay(e.target.value)}>{days.map(d => <option key={d}>{d}</option>)}</select>}>
        {counted.length ? <Table head={['Matière', ...ATELIERS.map(a => a.label), 'Total']} rows={mps.map(m => [<b>{m.name}</b>,
          ...ATELIERS.map(a => { const q = total(m.mp, a.code); return q ? fmtQty(m.mp, q) : '—' }), <b>{fmtQty(m.mp, total(m.mp))}</b>])} />
          : <p className="muted">Aucune sortie le {day}.</p>}
        <Table head={['Bon', 'Heure', 'Atelier', 'Lignes', 'Statut']} rows={dayBons.map(b => [
          <button className="link-btn" onClick={() => setOpen(open === b.id ? null : b.id)}>{b.id}</button>, b.trace.localAt.slice(11), atelierLabel(b.atelier),
          open === b.id ? <ul className="plain">{b.lines.map(l => <li key={l.mp}>{matName(l.mp)} : {fmtQty(l.mp, l.qty)}{l.received !== undefined && l.received < l.qty ? ` (reçu ${fmtQty(l.mp, l.received)} — ${l.motif || 'écart'})` : ''}</li>)}</ul> : `${num(b.lines.length)} matière(s)`,
          <BonBadge b={b} />])} />
      </Card>
      <p className="muted small-note">Unités convertibles : saisie possible en unité de stock ou d’achat ({unitQty('sac', 1)} = 50 kg, carton ↔ unité, litre ↔ ml). Jour sélectionné : {dayOf(Date.now()) === day ? 'aujourd’hui' : day}.</p>
    </Screen>
  )
}
