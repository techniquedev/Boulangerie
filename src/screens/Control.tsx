import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { money } from '../lib/format'
import { can } from '../data/rbac'

export function InventoryScreen() {
  const { user, state, update, audit, say } = useApp()
  const inv = state.inventory
  const role = user!.role
  const blind = role === 'magasinierCentral'
  const diff = (l: { theoretical: number; counted?: number }) => (l.counted ?? l.theoretical) - l.theoretical
  const gap = inv.lines.reduce((a, l) => a + diff(l) * l.unit, 0)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const validate = () => {
    update(s => ({ ...s, inventory: { ...s.inventory, status: 'Validé', adjustedBy: user!.name }, matStock: { ...s.matStock, 'MP-01': (s.matStock['MP-01'] ?? 27) + diff(s.inventory.lines[0]) } }))
    audit('Ajustement d’inventaire', `${inv.id} validé : contre-écriture ${money(gap)} (MP-01)`); say('Ajustement tracé par contre-écriture')
  }
  const saveCount = () => {
    update(s => ({ ...s, inventory: { ...s.inventory, lines: s.inventory.lines.map(l => counts[l.code] !== undefined && counts[l.code] !== '' ? { ...l, counted: Number(counts[l.code]) } : l) } }))
    say('Comptage enregistré')
  }
  return (
    <Screen title="Inventaire physique à l’aveugle" sub={`${inv.id} · ${inv.location}`}>
      <Card title={inv.id} actions={<Badge tone={inv.status === 'Validé' ? 'ok' : 'warn'}>{inv.status}</Badge>}>
        {!blind && <div className="kpi-row"><Kpi label="Écart valorisé" value={money(Math.abs(gap))} tone={gap ? 'danger' : 'ok'} note="2 sacs de farine × 28 500 FCFA = 57 000 FCFA" /></div>}
        <Table head={blind ? ['Article', 'Quantité comptée'] : ['Article', 'Théorique', 'Compté', 'Écart', 'Valeur']} rows={inv.lines.map(l => blind
          ? [l.label, <input className="num-input sm" inputMode="numeric" value={counts[l.code] ?? ''} onChange={e => setCounts({ ...counts, [l.code]: e.target.value.replace(/\D/g, '') })} />]
          : [l.label, l.theoretical, l.counted ?? '—', <b className={diff(l) ? 'neg' : ''}>{diff(l)}</b>, money(diff(l) * l.unit)])} />
        {blind && <Big onClick={saveCount}>Enregistrer mon comptage</Big>}
        {can.validateInventory(role) && inv.status !== 'Validé' && <Big onClick={validate}>Valider l’ajustement (Direction)</Big>}
        {role === 'controleur' && inv.status !== 'Validé' && <Notice tone="warn">En attente de validation par la Direction avant ajustement tracé.</Notice>}
      </Card>
    </Screen>
  )
}

export function QualityScreen() {
  const { user, state, update, audit, say } = useApp()
  const [action, setAction] = useState('')
  const close = (id: string) => {
    if (!action.trim()) return say('Action corrective obligatoire.')
    update(s => ({ ...s, ncs: s.ncs.map(n => n.id === id ? { ...n, status: 'Clôturée', action } : n) }))
    audit('Qualité', `${id} clôturée — action : ${action}`); say('Non-conformité clôturée'); setAction('')
  }
  return (
    <Screen title="Contrôles qualité et chaîne du froid" sub="Relevés de température et non-conformités">
      <Card title="Relevés de 8 h"><Table head={['Relevé', 'Lieu', 'Heure', 'Température', 'Plage', 'Résultat']} rows={state.readings.map(r => {
        const ok = r.value >= r.min && r.value <= r.max
        return [r.id, r.place, r.at, <b>{String(r.value).replace('.', ',')} °C</b>, `${r.min}–${r.max} °C`, <Badge tone={ok ? 'ok' : 'danger'}>{ok ? 'Conforme' : 'Hors plage'}</Badge>] })} /></Card>
      {state.ncs.map(n => <Card key={n.id} title={n.id} sub={n.subject} actions={<Badge tone={n.status === 'Ouverte' ? 'danger' : 'ok'}>{n.status}</Badge>}>
        {n.blocks && n.status === 'Ouverte' && <Notice tone="danger">Lot {n.blocks} bloqué : ni expédiable ni vendable.</Notice>}
        {n.action && <p><b>Action corrective :</b> {n.action}</p>}
        {n.status === 'Ouverte' && (user!.role === 'controleur' || user!.role === 'direction') && <><textarea className="area" placeholder="Action corrective" value={action} onChange={e => setAction(e.target.value)} /><Big onClick={() => close(n.id)}>Clôturer avec action corrective</Big></>}
      </Card>)}
    </Screen>
  )
}

export function PurchasesScreen() {
  const { state } = useApp()
  const tone = (s: string) => (s === 'Conforme' ? 'ok' : s.startsWith('Écart') ? 'danger' : 'warn') as 'ok' | 'danger' | 'warn'
  return (
    <Screen title="Achats fournisseurs" sub="Rapprochement bon de commande / réception / facture">
      <Card><Table head={['Bon de commande', 'Fournisseur', 'Commandé', 'Réception', 'Facture', 'Statut', 'Paiement']} rows={state.purchases.map(p => [
        <b>{p.po}</b>, p.supplier, p.ordered, p.received, p.invoice, <Badge tone={tone(p.status)}>{p.status}</Badge>,
        p.status === 'Conforme' ? <Badge tone="ok">Autorisé</Badge> : <Badge tone="danger">Bloqué</Badge>])} /></Card>
      <Notice tone="danger">Une facture en écart bloque la mise en paiement tant que le rapprochement n’est pas résolu.</Notice>
    </Screen>
  )
}
