import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Notice, Screen, Steps, Table } from '../components/ui'
import { money } from '../lib/format'
import { can } from '../data/rbac'
import { BAKERY_SITES } from '../data/boulanger'
import { nextShopMoveId, productName, SHOP_PRODUCTS, shopName } from '../data/shop'
import { siteShort } from '../data/org'
import { traceFor } from '../data/trace'

export function Expenses() {
  const { user, state, update, audit, say } = useApp()
  const role = user!.role
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [photo, setPhoto] = useState(false)
  const list = role === 'livreur' ? state.expenses.filter(e => e.by === user!.name) : state.expenses

  const advance = (id: string) => {
    update(s => ({ ...s, expenses: s.expenses.map(e => {
      if (e.id !== id) return e
      const i = e.flow.indexOf(e.status)
      return { ...e, status: e.flow[Math.min(i + 1, e.flow.length - 1)] }
    }) }))
    audit('Validation de dépense', `${id} : étape suivante`); say('Dépense mise à jour')
  }
  const refuse = (id: string) => {
    update(s => ({ ...s, expenses: s.expenses.map(e => e.id === id ? { ...e, status: 'Refusée' } : e) }))
    audit('Validation de dépense', `${id} refusée`); say('Dépense refusée')
  }
  const submit = () => {
    if (!label.trim() || !Number(amount)) return say('Libellé et montant obligatoires.')
    if (role === 'livreur' && !photo) return say('Photo du reçu obligatoire pour une demande de carburant.')
    update(s => ({ ...s, expenses: [{ id: `DÉP-2026-${String(32 + s.expenses.length - 1).padStart(4, '0')}`, label, amount: Number(amount), by: user!.name, status: 'Demandée', photo, flow: ['Demandée', 'Validée (direction)', 'Payée', 'Rapprochée'] }, ...s.expenses] }))
    audit('Dépense', `Demande « ${label} » ${money(Number(amount))}`); say('Demande soumise'); setLabel(''); setAmount(''); setPhoto(false)
  }

  return (
    <Screen title="Dépenses centralisées" sub="Aucune dépense ne peut être saisie depuis une boutique (US-11)">
      {role === 'livreur' && <Notice>Vous pouvez uniquement soumettre une demande de carburant avec photo du reçu.</Notice>}
      {can.submitExpense(role) && <Card title="Nouvelle demande">
        <div className="count-grid">
          <label>Libellé<input className="ref-input wide" value={label} onChange={e => setLabel(e.target.value)} placeholder={role === 'livreur' ? 'Carburant' : 'Ex. facture SBEE'} /></label>
          <label>Montant (FCFA)<input className="num-input" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="check"><input type="checkbox" checked={photo} onChange={e => setPhoto(e.target.checked)} /> Photo du reçu jointe</label>
        </div>
        <Big onClick={submit}>Soumettre la demande</Big>
      </Card>}
      {list.map(e => <Card key={e.id} title={`${e.id} — ${e.label}`} sub={`${money(e.amount)} · demandée par ${e.by}${e.photo ? ' · photo du reçu jointe' : ''}`} actions={<Badge tone={e.status === 'Demandée' ? 'warn' : e.status === 'Refusée' ? 'danger' : 'ok'}>{e.status}</Badge>}>
        {e.status !== 'Refusée' && <Steps steps={e.flow} current={e.flow.indexOf(e.status)} />}
        {e.motif && <p>Motif : {e.motif}</p>}
        {e.photoThumb && <img className="thumb big" src={e.photoThumb} alt="Reçu" />}
        {can.validateExpense(role) && e.status !== 'Refusée' && e.status !== e.flow[e.flow.length - 1] && <div className="btn-row">
          <Big onClick={() => advance(e.id)}>{e.status === 'Demandée' ? 'Valider la dépense' : `Passer à « ${e.flow[e.flow.indexOf(e.status) + 1]} »`}</Big>
          {e.status === 'Demandée' && <Big tone="danger" onClick={() => refuse(e.id)}>Refuser</Big>}
        </div>}
      </Card>)}
    </Screen>
  )
}

