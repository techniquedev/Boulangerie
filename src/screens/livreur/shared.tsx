import { useApp } from '../../store/context'
import { Badge } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { DRIVERS, tourFigures, type Tour, type TourStatus } from '../../data/tour'
import type { Expense, SiteCode } from '../../data/types'

// Trace d'un événement de tournée : livreur, smartphone affecté, site, horodatage serveur et heure locale.
export const driverTrace = (name: string, site: SiteCode, offline: boolean) => ({ ...traceFor(name, site, offline), device: DRIVERS[site]?.device || 'DEV-04' })

// Filtrage automatique : le livreur ne voit que ses propres tournées, livraisons et versements, sur son site.
export function useTour() {
  const { user, state } = useApp()
  const u = user!
  const site = u.sites[0]
  const tours = state.tours.filter(t => t.site === site && t.driver === u.name).sort((a, b) => b.ts - a.ts)
  const current = tours.find(t => t.status === 'Affectée' || t.status === 'En cours') || tours[0]
  const fig = (t: Tour) => tourFigures(t, state.deliveries, state.tourDeposits, state.tourFixes)
  return {
    user: u, site, tours, current, fig,
    fuel: state.expenses.filter(e => e.by === u.name && e.label.toLowerCase().includes('carburant')),
    remitStatus: (t: Tour) => state.versements.find(v => v.tourId === t.id && v.site === t.site)?.status || t.remit?.status,
  }
}

// Statut visible du livreur : jamais l'alerte, sa gravité ni les commentaires de la direction.
const tone = (s: TourStatus) => (s === 'Soldée' ? 'ok' : s === 'Soldée avec écart' ? 'danger' : 'warn')
export const TourBadge = ({ s }: { s: TourStatus }) => <Badge tone={tone(s)}>{s}</Badge>

// Statuts de la demande de carburant côté livreur : Soumise, Validée, Payée, Refusée.
export const fuelStatus = (e: Expense) => e.status === 'Demandée' ? 'Soumise' : e.status.startsWith('Validée') ? 'Validée' : e.status === 'Refusée' ? 'Refusée' : 'Payée'
export const FuelBadge = ({ e }: { e: Expense }) => {
  const s = fuelStatus(e)
  return <Badge tone={s === 'Payée' ? 'ok' : s === 'Refusée' ? 'danger' : 'warn'}>{s}</Badge>
}
