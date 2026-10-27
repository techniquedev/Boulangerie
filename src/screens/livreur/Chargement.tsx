import { Check, Lock } from 'lucide-react'
import { useApp } from '../../store/context'
import { useNav } from '../../store/nav'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { daysLeft, product, productName } from '../../data/shop'
import { tourBdl } from '../../data/tour'
import { nowStamp, num, stampAt } from '../../lib/format'
import { DlcBadge } from '../boutique/shared'
import { TraceInfo } from '../boulanger/shared'
import { driverTrace, TourBadge, useTour } from './shared'

export function LLoad() {
  const { state, update, audit, say } = useApp()
  const go = useNav()
  const { user, site, current: t } = useTour()
  if (!t) return <Screen title="Mon chargement"><Notice>Aucun BDL ne vous est affecté.</Notice></Screen>
  const b = tourBdl(state.bdls, t)

  // Prise en charge : la tournée passe « En cours » et le chargement est placé sous la responsabilité du livreur.
  const start = () => {
    const tr = driverTrace(user.name, site, state.offline), ts = Date.now()
    update(s => ({
      ...s,
      tours: s.tours.map(x => x.id === t.id && x.site === site ? { ...x, status: 'En cours', start: tr, startTs: ts } : x),
      bdls: s.bdls.map(x => x.id === t.bdl && x.toSite === site && x.kind === 'tournee' ? { ...x, status: 'Pris en charge — tournée en cours' } : x),
      queue: s.offline ? [{ id: t.id, text: `Prise en charge ${t.bdl}`, at: nowStamp() }, ...s.queue] : s.queue,
    }))
    audit('Prise en charge du chargement', `${t.bdl} confirmé par ${user.name} : tournée ${t.id} en cours`)
    say('Chargement pris en charge : tournée en cours'); go('lHome')
  }
  // Ordre de sortie FEFO des produits à date limite.
  const fefo = [...t.lines].filter(l => l.dlc).sort((a, b2) => daysLeft(a.dlc!) - daysLeft(b2.dlc!))

  return (
    <Screen title="Mon chargement" sub="BDL émis par le magasin et affecté nommément au livreur — lecture seule">
      <Card title={t.bdl} sub={b ? `Émis le ${stampAt(new Date(b.ts!))} par le magasin du site (${b.by})` : undefined} actions={<TourBadge s={t.status} />}>
        <Notice><Lock size={14} /> Les quantités du BDL ne sont pas modifiables. Une fois la tournée démarrée, ce chargement sert de référence à l’équilibrage de fin de tournée.</Notice>
        <Table head={['Produit', 'Format', 'Quantité chargée', 'Lot', 'Date limite']} rows={t.lines.map(l => [<b>{productName(l.code)}</b>, product(l.code).format, <b>{num(l.qty)}</b>,
          l.lot || '—', l.dlc ? <span className="badges">{l.dlc} <DlcBadge left={daysLeft(l.dlc)} /></span> : '—'])} />
        {fefo.length > 0 && <p className="muted small-note">Ordre de sortie FEFO : {fefo.map((l, i) => `${i + 1}. ${productName(l.code)} — lot ${l.lot} (DLC ${l.dlc})`).join(' · ')}</p>}
      </Card>
      <Card title="Destinations et ordre de tournée">
        <Table head={['Ordre', 'Point de livraison', 'Type']} rows={t.stops.map((s, i) => [<b>{i + 1}</b>, s.name, <Badge tone="neutral">{s.kind}</Badge>])} />
        <p className="muted small-note">Les ventes directes au comptoir mobile (clients de passage) s’ajoutent librement en cours de tournée.</p>
      </Card>
      {t.status === 'Affectée'
        ? <Big onClick={start}><Check size={22} /> Je confirme la prise en charge du chargement</Big>
        : t.start && <Card title="Prise en charge confirmée"><TraceInfo t={t.start} /></Card>}
    </Screen>
  )
}
