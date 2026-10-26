import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { money, num } from '../lib/format'
import { rawMaterials } from '../data/catalog'
import { bonsSortie, receptions } from '../data/production'

export function Magasin() {
  const { user, state, update, audit, say } = useApp()
  const [po, setPo] = useState(false)
  const rows = rawMaterials.map(m => {
    const q = state.matStock[m.code] ?? m.stock
    return { m, q, low: q < m.min, value: q * m.cmp }
  })
  const total = rows.reduce((a, r) => a + r.value, 0)
  const low = rows.filter(r => r.low)

  const adjust = (code: string, delta: number, motif: string) => {
    const cur = state.matStock[code] ?? 0
    if (cur + delta < 0) return say('Stock jamais négatif : sortie bloquée au-delà du disponible (RG-04).')
    update(s => ({ ...s, matStock: { ...s.matStock, [code]: cur + delta } }))
    audit('Contre-écriture de stock', `${code} : ${delta > 0 ? '+' : ''}${delta} — motif : ${motif} (écriture d’origine conservée)`)
    say('Contre-écriture tracée (RG-03)')
  }

  return (
    <Screen title="Magasin et stocks" sub="MAG-MP — stock valorisé au prix moyen pondéré (CMP, US-25)">
      <div className="kpi-row">
        <Kpi label="Valeur du stock matières" value={money(total)} />
        <Kpi label="Références sous le minimum" value={String(low.length)} tone={low.length ? 'warn' : 'ok'} note={low.map(r => r.m.name).join(', ')} />
      </div>
      {low.length > 0 && <Notice tone="warn">Réappro (US-24) : {low.map(r => `${r.m.name} (${r.q} / min ${r.m.min})`).join(' ; ')}.{' '}
        {!po ? <button className="link-btn" onClick={() => { setPo(true); say('Bon de commande proposé généré') }}>Proposer un bon de commande</button> : <b>Bon de commande proposé : {low.map(r => `${r.m.reorderLabel} de ${r.m.name}`).join(', ')}.</b>}</Notice>}
      <Card title="Matières premières">
        <Table head={['Code', 'Matière', 'Unité d’achat', 'Stock', 'Minimum', 'CMP', 'Valeur', 'État']} rows={rows.map(r => [
          r.m.code, r.m.name, r.m.unit, <b>{num(r.q)}</b>, r.m.minLabel, money(r.m.cmp), money(r.value),
          r.low ? <Badge tone="warn">Sous le minimum</Badge> : <Badge tone="ok">Disponible</Badge>])} />
        {(user!.role === 'magasinierCentral' || user!.role === 'magasinier') && <div className="btn-row">
          <Big tone="ghost" onClick={() => adjust('MP-03', -1, 'Sac éventré')}>Contre-écriture : −1 sac de sel</Big>
          <Big tone="ghost" onClick={() => adjust('MP-03', 1, 'Correction de saisie')}>Contre-écriture : +1 sac de sel</Big>
        </div>}
      </Card>
      <Card title="Réceptions fournisseurs (US-06)">
        <Table head={['N°', 'Date', 'Fournisseur', 'Facture', 'Lignes', 'Statut']} rows={receptions.map(r => [
          <b>{r.id}</b>, r.date, r.supplier, r.invoice, r.lines, <Badge tone={r.status === 'Réceptionné' ? 'ok' : 'warn'}>{r.status}</Badge>])} />
      </Card>
      <Card title="Bons de sortie vers les ateliers (US-20) — double validation">
        <Table head={['N°', 'Atelier', 'Émis par', 'Confirmé par', 'Contenu', 'Statut']} rows={bonsSortie.map(b => [
          <b>{b.id}</b>, b.to, b.by, b.confirmedBy, b.lines, <Badge tone="ok">{b.status}</Badge>])} />
      </Card>
    </Screen>
  )
}
