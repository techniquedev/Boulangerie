import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Steps } from '../../components/ui'
import { siteShort } from '../../data/org'
import { figures, flowIndex, LOT_FLOW, type LotStatus, type ProdLot } from '../../data/boulanger'
import { dec } from '../../lib/format'

// Filtrage automatique : l'enfourneur ne voit que les lots de pâtons et les cuissons de son propre site.
export function useOven() {
  const { user, state } = useApp()
  const u = user!
  const site = u.sites[0]
  const lots = state.lots.filter(l => l.site === site).sort((a, b) => b.ts - a.ts)
  return {
    user: u, site, siteName: siteShort(site), lots,
    queue: lots.filter(l => l.status === 'Remis au four' || l.status === 'En cours de cuisson').sort((a, b) => a.ts - b.ts),
    mine: lots.filter(l => l.oven?.by === u.name || l.cuisson?.by === u.name),
    threshold: state.rejectThreshold, photoQty: state.rejectPhotoQty,
  }
}

// Heure de remise au four par le boulanger (historique du lot).
export const handedAt = (l: ProdLot) => l.history.find(h => h.status === 'Remis au four')?.at || l.trace.localAt
export const formatsOf = (l: ProdLot) => figures(l).lines

const tone = (s: LotStatus) => (s === 'Remis au four' ? 'warn' : s === 'En cours de cuisson' ? 'danger' : s === 'Clôturé' ? 'neutral' : 'ok')
export const LotBadge = ({ s }: { s: LotStatus }) => <Badge tone={tone(s)}>{s}</Badge>
export const LotSteps = ({ l }: { l: ProdLot }) => {
  const i = flowIndex(l.status)
  return <Steps steps={LOT_FLOW} current={i === LOT_FLOW.length - 1 ? LOT_FLOW.length : i} />
}

// Taux de rebut comparé au seuil : vert sous le seuil, orange jusqu'à 1,5 fois le seuil, rouge au-delà.
export const rateTone = (rate: number, threshold: number) => (rate <= threshold ? 'ok' : rate <= threshold * 1.5 ? 'warn' : 'danger')
export function RateGauge({ rate, threshold }: { rate: number; threshold: number }) {
  const t = rateTone(rate, threshold)
  const max = Math.max(threshold * 2, rate * 1.1)
  const Icon = t === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div className={`gauge ${t}`}>
      <div className="gauge-head">
        <b>{dec(rate, 2)} <small>% de rebuts</small></b>
        <span className="gauge-state"><Icon size={16} /> {t === 'ok' ? 'Sous le seuil' : 'Au-dessus du seuil'}</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${Math.min(100, (rate / max) * 100)}%` }} />
        <div className="gauge-mark" style={{ left: `${(threshold / max) * 100}%` }}><span>Seuil {dec(threshold, 1)} %</span></div>
      </div>
    </div>
  )
}
