import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Screen, Table } from '../components/ui'
import { can } from '../data/rbac'
import { num, nowStamp } from '../lib/format'
import type { Bdl } from '../data/types'

const tone = (s: string) => (s.includes('écart') ? 'danger' : s.startsWith('Clôturé') ? 'ok' : 'warn') as 'danger' | 'ok' | 'warn'

export function BdlScreen() {
  const { user, state, update, audit, say } = useApp()
  const role = user!.role
  const blind = !can.seeSentQty(role)
  const [counts, setCounts] = useState<Record<string, Record<number, string>>>({})
  const [open, setOpen] = useState<string | null>(null)

  // Un compte de site ne voit que les BDL destinés à son site ; la Direction Générale les voit tous.
  const siteAccount = user!.group !== 'DIRECTION GÉNÉRALE'
  const visible = state.bdls.filter(b => (siteAccount ? !!b.toSite && user!.sites.includes(b.toSite) : true))

  const tol = (b: Bdl, label: string) => (label.toLowerCase().includes('yaourt') ? 2 : 0)

  const submit = (b: Bdl) => {
    const c = counts[b.id] || {}
    if (b.lines.some((_, i) => c[i] === undefined || c[i] === '')) return say('Saisissez le comptage de chaque article.')
    const lines = b.lines.map((l, i) => ({ ...l, counted: Number(c[i]) }))
    const gap = lines.some(l => Math.abs((l.counted ?? 0) - l.sent) > tol(b, l.label))
    const status = gap ? 'Réceptionné avec écart' : 'Clôturé (réceptionné conforme)'
    update(s => {
      let alerts = s.alerts
      if (gap && !s.alerts.some(a => a.detail.startsWith(b.id))) {
        const l = lines.find(x => Math.abs((x.counted ?? 0) - x.sent) > 0)!
        alerts = [{ id: `AL-2026-${String(88 + s.alerts.length).padStart(4, '0')}`, type: 'Écart BDL', severity: 'Haute', value: null,
          detail: `${b.id} : ${l.label} compté ${l.counted} pour ${l.sent} expédié(s)`, people: 'Magasinière / Boutiquier', status: 'Nouvelle',
          history: [{ at: nowStamp(), by: 'Système', text: 'Alerte générée automatiquement.' }] }, ...s.alerts]
      }
      return { ...s, alerts, bdls: s.bdls.map(x => x.id === b.id ? { ...x, lines, status } : x) }
    })
    audit('Réception BDL', `${b.id} → ${status}`)
    say(gap ? 'BDL réceptionné avec écart (RG-05)' : 'BDL réceptionné conforme')
    setOpen(null)
  }

  const replay = (b: Bdl) => {
    update(s => ({ ...s, bdls: s.bdls.map(x => x.id === b.id ? { ...x, status: 'Émis → En transit', lines: x.lines.map(l => ({ label: l.label, sent: l.sent })) } : x) }))
    setCounts({ ...counts, [b.id]: {} }); setOpen(b.id)
    say('Réception rejouée : saisissez votre comptage (ex. 450 pains 150 g)')
  }
  const shown = (s: string) => (blind && s.includes('écart') ? 'Réceptionné' : s)

  return (
    <Screen title="Bordereaux de livraison (BDL)" sub={blind ? 'Réception à l’aveugle (RG-06) : les quantités expédiées sont masquées' : 'Numéros uniques — stock central décrémenté à l’émission (US-07)'}>
      {visible.map(b => {
        const pending = b.toSite && b.lines.some(l => l.counted === undefined) && can.receiveBlind(role)
        return <Card key={b.id} title={b.id} sub={`Destination : ${b.to}${b.note ? ` · ${b.note}` : ''}`} actions={<Badge tone={blind ? 'ok' : tone(b.status)}>{shown(b.status)}</Badge>}>
          <Table head={blind ? ['Article attendu', 'Quantité comptée'] : ['Article', 'Expédié', 'Compté', 'Écart']} rows={b.lines.map((l, i) => blind
            ? [l.label, <b>{l.counted ?? '—'}</b>]
            : [l.label, num(l.sent), l.counted ?? '—', l.counted === undefined ? '—' : <b className={l.counted - l.sent ? 'neg' : ''}>{l.counted - l.sent}</b>])} />
          {pending && (open === b.id ? <>
            <div className="count-grid">{b.lines.map((l, i) => <label key={i}>{l.label}
              <input className="num-input" inputMode="numeric" value={counts[b.id]?.[i] ?? ''} onChange={e => setCounts({ ...counts, [b.id]: { ...(counts[b.id] || {}), [i]: e.target.value.replace(/\D/g, '') } })} /></label>)}</div>
            <Big onClick={() => submit(b)}>Valider mon comptage</Big></>
            : <Big onClick={() => setOpen(b.id)}>Saisir mon comptage</Big>)}
          {can.receiveBlind(role) && !pending && <Big tone="ghost" onClick={() => replay(b)}>Rejouer la réception à l’aveugle</Big>}
        </Card>
      })}
    </Screen>
  )
}
