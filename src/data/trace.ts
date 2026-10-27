import type { SiteCode } from './types'
import { nowStamp } from '../lib/format'

// Traçabilité : auteur, site, appareil, horodatage serveur (vide tant que non synchronisé) et heure locale de saisie.
export type Trace = { author: string; site: SiteCode; device: string; at: string; localAt: string; offline: boolean }

export const deviceFor = (site: string) => ({ 'SIT-01': 'DEV-01', 'SIT-02': 'DEV-02', 'SIT-03': 'DEV-03' } as Record<string, string>)[site] || 'DEV-01'

export const traceFor = (author: string, site: SiteCode, offline: boolean): Trace => {
  const at = nowStamp()
  return { author, site, device: deviceFor(site), at: offline ? '' : at, localAt: at, offline }
}
