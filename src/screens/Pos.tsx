import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useApp } from '../store/context'
import { Big, Notice, Screen } from '../components/ui'
import { money, nowStamp } from '../lib/format'
import { products } from '../data/catalog'
import type { Payment } from '../data/types'

type Mode = Payment['mode']
const MODES: Mode[] = ['Espèces', 'MTN MoMo', 'Moov Money', 'Celtiis Cash']

export function Pos() {
  const { user, state, update, say, audit } = useApp()
  const session = state.sessions.find(s => s.site === user!.sites[0])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [pay, setPay] = useState<Record<string, string>>({})
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [cat, setCat] = useState('Tous')
  const stock = state.stockA
  const cats = ['Tous', ...Array.from(new Set(products.map(p => p.category)))]
  const shown = products.filter(p => (cat === 'Tous' || p.category === cat) && p.code in stock)
  const total = Object.entries(cart).reduce((a, [c, q]) => a + q * products.find(p => p.code === c)!.retail, 0)
  const paidSum = MODES.reduce((a, m) => a + (Number(pay[m]) || 0), 0)
  const open = session?.status === 'Ouverte'

  const add = (code: string, d: number) => {
    const next = Math.max(0, (cart[code] || 0) + d)
    if (next > (stock[code] || 0)) return say('Stock insuffisant : vente bloquée (RG-04).')
    setCart({ ...cart, [code]: next })
  }
  const fill = (m: Mode) => setPay({ ...pay, [m]: String(total - (paidSum - (Number(pay[m]) || 0))) })

  const encaisser = () => {
    if (!session) return say('Aucune session de caisse pour votre site.')
    if (!total) return say('Ajoutez au moins un produit.')
    if (paidSum !== total) return say('Le mode de paiement est obligatoire et la somme doit égaler le total.')
    const payments: Payment[] = MODES.filter(m => Number(pay[m]) > 0).map(m => ({ mode: m, amount: Number(pay[m]), ...(m !== 'Espèces' ? { ref: refs[m] } : {}) }))
    if (payments.some(p => p.mode !== 'Espèces' && !p.ref?.trim())) return say('Référence Mobile Money obligatoire.')
    const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([code, qty]) => {
      const p = products.find(x => x.code === code)!
      return { code, label: `${p.name} ${p.format}`, qty, unit: p.retail }
    })
    update(s => ({
      ...s, ticketSeq: s.ticketSeq + 1,
      stockA: Object.fromEntries(Object.entries(s.stockA).map(([c, q]) => [c, q - (cart[c] || 0)])),
      queue: s.offline ? [{ id: `TK-A-0${s.ticketSeq}`, text: `Vente de ${total} FCFA`, at: nowStamp() }, ...s.queue] : s.queue,
      sessions: s.sessions.map(x => x.id === session.id ? { ...x, tickets: [...x.tickets, { id: `TK-A-0${s.ticketSeq}`, at: nowStamp(), lines, payments }] } : x),
    }))
    audit('Vente', `Ticket ${money(total)} — ${payments.map(p => p.mode).join(' + ')}`)
    say(state.offline ? 'Vente enregistrée hors-ligne : en attente de synchronisation' : 'Vente encaissée'); setCart({}); setPay({}); setRefs({})
  }

  if (!session) return <Screen title="Vente"><Notice tone="warn">Aucune session de caisse dans le jeu de démonstration pour votre site ({user!.siteLabel}).</Notice></Screen>
  if (!open) return <Screen title="Vente"><Notice tone="warn">La session {session.id} est clôturée. Une nouvelle session ne peut être ouverte qu’après clôture complète (RG-07).</Notice></Screen>

  return (
    <Screen title="Vente" sub={`${session.id} · prix en lecture seule — seule la Direction modifie les prix (US-15)`}>
      <div className="pos2">
        <div>
          <div className="filter-row">{cats.map(c => <button key={c} className={cat === c ? 'chip on' : 'chip'} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="prod-grid">{shown.map(p => <button key={p.code} className="prod-tile" onClick={() => add(p.code, 1)}>
            <span className="emoji">{p.emoji}</span><b>{p.name}</b><small>{p.format}</small><strong>{money(p.retail)}</strong><small>{stock[p.code]} en stock</small>
            {cart[p.code] ? <i className="qty-badge">{cart[p.code]}</i> : null}</button>)}</div>
        </div>
        <div className="cart">
          <h3>Ticket en cours</h3>
          {Object.entries(cart).filter(([, q]) => q > 0).map(([c, q]) => { const p = products.find(x => x.code === c)!
            return <div key={c} className="cart-line"><span>{p.name} {p.format}</span>
              <div className="stepper2"><button onClick={() => add(c, -1)}><Minus size={16} /></button><b>{q}</b><button onClick={() => add(c, 1)}><Plus size={16} /></button></div>
              <b>{money(q * p.retail)}</b></div> })}
          <div className="cart-total"><span>Total à payer</span><b>{money(total)}</b></div>
          {MODES.map(m => <div key={m} className="pay-row"><label>{m}<input className="num-input sm" inputMode="numeric" value={pay[m] || ''} onChange={e => setPay({ ...pay, [m]: e.target.value.replace(/\D/g, '') })} /></label>
            <button className="link-btn" onClick={() => fill(m)}>Tout</button>
            {m !== 'Espèces' && Number(pay[m]) > 0 && <input className="ref-input" placeholder="Référence" value={refs[m] || ''} onChange={e => setRefs({ ...refs, [m]: e.target.value })} />}</div>)}
          <p className={paidSum === total ? 'ok-text' : 'muted'}>Payé : {money(paidSum)} / {money(total)}</p>
          <Big onClick={encaisser}>Encaisser</Big>
        </div>
      </div>
    </Screen>
  )
}
