import { ClipboardList, PackageOpen } from 'lucide-react'
import { useNav } from '../../store/nav'
import { Card, Kpi, Screen, Table } from '../../components/ui'
import { BDL_ST, productName, SHOP_PRODUCTS } from '../../data/shop'
import { dayOf, num, today } from '../../lib/format'
import { SyncBanner } from '../magasin/shared'
import { DlcBadge, lastCount, useShop } from './shared'

export function SHome() {
  const go = useNav()
  const { shop, bdls, stock, decls } = useShop()
  const day = today()
  const yesterday = dayOf(Date.now() - 86400000)
  const transit = bdls.filter(b => b.status === BDL_ST.transit || b.status === BDL_ST.partial)
  const validatedToday = bdls.filter(b => (b.counts || []).some(c => dayOf(c.ts) === day))
  const withGap = bdls.filter(b => b.status === BDL_ST.gap)
  const inStock = SHOP_PRODUCTS.filter(p => stock[p.code].sellable > 0)
  const low = SHOP_PRODUCTS.filter(p => stock[p.code].sellable < p.alert)
  const soon = SHOP_PRODUCTS.flatMap(p => stock[p.code].lots).filter(l => l.left !== null && l.left <= 2)

  // Déclarations de la veille ; à défaut, la dernière déclaration enregistrée.
  const prev = decls.filter(d => dayOf(d.ts) === yesterday)
  const lastDay = decls.find(d => dayOf(d.ts) !== day)
  const shown = prev.length ? prev : lastDay ? decls.filter(d => dayOf(d.ts) === dayOf(lastDay.ts)) : []
  const recap = new Map<string, number>()
  shown.forEach(d => d.lines.forEach(l => { const k = `${productName(l.code)}|${l.motif}|${l.dest}`; recap.set(k, (recap.get(k) || 0) + l.qty) }))

  return (
    <Screen title="Accueil" sub={`${shop} — journée du ${day}`}>
      <SyncBanner />
      <div className="quick-actions">
        <button className="quick-btn" onClick={() => go('sReception')}><PackageOpen size={34} /><span>Réceptionner une livraison</span>
          {transit.length > 0 && <em className="count-pill">{transit.length} en transit</em>}</button>
        <button className="quick-btn alt" onClick={() => go('sPertes')}><ClipboardList size={34} /><span>Déclarer des invendus / pertes</span></button>
      </div>

      <Card title="Livraisons">
        <div className="kpi-row">
          <Kpi label="Bordereaux en cours d’acheminement" value={num(transit.length)} tone={transit.length ? 'warn' : 'ok'} />
          <Kpi label="Réceptions validées aujourd’hui" value={num(validatedToday.length)} />
          <Kpi label="Réceptions « avec écart »" value={num(withGap.length)} tone={withGap.length ? 'danger' : 'ok'} note="Vérifiez votre comptage dans « Suivi de mes réceptions »" />
        </div>
      </Card>

      <Card title="Stock vendant" actions={<button className="link-btn" onClick={() => go('sStock')}>Voir le stock</button>}>
        <div className="kpi-row">
          <Kpi label="Références en stock" value={`${num(inStock.length)} / ${num(SHOP_PRODUCTS.length)}`} />
          <Kpi label="En rupture ou sous le seuil" value={num(low.length)} tone={low.length ? 'warn' : 'ok'} note={low.map(p => productName(p.code)).join(', ')} />
          <Kpi label="Lots frais à péremption proche" value={num(soon.filter(l => l.left! >= 0).length)} tone={soon.length ? 'warn' : 'ok'} note="Alertes J-2, J-1 et dernier jour" />
          <Kpi label="Lots périmés bloqués à la vente" value={num(soon.filter(l => l.left! < 0).length)} tone={soon.some(l => l.left! < 0) ? 'danger' : 'ok'} />
        </div>
        {soon.length > 0 && <Table head={['Produit', 'Lot', 'Date limite', 'Quantité', 'Alerte']} rows={soon.map(l => [productName(l.code), l.lot, l.dlc, num(l.qty), <DlcBadge left={l.left} />])} />}
      </Card>

      <Card title={prev.length ? `Invendus et pertes de la veille (${yesterday})` : 'Invendus et pertes — dernière déclaration'}
        sub={shown[0] ? `${shown.map(d => d.id).join(', ')} · ${shown[0].trace.localAt}` : undefined}>
        {recap.size ? <Table head={['Produit', 'Motif', 'Destination', 'Quantité']} rows={[...recap].map(([k, q]) => { const [p, m, d] = k.split('|'); return [p, m, d, <b>{num(q)}</b>] })} />
          : <p className="muted">Aucune déclaration.</p>}
      </Card>
      {transit.some(b => b.status === BDL_ST.partial) && <p className="muted small-note">Réception partielle en cours : {transit.filter(b => b.status === BDL_ST.partial).map(b => `${b.id} (dernier comptage ${lastCount(b)?.trace.localAt})`).join(', ')}.</p>}
    </Screen>
  )
}
