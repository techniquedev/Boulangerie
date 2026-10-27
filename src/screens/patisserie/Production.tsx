import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/context'
import { useNav, useNavArg } from '../../store/nav'
import { Badge, Big, Card, Kpi, Notice, Screen, Steps, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import {
  addDaysTo, CONSUMPTION_TOLERANCE, needsMotif, nextPatLotId, PROD_LINES, prodLine, recipe, REJECT_MOTIFS, theoretical, YIELD_TOLERANCE,
  type PatItem, type PatLot,
} from '../../data/patisserie'
import { product, productName } from '../../data/shop'
import { atelierLabel, fmtQty, matName, siteMat, workshopKey } from '../../data/stock'
import { dayOf, dayStartTs, dec, nowStamp, num, today } from '../../lib/format'
import { cleanNum, toNum } from '../boulanger/shared'
import { LineIcon, usePat } from './shared'

type Row = { code: string; planned: string; produced: string; rejects: string; rejectMotif: string; flavor: string; dlc: string }
const iso = (d: string) => d.split('/').reverse().join('-')
const fr = (v: string) => v.split('-').reverse().join('/')

export function PProduction() {
  const { state, update, audit, say } = useApp()
  const go = useNav()
  const arg = useNavArg()
  const { user, site, stockOf } = usePat()
  const [lineCode, setLineCode] = useState(PROD_LINES.some(l => l.code === arg) ? arg! : '')
  const [step, setStep] = useState(0)
  const firstRow = (code: string): Row => ({ code: prodLine(code).products[0], planned: '', produced: '', rejects: '', rejectMotif: '', flavor: prodLine(code).flavors?.[0] || '', dlc: '' })
  const [rows, setRows] = useState<Row[]>(() => (PROD_LINES.some(l => l.code === arg) ? [firstRow(arg!)] : []))
  const [real, setReal] = useState<Record<string, string>>({})
  const [fab, setFab] = useState(iso(today()))
  const [motif, setMotif] = useState('')
  const [created, setCreated] = useState<PatLot | null>(null)

  const line = lineCode ? prodLine(lineCode) : null
  const stock = line ? stockOf(line.atelier) : {}
  const blank = (code = line?.products[0] || ''): Row => ({ code, planned: '', produced: '', rejects: '', rejectMotif: '', flavor: line?.flavors?.[0] || '', dlc: '' })
  const choose = (code: string) => { setLineCode(code); setStep(0); setRows([firstRow(code)]); setReal({}); setMotif(''); setCreated(null) }
  const setRow = (i: number, v: Partial<Row>) => setRows(rows.map((r, k) => k === i ? { ...r, ...v } : r))

  // Écran 1 — produits, recette et consommation théorique pour les quantités prévues.
  const planned = rows.filter(r => r.code && toNum(r.planned) > 0)
  const theo = theoretical(planned.map(r => ({ code: r.code, qty: toNum(r.planned) })))
  const ingredients = Object.keys(theo)
  const planError = !planned.length ? 'Choisissez au moins un produit et sa quantité prévue.' : ''

  // Écran 2 — consommation réelle, contrôlée par le stock d'atelier (seuls les ingrédients reçus sont disponibles).
  const realOf = (mp: string) => toNum(real[mp] ?? '')
  const over = ingredients.filter(mp => realOf(mp) > (stock[mp] || 0) + 1e-9)
  const noStock = ingredients.filter(mp => !(stock[mp] > 0))
  const matError = !ingredients.some(mp => realOf(mp) > 0) ? 'Saisissez les ingrédients réellement consommés.'
    : over.length ? `Stock d’atelier insuffisant : ${over.map(matName).join(', ')}. Le stock ne peut jamais devenir négatif.` : ''

  // Écran 3 — production, rebuts, dates et contrôle du rendement.
  const produced = planned.reduce((s, r) => s + toNum(r.produced), 0)
  const plannedQty = planned.reduce((s, r) => s + toNum(r.planned), 0)
  const yieldReal = plannedQty ? (produced / plannedQty) * 100 : 0
  const gaps = ingredients.map(mp => ({ mp, theo: theo[mp], real: realOf(mp), pct: theo[mp] ? ((realOf(mp) - theo[mp]) / theo[mp]) * 100 : 0 }))
  const outOfRange = line ? needsMotif(yieldReal - line.yieldTheo, gaps) : false
  const prodError = !produced ? 'Saisissez les quantités produites.'
    : planned.some(r => toNum(r.rejects) > 0 && !r.rejectMotif) ? 'Un motif est obligatoire pour chaque rebut.'
    : !fab ? 'Saisissez la date de fabrication.' : outOfRange && !motif.trim() ? 'Écart de rendement ou de consommation : le motif est obligatoire.' : ''
  const dlcOf = (r: Row) => r.dlc || iso(addDaysTo(fr(fab), recipe(r.code).shelf))

  const validate = () => {
    if (!line || planError || matError || prodError) return say(planError || matError || prodError)
    const ts = Date.now(), fabDay = fr(fab)
    const n = state.lots.filter(l => l.site === site && dayOf(l.ts) === fabDay).length + state.patLots.filter(l => l.site === site && l.fab === fabDay).length
    const lot: PatLot = {
      id: nextPatLotId(line.code, site, dayStartTs(fabDay) + 12 * 3600000, n),
      site, line: line.code, ts, fab: fabDay, trace: traceFor(user.name, site, state.offline), yieldTheo: line.yieldTheo,
      motif: outOfRange ? motif.trim() : undefined, corrections: [],
      items: planned.map<PatItem>(r => ({ code: r.code, planned: toNum(r.planned), produced: toNum(r.produced), rejects: toNum(r.rejects), rejectMotif: r.rejectMotif || undefined, flavor: line.flavors ? r.flavor : undefined, dlc: fr(dlcOf(r)) })),
      mats: ingredients.filter(mp => realOf(mp) > 0).map(mp => ({ mp, qty: realOf(mp) })),
    }
    update(s => {
      const k = workshopKey(site, line.atelier)
      const w = { ...(s.workshop[k] || {}) }
      lot.mats.forEach(m => { w[m.mp] = Math.max(0, +((w[m.mp] || 0) - m.qty).toFixed(4)) })
      return {
        ...s, workshop: { ...s.workshop, [k]: w }, patLots: [...s.patLots, lot],
        queue: s.offline ? [{ id: lot.id, text: `Production ${lot.id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }
    })
    audit('Production validée', `${lot.id} (${line.label}) : ${lot.items.map(i => `${num(i.produced)} ${productName(i.code)}`).join(' · ')} — rendement ${dec(yieldReal)} %`)
    say(state.offline ? `Lot ${lot.id} enregistré hors-ligne : mis en stock à la synchronisation` : `Lot ${lot.id} mis en stock : disponible pour l’expédition`)
    setCreated(lot)
  }

  if (!line) return (
    <Screen title="Nouvelle production" sub="Choisissez la ligne de production">
      <div className="atelier-pick">{PROD_LINES.map(l => <button key={l.code} className="atelier-btn tall" onClick={() => choose(l.code)}><LineIcon line={l} size={36} /><span>{l.label}<small>{atelierLabel(l.atelier)}</small></span></button>)}</div>
    </Screen>
  )

  if (created) return (
    <Screen title={`Nouvelle production — ${line.label}`}>
      <Card title={`Lot ${created.id}`} sub="Production validée : non modifiable (corrections par contre-écriture)" actions={<Badge tone={state.offline ? 'warn' : 'ok'}>{state.offline ? 'Créé — en attente de synchronisation' : 'Mis en stock'}</Badge>}>
        <Table head={['Produit', 'Produit(s)', 'Rebuts', 'Fabrication', 'DLC']} rows={created.items.map(i => [productName(i.code) + (i.flavor ? ` — ${i.flavor}` : ''), <b>{num(i.produced)}</b>, num(i.rejects), created.fab, i.dlc])} />
        <Notice tone="ok">Les produits alimentent le stock de produits finis et sont disponibles pour les bordereaux d’expédition du magasin.</Notice>
        <div className="btn-row"><Big onClick={() => choose(line.code)}><Plus size={20} /> Nouvelle production {line.label.toLowerCase()}</Big><Big tone="ghost" onClick={() => go('pLots')}>Voir mes lots</Big></div>
      </Card>
    </Screen>
  )

  return (
    <Screen title={`Nouvelle production — ${line.label}`} sub={`${atelierLabel(line.atelier)} · rendement théorique de la recette : ${line.yieldTheo} %`}>
      <div className="filter-row">{PROD_LINES.map(l => <button key={l.code} className={l.code === line.code ? 'chip on' : 'chip'} onClick={() => choose(l.code)}><LineIcon line={l} size={16} /> {l.label}</button>)}</div>
      <Steps steps={['Produits et recette', 'Ingrédients consommés', 'Production et contrôle']} current={step} />

      {step === 0 && <Card title={`Produits ${line.label.toLowerCase()} prévus`} sub="La recette de référence et la consommation théorique s’affichent automatiquement">
        <Table head={['Produit', ...(line.flavors ? ['Parfum'] : []), `Quantité prévue (${line.unitLabel})`, '']} rows={rows.map((r, i) => [
          <select className="ref-input" value={r.code} onChange={e => setRow(i, { code: e.target.value, dlc: '' })}>{line.products.map(c => <option key={c} value={c}>{productName(c)}</option>)}</select>,
          ...(line.flavors ? [<select className="ref-input" value={r.flavor} onChange={e => setRow(i, { flavor: e.target.value })}>{line.flavors.map(f => <option key={f}>{f}</option>)}</select>] : []),
          <input className="num-input sm" inputMode="numeric" placeholder="0" value={r.planned} onChange={e => setRow(i, { planned: cleanNum(e.target.value, false), produced: r.produced || cleanNum(e.target.value, false) })} />,
          rows.length > 1 ? <button className="icon-btn" title="Retirer" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={18} /></button> : '',
        ])} />
        <div className="btn-row"><Big tone="ghost" onClick={() => setRows([...rows, blank(line.products.find(c => !rows.some(r => r.code === c)) || line.products[0])])}><Plus size={20} /> Ajouter un produit</Big></div>
        {ingredients.length > 0 && <Table head={['Ingrédient', 'Consommation théorique', 'Stock d’atelier']} rows={ingredients.map(mp => [matName(mp), <b>{fmtQty(mp, theo[mp])}</b>,
          stock[mp] > 0 ? fmtQty(mp, stock[mp]) : <Badge tone="danger">Non reçu</Badge>])} />}
        {planError && <Notice tone="warn">{planError}</Notice>}
        <div className="btn-row"><Big disabled={!!planError} onClick={() => setStep(1)}>Suivant <ArrowRight size={20} /></Big></div>
      </Card>}

      {step === 1 && <Card title="Ingrédients réellement consommés" sub="Stock d’atelier en lecture seule — seuls les ingrédients confirmés comme reçus peuvent être consommés">
        <Table head={['Ingrédient', 'Théorique', 'Réellement consommé', 'Stock d’atelier', 'Écart']} rows={ingredients.map(mp => {
          const g = gaps.find(x => x.mp === mp)!
          return [<b>{matName(mp)}</b>, fmtQty(mp, theo[mp]),
            <label className="unit-input"><input className="num-input sm" inputMode="decimal" placeholder={dec(theo[mp], 3)} disabled={!(stock[mp] > 0)} value={real[mp] ?? ''}
              onChange={e => setReal({ ...real, [mp]: cleanNum(e.target.value) })} /><span>{siteMat(mp).unit}</span></label>,
            stock[mp] > 0 ? <span className={realOf(mp) > stock[mp] ? 'neg' : ''}>{fmtQty(mp, stock[mp])}</span> : <Badge tone="danger">Non reçu</Badge>,
            real[mp] ? <span className={Math.abs(g.pct) > CONSUMPTION_TOLERANCE ? 'neg' : 'ok-text'}>{g.pct >= 0 ? '+' : ''}{dec(g.pct)} %</span> : '—']
        })} />
        <div className="btn-row"><Big tone="ghost" onClick={() => setReal(Object.fromEntries(ingredients.filter(mp => stock[mp] > 0).map(mp => [mp, String(+Math.min(theo[mp], stock[mp]).toFixed(3)).replace('.', ',')])))}>Reprendre les quantités de la recette</Big></div>
        {noStock.length > 0 && <Notice tone="warn">Non reçu à l’atelier : {noStock.map(matName).join(', ')}. Confirmez d’abord un bon de sortie du magasin. <button className="link-btn" onClick={() => go('bReception')}>Réception des matières</button></Notice>}
        {matError && <Notice tone="warn">{matError}</Notice>}
        <div className="btn-row">
          <Big tone="ghost" onClick={() => setStep(0)}><ArrowLeft size={20} /> Retour</Big>
          <Big disabled={!!matError} onClick={() => setStep(2)}>Suivant <ArrowRight size={20} /></Big>
        </div>
      </Card>}

      {step === 2 && <>
        <Card title="Quantités produites, rebuts et dates">
          <label className="field">Date de fabrication<input className="ref-input" type="date" value={fab} onChange={e => setFab(e.target.value)} /></label>
          <Table head={['Produit', 'Prévu', 'Produit (conforme)', 'Rebuts', 'Motif du rebut', 'DLC']} rows={planned.map(r => {
            const i = rows.indexOf(r)
            return [<b>{productName(r.code)}{r.flavor && line.flavors ? ` — ${r.flavor}` : ''}</b>, num(toNum(r.planned)),
              <input className="num-input sm" inputMode="numeric" value={r.produced} onChange={e => setRow(i, { produced: cleanNum(e.target.value, false) })} />,
              <input className="num-input sm" inputMode="numeric" placeholder="0" value={r.rejects} onChange={e => setRow(i, { rejects: cleanNum(e.target.value, false) })} />,
              toNum(r.rejects) > 0 ? <select className="ref-input" value={r.rejectMotif} onChange={e => setRow(i, { rejectMotif: e.target.value })}><option value="">Motif…</option>{REJECT_MOTIFS.map(m => <option key={m}>{m}</option>)}</select> : '—',
              <label className="field"><input className="ref-input" type="date" value={dlcOf(r)} onChange={e => setRow(i, { dlc: e.target.value })} /><small className="muted">Proposée : fabrication + {recipe(r.code).shelf} j</small></label>]
          })} />
        </Card>
        <Card title="Contrôle du rendement par rapport à la recette">
          <div className="kpi-row">
            <Kpi label={`Prévu (${line.unitLabel})`} value={num(plannedQty)} />
            <Kpi label={`Obtenu (${line.unitLabel})`} value={num(produced)} />
            <Kpi label="Rendement réel" value={`${dec(yieldReal)} %`} tone={Math.abs(yieldReal - line.yieldTheo) > YIELD_TOLERANCE ? 'danger' : 'ok'} note={`Théorique ${line.yieldTheo} % (tolérance ± ${YIELD_TOLERANCE} points)`} />
          </div>
          <Table head={['Ingrédient', 'Théorique', 'Réel', 'Écart']} rows={gaps.map(g => [matName(g.mp), fmtQty(g.mp, g.theo), fmtQty(g.mp, g.real),
            <b className={Math.abs(g.pct) > CONSUMPTION_TOLERANCE ? 'neg' : 'ok-text'}>{g.pct >= 0 ? '+' : ''}{dec(g.pct)} %</b>])} />
          {outOfRange && <div className="pedago"><div>
            <b>Écart par rapport à la recette.</b>
            <p>Le rendement s’écarte de plus de {YIELD_TOLERANCE} points du rendement théorique, ou un ingrédient de plus de {CONSUMPTION_TOLERANCE} % de la quantité standard. Vérifiez votre saisie ; si elle est juste, indiquez ce qui s’est passé.</p>
            <textarea className="area" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif (obligatoire)" />
          </div></div>}
          {prodError && <Notice tone="warn">{prodError}</Notice>}
          {state.offline && <Notice tone="warn">Hors-ligne : le lot sera enregistré sur la tablette (statut « Créé ») puis mis en stock à la synchronisation.</Notice>}
          <div className="btn-row">
            <Big tone="ghost" onClick={() => setStep(1)}><ArrowLeft size={20} /> Retour</Big>
            <Big disabled={!!(planError || matError || prodError)} onClick={validate}><Check size={20} /> Valider et mettre en stock</Big>
          </div>
        </Card>
      </>}
      <p className="muted small-note">Produits de la ligne : {line.products.map(c => `${product(c).emoji} ${productName(c)}`).join(' · ')}.</p>
    </Screen>
  )
}
