export const TZ = 'Africa/Porto-Novo'

// FCFA sans décimales, séparateur de milliers espace insécable → espace simple (ex. 15 000 FCFA).
export const money = (n: number) =>
  `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`

export const num = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')

// Quantité avec décimales (ex. 1,5 kg ; 239,5 kg).
export const dec = (n: number, max = 1) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: max }).replace(/[  ]/g, ' ')

// Horodatage JJ/MM/AAAA HH:MM, fuseau Africa/Porto-Novo.
export const stampAt = (d: Date) => {
  const p = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const g = (t: string) => p.find(x => x.type === t)?.value || ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

export const nowStamp = () => stampAt(new Date())

// Jour JJ/MM/AAAA (Porto-Novo) d'un instant.
export const dayOf = (ts: number) => stampAt(new Date(ts)).slice(0, 10)
export const today = () => dayOf(Date.now())
export const hourNow = () => Number(nowStamp().slice(11, 13))

// Instant à HH:MM (heure de Porto-Novo, UTC+1 sans heure d'été) il y a `daysAgo` jours.
export const pnTs = (daysAgo: number, hh: number, mm: number) => {
  const [d, m, y] = today().split('/').map(Number)
  return Date.UTC(y, m - 1, d - daysAgo, hh - 1, mm)
}

// Lundi de la semaine (JJ/MM/AAAA) et mois (MM/AAAA) d'un instant, pour les regroupements.
export const weekOf = (ts: number) => {
  const wd = new Date(ts + 3600000).getUTCDay()
  return dayOf(ts - ((wd + 6) % 7) * 86400000)
}
export const monthOf = (ts: number) => dayOf(ts).slice(3)

export const DEMO_DAY = '26/10/2026'
export const DEMO_DAY_LONG = 'lundi 26/10/2026'
