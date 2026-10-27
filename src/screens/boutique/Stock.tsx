import { useState } from 'react'
import { Copy, Lock, Send } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { product, productName, SHOP_PRODUCTS } from '../../data/shop'
import { nowStamp, num, today } from '../../lib/format'
import { DlcBadge, useShop } from './shared'

export function SStock() {
  const { update, audit, say } = useApp()
  const { user, shop, stock } = useShop()
  const low = SHOP_PRODUCTS.filter(p => stock[p.code].sellable < p.alert)
  const draft = `${shop} — demande de réapprovisionnement du ${today()} :\n${low.map(p => `• ${productName(p.code)} : ${stock[p.code].sellable ? `stock ${num(stock[p.code].sellable)} (seuil ${p.alert})` : 'rupture'}`).join('\n')}\nMerci. ${user.name}`
  const [msg, setMsg] = useState<string | null>(null)
  const text = msg ?? draft

  const send = () => {
    update(s => ({ ...s, notifications: [{ id: `N-${Date.now()}`, text, roles: ['magasinier', 'magasinierCentral'], at: nowStamp() }, ...s.notifications] }))
    audit('Demande de réapprovisionnement', `${shop} : ${low.map(p => productName(p.code)).join(', ')}`)
    say('Message transmis au magasin du site'); setMsg(null)
  }

  return (
    <Screen title="Stock vendant de la boutique" sub={`${shop} — stock en temps réel, mis à jour par les réceptions, les ventes de la caisse, les retours et les pertes`}>
      <Notice><Lock size={14} /> Consultation en lecture seule : aucun ajustement manuel. Tout écart constaté passe par une déclaration motivée (onglet « Invendus, pertes et retours ») ou un inventaire du contrôleur.</Notice>

      <Card title="Stock par produit et par format">
        <Table head={['Produit', 'Format', 'Stock vendable', 'Bloqué (périmé)', 'Seuil d’alerte', 'État']} rows={SHOP_PRODUCTS.map(p => {
          const s = stock[p.code], pr = product(p.code)
          return [<b>{pr.emoji} {pr.name}</b>, pr.format, <b>{num(s.sellable)}</b>, s.blocked ? <span className="neg">{num(s.blocked)}</span> : '—', num(p.alert),
            s.sellable === 0 ? <Badge tone="danger">Rupture</Badge> : s.sellable < p.alert ? <Badge tone="warn">Sous le seuil</Badge> : <Badge tone="ok">Disponible</Badge>]
        })} />
      </Card>

      <Card title="Produits à date limite — lots en ordre de vente FEFO" sub="Premier périmé, premier sorti : la caisse vend toujours le lot le plus proche de sa date limite ; un lot périmé est bloqué à la vente">
        <Table head={['Ordre FEFO', 'Produit', 'Lot', 'Date limite', 'Quantité restante', 'Signalétique']} rows={SHOP_PRODUCTS.filter(p => p.perishable).flatMap(p => {
          let n = 0
          return stock[p.code].lots.map(l => [l.left !== null && l.left < 0 ? '—' : String(++n), productName(p.code), <b>{l.lot}</b>, l.dlc, num(l.qty),
            l.left !== null && l.left < 0 ? <Badge tone="danger">Bloqué à la vente</Badge> : l.left !== null && l.left <= 2 ? <DlcBadge left={l.left} /> : '—'])
        })} />
      </Card>

      <Card title="Alertes de seuil bas et de rupture" sub="Proposition de message à transmettre au magasin du site">
        {low.length ? <>
          <textarea className="area tall" value={text} onChange={e => setMsg(e.target.value)} />
          <div className="btn-row">
            <Big onClick={send}><Send size={18} /> Transmettre au magasin du site</Big>
            <Big tone="ghost" onClick={() => { void navigator.clipboard?.writeText(text); say('Message copié') }}><Copy size={18} /> Copier le message</Big>
          </div>
        </> : <Notice tone="ok">Aucun produit sous le seuil d’alerte.</Notice>}
      </Card>
    </Screen>
  )
}
