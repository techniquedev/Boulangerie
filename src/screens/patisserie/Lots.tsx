import { useState } from 'react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Kpi, Notice, Screen, Table } from '../../components/ui'
import { PAT_STATUSES, patFigures, PROD_LINES, prodLine, type PatFix, type PatStatus } from '../../data/patisserie'
import { productName } from '../../data/shop'
import { fmtQty, matName, siteMat, workshopKey } from '../../data/stock'
import { dec, nowStamp, num } from '../../lib/format'
import { TraceInfo } from '../boulanger/shared'
import { DlcBadge } from '../boutique/shared'
import { LineIcon, PatBadge, usePat } from './shared'

export function PLots() {
  const { update, audit, say } = useApp()
  const { user, site, mine, pf, status, stockOf } = usePat()
  const [line, setLine] = useState('')
  const [day, setDay] = useState('')
  const [st, setSt] = useState<PatStatus | ''>('')
  const list = mine.filter(l => (!line || l.line === line) && (!day || l.fab === day) && (!st || status(l) === st))
  const [sel, setSel] = useState(mine[0]?.id)
  const lot = list.find(l => l.id === sel) || list[0]
  const [fix, setFix] = useState({ target: '', delta: '', motif: '' })
  const days = Array.from(new Set(mine.map(l => l.fab)))

  // Ordre FEFO des lots encore en stock, par produit.
  const fefoRank = new Map<object, number>()
  const byCode = new Map<string, typeof pf>()
  pf.filter(p => p.remaining > 0 && p.left >= 0).forEach(p => byCode.set(p.item.code, [...(byCode.get(p.item.code) || []), p]))
  byCode.forEach(rows => rows.forEach((p, i) => fefoRank.set(p, i + 1)))

  const f = lot && patFigures(lot)
  const rowsOf = lot ? pf.filter(p => p.lot === lot) : []

  // Contre-écriture tracée : ingrédients (stock d'atelier) ou quantités produites (stock de produits finis).
  const applyFix = () => {
    if (!lot || !f) return
    const [kind, key] = fix.target.split(':') as ['mat' | 'item', string]
    const delta = Number(fix.delta.replace(',', '.'))
    if (!fix.target || !delta) return say('Choisissez la ligne et la quantité à corriger (ex. -2 ou 0,5).')
    if (!fix.motif.trim()) return say('Le motif de la contre-écriture est obligatoire.')
    const atl = prodLine(lot.line).atelier
    if (kind === 'mat') {
      const cur = f.mats.find(m => m.mp === key)?.qty || 0
      if (cur + delta < 0) return say('Correction impossible : la consommation deviendrait négative.')
      if (delta > (stockOf(atl)[key] || 0)) return say('Stock d’atelier insuffisant : le stock ne peut jamais devenir négatif.')
    } else if ((rowsOf.find(p => p.item.code === key)?.remaining || 0) + delta < 0) return say('Correction impossible : quantités déjà expédiées.')
    const c: PatFix = { at: nowStamp(), by: user.name, motif: fix.motif.trim(), kind, key, delta }
    const k = workshopKey(site, atl)
    update(s => ({
      ...s,
      patLots: s.patLots.map(l => l.id === lot.id && l.site === lot.site ? { ...l, corrections: [...l.corrections, c] } : l),
      workshop: kind === 'mat' ? { ...s.workshop, [k]: { ...s.workshop[k], [key]: +(((s.workshop[k] || {})[key] || 0) - delta).toFixed(4) } } : s.workshop,
    }))
    audit('Contre-écriture de production', `${lot.id} : ${kind === 'mat' ? matName(key) : productName(key)} ${delta > 0 ? '+' : ''}${dec(delta, 3)} — motif : ${c.motif} (lot d’origine conservé)`)
    say('Contre-écriture tracée'); setFix({ target: '', delta: '', motif: '' })
  }

  return (
    <Screen title="Mes lots de production et péremptions" sub="Lots issus de mes productions — FEFO : premier périmé, premier sorti">
      <div className="filter-row">
        <button className={!line ? 'chip on' : 'chip'} onClick={() => setLine('')}>Toutes les lignes</button>
        {PROD_LINES.map(l => <button key={l.code} className={line === l.code ? 'chip on' : 'chip'} onClick={() => setLine(l.code)}><LineIcon line={l} size={16} /> {l.label}</button>)}
        <select className="ref-input" value={day} onChange={e => setDay(e.target.value)}><option value="">Toutes les dates</option>{days.map(d => <option key={d}>{d}</option>)}</select>
        <select className="ref-input" value={st} onChange={e => setSt(e.target.value as PatStatus | '')}><option value="">Tous les statuts</option>{PAT_STATUSES.map(x => <option key={x}>{x}</option>)}</select>
      </div>
      {!lot || !f ? <Notice>Aucun lot pour ces filtres.</Notice> : <div className="split">
        <div className="list-col scroll-list">{list.map(l => <button key={l.id} className={`list-item ${l.id === lot.id ? 'on' : ''}`} onClick={() => { setSel(l.id); setFix({ target: '', delta: '', motif: '' }) }}>
          <b>{l.id}</b><small>{prodLine(l.line).label} · fabriqué le {l.fab}</small><PatBadge s={status(l)} />
        </button>)}</div>
        <Card title={`Lot ${lot.id}`} sub={`${prodLine(lot.line).label} · fabriqué le ${lot.fab}`} actions={<PatBadge s={status(lot)} />}>
          <div className="kpi-row">
            <Kpi label="Quantité produite" value={num(f.produced)} />
            <Kpi label="Rebuts" value={`${num(f.rejects)} (${dec(f.rejectRate)} %)`} tone={f.rejects ? 'warn' : 'ok'} />
            <Kpi label="Rendement réel / théorique" value={`${dec(f.yieldReal)} % / ${lot.yieldTheo} %`} tone={Math.abs(f.yieldGap) > 5 ? 'danger' : 'ok'} />
          </div>
          <Table head={['Produit', 'Produit', 'Rebuts', 'DLC', 'Expédié', 'Reste en stock', 'FEFO']} rows={rowsOf.map(p => [
            <b>{productName(p.item.code)}{p.item.flavor ? ` — ${p.item.flavor}` : ''}</b>, num(p.item.produced),
            p.item.rejects ? `${num(p.item.rejects)} (${p.item.rejectMotif})` : '—', p.item.dlc, num(p.shipped), <b>{num(p.remaining)}</b>,
            p.remaining <= 0 ? '—' : p.left < 0 ? <Badge tone="danger">Bloqué à la vente</Badge> : <span className="badges">{fefoRank.get(p) === 1 && <Badge tone="ok">À sortir en premier</Badge>}<DlcBadge left={p.left} /></span>])} />
          {lot.motif && <Notice tone="warn"><b>Motif de l’écart :</b> {lot.motif}</Notice>}
          <Table head={['Ingrédient consommé', 'Théorique (recette)', 'Réel', 'Écart']} rows={f.gaps.map(g => [matName(g.mp), fmtQty(g.mp, g.theo), <b>{fmtQty(g.mp, g.real)}</b>,
            <span className={Math.abs(g.pct) > 10 ? 'neg' : 'ok-text'}>{g.pct >= 0 ? '+' : ''}{dec(g.pct)} %</span>])} />
          <TraceInfo t={lot.trace} />
          {lot.corrections.length > 0 && <Table head={['Contre-écriture', 'Auteur', 'Ligne', 'Correction', 'Motif']} rows={lot.corrections.map(c => [c.at, c.by,
            c.kind === 'mat' ? matName(c.key) : productName(c.key), <b>{c.delta > 0 ? '+' : ''}{dec(c.delta, 3)}</b>, c.motif])} />}
          <div className="close-box">
            <b>Corriger par contre-écriture</b>
            <div className="btn-row">
              <select className="ref-input" value={fix.target} onChange={e => setFix({ ...fix, target: e.target.value })}>
                <option value="">Ligne à corriger…</option>
                {lot.items.map(i => <option key={i.code} value={`item:${i.code}`}>Quantité produite — {productName(i.code)}</option>)}
                {lot.mats.map(m => <option key={m.mp} value={`mat:${m.mp}`}>Ingrédient — {matName(m.mp)} ({siteMat(m.mp).unit})</option>)}
              </select>
              <input className="num-input sm" inputMode="decimal" placeholder="± qté" value={fix.delta} onChange={e => setFix({ ...fix, delta: e.target.value.replace(/[^\d,.-]/g, '') })} />
            </div>
            <input className="ref-input wide" placeholder="Motif (obligatoire)" value={fix.motif} onChange={e => setFix({ ...fix, motif: e.target.value })} />
            <Big tone="ghost" onClick={applyFix}>Enregistrer la contre-écriture</Big>
          </div>
        </Card>
      </div>}
    </Screen>
  )
}
