import { Flag, PackageCheck, Truck } from 'lucide-react'
import { useNav } from '../../store/nav'
import { Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { productName } from '../../data/shop'
import { money, num, stampAt } from '../../lib/format'
import { SyncBanner } from '../magasin/shared'
import { TourBadge, useTour } from './shared'

export function LHome() {
  const go = useNav()
  const { current: t, fig } = useTour()
  if (!t) return <Screen title="Ma tournée du jour"><SyncBanner /><Notice>Aucune tournée ne vous est affectée : le chargement provient toujours d’un BDL émis par le magasin.</Notice></Screen>
  const f = fig(t)
  const open = t.status === 'Affectée' || t.status === 'En cours'

  return (
    <Screen title="Ma tournée du jour" sub={`${t.id} · chargement issu du ${t.bdl}`}>
      <SyncBanner />
      <div className="quick-actions phone">
        <button className="quick-btn" disabled={t.status !== 'Affectée'} onClick={() => go('lLoad')}><PackageCheck size={30} /><span>Démarrer la tournée</span></button>
        <button className="quick-btn" disabled={t.status !== 'En cours'} onClick={() => go('lDeliver')}><Truck size={30} /><span>Enregistrer une livraison</span></button>
        <button className="quick-btn alt" disabled={t.status !== 'En cours'} onClick={() => go('lClose')}><Flag size={30} /><span>Clôturer ma tournée</span></button>
      </div>

      <Card title={`Tournée ${t.id}`} actions={<TourBadge s={t.status} />}>
        <div className="kpi-row">
          <Kpi label="BDL affecté" value={t.bdl} />
          <Kpi label="Départ" value={t.startTs ? stampAt(new Date(t.startTs)).slice(11) : '—'} note={t.startTs ? stampAt(new Date(t.startTs)).slice(0, 10) : 'Prise en charge non confirmée'} />
          <Kpi label="Points de livraison" value={`${f.stopsDone} livré(s) / ${t.stops.length}`} note={`${t.stops.length - f.stopsDone} restant(s)`} />
        </div>
        <div className="progress"><i style={{ width: `${(f.stopsDone / Math.max(1, t.stops.length)) * 100}%` }} /></div>
      </Card>

      <Card title="Compteurs en temps réel">
        <div className="kpi-row">
          <Kpi label="Encaissé en espèces" value={money(f.cash)} />
          <Kpi label="Encaissé en Mobile Money" value={money(f.momo)} />
          <Kpi label="Retours et pertes" value={num(f.rows.reduce((s, r) => s + r.returned + r.lost, 0))} />
        </div>
        <Table head={['Produit', 'Chargé', 'Restant à livrer']} rows={f.rows.map(r => [productName(r.code), num(r.loaded), <b>{num(r.remaining)}</b>])} />
      </Card>
      {!open && <Notice>Tournée {t.status.toLowerCase()} : retrouvez-la dans « Historique et audit ».</Notice>}
    </Screen>
  )
}
