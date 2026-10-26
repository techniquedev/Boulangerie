import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Notice, Screen, Steps, Table } from '../components/ui'
import { money } from '../lib/format'
import { can } from '../data/rbac'

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
      {list.map(e => <Card key={e.id} title={`${e.id} — ${e.label}`} sub={`${money(e.amount)} · demandée par ${e.by}${e.photo ? ' · photo du reçu jointe' : ''}`} actions={<Badge tone={e.status === 'Demandée' ? 'warn' : 'ok'}>{e.status}</Badge>}>
        <Steps steps={e.flow} current={e.flow.indexOf(e.status)} />
        {can.validateExpense(role) && e.status !== e.flow[e.flow.length - 1] && <Big onClick={() => advance(e.id)}>{e.status === 'Demandée' ? 'Valider la dépense' : `Passer à « ${e.flow[e.flow.indexOf(e.status) + 1]} »`}</Big>}
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
      {state.versements.map(v => <Card key={v.id} title={`${v.id} — ${v.site === 'SIT-02' ? 'Boutique A' : 'Boutique B'}`} sub={`${money(v.amount)} versés par ${v.by}${v.bank ? ` · dépôt ${v.bank} réf. ${v.ref}` : ''}`}
        actions={<Badge tone="ok">{v.status}</Badge>}>
        <Steps steps={v.flow} current={v.flow.indexOf(v.status)} />
        {can.confirmVersement(user!.role) && v.status !== v.flow[v.flow.length - 1] && <Big onClick={() => confirm(v.id)}>Confirmer l’étape suivante</Big>}
      </Card>)}
    </Screen>
  )
}

export function Invendus() {
  const { state, user } = useApp()
  const rows = state.losses.filter(l => (user!.group !== 'DIRECTION GÉNÉRALE' ? user!.sites.includes(l.site) : true))
  const total = rows.reduce((a, l) => a + l.qty, 0)
  return (
    <Screen title="Invendus, pertes et retours" sub="Déclaration de fin de journée — boutique A (US-22)">
      <Card title="Déclarations du 26/10/2026" sub={`${total} unités déclarées`}>
        <Table head={['Quantité', 'Produit', 'Motif', 'Destination', 'Photo', 'Heure']} rows={rows.map(l => [
          <b>{l.qty}</b>, l.label, l.reason, l.destination, l.photo ? <Badge tone="ok">Jointe</Badge> : '—', l.at])} />
      </Card>
    </Screen>
  )
}
