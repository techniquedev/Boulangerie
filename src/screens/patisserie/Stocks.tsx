import { useState } from 'react'
import { Lock, Send } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { ATELIER_MIN, PROD_LINES, recipe } from '../../data/patisserie'
import { productName } from '../../data/shop'
import { atelierLabel, convText, fmtQty, matName, siteMat, type AtelierCode } from '../../data/stock'
import { nowStamp, num, today } from '../../lib/format'
import { DlcBadge } from '../boutique/shared'
import { LineIcon, usePat } from './shared'

const ATLS: AtelierCode[] = ['ATL-P', 'ATL-YG']

export function PStocks() {
  const { update, audit, say } = useApp()
  const { user, siteName, stockOf, pf } = usePat()
  // Ingrédients suivis : ceux des recettes de chaque atelier.
  const mpsOf = (atl: AtelierCode) => [...new Set(PROD_LINES.filter(l => l.atelier === atl).flatMap(l => l.products.flatMap(c => recipe(c).ingredients.map(([mp]) => mp))))]
  const low = ATLS.flatMap(atl => mpsOf(atl).filter(mp => (stockOf(atl)[mp] || 0) < (ATELIER_MIN[mp] ?? 0)).map(mp => ({ atl, mp })))
  const draft = `Ateliers pâtisserie / yaourts-glaces ${siteName} — demande de réapprovisionnement du ${today()} :\n${low.map(x => `• ${atelierLabel(x.atl)} — ${matName(x.mp)} : stock ${fmtQty(x.mp, stockOf(x.atl)[x.mp] || 0)} (minimum ${fmtQty(x.mp, ATELIER_MIN[x.mp])})`).join('\n')}\nMerci. ${user.name}`
  const [msg, setMsg] = useState<string | null>(null)
  const stockPf = pf.filter(p => p.remaining > 0)

  const send = () => {
    update(s => ({ ...s, notifications: [{ id: `N-${Date.now()}`, text: msg ?? draft, roles: ['magasinier', 'magasinierCentral'], at: nowStamp() }, ...s.notifications] }))
    audit('Demande de réapprovisionnement', `Ateliers ${siteName} : ${low.map(x => matName(x.mp)).join(', ')}`)
    say('Message transmis au magasinier'); setMsg(null)
  }

  return (
    <Screen title="Stocks d’atelier et produits finis" sub={`${siteName} — mis à jour par les réceptions confirmées et les productions validées`}>
      {ATLS.map(atl => <Card key={atl} title={`Ingrédients — ${atelierLabel(atl)}`}>
        <Table head={['Ingrédient', 'Stock disponible', 'Conversions', 'Minimum', 'État']} rows={mpsOf(atl).map(mp => {
          const q = stockOf(atl)[mp] || 0, min = ATELIER_MIN[mp] ?? 0
          return [<b>{matName(mp)}</b>, <b className={q < min ? 'neg' : ''}>{fmtQty(mp, q)}</b>, <small>{convText(siteMat(mp))}</small>, fmtQty(mp, min),
            q <= 0 ? <Badge tone="danger">Non disponible</Badge> : q < min ? <Badge tone="warn">Sous le minimum</Badge> : <Badge tone="ok">Disponible</Badge>]
        })} />
      </Card>)}

      {low.length > 0 && <Card title="Ingrédients sous le stock minimum" sub="Proposition de message de réapprovisionnement au magasinier">
        <textarea className="area tall" value={msg ?? draft} onChange={e => setMsg(e.target.value)} />
        <Big onClick={send}><Send size={18} /> Transmettre au magasinier</Big>
      </Card>}

      <Card title="Produits finis disponibles pour la distribution" sub="Par référence et par lot, après les expéditions du magasin — ordre FEFO">
        {stockPf.length ? <Table head={['Produit', 'Lot', 'Fabrication', 'DLC', 'Disponible', 'Signalétique']} rows={stockPf.map(p => [productName(p.item.code) + (p.item.flavor ? ` — ${p.item.flavor}` : ''),
          p.lot.id, p.lot.fab, p.item.dlc, <b>{num(p.remaining)}</b>, p.left < 0 ? <Badge tone="danger">Bloqué à la vente</Badge> : <DlcBadge left={p.left} />])} />
          : <Notice>Aucun produit fini en stock.</Notice>}
      </Card>

      <Card title="Recettes et nomenclatures" sub="Lecture seule : les modifications de recettes et de prix sont réservées à la direction" actions={<Badge tone="neutral"><Lock size={12} /> Lecture seule</Badge>}>
        {PROD_LINES.map(line => <div key={line.code} className="recipe-block">
          <h4><LineIcon line={line} size={16} /> {line.label} — rendement théorique {line.yieldTheo} %</h4>
          <Table head={['Produit', 'Ingrédients par unité produite', 'Conservation']} rows={line.products.map(c => {
            const r = recipe(c)
            return [<b>{productName(c)}</b>, <small>{r.ingredients.map(([mp, q]) => `${matName(mp)} ${fmtQty(mp, q)}`).join(' · ')}{r.note ? ` — ${r.note}` : ''}</small>,
              `${r.shelf} jour${r.shelf > 1 ? 's' : ''}`]
          })} />
        </div>)}
      </Card>
    </Screen>
  )
}
