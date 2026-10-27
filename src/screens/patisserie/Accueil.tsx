import { ClipboardCheck } from 'lucide-react'
import { useNav } from '../../store/nav'
import { Badge, Card, Kpi, Screen, Table } from '../../components/ui'
import { patFigures, PROD_LINES, prodLine } from '../../data/patisserie'
import { productName } from '../../data/shop'
import { atelierLabel, BS, fmtQty, matName } from '../../data/stock'
import { dayOf, dec, num, today } from '../../lib/format'
import { DlcBadge } from '../boutique/shared'
import { SyncBanner } from '../magasin/shared'
import { LineIcon, PatBadge, usePat } from './shared'

export function PHome() {
  const go = useNav()
  const { mine, pf, bons, siteName, stockOf, status } = usePat()
  const day = today()
  const lotsToday = mine.filter(l => l.fab === day)
  const pending = bons.filter(b => b.status === BS.emis)
  const received = new Map<string, number>()
  bons.filter(b => b.confirmTs && dayOf(b.confirmTs) === day).forEach(b => b.lines.forEach(l => received.set(l.mp, (received.get(l.mp) || 0) + (l.received ?? l.qty))))
  const myPf = pf.filter(p => mine.includes(p.lot) && p.remaining > 0)
  const soon = myPf.filter(p => p.left <= 2)
  const waiting = mine.filter(l => status(l) === 'Créé')

  return (
    <Screen title="Accueil" sub={`Ateliers pâtisserie et yaourts / crèmes glacées — ${siteName} — journée du ${day}`}>
      <SyncBanner />
      <div className="quick-actions four">
        <button className="quick-btn alt" onClick={() => go('bReception')}><ClipboardCheck size={30} /><span>Confirmer une réception de matières</span>
          {pending.length > 0 && <em className="count-pill">{pending.length} à confirmer</em>}</button>
        {PROD_LINES.map(l => <button key={l.code} className="quick-btn" onClick={() => go('pProduction', l.code)}><LineIcon line={l} size={30} /><span>Nouvelle production {l.label.toLowerCase()}</span></button>)}
      </div>

      <Card title="Indicateurs du jour par ligne de production">
        <Table head={['Ligne', 'Lots saisis', 'Quantités produites', 'Matières consommées', 'Rendement moyen / recette']} rows={PROD_LINES.map(line => {
          const ls = lotsToday.filter(l => l.line === line.code).map(patFigures)
          const planned = ls.reduce((s, f) => s + f.planned, 0), produced = ls.reduce((s, f) => s + f.produced, 0)
          const mats = new Map<string, number>()
          ls.forEach(f => f.mats.forEach(m => mats.set(m.mp, (mats.get(m.mp) || 0) + m.qty)))
          const y = planned ? (produced / planned) * 100 : 0
          return [<span className="row-name"><LineIcon line={line} /> <b>{line.label}</b></span>, num(ls.length), `${num(produced)} ${line.unitLabel}`,
            <small>{[...mats].map(([mp, q]) => `${matName(mp)} ${fmtQty(mp, q)}`).join(' · ') || '—'}</small>,
            planned ? <Badge tone={Math.abs(y - line.yieldTheo) > 5 ? 'warn' : 'ok'}>{dec(y)} % (recette {line.yieldTheo} %)</Badge> : '—']
        })} />
      </Card>

      <Card title="Lots fabriqués aujourd’hui">
        {lotsToday.length ? <Table head={['Lot', 'Ligne', 'Produits', 'DLC', 'Statut']} rows={lotsToday.map(l => [<b>{l.id}</b>, prodLine(l.line).label,
          patFigures(l).items.map(i => `${num(i.produced)} ${productName(i.code)}`).join(' · '), [...new Set(l.items.map(i => i.dlc))].join(', '), <PatBadge s={status(l)} />])} />
          : <p className="muted">Aucun lot aujourd’hui.</p>}
      </Card>

      <div className="recap">
        <Card title="Matières reçues aujourd’hui" actions={<button className="link-btn" onClick={() => go('bReception')}>Réceptions</button>}>
          <Table head={['Ingrédient', 'Reçu']} rows={received.size ? [...received].map(([mp, q]) => [matName(mp), <b>{fmtQty(mp, q)}</b>]) : [[<span className="muted">Aucune réception aujourd’hui</span>, '—']]} />
        </Card>
        <Card title="Stock d’ingrédients disponible" actions={<button className="link-btn" onClick={() => go('pStocks')}>Détail</button>}>
          <Table head={['Atelier', 'Ingrédients']} rows={(['ATL-P', 'ATL-YG'] as const).map(a => [atelierLabel(a),
            <small>{Object.entries(stockOf(a)).filter(([, q]) => q > 0).map(([mp, q]) => `${matName(mp)} ${fmtQty(mp, q)}`).join(' · ') || 'Aucun ingrédient : confirmez un bon de sortie'}</small>])} />
        </Card>
      </div>

      <Card title="Lots arrivant à péremption et productions en attente de mise en stock">
        {soon.length || waiting.length ? <Table head={['Lot', 'Produit', 'Reste', 'DLC', 'Alerte']} rows={[
          ...soon.map(p => [p.lot.id, productName(p.item.code), num(p.remaining), p.item.dlc, <DlcBadge left={p.left} />]),
          ...waiting.map(l => [l.id, prodLine(l.line).label, '—', '—', <PatBadge s="Créé" />]),
        ]} /> : <p className="muted">Aucune alerte de péremption ; aucune production en attente.</p>}
      </Card>
    </Screen>
  )
}
