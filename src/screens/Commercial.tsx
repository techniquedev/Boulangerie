import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Steps, Table } from '../components/ui'
import { money } from '../lib/format'
import { can } from '../data/rbac'
import { clients } from '../data/partners'
import { orderFlow } from '../data/seed3'
import { useSiteFilter } from '../components/SiteFilter'
import { siteShort } from '../data/org'
import { activityDays } from '../data/direction'
import { figures } from '../data/boulanger'
import { patFigures, theoretical } from '../data/patisserie'
import { productName } from '../data/shop'
import { fmtQty, matName, siteStock, workshopKey } from '../data/stock'
import { outstandingOf } from '../data/tour'
import { dayOf, dayStartTs, num } from '../lib/format'

export function Orders() {
  const { state, update, audit, say } = useApp()
  const next = (id: string) => {
    update(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, status: orderFlow[Math.min(orderFlow.indexOf(o.status) + 1, orderFlow.length - 1)] } : o) }))
    audit('Commande', `${id} : étape suivante`); say('Statut de la commande mis à jour')
  }
  const cancel = (id: string) => { update(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, status: 'Annulée' } : o) })); audit('Commande', `${id} annulée`) }
  return (
    <Screen title="Commandes clients" sub="Cycle : Brouillon → Confirmée → En production → Prête → Livrée → Soldée / Annulée">
      {state.orders.map(o => <Card key={o.id} title={`${o.id} — ${o.item}`} sub={`Client ${o.client} · livraison le ${o.due}`} actions={<Badge tone={o.status === 'Annulée' ? 'danger' : 'warn'}>{o.status}</Badge>}>
        <Steps steps={orderFlow} current={orderFlow.indexOf(o.status)} />
        <div className="kpi-row"><Kpi label="Total" value={money(o.total)} /><Kpi label="Acompte encaissé" value={money(o.deposit)} /><Kpi label="Reste à payer" value={money(o.total - o.deposit)} /></div>
        {o.status !== 'Soldée' && o.status !== 'Annulée' && <div className="btn-row"><Big onClick={() => next(o.id)}>Étape suivante</Big><Big tone="danger" onClick={() => cancel(o.id)}>Annuler</Big></div>}
      </Card>)}
    </Screen>
  )
}

export function Credit() {
  const { user, state, audit, say } = useApp()
  const [derog, setDerog] = useState<Record<string, boolean>>({})
  // Encours réel : encours de référence + ventes à crédit enregistrées en tournée par les livreurs des 3 sites.
  const out = (code: string) => outstandingOf(code, state.deliveries)
  const alice = clients[0]
  const orders = [{ id: 'CMD-G-2026-018', amount: 120000 }, { id: 'CMD-G-2026-019', amount: 250000 }]
  const share = (c: typeof alice) => `Relevé ${c.name} : encours ${money(out(c.code))} / plafond ${money(c.ceiling)} — ${c.statement}`
  const credits = state.deliveries.filter(d => d.mode === 'Crédit').sort((a, b) => b.id.localeCompare(a.id))
  return (
    <Screen title="Crédit clients grossistes" sub="Plafond de crédit et blocage de commande — encours incluant les ventes à crédit des tournées des 3 sites">
      <Card title="Clients">
        <Table head={['Code', 'Client', 'Plafond', 'Encours', 'Disponible', 'Relevé', '']} rows={clients.map(c => [c.code, c.name, money(c.ceiling), money(out(c.code)),
          <span className={c.ceiling - out(c.code) < 5000 ? 'neg' : ''}>{money(c.ceiling - out(c.code))}</span>, c.statement,
          <button className="link-btn" onClick={() => { navigator.clipboard?.writeText(share(c)); say('Relevé copié (PDF/WhatsApp simulé)') }}>Exporter</button>])} />
      </Card>
      <Card title={`Commandes de ${alice.name}`}>
        {orders.map(o => { const total = out(alice.code) + o.amount, over = total > alice.ceiling
          return <div key={o.id} className="credit-line"><div><b>{o.id}</b> — {money(o.amount)} → encours {money(total)} / {money(alice.ceiling)}</div>
            {!over ? <Badge tone="ok">Acceptée (sous le plafond)</Badge> : derog[o.id] ? <Badge tone="warn">Dérogation accordée</Badge> : <>
              <Badge tone="danger">Bloquée : dépasse le plafond de {money(total - alice.ceiling)}</Badge>
              {can.derogation(user!.role) ? <Big onClick={() => { setDerog({ ...derog, [o.id]: true }); audit('Dérogation crédit', `${o.id} autorisée par la Direction`); say('Dérogation tracée') }}>Accorder la dérogation</Big>
                : <Notice tone="warn">Demande de dérogation à transmettre à la Direction.</Notice>}</>}</div> })}
      </Card>
      <Card title="Ventes à crédit des tournées" sub="Livraisons à crédit enregistrées par les livreurs (montant au tarif grossiste)">
        <Table head={['Livraison', 'Site', 'Livreur', 'Client', 'Montant']} rows={credits.map(d => [d.id, siteShort(d.site), d.trace.author, d.stop.name, money(d.amount)])} />
      </Card>
    </Screen>
  )
}

