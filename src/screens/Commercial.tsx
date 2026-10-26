import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Steps, Table } from '../components/ui'
import { money } from '../lib/format'
import { can } from '../data/rbac'
import { clients } from '../data/partners'
import { orderFlow } from '../data/seed3'
import { rawMaterials } from '../data/catalog'

export function Orders() {
  const { state, update, audit, say } = useApp()
  const next = (id: string) => {
    update(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, status: orderFlow[Math.min(orderFlow.indexOf(o.status) + 1, orderFlow.length - 1)] } : o) }))
    audit('Commande', `${id} : étape suivante`); say('Statut de la commande mis à jour')
  }
  const cancel = (id: string) => { update(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, status: 'Annulée' } : o) })); audit('Commande', `${id} annulée`) }
  return (
    <Screen title="Commandes clients" sub="Cycle : Brouillon → Confirmée → En production → Prête → Livrée → Soldée / Annulée (US-17)">
      {state.orders.map(o => <Card key={o.id} title={`${o.id} — ${o.item}`} sub={`Client ${o.client} · livraison le ${o.due}`} actions={<Badge tone={o.status === 'Annulée' ? 'danger' : 'warn'}>{o.status}</Badge>}>
        <Steps steps={orderFlow} current={orderFlow.indexOf(o.status)} />
        <div className="kpi-row"><Kpi label="Total" value={money(o.total)} /><Kpi label="Acompte encaissé" value={money(o.deposit)} /><Kpi label="Reste à payer" value={money(o.total - o.deposit)} /></div>
        {o.status !== 'Soldée' && o.status !== 'Annulée' && <div className="btn-row"><Big onClick={() => next(o.id)}>Étape suivante</Big><Big tone="danger" onClick={() => cancel(o.id)}>Annuler</Big></div>}
      </Card>)}
    </Screen>
  )
}

export function Credit() {
  const { user, audit, say } = useApp()
  const [derog, setDerog] = useState<Record<string, boolean>>({})
  const alice = clients[0]
  const orders = [{ id: 'CMD-G-2026-018', amount: 120000 }, { id: 'CMD-G-2026-019', amount: 250000 }]
  const share = (c: typeof alice) => `Relevé ${c.name} : encours ${money(c.outstanding)} / plafond ${money(c.ceiling)} — ${c.statement}`
  return (
    <Screen title="Crédit clients grossistes" sub="Plafond de crédit et blocage de commande (US-27)">
      <Card title="Clients">
        <Table head={['Code', 'Client', 'Plafond', 'Encours (26/10)', 'Disponible', 'Relevé', '']} rows={clients.map(c => [c.code, c.name, money(c.ceiling), money(c.outstanding), money(c.ceiling - c.outstanding), c.statement,
          <button className="link-btn" onClick={() => { navigator.clipboard?.writeText(share(c)); say('Relevé copié (PDF/WhatsApp simulé)') }}>Exporter</button>])} />
      </Card>
      <Card title={`Commandes de ${alice.name}`}>
        {orders.map(o => { const total = alice.outstanding + o.amount, over = total > alice.ceiling
          return <div key={o.id} className="credit-line"><div><b>{o.id}</b> — {money(o.amount)} → encours {money(total)} / {money(alice.ceiling)}</div>
            {!over ? <Badge tone="ok">Acceptée (sous le plafond)</Badge> : derog[o.id] ? <Badge tone="warn">Dérogation accordée</Badge> : <>
              <Badge tone="danger">Bloquée : dépasse le plafond de {money(total - alice.ceiling)}</Badge>
              {can.derogation(user!.role) ? <Big onClick={() => { setDerog({ ...derog, [o.id]: true }); audit('Dérogation crédit', `${o.id} autorisée par la Direction`); say('Dérogation tracée') }}>Accorder la dérogation</Big>
                : <Notice tone="warn">Demande de dérogation à transmettre à la Direction.</Notice>}</>}</div> })}
      </Card>
    </Screen>
  )
}

export function Plan() {
  const { state } = useApp()
  // Base du plan : production réelle du 26/10 (même jour de semaine) + commande CMD-2026-017.
  const rows: [string, number, number][] = [
    ['Pain standard 150 g', 800, 800], ['Pain standard 100 g', 600, 600], ['Pain standard 50 g', 500, 500],
    ['Pain découpé 115 g', 300, 300], ['Gâteau 2 étages (CMD-2026-017, livraison 28/10)', 1, 0],
  ]
  // Besoins issus de BS-2026-041 : 3 sacs de farine, 1,5 kg de levure (0,3 carton), 1,5 kg de sel.
  const need = [{ m: 'MP-01', q: 3, label: '3 sacs (150 kg)' }, { m: 'MP-02', q: 0.3, label: '1,5 kg (0,3 carton)' }, { m: 'MP-03', q: 0.06, label: '1,5 kg (0,06 sac)' }]
  return (
    <Screen title="Plan de production du 27/10 et besoins matières" sub="Généré depuis les commandes + moyenne des mêmes jours de semaine, ajustable (US-18, US-19)">
      <Card title="Plan et comparaison au réalisé"><Table head={['Produit', 'Plan 27/10', 'Réalisé 26/10']} rows={rows.map(r => [r[0], r[1], r[2]])} /></Card>
      <Card title="Explosion des recettes — besoins en matières">
        <Table head={['Matière', 'Besoin', 'Stock', 'Minimum', 'État']} rows={need.map(n => { const m = rawMaterials.find(x => x.code === n.m)!; const q = state.matStock[n.m] ?? m.stock
          return [m.name, n.label, m.stockLabel.replace(String(m.stock), String(q)), m.minLabel, q < m.min ? <Badge tone="warn">Stock sous le minimum — bon de commande proposé (US-24)</Badge> : <Badge tone="ok">Suffisant</Badge>] })} />
      </Card>
    </Screen>
  )
}
