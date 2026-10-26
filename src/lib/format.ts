const TZ = 'Africa/Porto-Novo'

// FCFA sans décimales, séparateur de milliers espace insécable → espace simple (ex. 15 000 FCFA).
export const money = (n: number) =>
  `${Math.round(n).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} FCFA`

export const num = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')

// Horodatage JJ/MM/AAAA HH:MM, fuseau Africa/Porto-Novo.
export const nowStamp = () => {
  const p = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const g = (t: string) => p.find(x => x.type === t)?.value || ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

export const DEMO_DAY = '26/10/2026'
export const DEMO_DAY_LONG = 'lundi 26/10/2026'
