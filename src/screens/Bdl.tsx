import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Card, Kpi, Notice, Screen, Table } from '../components/ui'
import { useSiteFilter } from '../components/SiteFilter'
import { siteShort } from '../data/org'
import { BDL_ST } from '../data/shop'
import { can } from '../data/rbac'
import { num, stampAt } from '../lib/format'

const tone = (s: string) => (s.includes('écart') ? 'danger' : s.startsWith('Clôturé') || s.includes('conforme') || s.includes('soldée') ? 'ok' : 'warn') as 'danger' | 'ok' | 'warn'

// Bordereaux de livraison des 3 sites : boutiques (réception à l'aveugle) et chargements de tournée des livreurs.
// Vue Direction / Contrôleur / magasinier central : quantités expédiées et comptées, écarts.
export function BdlScreen() {
  const { user, state } = useApp()
  const { scope, bar } = useSiteFilter(false)
  const [kind, setKind] = useState<'all' | 'boutique' | 'tournee'>('all')
  const [status, setStatus] = useState('')
  const all = state.bdls.filter(b => (!b.toSite || scope.includes(b.toSite)) && (kind === 'all' || (kind === 'tournee' ? b.kind === 'tournee' : b.kind !== 'tournee')))
  const list = all.filter(b => !status || b.status === status).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const [sel, setSel] = useState<string | null>(null)
  const b = list.find(x => `${x.id}-${x.toSite}` === sel) || list[0]
  const statuses = [...new Set(all.map(x => x.status))]
  if (!can.seeSentQty(user!.role)) return <Notice tone="danger">Accès réservé : les quantités expédiées ne sont jamais visibles en boutique (RG-06).</Notice>

  return (
    <Screen title="Bordereaux de livraison (BDL)" sub="Boutiques (réception à l’aveugle) et chargements de tournée — 3 sites">
      {bar}
      <div className="filter-row">
        {([['all', 'Tous'], ['boutique', 'Boutiques'], ['tournee', 'Tournées livreurs']] as const).map(([k, l]) => <button key={k} className={kind === k ? 'chip on' : 'chip'} onClick={() => setKind(k)}>{l}</button>)}
        <select className="ref-input" value={status} onChange={e => setStatus(e.target.value)}><option value="">Tous les statuts</option>{statuses.map(x => <option key={x}>{x}</option>)}</select>
      </div>
      <div className="kpi-row">
        <Kpi label="BDL" value={num(all.length)} />
        <Kpi label="En transit / réception partielle" value={num(all.filter(x => x.status === BDL_ST.transit || x.status === BDL_ST.partial).length)} tone="warn" />
        <Kpi label="Réceptionnés avec écart" value={num(all.filter(x => x.status === BDL_ST.gap).length)} tone={all.some(x => x.status === BDL_ST.gap) ? 'danger' : 'ok'} />
      </div>
      {!b ? <Notice>Aucun bordereau.</Notice> : <div className="split">
        <div className="list-col scroll-list">{list.map(x => <button key={`${x.id}-${x.toSite}`} className={`list-item ${x === b ? 'on' : ''}`} onClick={() => setSel(`${x.id}-${x.toSite}`)}>
          <b>{x.id}</b><small>{x.toSite ? siteShort(x.toSite) : '—'} · {x.to}</small><Badge tone={tone(x.status)}>{x.status}</Badge>
        </button>)}</div>
        <Card title={b.id} sub={`${b.to}${b.ts ? ` · émis le ${stampAt(new Date(b.ts))}` : ''}${b.by ? ` par ${b.by}` : ''}`} actions={<Badge tone={tone(b.status)}>{b.status}</Badge>}>
          <Table head={['Article', 'Lot', 'Expédié', 'Compté', 'Écart']} rows={b.lines.map(l => [l.label, l.lot ? `${l.lot} · ${l.dlc}` : '—', num(l.sent), l.counted ?? '—',
            l.counted === undefined ? '—' : <b className={l.counted - l.sent ? 'neg' : 'ok-text'}>{l.counted - l.sent}</b>])} />
          {b.counts?.map((c, i) => <p key={i} className="trace">Comptage {i + 1}{c.partial ? ' (partiel)' : ''} par {c.trace.author} le {c.trace.localAt} · appareil {c.trace.device}{c.remark ? ` — « ${c.remark} »` : ''}</p>)}
          {b.requests?.map((r, i) => <p key={i} className="trace">Demande d’explication ({r.by}, {r.at}) : {r.text} — {r.answer ? `réponse de ${r.answer.by} : ${r.answer.text}` : 'en attente de réponse'}</p>)}
        </Card>
      </div>}
    </Screen>
  )
}
