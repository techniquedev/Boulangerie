import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { money, nowStamp } from '../lib/format'
import { can } from '../data/rbac'
import { paid, sale } from '../data/seed2'

const THRESHOLD = 1000

export function Caisse() {
  const { user, state, update, audit, say } = useApp()
  const role = user!.role
  const blind = can.closeBlind(role)
  const sessions = state.sessions.filter(s => user!.sites.includes(s.site))
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')

  const theo = (id: string) => {
    const s = state.sessions.find(x => x.id === id)!
    return (s.fond || 0) + s.tickets.reduce((a, t) => a + paid(t, 'Espèces'), 0)
  }

  const close = (id: string) => {
    if (counted === '') return say('Saisissez le montant compté en espèces.')
    const c = Number(counted), t = theo(id), diff = c - t
    update(s => {
      const exists = s.alerts.some(a => a.detail.startsWith(id))
      const alerts = Math.abs(diff) > THRESHOLD && !exists ? [{
        id: `AL-2026-${String(90 + s.alerts.length - 2).padStart(4, '0')}`,
        type: 'Écart de caisse', severity: 'Moyenne' as const, value: Math.abs(diff), people: user!.name, status: 'Nouvelle' as const,
        detail: `${id} : compté ${money(c)}, théorique ${money(t)} (écart ${diff} FCFA)`,
        history: [{ at: nowStamp(), by: 'Système', text: 'Alerte générée à la clôture de caisse.' }],
      }, ...s.alerts] : s.alerts
      return { ...s, alerts, sessions: s.sessions.map(x => x.id === id ? { ...x, status: 'Clôturée (comptée)', counted: c, closedAt: nowStamp(), closedBy: user!.name } : x) }
    })
    audit('Clôture de caisse', `${id} clôturée — rapport Z archivé`)
    say('Caisse clôturée — rapport « Z de caisse » généré et archivé'); setCounted('')
  }

  const cancel = (sid: string, tid: string) => {
    if (!reason.trim()) return say('Motif obligatoire pour annuler une vente (RG-08).')
    update(s => ({ ...s, sessions: s.sessions.map(x => x.id === sid ? { ...x, tickets: x.tickets.map(t => t.id === tid ? { ...t, cancelled: { by: user!.name, reason, at: nowStamp() } } : t) } : x) }))
    audit('Annulation de vente', `Ticket ${tid} annulé — motif : ${reason}`); say('Annulation tracée (compteur anti-fraude)'); setReason('')
  }

  return (
    <Screen title="Caisse" sub="Une seule session ouverte par caisse (RG-07) — clôture à l’aveugle (US-28)">
      {blind && <Notice>Aucun bouton de dépense ni de sortie de caisse n’existe sur cet écran (US-10). Les annulations sont réservées à la Direction Générale.</Notice>}
      {sessions.length === 0 && <Notice>Aucune session de caisse dans le jeu de démonstration pour votre site.</Notice>}
      {sessions.map(s => {
        const ca = s.summary ? s.summary.ca : s.tickets.reduce((a, t) => a + sale(t), 0)
        const done = s.status !== 'Ouverte'
        return <Card key={s.id} title={s.id} sub={`Ouverte par ${s.openedBy} le ${s.openedAt}${s.fond !== null ? ` · fond de caisse ${money(s.fond)}` : ''}`}
          actions={<Badge tone={done ? 'ok' : 'warn'}>{s.status}</Badge>}>
          <div className="kpi-row"><Kpi label="Chiffre d’affaires" value={money(ca)} />
            {!blind && s.fond !== null && <Kpi label="Espèces théoriques" value={money(theo(s.id))} />}
            {s.counted !== undefined && !blind && <Kpi label="Écart" value={`${s.counted - theo(s.id)} FCFA`} tone={Math.abs(s.counted - theo(s.id)) > THRESHOLD ? 'danger' : 'ok'} />}</div>
          {s.tickets.length > 0 && <Table head={['Ticket', 'Heure', 'Articles', 'Paiement', 'Total', blind ? '' : 'Action']} rows={s.tickets.map(t => [
            <b>{t.id}</b>, t.at, t.lines.map(l => `${l.qty} × ${l.label}`).join(', '),
            t.payments.map(p => `${p.mode} ${money(p.amount)}${p.ref ? ` (${p.ref})` : ''}`).join(' + '),
            t.cancelled ? <Badge tone="danger">Annulé — {t.cancelled.reason}</Badge> : money(sale(t)),
            !blind && !t.cancelled && can.cancelSale(role) && !done ? <button className="link-btn" onClick={() => cancel(s.id, t.id)}>Annuler</button> : ''])} />}
          {can.cancelSale(role) && !done && <input className="ref-input wide" placeholder="Motif d’annulation (obligatoire)" value={reason} onChange={e => setReason(e.target.value)} />}
          {blind && !done && <div className="close-box"><h4>Clôture à l’aveugle</h4><p className="muted">Comptez vos espèces sans voir le montant théorique.</p>
            <input className="num-input" inputMode="numeric" placeholder="Espèces comptées (FCFA)" value={counted} onChange={e => setCounted(e.target.value.replace(/\D/g, ''))} />
            <Big onClick={() => close(s.id)}>Clôturer la caisse</Big></div>}
          {blind && done && <Notice tone="ok">Caisse clôturée et comptée. Rapport « Z de caisse » archivé.</Notice>}
          {!blind && done && s.counted !== undefined && <Notice tone={Math.abs(s.counted - theo(s.id)) > THRESHOLD ? 'danger' : 'ok'}>Compté {money(s.counted)} — théorique {money(theo(s.id))}.</Notice>}
        </Card>
      })}
    </Screen>
  )
}
