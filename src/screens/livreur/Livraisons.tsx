import { useState } from 'react'
import { Camera, Check, Minus, Plus, Store, User, Users } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { clients } from '../../data/partners'
import { productName } from '../../data/shop'
import { CASH_MODES, creditAmount, isMomo, nextDeliveryId, outstandingOf, type Delivery, type PayMode, type Proof, type Stop } from '../../data/tour'
import { money, nowStamp, num } from '../../lib/format'
import { readPhoto } from '../../lib/photo'
import { driverTrace, useTour } from './shared'

const PASSAGE: Stop = { kind: 'Client de passage', name: 'Comptoir mobile — client de passage' }

export function LDeliver() {
  const { state, update, audit, say } = useApp()
  const { user, site, current: t, fig } = useTour()
  const [stop, setStop] = useState<Stop | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [mode, setMode] = useState<PayMode | ''>('')
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [proof, setProof] = useState<Proof | undefined>()
  const [confirmName, setConfirmName] = useState('')
  if (!t || t.status !== 'En cours') return <Screen title="Livraisons et ventes"><Notice tone="warn">Confirmez d’abord la prise en charge de votre chargement (onglet « Mon chargement »).</Notice></Screen>
  const f = fig(t)

  const lines = Object.entries(qty).filter(([, q]) => q > 0).map(([code, q]) => ({ code, qty: q }))
  const over = lines.filter(l => l.qty > (f.rows.find(r => r.code === l.code)?.remaining || 0))
  const client = stop?.code ? clients.find(c => c.code === stop.code) : undefined
  const credit = mode === 'Crédit' ? creditAmount(lines) : 0
  const outstanding = client ? outstandingOf(client.code, state.deliveries) : 0
  const blocked = mode === 'Crédit' && !!client && outstanding + credit > client.ceiling
  const error = !stop ? 'Choisissez le client ou le point de livraison.' : !lines.length ? 'Saisissez les quantités livrées.'
    : over.length ? 'Quantité supérieure au chargement restant.' : !mode ? 'Choisissez le mode de règlement.'
    : mode !== 'Crédit' && !Number(amount) ? 'Saisissez le montant encaissé.' : isMomo(mode) && !ref.trim() ? 'La référence de transaction Mobile Money est obligatoire.'
    : blocked ? 'Plafond de crédit dépassé : livraison à crédit bloquée.' : ''
  const reset = () => { setStop(null); setQty({}); setMode(''); setAmount(''); setRef(''); setProof(undefined); setConfirmName('') }
  const step = (code: string, d: number) => setQty({ ...qty, [code]: Math.max(0, (qty[code] || 0) + d) })

  const save = () => {
    if (error || !stop || !mode) return say(error)
    const d: Delivery = {
      id: nextDeliveryId(state.deliveries, t), tourId: t.id, site, nature: stop.kind === 'Client de passage' ? 'Vente directe' : 'Livraison sur commande', stop, lines,
      amount: mode === 'Crédit' ? credit : Number(amount), mode, ref: isMomo(mode) ? ref.trim() : undefined,
      proof: proof || (confirmName.trim() ? { kind: 'Confirmation du client', name: confirmName.trim() } : undefined), trace: driverTrace(user.name, site, state.offline),
    }
    update(s => ({ ...s, deliveries: [...s.deliveries, d], queue: s.offline ? [{ id: d.id, text: `Livraison ${d.id}`, at: nowStamp() }, ...s.queue] : s.queue }))
    audit('Livraison en tournée', `${d.id} — ${stop.name} : ${lines.map(l => `${l.qty} ${productName(l.code)}`).join(', ')} · ${mode}${mode === 'Crédit' ? '' : ` ${money(d.amount)}`}`)
    say(state.offline ? `Livraison ${d.id} enregistrée hors-ligne : en attente de synchronisation` : `Livraison ${d.id} enregistrée`); reset()
  }
  const askDerogation = () => {
    if (!client) return
    update(s => ({ ...s, notifications: [{ id: `N-${Date.now()}`, text: `Dérogation de crédit demandée par ${user.name} (${t.id}) : ${client.name}, livraison de ${money(credit)} au-delà du plafond de ${money(client.ceiling)}`, roles: ['direction'], at: nowStamp() }, ...s.notifications] }))
    audit('Demande de dérogation de crédit', `${t.id} — ${client.name} : ${money(credit)}`); say('Demande de dérogation transmise à la direction')
  }

  return (
    <Screen title="Livraisons et ventes en tournée" sub={`${t.id} — 1. client · 2. quantités · 3. règlement`}>
      <Card title="1. Client ou point de livraison">
        <div className="stop-grid">
          {t.stops.map((s, i) => <button key={s.name} className={`stop-btn ${stop?.name === s.name ? 'on' : ''}`} onClick={() => { setStop(s); if (mode === 'Crédit' && !s.code) setMode('') }}>
            {s.kind === 'Boutique' ? <Store size={22} /> : <Users size={22} />}<span><b>{i + 1}. {s.name}</b><small>{s.kind} · livraison sur commande</small></span></button>)}
          <button className={`stop-btn ${stop?.name === PASSAGE.name ? 'on' : ''}`} onClick={() => { setStop(PASSAGE); if (mode === 'Crédit') setMode('') }}><User size={22} /><span><b>Client de passage</b><small>Vente directe au comptoir mobile</small></span></button>
        </div>
      </Card>

      {stop && <Card title="2. Produits livrés">
        {f.rows.map(r => <div key={r.code} className="qty-line">
          <span><b>{productName(r.code)}</b><small>Restant : {num(r.remaining)}</small></span>
          <div className="stepper2 big"><button onClick={() => step(r.code, -1)}><Minus size={20} /></button>
            <input className="num-input sm" inputMode="numeric" value={qty[r.code] || ''} placeholder="0" onChange={e => setQty({ ...qty, [r.code]: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            <button onClick={() => step(r.code, 1)}><Plus size={20} /></button></div>
        </div>)}
        {over.length > 0 && <Notice tone="danger">Quantité supérieure au chargement restant : {over.map(l => productName(l.code)).join(', ')}.</Notice>}
      </Card>}

      {stop && lines.length > 0 && <Card title="3. Règlement">
        <div className="pay-modes">{[...CASH_MODES, ...(stop.kind === 'Client grossiste' ? ['Crédit' as const] : [])].map(m =>
          <button key={m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{m}</button>)}</div>
        {mode && mode !== 'Crédit' && <div className="btn-row">
          <label className="field">Montant encaissé (FCFA)<input className="num-input" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} /></label>
          {isMomo(mode) && <label className="field">Référence de transaction<input className="ref-input" value={ref} onChange={e => setRef(e.target.value)} placeholder="Ex. MOMO2610…" /></label>}
        </div>}
        {mode === 'Crédit' && client && <div className="kpi-row">
          <div className="kpi-tile"><p>Encours actuel</p><b>{money(outstanding)}</b></div>
          <div className="kpi-tile"><p>Plafond (non modifiable)</p><b>{money(client.ceiling)}</b></div>
          <div className={`kpi-tile ${blocked ? 'danger' : 'ok'}`}><p>Encours après livraison</p><b>{money(outstanding + credit)}</b></div>
        </div>}
        {blocked && <Notice tone="danger">Livraison à crédit bloquée : elle ferait dépasser le plafond de {client!.name}. Seule la direction peut accorder une dérogation. <button className="link-btn" onClick={askDerogation}>Demander une dérogation à la direction</button></Notice>}
        <div className="btn-row">
          <label className="big-btn ghost file-btn sm"><Camera size={16} /> {proof ? 'Photo jointe' : 'Preuve : photo'}
            <input type="file" accept="image/*" capture="environment" onChange={async e => { const file = e.target.files?.[0]; if (file) setProof({ kind: 'Photo', name: file.name, thumb: await readPhoto(file) }); e.target.value = '' }} /></label>
          <input className="ref-input" value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder="ou confirmation : nom du client" />
        </div>
        {error && !blocked && <Notice tone="warn">{error}</Notice>}
        <Big disabled={!!error} onClick={save}><Check size={22} /> Valider la livraison</Big>
      </Card>}

      <Card title={`Livraisons de la tournée (${f.deliveries.length})`}>
        <Table head={['N°', 'Client', 'Produits', 'Règlement']} rows={f.deliveries.map(d => [d.id.split('-').pop(), d.stop.name, d.lines.map(l => `${l.qty} ${productName(l.code)}`).join(', '),
          d.mode === 'Crédit' ? <Badge tone="warn">Crédit</Badge> : `${money(d.amount)} · ${d.mode}`])} />
      </Card>
    </Screen>
  )
}
