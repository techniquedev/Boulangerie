import { AlertTriangle, CheckCircle2, CloudOff } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Steps } from '../../components/ui'
import { bakerStock, LOT_FLOW, yieldTone, type LotStatus, type ProdLot, type Trace } from '../../data/boulanger'
import type { AtelierCode } from '../../data/stock'
import { num } from '../../lib/format'
import { siteShort } from '../../data/org'

// Ateliers dont le rôle confirme les bons de sortie (boulanger : boulangerie ; pâtissier / opératrice : pâtisserie, yaourts-glaces).
export const ateliersOf = (role: string): AtelierCode[] => (role === 'patissier' ? ['ATL-P', 'ATL-YG'] : ['ATL-B'])

// Filtrage automatique : le boulanger ne voit que son site et ses propres pétrissées.
export function useBaker() {
  const { user, state } = useApp()
  const u = user!
  const site = u.sites[0]
  const ateliers = ateliersOf(u.role)
  return {
    user: u, site, siteName: siteShort(site),
    mine: state.lots.filter(l => l.site === site && l.trace.author === u.name).sort((a, b) => b.ts - a.ts),
    bons: state.bonsSortie.filter(b => b.site === site && ateliers.includes(b.atelier)).sort((a, b) => b.ts - a.ts),
    stock: bakerStock(state.workshop, site),
    threshold: state.epsThreshold,
  }
}

// Saisie numérique : chiffres et une virgule (clavier numérique sur tablette).
export const cleanNum = (v: string, decimals = true) => {
  const s = v.replace('.', ',').replace(decimals ? /[^\d,]/g : /\D/g, '')
  const [i, ...rest] = s.split(',')
  return rest.length ? `${i},${rest.join('').slice(0, 2)}` : i
}
export const toNum = (v: string) => Number(v.replace(',', '.')) || 0

const TONE_TEXT = { ok: 'Au-dessus du seuil', warn: 'Sous le seuil', danger: 'Nettement sous le seuil' }

// Rendement comparé au seuil : barre, repère du seuil, libellé et pictogramme (jamais la couleur seule).
export function YieldGauge({ perBag, threshold, big }: { perBag: number; threshold: number; big?: boolean }) {
  const tone = yieldTone(perBag, threshold)
  const max = Math.max(threshold * 1.5, perBag * 1.05)
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div className={`gauge ${tone} ${big ? 'big' : ''}`}>
      <div className="gauge-head">
        <b>{num(perBag)} <small>EPS/sac</small></b>
        <span className="gauge-state"><Icon size={big ? 20 : 16} /> {TONE_TEXT[tone]}</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${Math.min(100, (perBag / max) * 100)}%` }} />
        <div className="gauge-mark" style={{ left: `${(threshold / max) * 100}%` }}><span>Seuil {num(threshold)}</span></div>
      </div>
    </div>
  )
}

export const statusTone = (s: LotStatus) => (s === 'Créé' || s === 'Remis au four' ? 'warn' : s === 'Clôturé' ? 'neutral' : 'ok')
export const StatusBadge = ({ s }: { s: LotStatus }) => <Badge tone={statusTone(s)}>{s}</Badge>

export const LotFrise = ({ lot }: { lot: ProdLot }) => {
  const i = LOT_FLOW.indexOf(lot.status)
  return <Steps steps={LOT_FLOW} current={i === LOT_FLOW.length - 1 ? LOT_FLOW.length : i} />
}

export const TraceInfo = ({ t }: { t: Trace }) => (
  <p className="trace">
    {t.author} · {siteShort(t.site)} · appareil {t.device} · horodatage serveur {t.at || <em className="pending"><CloudOff size={13} /> en attente de synchronisation</em>}
    {t.offline && <> · saisi hors-ligne à {t.localAt} (heure locale)</>}
  </p>
)
