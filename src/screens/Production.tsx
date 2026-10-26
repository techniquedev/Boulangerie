import { useApp } from '../store/context'
import { Badge, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { num } from '../lib/format'
import { boulLot, doughKg, epsOf, EPS_GRAMS, MIN_EPS_PER_BAG, otherLots, recipeVersions } from '../data/production'

export function Production() {
  const { user } = useApp()
  const role = user!.role
  const kg = doughKg(boulLot.lines)
  const eps = epsOf(kg)
  const perBag = eps / boulLot.bags
  const total = boulLot.lines.reduce((a, l) => a + l.qty, 0)
  const showBoul = role !== 'patissier'
  const showOther = role !== 'boulanger'

  return (
    <Screen title="Production" sub="Lots du lundi 26/10/2026 — RG-01 : EPS = poids total de pâte ÷ 146 g">
      {showBoul && <Card title={boulLot.id} sub={`Saisi par ${boulLot.by} à 03 h 40 · à partir de ${boulLot.source} · recette ${boulLot.recipe}`}
        actions={<Badge tone="ok">{boulLot.status}</Badge>}>
        <Table head={['Produit', 'Nombre', 'Grammage', 'Poids de pâte']}
          rows={boulLot.lines.map(l => [l.label, num(l.qty), `${l.grams} g`, `${((l.qty * l.grams) / 1000).toString().replace('.', ',')} kg`])} />
        <div className="kpi-row">
          <Kpi label="Poids total de pâte" value={`${kg.toString().replace('.', ',')} kg`} />
          <Kpi label={`EPS (÷ ${EPS_GRAMS} g)`} value={`≈ ${num(eps)} EPS`} note={`${num(kg * 1000)} g ÷ ${EPS_GRAMS}`} />
          <Kpi label="Rendement" value={`${Math.round(perBag)} EPS/sac`} tone={perBag >= MIN_EPS_PER_BAG ? 'ok' : 'danger'} note={`${boulLot.bags} sacs · seuil ${MIN_EPS_PER_BAG}`} />
          <Kpi label="Pâtons façonnés" value={num(total)} />
        </div>
        {perBag >= MIN_EPS_PER_BAG
          ? <Notice tone="ok">Rendement supérieur au seuil de {MIN_EPS_PER_BAG} EPS/sac : aucune alerte.</Notice>
          : <Notice tone="danger">Rendement sous le seuil : alerte générée.</Notice>}
      </Card>}
      {showOther && otherLots.map(l => <Card key={l.id} title={l.id} sub={`${l.line} · saisi par ${l.by}${l.dlc !== '—' ? ` · DLC ${l.dlc}` : ''}`}
        actions={<Badge tone="ok">Mis en stock STK-PF</Badge>}>
        <Table head={['Code', 'Produit', 'Quantité']} rows={l.items.map(i => [i.code, i.label, num(i.qty)])} />
        {l.dlc !== '—' && <Notice>Lot avec date limite de consommation : suivi FEFO (RG-11).</Notice>}
      </Card>)}
      {role !== 'patissier' && <Card title="Recette R-BOUL-01 — versions (US-13)">
        <Table head={['Version', 'Depuis', 'Détail']} rows={recipeVersions.map(v => [<b>{v.v}</b>, v.since, v.note])} />
      </Card>}
    </Screen>
  )
}
