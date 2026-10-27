import { useState } from 'react'
import { MessageSquareReply } from 'lucide-react'
import { useApp } from '../../store/context'
import { Big, Card, Notice, Screen, Table } from '../../components/ui'
import { BDL_ST, product } from '../../data/shop'
import { dayOf, nowStamp, num, stampAt } from '../../lib/format'
import { TraceInfo } from '../boulanger/shared'
import { BdlBadge, countedTotal, useShop } from './shared'
import { usePeriod } from '../../components/PeriodFilter'

const FILTERS = ['Tous', BDL_ST.transit, BDL_ST.partial, BDL_ST.ok, BDL_ST.gap, BDL_ST.clos]

export function SSuivi() {
  const { update, audit, say } = useApp()
  const { user, site, shop, bdls } = useShop()
  const [f, setF] = useState('Tous')
  const per = usePeriod(bdls.filter(b => b.ts).map(b => dayOf(b.ts!)))
  const inP = bdls.filter(b => !b.ts || per.match(dayOf(b.ts)))
  const list = inP.filter(b => f === 'Tous' || b.status === f)
  const [sel, setSel] = useState((bdls.find(b => b.requests?.some(r => !r.answer)) || bdls[0])?.id)
  const b = list.find(x => x.id === sel) || list[0]
  const [answer, setAnswer] = useState<Record<number, string>>({})

  // Réponse tracée à une demande d'explication : le comptage validé reste inchangé.
  const reply = (i: number) => {
    const text = answer[i]?.trim()
    if (!b || !text) return say('Saisissez votre réponse.')
    update(s => ({ ...s, bdls: s.bdls.map(x => x.id === b.id && x.toSite === site
      ? { ...x, requests: (x.requests || []).map((r, k) => k === i ? { ...r, answer: { at: nowStamp(), by: user.name, text } } : r) } : x) }))
    audit('Réponse à une demande d’explication', `${b.id} : ${text}`)
    say('Réponse transmise à la hiérarchie'); setAnswer({ ...answer, [i]: '' })
  }

  return (
    <Screen title="Suivi de mes réceptions et des écarts" sub={`${shop} — historique des bordereaux et des comptages validés`}>
      {per.bar}
      <div className="filter-row">{FILTERS.map(x => <button key={x} className={f === x ? 'chip on' : 'chip'} onClick={() => setF(x)}>{x} ({inP.filter(y => x === 'Tous' || y.status === x).length})</button>)}</div>
      {!b ? <Notice>Aucun bordereau pour ce filtre.</Notice> : <div className="split">
        <div className="list-col scroll-list">{list.map(x => <button key={x.id} className={`list-item ${x.id === b.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
          <b>{x.id}</b><small>{x.ts ? stampAt(new Date(x.ts)) : '—'}{x.requests?.some(r => !r.answer) ? ' · explication demandée' : ''}</small><BdlBadge b={x} />
        </button>)}</div>
        <Card title={`Bordereau ${b.id}`} sub={`Émis le ${b.ts ? stampAt(new Date(b.ts)) : '—'} par le magasin du site`} actions={<BdlBadge b={b} />}>
          {b.status === BDL_ST.gap && <Notice tone="warn">Réception enregistrée avec écart. Le contrôle est suivi par la hiérarchie ; votre comptage validé ne peut pas être modifié.</Notice>}
          {b.counts?.length ? <>
            <Table head={['Article', 'Format', ...b.counts.map((_, k) => b.counts!.length > 1 ? `Comptage ${k + 1}` : 'Quantité comptée'), ...(b.counts.length > 1 ? ['Total compté'] : [])]}
              rows={b.lines.map((l, i) => {
                const p = l.code ? product(l.code) : null
                return [<b>{p ? p.name : l.label}</b>, p?.format || '—', ...b.counts!.map(c => num(c.counts[i] || 0)), ...(b.counts!.length > 1 ? [<b>{num(countedTotal(b, i))}</b>] : [])]
              })} />
            {b.counts.map((c, k) => <div key={k} className="pass">
              <b>Comptage {b.counts!.length > 1 ? `${k + 1} ` : ''}validé le {c.trace.localAt}{c.partial ? ' — réception partielle' : ''}</b>
              {c.remark && <p>Remarque : {c.remark}</p>}
              {c.photos.length > 0 && <div className="photo-row">{c.photos.map((p, i) => <figure key={i}>{p.thumb ? <img src={p.thumb} alt={p.name} /> : <span className="muted">{p.name}</span>}<figcaption>{p.kind}</figcaption></figure>)}</div>}
              <TraceInfo t={c.trace} />
            </div>)}
          </> : <Notice>Bordereau en transit : comptage non encore effectué.</Notice>}

          {(b.requests || []).map((r, i) => <div key={i} className="close-box">
            <b>Demande d’explication — {r.by}, {r.at}</b>
            <p>{r.text}</p>
            {r.answer ? <Notice tone="ok">Votre réponse ({r.answer.at}) : {r.answer.text}</Notice> : <>
              <textarea className="area" value={answer[i] || ''} onChange={e => setAnswer({ ...answer, [i]: e.target.value })} placeholder="Votre explication (tracée)" />
              <Big onClick={() => reply(i)}><MessageSquareReply size={18} /> Envoyer ma réponse</Big>
            </>}
          </div>)}
        </Card>
      </div>}
    </Screen>
  )
}
