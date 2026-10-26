import { useApp } from '../store/context'
import { Badge, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { money, num } from '../lib/format'
import { sale, paid } from '../data/seed2'
import { cuissonLot } from '../data/production'

export function Reports() {
  const { state, say } = useApp()
  const a = state.sessions.find(s => s.site === 'SIT-02')!
  const caA = a.tickets.reduce((x, t) => x + sale(t), 0)
  const list = [
    ['Production', 'Lots, EPS, rendement, rebuts'], ['Ventes', 'CA par boutique, paiements'], ['Stocks', 'Valorisation CMP, alertes réappro'],
    ['BDL', 'Émis, réceptionnés, écarts'], ['Caisse', 'Sessions, Z de caisse, écarts'],
  ]
  return (
    <Screen title="Rapports" sub="Bibliothèque MVP (US-38) et rapport quotidien du soir (US-39)">
      <Card title="Rapport quotidien — 26/10/2026" sub="Envoyé le soir par email / WhatsApp à la Direction">
        <div className="kpi-row">
          <Kpi label="Ventes boutique A" value={money(caA)} />
          <Kpi label="Ventes consolidées (A + B)" value={money(caA + 143500)} />
          <Kpi label="Pains conformes / rebuts" value={`${num(cuissonLot.good)} / ${cuissonLot.rejects.reduce((x, r) => x + r.qty, 0)}`} />
          <Kpi label="Alertes ouvertes" value={String(state.alerts.filter(x => x.status !== 'Clôturée').length)} />
        </div>
        <button className="big-btn" onClick={() => say('Rapport envoyé par email et WhatsApp (simulation)')}>Envoyer maintenant</button>
      </Card>
      <Card title="Bibliothèque de rapports"><Table head={['Rapport', 'Contenu', 'Export']} rows={list.map(r => [<b>{r[0]}</b>, r[1],
        <span className="btn-inline"><button className="link-btn" onClick={() => say(`${r[0]} : export PDF (simulation)`)}>PDF</button> · <button className="link-btn" onClick={() => say(`${r[0]} : export Excel (simulation)`)}>Excel</button></span>])} /></Card>
    </Screen>
  )
}

export function Treasury() {
  const { state } = useApp()
  const a = state.sessions.find(s => s.site === 'SIT-02')!
  const ca = a.tickets.reduce((x, t) => x + sale(t), 0) + 143500
  const dep = state.expenses.filter(e => e.status !== 'Demandée').reduce((x, e) => x + e.amount, 0)
  const cash = a.tickets.reduce((x, t) => x + paid(t, 'Espèces'), 0)
  return (
    <Screen title="Trésorerie et résultat simplifiés" sub="Vue consolidée ventes / dépenses / achats — octobre 2026 (US-40)">
      <div className="kpi-row">
        <Kpi label="Ventes du jour (A + B)" value={money(ca)} /><Kpi label="Dépenses validées" value={money(dep)} />
        <Kpi label="Dépenses en attente" value={money(state.expenses.filter(e => e.status === 'Demandée').reduce((x, e) => x + e.amount, 0))} tone="warn" />
        <Kpi label="Résultat du jour (simplifié)" value={money(ca - dep)} tone="ok" />
      </div>
      <Card title="Par site"><Table head={['Site', 'Ventes', 'Espèces', 'Mobile Money']} rows={[
        ['Boutique A (SIT-02)', money(ca - 143500), money(cash), money(a.tickets.reduce((x, t) => x + paid(t, 'momo'), 0))],
        ['Boutique B (SIT-03)', money(143500), money(113500), money(30000)]]} /></Card>
    </Screen>
  )
}

export function Tour() {
  const { user, say } = useApp()
  const loaded = { pains: 200, yaourts: 50 }, back = { pains: 20, yaourts: 5 }, done = { pains: 180, yaourts: 45 }
  const ok = loaded.pains === done.pains + back.pains && loaded.yaourts === done.yaourts + back.yaourts
  return (
    <Screen title="Tournée du livreur" sub={`BDL-2026-0263 · ${user!.name} (US-26, V2)`}>
      <Card title="Contrôle automatique : chargé = livré + retourné" actions={<Badge tone={ok ? 'ok' : 'danger'}>{ok ? 'Équilibré ✓' : 'Écart'}</Badge>}>
        <Table head={['Article', 'Chargé', 'Livré / vendu', 'Retourné', 'Contrôle']} rows={[
          ['Pain 150 g', loaded.pains, done.pains, back.pains, `${done.pains} + ${back.pains} = ${loaded.pains} ✓`],
          ['Yaourts', loaded.yaourts, done.yaourts, back.yaourts, `${done.yaourts} + ${back.yaourts} = ${loaded.yaourts} ✓`]]} />
        <div className="kpi-row"><Kpi label="Encaissement remis au bureau" value={money(32000)} /></div>
      </Card>
      <Card title="Tournée de la semaine précédente" actions={<Badge tone="ok">Alerte clôturée</Badge>}><p>Écart de 3 pains constaté, alerte traitée et clôturée.</p></Card>
      <button className="big-btn ghost" onClick={() => say('Pour le carburant : ouvrez « Dépenses » et joignez la photo du reçu.')}>Demande de carburant</button>
    </Screen>
  )
}

export function Notifications() {
  const { user, state } = useApp()
  const mine = state.notifications.filter(n => n.roles.includes(user!.role))
  return (
    <Screen title="Centre de notifications" sub="In-app (SMS / WhatsApp en V2) — US-42">
      {mine.length === 0 ? <Notice>Aucune notification.</Notice> : <Card>{mine.map(n => <div key={n.id} className="note-line"><b>{n.text}</b><small>{n.at}</small></div>)}</Card>}
    </Screen>
  )
}
