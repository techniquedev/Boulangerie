import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { money, num } from '../lib/format'
import { rawMaterials } from '../data/catalog'
import { siteShort } from '../data/org'
import { SITES } from '../data/direction'
import { atelierLabel, BS, fmtQty, matName, receptionGroups, siteStock, SITE_MATS, supplierName, unitQty } from '../data/stock'

export function Magasin() {
  const { user, state, update, audit, say } = useApp()
  const [po, setPo] = useState(false)
  const rows = rawMaterials.map(m => {
    const q = state.matStock[m.code] ?? m.stock
    return { m, q, low: q < m.min, value: q * m.cmp }
  })
  const total = rows.reduce((a, r) => a + r.value, 0)
  // Vue de tous les sites (Direction, magasinier central) : stocks, réceptions et bons des magasins de site.
  const sites = SITES.filter(x => user!.sites.includes(x))
  const siteStocks = Object.fromEntries(sites.map(x => [x, siteStock(state.movements, x)]))
  const recs = state.receptions.filter(r => sites.includes(r.site)).sort((a, b) => b.ts - a.ts).slice(0, 15)
  const bons = state.bonsSortie.filter(b => sites.includes(b.site)).sort((a, b) => b.ts - a.ts).slice(0, 20)
  const low = rows.filter(r => r.low)

  const adjust = (code: string, delta: number, motif: string) => {
    const cur = state.matStock[code] ?? 0
    if (cur + delta < 0) return say('Stock jamais négatif : sortie bloquée au-delà du disponible.')
    update(s => ({ ...s, matStock: { ...s.matStock, [code]: cur + delta } }))
    audit('Contre-écriture de stock', `${code} : ${delta > 0 ? '+' : ''}${delta} — motif : ${motif} (écriture d’origine conservée)`)
    say('Contre-écriture tracée')
  }

  return (
    <Screen title="Magasin et stocks" sub="Magasin central (MAG-MP) et magasins des 3 sites — stocks valorisés au prix moyen pondéré (CMP)">
      <div className="kpi-row">
        <Kpi label="Valeur du stock matières" value={money(total)} />
        <Kpi label="Références sous le minimum" value={String(low.length)} tone={low.length ? 'warn' : 'ok'} note={low.map(r => r.m.name).join(', ')} />
      </div>
      {low.length > 0 && <Notice tone="warn">Réappro : {low.map(r => `${r.m.name} (${r.q} / min ${r.m.min})`).join(' ; ')}.{' '}
        {!po ? <button className="link-btn" onClick={() => { setPo(true); say('Bon de commande proposé généré') }}>Proposer un bon de commande</button> : <b>Bon de commande proposé : {low.map(r => `${r.m.reorderLabel} de ${r.m.name}`).join(', ')}.</b>}</Notice>}
      <Card title="Magasin central (MAG-MP) — matières premières">
        <Table head={['Code', 'Matière', 'Unité d’achat', 'Stock', 'Minimum', 'CMP', 'Valeur', 'État']} rows={rows.map(r => [
          r.m.code, r.m.name, r.m.unit, <b>{num(r.q)}</b>, r.m.minLabel, money(r.m.cmp), money(r.value),
          r.low ? <Badge tone="warn">Sous le minimum</Badge> : <Badge tone="ok">Disponible</Badge>])} />
        {(user!.role === 'magasinierCentral' || user!.role === 'magasinier') && <div className="btn-row">
          <Big tone="ghost" onClick={() => adjust('MP-03', -1, 'Sac éventré')}>Contre-écriture : −1 sac de sel</Big>
          <Big tone="ghost" onClick={() => adjust('MP-03', 1, 'Correction de saisie')}>Contre-écriture : +1 sac de sel</Big>
        </div>}
      </Card>
      <Card title="Magasins de site — stock disponible" sub="Calculé à partir des mouvements de chaque site (réceptions, bons de sortie, contre-écritures)">
        <Table head={['Matière', ...sites.map(siteShort), 'Minimum (par site)']} rows={SITE_MATS.map(m => [<b>{m.name}</b>,
          ...sites.map(x => { const q = siteStocks[x][m.mp] || 0; return <span className={q < m.min ? 'neg' : ''}>{fmtQty(m.mp, q)}</span> }), fmtQty(m.mp, m.min)])} />
        <div className="kpi-row">{sites.map(x => <Kpi key={x} label={`Valeur du stock ${siteShort(x)} (CMP)`} value={money(SITE_MATS.reduce((a, m) => a + (siteStocks[x][m.mp] || 0) * m.cmp, 0))} />)}</div>
      </Card>
      <Card title="Réceptions fournisseurs des magasins de site" sub="Les plus récentes">
        <Table head={['Site', 'N°', 'Date', 'Fournisseur', 'Facture', 'Lignes', 'Statut']} rows={recs.map(r => [siteShort(r.site),
          <b>{r.id}</b>, r.deliveryDate, supplierName(r.supplier), r.invoiceNo, r.lines.map(l => `${matName(l.mp)} ${unitQty(l.unit, l.received)}`).join(' · '),
          receptionGroups(state.receptions, r.site).find(g => g.recs.includes(r))?.partial ? <Badge tone="warn">Réception partielle</Badge> : <Badge tone="ok">Complète</Badge>])} />
      </Card>
      <Card title="Bons de sortie vers les ateliers — double validation" sub="Les plus récents, tous sites">
        <Table head={['Site', 'N°', 'Atelier', 'Émis par', 'Confirmé par', 'Contenu', 'Statut']} rows={bons.map(b => [siteShort(b.site),
          <b>{b.id}</b>, atelierLabel(b.atelier), b.by, b.confirm?.author || '—', b.lines.map(l => `${matName(l.mp)} ${fmtQty(l.mp, l.qty)}`).join(' · '),
          <Badge tone={b.status === BS.emis ? 'warn' : b.status === BS.refus || b.ecart || b.reconcile?.result === 'Écart à traiter' ? 'danger' : 'ok'}>{b.status}{b.reconcile ? ` — ${b.reconcile.result}` : ''}</Badge>])} />
      </Card>
    </Screen>
  )
}
