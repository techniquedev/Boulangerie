import { useState } from 'react'
import { useApp } from '../store/context'
import { Card, Kpi, Screen, Table, Badge, Notice } from '../components/ui'
import { siteShort } from '../data/org'
import { money, num } from '../lib/format'
import { boulLot, cuissonLot, doughKg, epsOf, rejectRate, otherLots } from '../data/production'
import { rawMaterials } from '../data/catalog'
import { sale, paid } from '../data/seed2'
import type { SiteCode } from '../data/types'

export function Dashboard() {
  const { user, state } = useApp()
  const u = user!
  const [filter, setFilter] = useState<'all' | SiteCode>('all')
  const shopSites: SiteCode[] = ['SIT-02', 'SIT-03']
  const scope = filter === 'all' ? shopSites : [filter]

  const rows = scope.map(code => {
    const s = state.sessions.find(x => x.site === code)!
    const ca = s.summary ? s.summary.ca : s.tickets.reduce((a, t) => a + sale(t), 0)
    const cash = s.summary ? s.summary.cash : s.tickets.reduce((a, t) => a + paid(t, 'Espèces'), 0)
    const momo = s.summary ? s.summary.momo : s.tickets.reduce((a, t) => a + paid(t, 'momo'), 0)
    return { code, name: siteShort(code), ca, cash, momo }
  })
  const ca = rows.reduce((a, r) => a + r.ca, 0)
  const cash = rows.reduce((a, r) => a + r.cash, 0)
  const momo = rows.reduce((a, r) => a + r.momo, 0)

  const full = u.role === 'direction' || u.role === 'controleur'
  const kg = doughKg(boulLot.lines), eps = epsOf(kg), rate = rejectRate(cuissonLot.rejects.reduce((a, r) => a + r.qty, 0), cuissonLot.received)
  const openAlerts = state.alerts.filter(a => a.status !== 'Clôturée')
  const valid = state.expenses.filter(e => e.status !== 'Demandée').reduce((a, e) => a + e.amount, 0)
  const pending = state.expenses.filter(e => e.status === 'Demandée').reduce((a, e) => a + e.amount, 0)
  const low = rawMaterials.filter(m => (state.matStock[m.code] ?? m.stock) < m.min)
  const piece = (l: string) => otherLots.find(x => x.line === l)!.items.reduce((a, i) => a + i.qty, 0)
  const bdl = state.bdls

  return (
    <Screen title="Tableau de bord" sub="Journée du lundi 26/10/2026 — filtres par site, boutique ou vue consolidée">
      <div className="filter-row">
        {[['all', 'Vue consolidée'], ...shopSites.map(c => [c, siteShort(c)])].map(([k, l]) =>
          <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k as 'all' | SiteCode)}>{l}</button>)}
      </div>
      <div className="kpi-row">
        <Kpi label={filter === 'all' ? 'CA consolidé J' : 'CA du jour'} value={money(ca)} note={rows.map(r => `${r.name} ${num(r.ca)}`).join(' + ')} />
        <Kpi label="Encaissements espèces / Mobile Money" value={`${num(cash)} / ${num(momo)} FCFA`} />
        {full && <>
          <Kpi label="Dépenses validées / en attente" value={`${num(valid)} / ${num(pending)} FCFA`} />
          <Kpi label="Alertes ouvertes" value={String(openAlerts.length)} tone={openAlerts.length ? 'warn' : 'ok'} note="Visibles Direction et Contrôleur uniquement" />
        </>}
      </div>
      <Card title="Production du jour (SITE 1)">
        <div className="kpi-row">
          <Kpi label="Farine pétrie" value={`${boulLot.bags} sacs (${boulLot.bags * 50} kg)`} />
          <Kpi label="Rendement moyen" value={`${Math.round(eps / boulLot.bags)} EPS/sac`} note="Seuil : 400" tone="ok" />
          <Kpi label="Pains cuits conformes / rebuts" value={`${num(cuissonLot.good)} conformes — ${cuissonLot.rejects.reduce((a, r) => a + r.qty, 0)} rebuts (${rate.toFixed(2).replace('.', ',')} %)`} />
          <Kpi label="Pâtisserie / Yaourts / Glaces" value={`${piece('Pâtisserie')} pièces / ${piece('Yaourts')} pots / ${piece('Glaces')} unités`} />
        </div>
      </Card>
      <Card title="Bordereaux de livraison">
        <div className="kpi-row">
          <Kpi label="BDL émis / réceptionnés / avec écart" value={`${bdl.length} / ${bdl.filter(b => b.status.startsWith('Réception') || b.status.startsWith('Clôturé')).length} / ${bdl.filter(b => b.status.includes('écart')).length}`} />
          {full && <Kpi label="Stock en alerte réappro" value={low.map(m => `${m.name} ${m.code}`).join(', ') || 'Aucun'} tone={low.length ? 'warn' : 'ok'} />}
        </div>
      </Card>
      {full ? <Card title="Alertes ouvertes" sub="Jamais visibles par les opérateurs concernés (RG-10)">
        <Table head={['N°', 'Type', 'Gravité', 'Valeur', 'Statut']} rows={openAlerts.map(a => [
          a.id, a.type, <Badge tone={a.severity === 'Haute' ? 'danger' : 'warn'}>{a.severity}</Badge>, a.value ? money(a.value) : '—', a.status])} />
      </Card> : <Notice>Les alertes d’écart et de fraude sont réservées aux rôles Contrôleur et Direction.</Notice>}
    </Screen>
  )
}