export function Versements() {
  const { user, state, update, audit, say } = useApp()
  const confirm = (id: string) => {
    update(s => ({ ...s, versements: s.versements.map(v => v.id === id ? { ...v, status: v.flow[Math.min(v.flow.indexOf(v.status) + 1, v.flow.length - 1)] } : v) }))
    audit('Versement', `${id} : étape suivante`); say('Versement mis à jour')
  }
  return (
    <Screen title="Remise des recettes" sub="Versement au bureau central et dépôt en banque (US-30)">
      {state.versements.map(v => <Card key={`${v.id}-${v.site}`} title={`${v.id} — ${v.tourId ? `tournée ${v.tourId}` : v.site === 'SIT-02' ? 'Boutique A' : 'Boutique B'}`} sub={`${money(v.amount)} versés par ${v.by}${v.tourId ? ` (espèces ${money(v.cash || 0)} · Mobile Money ${money(v.momo || 0)})` : ''}${v.bank ? ` · dépôt ${v.bank} réf. ${v.ref}` : ''}`}
        actions={<Badge tone="ok">{v.status}</Badge>}>
        <Steps steps={v.flow} current={v.flow.indexOf(v.status)} />
        {can.confirmVersement(user!.role) && v.status !== v.flow[v.flow.length - 1] && <Big onClick={() => confirm(v.id)}>Confirmer l’étape suivante</Big>}
      </Card>)}
    </Screen>
  )
}

// Direction : taux de perte par produit et par boutique, et validation des contre-écritures au-delà du seuil (US-22).
export function Invendus() {
  const { state, user, update, audit, say } = useApp()
  const sites = BAKERY_SITES.filter(x => user!.sites.includes(x))
  const received = (site: string, code: string) => state.shopMoves.filter(m => m.site === site && m.code === code && m.kind === 'Réception BDL').reduce((a, m) => a + m.qty, 0)
  const lost = (site: string, code: string) => -state.shopMoves.filter(m => m.site === site && m.code === code && m.kind === 'Invendu / perte').reduce((a, m) => a + m.qty, 0)
  const rate = (r: number, l: number) => (r ? `${((l / r) * 100).toFixed(1).replace('.', ',')} %` : '—')
  const pending = state.shopFixes.filter(f => f.status === 'En attente de validation' && sites.includes(f.site))

  const decide = (id: string, ok: boolean) => {
    const f = state.shopFixes.find(x => x.id === id)!
    const ts = Date.now()
    update(s => ({
      ...s, shopFixes: s.shopFixes.map(x => x.id === id ? { ...x, status: ok ? 'Validée par la direction' : 'Refusée par la direction', decidedBy: user!.name } : x),
      shopMoves: ok ? [...s.shopMoves, { id: nextShopMoveId(s.shopMoves, f.site), site: f.site, code: f.code, lot: f.lot, qty: f.delta, kind: 'Contre-écriture', ref: f.id, ts, trace: traceFor(user!.name, f.site, s.offline), motif: `${f.motif} (validée par ${user!.name})` }] : s.shopMoves,
    }))
    audit('Contre-écriture stock vendant', `${id} ${ok ? 'validée' : 'refusée'} par la direction`); say(ok ? 'Contre-écriture validée et appliquée' : 'Contre-écriture refusée')
  }

  return (
    <Screen title="Invendus, pertes et retours" sub="Taux de perte par produit et par boutique — pertes déclarées / quantités reçues (US-22)">
      <Card title="Taux de perte par produit et par boutique">
        <Table head={['Produit', ...sites.map(siteShort), 'Toutes boutiques']} rows={SHOP_PRODUCTS.map(p => {
          const r = sites.map(x => received(x, p.code)), l = sites.map(x => lost(x, p.code))
          return [productName(p.code), ...sites.map((_, i) => `${rate(r[i], l[i])} (${l[i]} / ${r[i]})`), <b>{rate(r.reduce((a, b) => a + b, 0), l.reduce((a, b) => a + b, 0))}</b>]
        })} />
      </Card>
      <Card title="Contre-écritures en attente de validation" sub="Corrections de plus de 10 unités demandées par les boutiquiers">
        {pending.length ? <Table head={['N°', 'Boutique', 'Déclaration', 'Produit', 'Correction', 'Motif', 'Demandée par', '']} rows={pending.map(f => [f.id, shopName(f.site), f.ref, productName(f.code),
          <b>{f.delta > 0 ? '+' : ''}{f.delta}</b>, f.motif, `${f.trace.author} · ${f.trace.localAt}`,
          <div className="btn-row"><Big onClick={() => decide(f.id, true)}>Valider</Big><Big tone="ghost" onClick={() => decide(f.id, false)}>Refuser</Big></div>])} />
          : <Notice tone="ok">Aucune contre-écriture en attente.</Notice>}
      </Card>
      <Card title="Dernières déclarations">
        <Table head={['N°', 'Boutique', 'Date', 'Lignes', 'Photos']} rows={state.declarations.filter(d => sites.includes(d.site)).sort((a, b) => b.ts - a.ts).slice(0, 15).map(d => [d.id, shopName(d.site), d.trace.localAt,
          d.lines.map(l => `${l.qty} ${productName(l.code)} (${l.motif} → ${l.dest})`).join(' · '), d.lines.some(l => l.photo) ? <Badge tone="ok">Jointe(s)</Badge> : '—'])} />
      </Card>
    </Screen>
  )
}