// Plan de production du lendemain par site : moyenne des derniers jours de production réelle + commandes,
// puis explosion des recettes et comparaison au stock du magasin de site et des ateliers.
export function Plan() {
  const { state } = useApp()
  // Le plan part du dernier jour de la période choisie.
  const { scope, period, bar } = useSiteFilter()
  const day = period.last
  const next = dayOf(dayStartTs(day) + 36 * 3600000)
  const recent = (site: string) => {
    const days = activityDays(state).filter(d => dayStartTs(d) <= dayStartTs(day)).slice(0, 6)
    const bread = new Map<string, { grams: number; qty: number }>(), pat = new Map<string, number>()
    let bags = 0, eps = 0
    state.lots.filter(l => l.site === site && days.includes(dayOf(l.ts))).forEach(l => {
      const f = figures(l); bags += f.bags; eps += f.eps
      f.lines.forEach(x => bread.set(x.label, { grams: x.grams, qty: (bread.get(x.label)?.qty || 0) + x.qty }))
    })
    state.patLots.filter(l => l.site === site && days.includes(l.fab)).forEach(l => patFigures(l).items.forEach(i => pat.set(i.code, (pat.get(i.code) || 0) + i.produced)))
    const n = Math.max(1, days.length)
    return { bread: [...bread].map(([label, v]) => ({ label, grams: v.grams, qty: Math.round(v.qty / n) })), pat: [...pat].map(([code, q]) => ({ code, qty: Math.round(q / n) })), perBag: bags ? eps / bags : state.epsThreshold }
  }
  return (
    <Screen title={`Plan de production du ${next} et besoins matières`} sub="Moyenne des derniers jours de production réelle + commandes clients, ajustable">
      {bar}
      {scope.map(site => {
        const r = recent(site)
        const planEps = r.bread.reduce((a, b) => a + (b.qty * b.grams) / 146, 0)
        const bags = planEps / r.perBag
        // Recette R-BOUL-01 : par sac de farine, 0,5 kg de levure, 0,5 kg de sel, 20 kg de glace.
        const need: Record<string, number> = { 'MP-01': bags, 'MP-02': bags * 0.5, 'MP-03': bags * 0.5, 'MP-08': bags * 20 }
        Object.entries(theoretical(r.pat)).forEach(([mp, q]) => { need[mp] = (need[mp] || 0) + q })
        const st = siteStock(state.movements, site)
        const ws = (mp: string) => ['ATL-B', 'ATL-P', 'ATL-YG'].reduce((a, atl) => a + (state.workshop[workshopKey(site, atl)]?.[mp] || 0), 0)
        const orders = state.orders.filter(o => o.due.startsWith(next) && o.status !== 'Annulée')
        return <Card key={site} title={siteShort(site)} sub={`Base : rendement moyen ${num(r.perBag)} EPS/sac`}>
          <Table head={['Produit', `Plan ${next}`]} rows={[...r.bread.map(b => [b.label, num(b.qty)]), ...r.pat.map(p => [productName(p.code), num(p.qty)]),
            ...orders.map(o => [`${o.item} (${o.id}, ${o.client})`, '1'])]} />
          <Table head={['Matière', 'Besoin', 'Stock magasin + ateliers', 'État']} rows={Object.entries(need).filter(([, q]) => q > 0).map(([mp, q]) => {
            const have = (st[mp] || 0) + ws(mp)
            return [matName(mp), fmtQty(mp, +q.toFixed(2)), fmtQty(mp, +have.toFixed(2)), have < q ? <Badge tone="warn">Insuffisant — réappro à prévoir</Badge> : <Badge tone="ok">Suffisant</Badge>]
          })} />
        </Card>
      })}
    </Screen>
  )
}
