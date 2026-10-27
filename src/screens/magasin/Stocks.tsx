import { Send } from 'lucide-react'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { convText, fmtQty, LOC_LABELS, SITE_MATS, supplierName, unitQty, type Loc } from '../../data/stock'
import { money, num } from '../../lib/format'
import { useStore } from './shared'

// Fournisseur habituel par matière (pré-remplissage de la proposition de commande).
const usualSupplier: Record<string, string> = {
  'MP-01': 'FR-01', 'MP-02': 'FR-01', 'MP-03': 'FR-04', 'MP-04': 'FR-04', 'MP-09': 'FR-04',
  'MP-05': 'FR-02', 'MP-06': 'FR-02', 'MP-07': 'FR-02', 'MP-08': 'FR-02', 'MP-10': 'FR-03', 'MP-11': 'FR-03', 'MP-12': 'FR-03',
}

export function MStocks() {
  const { siteName, stock } = useStore()
  const rows = SITE_MATS.map(m => ({ m, q: stock[m.mp] || 0 }))
  const low = rows.filter(r => r.q < r.m.min)
  const value = rows.reduce((s, r) => s + r.q * r.m.cmp, 0)

  return (
    <Screen title="État des stocks et seuils d’alerte" sub={`Magasin du site ${siteName} — stock calculé en temps réel à partir des mouvements (entrées et sorties), jamais saisi`}>
      <div className="kpi-row">
        <Kpi label="Matières suivies" value={num(rows.length)} />
        <Kpi label="Sous le stock minimum" value={num(low.length)} tone={low.length ? 'danger' : 'ok'} note={low.map(r => r.m.name).join(', ')} />
        <Kpi label="Valeur du stock (CMP)" value={money(value)} note="Lecture seule — coût moyen pondéré paramétré par la direction" />
      </div>

      {(['MAG', 'CF'] as Loc[]).map(loc => <Card key={loc} title={LOC_LABELS[loc]}>
        <Table head={['Code', 'Matière', 'Stock disponible', 'Unité de stock', 'Conversions', 'Minimum', 'Réapprovisionnement', 'État', 'CMP', 'Valeur']}
          rows={rows.filter(r => r.m.loc === loc).map(({ m, q }) => [
            m.mp, <b>{m.name}</b>, <b className={q < m.min ? 'neg' : ''}>{fmtQty(m.mp, q)}</b>, m.unit, <small>{convText(m)}</small>,
            fmtQty(m.mp, m.min), fmtQty(m.mp, m.reorder),
            q < m.min ? <Badge tone="danger">Sous le minimum</Badge> : q < m.min * 1.25 ? <Badge tone="warn">Proche du minimum</Badge> : <Badge tone="ok">Disponible</Badge>,
            `${money(m.cmp)} / ${m.unit}`, money(q * m.cmp)])} />
      </Card>)}

      <Card title="Proposition de bon de commande fournisseur" sub="Pré-remplie pour les matières sous le minimum, à transmettre au service achats" actions={<Badge tone="neutral">V2</Badge>}>
        {low.length ? <>
          <Table head={['Matière', 'Stock', 'Quantité proposée', 'Fournisseur habituel']} rows={low.map(({ m, q }) => {
            const buy = m.units[m.units.length > 1 ? 1 : 0]
            const n = Math.ceil(m.reorder / buy.f)
            return [m.name, fmtQty(m.mp, q), <b>{unitQty(buy.u, n)} ({fmtQty(m.mp, n * buy.f)})</b>, supplierName(usualSupplier[m.mp])]
          })} />
          <div className="greyed-inline"><Big disabled onClick={() => {}}><Send size={18} /> Transmettre au service achats</Big><span className="muted">Fonctionnalité V2 — non disponible dans cette version.</span></div>
        </> : <Notice tone="ok">Aucune matière sous le minimum.</Notice>}
      </Card>
    </Screen>
  )
}
