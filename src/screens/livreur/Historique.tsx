import { useState } from 'react'
import { FileText } from 'lucide-react'
import { useApp } from '../../store/context'
import { Big, Card, Notice, Screen, Table } from '../../components/ui'
import { can } from '../../data/rbac'
import { productName } from '../../data/shop'
import type { TourFix, TourStatus } from '../../data/tour'
import { dayOf, money, num, today } from '../../lib/format'
import { exportPdf } from '../../lib/export'
import { TraceInfo } from '../boulanger/shared'
import { driverTrace, FuelBadge, TourBadge, useTour } from './shared'

const STATUSES: TourStatus[] = ['Affectée', 'En cours', 'Soldée', 'Soldée avec écart']

export function LHistory() {
  const { state, update, audit, say } = useApp()
  const { user, site, tours, fig, fuel, remitStatus } = useTour()
  const [day, setDay] = useState('')
  const [st, setSt] = useState<TourStatus | ''>('')
  const list = tours.filter(t => (!day || dayOf(t.ts) === day) && (!st || t.status === st))
  const [sel, setSel] = useState(tours[0]?.id)
  const t = list.find(x => x.id === sel) || list[0]
  const [open, setOpen] = useState<string | null>(null)
  const [fix, setFix] = useState({ deliveryId: '', code: '', qty: '', amount: '', motif: '' })
  const f = t && fig(t)
  const fixes = state.tourFixes.filter(x => x.tourId === t?.id)

  // Contre-écriture tracée d'une livraison (tant que la tournée n'est pas soldée) : la saisie d'origine reste intacte.
  const saveFix = () => {
    if (!t || !f) return
    const qtyDelta = Number(fix.qty) || 0, amountDelta = Number(fix.amount) || 0
    if (!fix.deliveryId || (!qtyDelta && !amountDelta)) return say('Choisissez la livraison et la correction (quantité et/ou montant, ex. -2).')
    if (qtyDelta && !fix.code) return say('Choisissez le produit corrigé.')
    if (!fix.motif.trim()) return say('Le motif de la contre-écriture est obligatoire.')
    if (qtyDelta > 0 && qtyDelta > (f.rows.find(r => r.code === fix.code)?.remaining || 0)) return say('Correction supérieure au chargement restant.')
    const c: TourFix = { id: `CE-${t.id}-${String(fixes.length + 1).padStart(2, '0')}`, tourId: t.id, deliveryId: fix.deliveryId, code: fix.code || undefined, qtyDelta, amountDelta, motif: fix.motif.trim(), trace: driverTrace(user.name, site, state.offline) }
    update(s => ({ ...s, tourFixes: [...s.tourFixes, c] }))
    audit('Contre-écriture de livraison', `${c.id} sur ${c.deliveryId} : ${qtyDelta ? `${qtyDelta > 0 ? '+' : ''}${qtyDelta} ${productName(fix.code)} ` : ''}${amountDelta ? `${amountDelta > 0 ? '+' : ''}${money(amountDelta)}` : ''} — ${c.motif}`)
    say('Contre-écriture tracée'); setFix({ deliveryId: '', code: '', qty: '', amount: '', motif: '' })
  }

  const exportTour = () => {
    if (!t || !f) return
    exportPdf(`releve-${t.id}`, `Relevé de tournée ${t.id} — ${user.name}`, `${t.bdl} · ${dayOf(t.ts)} · statut ${t.status} · édité le ${today()}`, [
      { title: 'Équilibrage des quantités', head: ['Produit', 'Chargé', 'Livré / vendu', 'Retourné', 'Pertes'], rows: f.rows.map(r => [productName(r.code), r.loaded, r.delivered, r.returned, r.lost]) },
      { title: 'Livraisons', head: ['N°', 'Heure', 'Client', 'Produits', 'Montant', 'Règlement', 'Référence'], rows: f.deliveries.map(d => [d.id, d.trace.localAt, d.stop.name, d.lines.map(l => `${l.qty} ${productName(l.code)}`).join(', '), money(d.amount), d.mode, d.ref || '']) },
      { title: 'Versement', head: ['Bordereau', 'Espèces', 'Mobile Money', 'Encaissé attendu (espèces / MM)', 'Statut'], rows: t.remit ? [[t.remit.id, money(t.remit.cash), money(t.remit.momo), `${money(f.cash)} / ${money(f.momo)}`, remitStatus(t) || '']] : [] },
    ])
  }

  return (
    <Screen title="Historique de mes tournées" sub="Tournées, livraisons, carburant et contre-écritures — piste d’audit">
      <div className="filter-row">
        <select className="ref-input" value={day} onChange={e => setDay(e.target.value)}><option value="">Toutes les dates</option>{[...new Set(tours.map(x => dayOf(x.ts)))].map(d => <option key={d}>{d}</option>)}</select>
        <select className="ref-input" value={st} onChange={e => setSt(e.target.value as TourStatus | '')}><option value="">Tous les statuts</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      </div>
      {!t || !f ? <Notice>Aucune tournée pour ces filtres.</Notice> : <div className="split">
        <div className="list-col scroll-list">{list.map(x => <button key={x.id} className={`list-item ${x.id === t.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
          <b>{x.id}</b><small>{dayOf(x.ts)} · {x.bdl}</small><TourBadge s={x.status} />
        </button>)}</div>
        <Card title={`Tournée ${t.id}`} sub={`BDL d’origine ${t.bdl} · ${f.stopsDone} / ${t.stops.length} points livrés`} actions={<TourBadge s={t.status} />}>
          <Table head={['Produit', 'Chargé', 'Livré', 'Retourné', 'Pertes']} rows={f.rows.map(r => [productName(r.code), num(r.loaded), num(r.delivered), num(r.returned), num(r.lost)])} />
          <p>Encaissé : <b>{money(f.cash)}</b> espèces · <b>{money(f.momo)}</b> Mobile Money · crédit {money(f.credit)}{t.remit && <> — versement {t.remit.id} : {money(t.remit.cash)} + {money(t.remit.momo)} ({remitStatus(t)})</>}</p>
          {t.comment && <Notice tone="warn"><b>Ma remarque :</b> {t.comment.text}</Notice>}
          <h4>Livraisons</h4>
          {f.deliveries.map(d => <div key={d.id} className="pass">
            <button className="link-btn" onClick={() => setOpen(open === d.id ? null : d.id)}>{d.id} — {d.stop.name} · {d.mode === 'Crédit' ? 'Crédit' : money(d.amount)}</button>
            {open === d.id && <>
              <p>{d.nature} · {d.lines.map(l => `${l.qty} ${productName(l.code)}`).join(', ')} · {d.mode}{d.ref ? ` (réf. ${d.ref})` : ''}</p>
              <p>Preuve : {d.proof ? (d.proof.thumb ? <img className="thumb" src={d.proof.thumb} alt={d.proof.name} /> : `${d.proof.kind} — ${d.proof.name}`) : 'aucune'}</p>
              <TraceInfo t={d.trace} />
            </>}
          </div>)}
          {fixes.length > 0 && <Table head={['Contre-écriture', 'Livraison', 'Correction', 'Auteur', 'Motif']} rows={fixes.map(x => [`${x.id} · ${x.trace.localAt}`, x.deliveryId,
            `${x.qtyDelta ? `${x.qtyDelta > 0 ? '+' : ''}${x.qtyDelta} ${productName(x.code || '')} ` : ''}${x.amountDelta ? `${x.amountDelta > 0 ? '+' : ''}${money(x.amountDelta)}` : ''}`, x.trace.author, x.motif])} />}
          {t.status === 'En cours' && f.deliveries.length > 0 && <div className="close-box">
            <b>Corriger une livraison par contre-écriture</b>
            <div className="btn-row">
              <select className="ref-input" value={fix.deliveryId} onChange={e => setFix({ ...fix, deliveryId: e.target.value })}><option value="">Livraison…</option>{f.deliveries.map(d => <option key={d.id} value={d.id}>{d.id} — {d.stop.name}</option>)}</select>
              <select className="ref-input" value={fix.code} onChange={e => setFix({ ...fix, code: e.target.value })}><option value="">Produit…</option>{t.lines.map(l => <option key={l.code} value={l.code}>{productName(l.code)}</option>)}</select>
              <input className="num-input sm" inputMode="numeric" placeholder="± qté" value={fix.qty} onChange={e => setFix({ ...fix, qty: e.target.value.replace(/[^\d-]/g, '') })} />
              <input className="num-input sm" inputMode="numeric" placeholder="± FCFA" value={fix.amount} onChange={e => setFix({ ...fix, amount: e.target.value.replace(/[^\d-]/g, '') })} />
            </div>
            <input className="ref-input wide" placeholder="Motif (obligatoire)" value={fix.motif} onChange={e => setFix({ ...fix, motif: e.target.value })} />
            <Big tone="ghost" onClick={saveFix}>Enregistrer la contre-écriture</Big>
          </div>}
          {can.exportTour(user.role) && <Big tone="ghost" onClick={exportTour}><FileText size={18} /> Relevé de tournée et versement (PDF)</Big>}
        </Card>
      </div>}

      <Card title="Mes demandes de carburant" sub="Traitement par le bureau central">
        <Table head={['N°', 'Date', 'Montant', 'Motif', 'Statut']} rows={fuel.map(e => [e.id, e.at || '—', money(e.amount), e.motif || e.label, <FuelBadge e={e} />])} />
      </Card>
    </Screen>
  )
}
