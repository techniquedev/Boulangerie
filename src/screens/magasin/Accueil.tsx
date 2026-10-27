import { PackagePlus, Truck } from 'lucide-react'
import { useNav } from '../../store/nav'
import { Badge, Card, Kpi, Screen, Table } from '../../components/ui'
import { ATELIERS, bonDay, BS, fmtQty, matName, SITE_MATS, type BonSortie } from '../../data/stock'
import { dayOf, num, today } from '../../lib/format'
import { SyncBanner, useStore } from './shared'

// Matières sorties d'une liste de bons, regroupées par matière (ex. « Farine 3 sacs · Levure 1,5 kg »).
const summary = (bons: BonSortie[]) => {
  const t = new Map<string, number>()
  bons.forEach(b => b.lines.forEach(l => t.set(l.mp, (t.get(l.mp) || 0) + l.qty)))
  return [...t].map(([mp, q]) => `${matName(mp)} ${fmtQty(mp, q)}`).join(' · ') || '—'
}

export function MHome() {
  const go = useNav()
  const { siteName, stock, receptions, bons } = useStore()
  const day = today()
  const yesterday = dayOf(Date.now() - 86400000)
  const recToday = receptions.filter(r => dayOf(r.ts) === day)
  const inToday = new Map<string, number>()
  recToday.forEach(r => r.lines.forEach(l => inToday.set(l.mp, (inToday.get(l.mp) || 0) + l.received * l.f)))
  const bonsToday = bons.filter(b => bonDay(b) === day)
  const pending = bons.filter(b => b.status === BS.emis)
  const main = SITE_MATS.filter(m => m.main)

  const outRows = (d: string) => ATELIERS.map(a => {
    const list = bons.filter(b => bonDay(b) === d && b.atelier === a.code && b.status !== BS.refus)
    return [<b>{a.label}</b>, num(list.length), summary(list)]
  })

  return (
    <Screen title="Accueil" sub={`Magasin du site ${siteName} — journée du ${day}`}>
      <SyncBanner />
      <div className="quick-actions">
        <button className="quick-btn" onClick={() => go('mReceptions')}><PackagePlus size={34} /><span>Enregistrer une réception</span></button>
        <button className="quick-btn alt" onClick={() => go('mSorties')}><Truck size={34} /><span>Nouveau bon de sortie atelier</span>
          {pending.length > 0 && <em className="count-pill">{pending.length} en attente de confirmation</em>}</button>
      </div>

      <Card title="Indicateurs du jour">
        <div className="kpi-row">
          <Kpi label="Réceptions enregistrées" value={num(recToday.length)} />
          <Kpi label="Bons de sortie émis" value={num(bonsToday.length)} />
          <Kpi label="Bons confirmés par l’atelier" value={num(bonsToday.filter(b => b.status === BS.conf || b.status === BS.clos).length)} tone="ok" />
          <Kpi label="En attente de confirmation" value={num(pending.length)} tone={pending.length ? 'warn' : 'ok'} note="Tous les bons « Émis » du site" />
        </div>
        <Table head={['Matière entrée aujourd’hui', 'Quantité totale']} rows={inToday.size
          ? [...inToday].map(([mp, q]) => [matName(mp), <b>{fmtQty(mp, q)}</b>])
          : [[<span className="muted">Aucune réception aujourd’hui</span>, '—']]} />
      </Card>

      <Card title="Niveau de stock des principales matières" actions={<button className="link-btn" onClick={() => go('mStocks')}>État complet des stocks</button>}>
        <div className="stock-grid">{main.map(m => {
          const q = stock[m.mp] || 0
          const low = q < m.min
          return <div key={m.mp} className={`stock-tile ${low ? 'low' : ''}`}>
            <span>{m.name}</span><b>{fmtQty(m.mp, q)}</b>
            <div className="level"><i style={{ width: `${Math.min(100, (q / (m.reorder + m.min)) * 100)}%` }} /><em style={{ left: `${(m.min / (m.reorder + m.min)) * 100}%` }} /></div>
            <small>Minimum {fmtQty(m.mp, m.min)}</small>
            {low && <Badge tone="danger">Sous le minimum</Badge>}
          </div>
        })}</div>
      </Card>

      <div className="recap">
        <Card title={`Sorties de la veille (${yesterday})`}><Table head={['Atelier', 'Bons', 'Matières sorties']} rows={outRows(yesterday)} /></Card>
        <Card title={`Sorties du jour (${day})`}><Table head={['Atelier', 'Bons', 'Matières sorties']} rows={outRows(day)} /></Card>
      </div>
    </Screen>
  )
}
