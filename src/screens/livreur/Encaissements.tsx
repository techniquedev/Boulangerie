import { useState } from 'react'
import { Camera, Fuel, HandCoins } from 'lucide-react'
import { useApp } from '../../store/context'
import { Big, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { CASH_MODES, isMomo, type Deposit } from '../../data/tour'
import type { Payment } from '../../data/types'
import { money, nowStamp } from '../../lib/format'
import { readPhoto } from '../../lib/photo'
import { driverTrace, FuelBadge, useTour } from './shared'

export function LCash() {
  const { state, update, audit, say } = useApp()
  const { user, site, current: t, fig, fuel } = useTour()
  const [dep, setDep] = useState({ orderId: '', amount: '', mode: 'Espèces' as Payment['mode'], ref: '' })
  const [req, setReq] = useState({ amount: '', motif: '', photo: '' })
  const f = t ? fig(t) : null
  const orders = state.orders.filter(o => o.status !== 'Soldée' && o.status !== 'Annulée')

  // Journal : livraisons encaissées et acomptes de la tournée (les ventes à crédit n'entrent pas dans l'encaissement).
  const journal = f ? [
    ...f.deliveries.filter(d => d.mode !== 'Crédit').map(d => ({ at: d.trace.localAt, client: d.stop.name, amount: d.amount, mode: d.mode, ref: d.ref, what: 'Livraison' })),
    ...f.deposits.map(d => ({ at: d.trace.localAt, client: `Acompte ${d.orderId}`, amount: d.amount, mode: d.mode, ref: d.ref, what: 'Acompte' })),
  ] : []

  const saveDeposit = () => {
    if (!t || t.status !== 'En cours') return say('L’acompte s’encaisse pendant une tournée en cours.')
    const amount = Number(dep.amount)
    if (!dep.orderId || !amount) return say('Choisissez la commande et le montant de l’acompte.')
    if (isMomo(dep.mode) && !dep.ref.trim()) return say('La référence Mobile Money est obligatoire.')
    const d: Deposit = { id: `ACP-${t.id}-${String(state.tourDeposits.filter(x => x.tourId === t.id).length + 1).padStart(2, '0')}`, tourId: t.id, site, orderId: dep.orderId, amount, mode: dep.mode, ref: isMomo(dep.mode) ? dep.ref.trim() : undefined, trace: driverTrace(user.name, site, state.offline) }
    update(s => ({ ...s, tourDeposits: [...s.tourDeposits, d], orders: s.orders.map(o => o.id === d.orderId ? { ...o, deposit: o.deposit + amount } : o),
      queue: s.offline ? [{ id: d.id, text: `Acompte ${d.orderId}`, at: nowStamp() }, ...s.queue] : s.queue }))
    audit('Acompte sur commande', `${d.orderId} : ${money(amount)} (${d.mode}) encaissé en tournée ${t.id}`)
    say('Acompte enregistré et rattaché à la commande'); setDep({ orderId: '', amount: '', mode: 'Espèces', ref: '' })
  }

  // Demande de remboursement de carburant : aucun décaissement depuis l'application, le bureau central valide et paie.
  const sendFuel = () => {
    const amount = Number(req.amount)
    if (!amount || !req.motif.trim()) return say('Montant estimé et motif obligatoires.')
    if (!req.photo) return say('La photo du reçu est obligatoire.')
    update(s => ({ ...s, expenses: [{ id: `DÉP-2026-${String(30 + s.expenses.length + 1).padStart(4, '0')}`, label: 'Demande de carburant livreur', amount, by: user.name, status: 'Demandée',
      photo: true, photoThumb: req.photo, motif: req.motif.trim(), at: nowStamp(), flow: ['Demandée', 'Validée (direction)', 'Payée', 'Rapprochée'] }, ...s.expenses],
      queue: s.offline ? [{ id: `CARB-${Date.now()}`, text: 'Demande de carburant', at: nowStamp() }, ...s.queue] : s.queue }))
    audit('Demande de carburant', `${user.name} : ${money(amount)} — ${req.motif.trim()} (photo du reçu jointe)`)
    say('Demande transmise au bureau central'); setReq({ amount: '', motif: '', photo: '' })
  }

  return (
    <Screen title="Encaissements et carburant" sub="Aucun bouton de dépense, de retrait ou de prix : seul le bureau central règle les dépenses">
      {f && <Card title={`Journal des encaissements — ${t!.id}`}>
        <div className="kpi-row">
          <Kpi label="Total espèces" value={money(f.cash)} />
          <Kpi label="Total Mobile Money" value={money(f.momo)} />
          <Kpi label="Ventes à crédit (non encaissées)" value={money(f.credit)} />
        </div>
        {journal.length ? <Table head={['Heure', 'Client', 'Montant', 'Moyen de paiement', 'Référence']} rows={journal.map(j => [j.at.slice(11), j.client, <b>{money(j.amount)}</b>, j.mode, j.ref || '—'])} />
          : <p className="muted">Aucun encaissement pour l’instant.</p>}
      </Card>}

      <Card title="Acompte sur commande client" sub="Encaissé en tournée et rattaché à la commande">
        <div className="btn-row">
          <select className="ref-input" value={dep.orderId} onChange={e => setDep({ ...dep, orderId: e.target.value })}><option value="">Commande…</option>
            {orders.map(o => <option key={o.id} value={o.id}>{o.id} — {o.client} ({o.item})</option>)}</select>
          <input className="num-input sm" inputMode="numeric" placeholder="Montant" value={dep.amount} onChange={e => setDep({ ...dep, amount: e.target.value.replace(/\D/g, '') })} />
          <select className="ref-input" value={dep.mode} onChange={e => setDep({ ...dep, mode: e.target.value as Payment['mode'] })}>{CASH_MODES.map(m => <option key={m}>{m}</option>)}</select>
          {isMomo(dep.mode) && <input className="ref-input" placeholder="Référence" value={dep.ref} onChange={e => setDep({ ...dep, ref: e.target.value })} />}
        </div>
        <Big tone="ghost" onClick={saveDeposit}><HandCoins size={18} /> Enregistrer l’acompte</Big>
      </Card>

      <Card title="Demande de remboursement de carburant" sub="Photo du reçu obligatoire — la demande part au bureau central pour validation et paiement">
        <div className="btn-row">
          <label className="field">Montant estimé (FCFA)<input className="num-input" inputMode="numeric" value={req.amount} onChange={e => setReq({ ...req, amount: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="field">Motif<input className="ref-input" value={req.motif} onChange={e => setReq({ ...req, motif: e.target.value })} placeholder="Plein de la moto de tournée" /></label>
        </div>
        <div className="btn-row">
          <label className={`big-btn ghost file-btn ${req.photo ? '' : 'required'}`}><Camera size={18} /> {req.photo ? 'Reçu photographié' : 'Photo du reçu (obligatoire)'}
            <input type="file" accept="image/*" capture="environment" onChange={async e => { const file = e.target.files?.[0]; if (file) setReq({ ...req, photo: await readPhoto(file) }); e.target.value = '' }} /></label>
          {req.photo && <img className="thumb" src={req.photo} alt="Reçu" />}
        </div>
        <Big onClick={sendFuel}><Fuel size={18} /> Soumettre la demande</Big>
        <Table head={['N°', 'Date', 'Montant', 'Motif', 'Statut']} rows={fuel.map(e => [e.id, e.at || '—', money(e.amount), e.motif || e.label, <FuelBadge e={e} />])} />
        <Notice>Le paiement est effectué par le bureau central : aucun mouvement d’argent n’apparaît ici.</Notice>
      </Card>
    </Screen>
  )
}
