import { useState } from 'react'
import { Camera, Check, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import {
  LOSS_DESTS, LOSS_MOTIFS, nextDeclId, nextFixId, nextShopMoveId, photoRequired, productName, SHOP_FIX_THRESHOLD, SHOP_PRODUCTS,
  type DeclLine, type DeclPhoto, type LossDest, type LossMotif, type ShopFix, type ShopMove,
} from '../../data/shop'
import { dayOf, nowStamp, num } from '../../lib/format'
import { readPhoto } from '../../lib/photo'
import { useShop } from './shared'

type Row = { code: string; lot: string; qty: string; motif: LossMotif | ''; dest: LossDest | ''; photo?: DeclPhoto }
const blank = (): Row => ({ code: '', lot: '', qty: '', motif: '', dest: '' })
const DEFAULT_DEST: Record<LossMotif, LossDest> = { 'Invendu': 'Recyclage', 'Périmé': 'Destruction', 'Casse': 'Destruction', 'Rupture de la chaîne du froid': 'Destruction', 'Retour client': 'Retour atelier' }

export function SPertes() {
  const { state, update, audit, say } = useApp()
  const { user, site, shop, stock, decls, fixes } = useShop()
  const [rows, setRows] = useState<Row[]>([blank()])
  const [sel, setSel] = useState<string | null>(null)
  const [fix, setFix] = useState({ line: '', delta: '', motif: '' })

  const setRow = (i: number, v: Partial<Row>) => setRows(rows.map((r, k) => k === i ? { ...r, ...v } : r))
  const lotsOf = (code: string) => code ? stock[code].lots : []
  // Lot proposé : le lot périmé pour un motif « Périmé », sinon le premier lot FEFO.
  const pickLot = (code: string, motif: Row['motif']) => {
    const ls = lotsOf(code)
    return (motif === 'Périmé' ? ls.find(l => l.left !== null && l.left < 0) : undefined)?.lot ?? ls.find(l => l.left === null || l.left >= 0)?.lot ?? ls[0]?.lot ?? ''
  }
  const avail = (r: Row) => lotsOf(r.code).find(l => l.lot === r.lot)?.qty ?? 0

  const checks = rows.map(r => {
    if (!r.code && !r.qty) return ''
    const q = Number(r.qty) || 0
    if (!r.code || !q || !r.motif || !r.dest) return 'Produit, quantité, motif et destination sont obligatoires.'
    if (r.motif !== 'Retour client' && q > avail(r)) return `Quantité supérieure au stock du lot (${num(avail(r))}) : le stock ne peut pas devenir négatif.`
    if (photoRequired({ code: r.code, qty: q, motif: r.motif }, state.lossPhotoThreshold) && !r.photo) return 'Photo obligatoire pour cette perte (au-delà du seuil fixé par la direction).'
    return ''
  })
  const filled = rows.filter(r => r.code && r.qty)
  const error = !filled.length ? 'Ajoutez au moins une ligne.' : checks.find(Boolean) || ''

  const validate = () => {
    if (error) return say(error)
    const ts = Date.now(), t = traceFor(user.name, site, state.offline)
    const id = nextDeclId(state.declarations, site, ts)
    const lines: DeclLine[] = filled.map(r => ({ code: r.code, lot: r.lot, qty: Number(r.qty), motif: r.motif as LossMotif, dest: r.dest as LossDest, photo: r.photo }))
    update(s => {
      const raw: Omit<ShopMove, 'id'>[] = lines.flatMap(l => [
        ...(l.motif === 'Retour client' ? [{ site, code: l.code, lot: l.lot, qty: l.qty, kind: 'Retour client' as const, ref: id, ts, trace: t, motif: 'Retour client' }] : []),
        { site, code: l.code, lot: l.lot, qty: -l.qty, kind: 'Invendu / perte' as const, ref: id, ts, trace: t, motif: `${l.motif} → ${l.dest}` },
      ])
      return {
        ...s, declarations: [...s.declarations, { id, site, ts, lines, trace: t, status: 'Validée' }],
        shopMoves: [...s.shopMoves, ...raw.map((m, i) => ({ ...m, id: nextShopMoveId(s.shopMoves, site, i) }))],
        queue: s.offline ? [{ id, text: `Déclaration ${id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }
    })
    audit('Déclaration d’invendus / pertes', `${id} : ${lines.map(l => `${num(l.qty)} ${productName(l.code)} (${l.motif} → ${l.dest})`).join(' · ')}`)
    say(state.offline ? `Déclaration ${id} enregistrée hors-ligne : en attente de synchronisation` : `Déclaration ${id} validée : stock vendant mis à jour`)
    setRows([blank()]); setSel(id)
  }

  const d = decls.find(x => x.id === sel)
  const dFixes = d ? fixes.filter(f => f.ref === d.id) : []
  // Contre-écriture : quantité positive = remise en stock (déclaration trop élevée) ; au-delà du seuil, validation par la direction.
  const applyFix = () => {
    if (!d) return
    const l = d.lines[Number(fix.line)]
    const delta = Number(fix.delta.replace(',', '.'))
    if (!l || !delta) return say('Choisissez la ligne et la quantité à corriger (ex. 2 ou -1).')
    if (!fix.motif.trim()) return say('Le motif de la contre-écriture est obligatoire.')
    const lotQty = stock[l.code].lots.find(x => x.lot === l.lot)?.qty ?? 0
    if (lotQty + delta < 0) return say('Contre-écriture bloquée : le stock du lot deviendrait négatif.')
    const pending = Math.abs(delta) > SHOP_FIX_THRESHOLD
    const ts = Date.now(), t = traceFor(user.name, site, state.offline)
    const f: ShopFix = { id: nextFixId(state.shopFixes, site), site, ts, ref: d.id, code: l.code, lot: l.lot, delta, motif: fix.motif.trim(), trace: t, status: pending ? 'En attente de validation' : 'Appliquée' }
    update(s => ({
      ...s, shopFixes: [...s.shopFixes, f],
      shopMoves: pending ? s.shopMoves : [...s.shopMoves, { id: nextShopMoveId(s.shopMoves, site), site, code: l.code, lot: l.lot, qty: delta, kind: 'Contre-écriture', ref: f.id, ts, trace: t, motif: f.motif }],
    }))
    audit('Contre-écriture stock vendant', `${f.id} sur ${d.id} : ${productName(l.code)} ${delta > 0 ? '+' : ''}${delta} — ${f.motif}${pending ? ' (en attente de validation hiérarchique)' : ''}`)
    say(pending ? `Correction de plus de ${SHOP_FIX_THRESHOLD} unités : transmise à la direction pour validation` : 'Contre-écriture tracée')
    setFix({ line: '', delta: '', motif: '' })
  }

  return (
    <Screen title="Invendus, pertes et retours" sub={`${shop} — déclaration de fin de journée · déduction tracée du stock vendant`}>
      <Card title="Nouvelle déclaration" sub={`Datée du ${dayOf(Date.now())} · photo obligatoire pour les pertes au-delà du seuil fixé par la direction`}>
        <Table head={['Produit', 'Lot', 'Quantité', 'Motif', 'Destination', 'Photo', '']} rows={rows.map((r, i) => {
          const need = !!r.code && !!r.motif && photoRequired({ code: r.code, qty: Number(r.qty) || 0, motif: r.motif }, state.lossPhotoThreshold)
          return [
            <select className="ref-input" value={r.code} onChange={e => setRow(i, { code: e.target.value, lot: pickLot(e.target.value, r.motif) })}>
              <option value="">Choisir…</option>{SHOP_PRODUCTS.filter(p => stock[p.code].total > 0 || r.motif === 'Retour client').map(p => <option key={p.code} value={p.code}>{productName(p.code)}</option>)}
            </select>,
            r.code && lotsOf(r.code).some(l => l.lot) ? <select className="ref-input" value={r.lot} onChange={e => setRow(i, { lot: e.target.value })}>
              {lotsOf(r.code).map(l => <option key={l.lot} value={l.lot}>{l.lot} · {l.dlc} · {num(l.qty)}{l.left !== null && l.left < 0 ? ' · périmé' : ''}</option>)}
            </select> : <span className="muted">{r.code ? `stock ${num(avail(r))}` : '—'}</span>,
            <input className="num-input sm" inputMode="numeric" placeholder="0" value={r.qty} onChange={e => setRow(i, { qty: e.target.value.replace(/\D/g, '') })} />,
            <select className="ref-input" value={r.motif} onChange={e => { const m = e.target.value as LossMotif; setRow(i, { motif: m, dest: r.dest || DEFAULT_DEST[m], lot: r.code ? pickLot(r.code, m) : r.lot }) }}>
              <option value="">Motif…</option>{LOSS_MOTIFS.map(m => <option key={m}>{m}</option>)}
            </select>,
            <select className="ref-input" value={r.dest} onChange={e => setRow(i, { dest: e.target.value as LossDest })}>
              <option value="">Destination…</option>{LOSS_DESTS.map(x => <option key={x}>{x}</option>)}
            </select>,
            r.photo ? <span className="photo-cell"><img src={r.photo.thumb} alt={r.photo.name} /><button className="link-btn" onClick={() => setRow(i, { photo: undefined })}>Retirer</button></span>
              : <label className={`big-btn ghost file-btn sm ${need ? 'required' : ''}`}><Camera size={16} /> {need ? 'Photo obligatoire' : 'Photo'}
                <input type="file" accept="image/*" capture="environment" onChange={async e => { const f = e.target.files?.[0]; if (f) setRow(i, { photo: { name: f.name, thumb: await readPhoto(f) } }); e.target.value = '' }} /></label>,
            rows.length > 1 ? <button className="icon-btn" title="Retirer la ligne" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={18} /></button> : '',
          ]
        })} />
        <div className="btn-row"><Big tone="ghost" onClick={() => setRows([...rows, blank()])}><Plus size={20} /> Ajouter une ligne</Big></div>
        {error && filled.length > 0 && <Notice tone="warn">{error}</Notice>}
        <div className="btn-row"><Big disabled={!!error} onClick={validate}><Check size={20} /> Valider la déclaration</Big></div>
      </Card>

      <Card title="Historique des déclarations" sub="Déclarations validées : non supprimables, corrections par contre-écriture">
        <div className="split">
          <div className="list-col scroll-list">{decls.map(x => <button key={x.id} className={`list-item ${x.id === d?.id ? 'on' : ''}`} onClick={() => { setSel(x.id); setFix({ line: '', delta: '', motif: '' }) }}>
            <b>{x.id}</b><small>{x.trace.localAt} · {num(x.lines.reduce((s, l) => s + l.qty, 0))} unité(s)</small><Badge tone="ok">{x.status}</Badge>
          </button>)}</div>
          {d ? <div className="detail">
            <h3>{d.id} — {d.trace.localAt}</h3>
            <Table head={['Produit', 'Lot', 'Quantité', 'Motif', 'Destination', 'Pièce jointe']} rows={d.lines.map(l => [productName(l.code), l.lot || '—', <b>{num(l.qty)}</b>, l.motif, l.dest,
              l.photo ? (l.photo.thumb ? <img className="thumb" src={l.photo.thumb} alt={l.photo.name} /> : <Badge tone="ok">Photo jointe</Badge>) : '—'])} />
            {dFixes.length > 0 && <Table head={['Contre-écriture', 'Produit', 'Correction', 'Motif', 'Statut']} rows={dFixes.map(f => [`${f.id} · ${f.trace.localAt}`, productName(f.code),
              <b>{f.delta > 0 ? '+' : ''}{f.delta}</b>, f.motif, <Badge tone={f.status === 'En attente de validation' ? 'warn' : f.status.startsWith('Refus') ? 'danger' : 'ok'}>{f.status}</Badge>])} />}
            <div className="close-box">
              <b>Corriger par contre-écriture</b>
              <div className="btn-row">
                <select className="ref-input" value={fix.line} onChange={e => setFix({ ...fix, line: e.target.value })}><option value="">Ligne…</option>
                  {d.lines.map((l, i) => <option key={i} value={i}>{productName(l.code)} — {l.motif} ({num(l.qty)})</option>)}</select>
                <input className="num-input sm" inputMode="numeric" placeholder="± qté" value={fix.delta} onChange={e => setFix({ ...fix, delta: e.target.value.replace(/[^\d-]/g, '') })} />
              </div>
              <input className="ref-input wide" placeholder="Motif (obligatoire)" value={fix.motif} onChange={e => setFix({ ...fix, motif: e.target.value })} />
              <Big tone="ghost" onClick={applyFix}>Enregistrer la contre-écriture</Big>
              <small className="muted">Quantité positive : remise en stock d’une quantité déclarée à tort. Au-delà de {SHOP_FIX_THRESHOLD} unités, la correction est soumise à la validation de la direction.</small>
            </div>
          </div> : <p className="muted">Sélectionnez une déclaration.</p>}
        </div>
      </Card>
    </Screen>
  )
}
