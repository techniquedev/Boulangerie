import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Info, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/context'
import { useNav } from '../../store/nav'
import { Badge, Big, Card, Kpi, Notice, Screen, Steps, Table } from '../../components/ui'
import {
  epsOfKg, forecast, FORMATS, kgOf, MATS, matLabel, matQty, mpOf, nextAlertId, nextLotId, patonsOf, perBagOf, traceFor,
  type Line, type MatKey, type ProdLot,
} from '../../data/boulanger'
import { EPS_GRAMS } from '../../data/production'
import { workshopKey } from '../../data/stock'
import { dec, nowStamp, num } from '../../lib/format'
import { cleanNum, toNum, useBaker, YieldGauge } from './shared'

type Row = { label: string; grams: string; qty: string; extra?: boolean }
const blankMats = () => Object.fromEntries(MATS.map(m => [m.key, { on: true, qty: '' }])) as Record<MatKey, { on: boolean; qty: string }>
const blankRows = (): Row[] => FORMATS.map(f => ({ label: f.label, grams: String(f.grams), qty: '' }))

export function BPetrissee() {
  const { state, update, audit, say } = useApp()
  const go = useNav()
  const { user, site, siteName, stock, threshold } = useBaker()
  const [step, setStep] = useState(0)
  const [mats, setMats] = useState(blankMats)
  const [rows, setRows] = useState<Row[]>(blankRows)
  const [motif, setMotif] = useState('')
  const [created, setCreated] = useState<ProdLot | null>(null)

  // Partie A — matières
  const used = MATS.filter(m => mats[m.key].on).map(m => ({ mat: m.key, qty: toNum(mats[m.key].qty) })).filter(m => m.qty > 0)
  const over = MATS.filter(m => mats[m.key].on && toNum(mats[m.key].qty) > stock[m.key])
  const bags = mats.farine.on ? toNum(mats.farine.qty) : 0
  const matError = stock.farine <= 0 ? 'Aucune farine réceptionnée à l’atelier : confirmez d’abord un bon de sortie du magasin central.'
    : bags <= 0 ? 'Saisissez le nombre de sacs de farine consommés.'
    : over.length ? `Quantité supérieure au stock atelier : ${over.map(m => m.label).join(', ')}. Le stock ne peut jamais devenir négatif.` : ''

  // Partie B — pâtons
  const lines: Line[] = rows.map(r => ({ label: r.label.trim() || `Format ${r.grams} g`, grams: toNum(r.grams), qty: toNum(r.qty) })).filter(l => l.qty > 0 && l.grams > 0)
  const patons = patonsOf(lines)
  const lineError = !patons ? 'Saisissez au moins un nombre de pâtons.' : rows.some(r => r.extra && toNum(r.qty) > 0 && (!r.label.trim() || toNum(r.grams) <= 0)) ? 'Indiquez le libellé et le grammage du format ajouté.' : ''

  // Partie C — contrôles en temps réel
  const kg = kgOf(lines)
  const eps = epsOfKg(kg)
  const perBag = perBagOf(eps, bags)
  const below = patons > 0 && perBag < threshold
  const motifError = below && !motif.trim() ? 'Rendement sous le seuil : le motif est obligatoire avant validation.' : ''

  const setMat = (k: MatKey, v: Partial<{ on: boolean; qty: string }>) => setMats({ ...mats, [k]: { ...mats[k], ...v } })
  const setRow = (i: number, v: Partial<Row>) => setRows(rows.map((r, k) => k === i ? { ...r, ...v } : r))
  const restart = () => { setMats(blankMats()); setRows(blankRows()); setMotif(''); setStep(0); setCreated(null) }

  // Partie D — validation : lot de production, déduction du stock atelier, historisation non modifiable.
  const validate = () => {
    if (matError || lineError || motifError) return say(matError || lineError || motifError)
    const ts = Date.now()
    const lot: ProdLot = {
      id: nextLotId(state.lots, state.patLots, site, ts), site, ts, trace: traceFor(user.name, site, state.offline),
      mats: used, lines, threshold, motif: below ? motif.trim() : undefined,
      status: 'Remis au four', history: [{ status: 'Créé', at: nowStamp(), by: user.name }, { status: 'Remis au four', at: nowStamp(), by: user.name }],
      corrections: [],
    }
    update(s => {
      const k = workshopKey(site, 'ATL-B')
      const w = { ...(s.workshop[k] || {}) }
      used.forEach(m => { w[mpOf(m.mat)] = Math.max(0, +((w[mpOf(m.mat)] || 0) - m.qty).toFixed(4)) })
      // Alerte de contrôle formelle : visible uniquement par la direction et le contrôleur central.
      const alerts = below ? [{
        id: nextAlertId(s.alerts), type: 'Rendement sous seuil', severity: 'Moyenne' as const, value: null,
        detail: `${lot.id} (${siteName}) : ${num(perBag)} EPS/sac pour ${dec(bags, 2)} sac(s), seuil ${num(threshold)} — motif du boulanger : ${lot.motif}`,
        people: `${user.name} (boulanger)`, status: 'Nouvelle' as const,
        history: [{ at: nowStamp(), by: 'Système', text: 'Alerte générée à la validation de la pétrissée.' }],
      }, ...s.alerts] : s.alerts
      return {
        ...s, alerts, workshop: { ...s.workshop, [k]: w }, lots: [lot, ...s.lots],
        queue: s.offline ? [{ id: lot.id, text: `Pétrissée ${lot.id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }
    })
    audit('Pétrissée validée', `${lot.id} : ${num(patons)} pâtons remis au four · ${dec(kg)} kg · ${num(eps)} EPS · ${num(perBag)} EPS/sac`)
    say(state.offline ? `Lot ${lot.id} enregistré hors-ligne : en attente de synchronisation` : `Lot ${lot.id} créé et remis au four`)
    setCreated(lot)
  }

  if (created) return (
    <Screen title="Nouvelle pétrissée" sub={`Atelier boulangerie ${siteName}`}>
      <Card title={`Lot de production ${created.id}`} sub="Historisé de façon non modifiable — visible par l’enfourneur, qui ne peut pas modifier les quantités" actions={<Badge tone="warn">Créé → Remis au four</Badge>}>
        <div className="lot-done"><Check size={40} /><div><b>{num(patonsOf(created.lines))} pâtons</b> confiés à l’enfourneur</div></div>
        <Table head={['Format', 'Pâtons']} rows={created.lines.map(l => [l.label, <b>{num(l.qty)}</b>])} />
        <div className="btn-row">
          <Big onClick={restart}><Plus size={20} /> Nouvelle pétrissée</Big>
          <Big tone="ghost" onClick={() => go('bLots')}>Voir mes lots</Big>
        </div>
      </Card>
    </Screen>
  )

  const live = (
    <div className="live-calc">
      <Kpi label="Poids total de pâte" value={`${dec(kg)} kg`} />
      <Kpi label={`EPS (÷ ${EPS_GRAMS} g)`} value={`${num(eps)} EPS`} />
      <Kpi label="Pâtons" value={num(patons)} />
      <div className="gauge-box"><p>Rendement — référence {num(threshold)} EPS/sac</p><YieldGauge perBag={perBag} threshold={threshold} /></div>
    </div>
  )

  return (
    <Screen title="Nouvelle pétrissée" sub={`Atelier boulangerie ${siteName} — 1 EPS = ${EPS_GRAMS} g de pâte façonnée`}>
      <Steps steps={['Matières consommées', 'Pâtons façonnés', 'Contrôle et validation']} current={step} />

      {step === 0 && <Card title="A — Matières premières consommées" sub="Stock atelier en lecture seule : seules les matières réceptionnées sont disponibles">
        <div className="mat-grid">{MATS.map(m => {
          const avail = stock[m.key]
          const off = avail <= 0
          const q = toNum(mats[m.key].qty)
          return <div key={m.key} className={`mat-tile ${mats[m.key].on && !off ? 'on' : ''} ${off ? 'off' : ''}`}>
            <label className="mat-pick"><input type="checkbox" checked={mats[m.key].on && !off} disabled={off} onChange={e => setMat(m.key, { on: e.target.checked })} /><b>{m.label}</b></label>
            <label className="unit-input big"><input className="num-input" inputMode="decimal" placeholder="0" disabled={off || !mats[m.key].on} value={off ? '' : mats[m.key].qty}
              onChange={e => setMat(m.key, { qty: cleanNum(e.target.value) })} /><span>{m.key === 'farine' ? 'sacs' : 'kg'}</span></label>
            <small className={q > avail ? 'neg' : ''}>{off ? 'Aucune réception confirmée' : `Stock atelier : ${matQty(m.key, avail)}`}{q > avail && !off ? ' — dépassement bloqué' : ''}</small>
          </div>
        })}</div>
        {matError && <Notice tone="warn">{matError} {stock.farine <= 0 && <button className="link-btn" onClick={() => go('bReception')}>Réceptionner les matières</button>}</Notice>}
        <div className="btn-row"><Big disabled={!!matError} onClick={() => setStep(1)}>Suivant <ArrowRight size={20} /></Big></div>
      </Card>}

      {step === 1 && <div className="form-split">
        <Card title="B — Pâtons façonnés par type de pain" sub={`Prévision : pâtons attendus au minimum si toute la pâte de ${dec(bags, 2)} sac(s) était façonnée dans ce format, au seuil de ${num(threshold)} EPS/sac`}>
          <Table head={['Format', 'Grammage', 'Pâtons façonnés', 'Poids de pâte', 'Prévision', '']} rows={rows.map((r, i) => [
            r.extra ? <input className="ref-input" value={r.label} placeholder="Libellé du format" onChange={e => setRow(i, { label: e.target.value })} /> : <b>{r.label}</b>,
            r.extra ? <label className="unit-input"><input className="num-input sm" inputMode="numeric" value={r.grams} onChange={e => setRow(i, { grams: cleanNum(e.target.value, false) })} /><span>g</span></label> : `${r.grams} g`,
            <input className="num-input sm" inputMode="numeric" placeholder="0" value={r.qty} onChange={e => setRow(i, { qty: cleanNum(e.target.value, false) })} />,
            `${dec((toNum(r.qty) * toNum(r.grams)) / 1000)} kg`,
            <span className="muted">{num(forecast(bags, toNum(r.grams), threshold))}</span>,
            r.extra ? <button className="icon-btn" title="Retirer la ligne" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={18} /></button> : '',
          ])} />
          <div className="btn-row"><Big tone="ghost" onClick={() => setRows([...rows, { label: '', grams: '', qty: '', extra: true }])}><Plus size={20} /> Ajouter un format</Big></div>
          {lineError && <Notice tone="warn">{lineError}</Notice>}
          <div className="btn-row">
            <Big tone="ghost" onClick={() => setStep(0)}><ArrowLeft size={20} /> Retour</Big>
            <Big disabled={!!lineError} onClick={() => setStep(2)}>Suivant <ArrowRight size={20} /></Big>
          </div>
        </Card>
        <Card title="C — Calcul en temps réel">{live}</Card>
      </div>}

      {step === 2 && <>
        <Card title="C — Contrôles automatiques avant validation">
          {live}
          {below
            ? <div className="pedago"><Info size={22} /><div>
                <b>Rendement de {num(perBag)} EPS/sac, sous la référence de {num(threshold)} EPS/sac.</b>
                <p>Avec {dec(bags, 2)} sac(s), on attend au moins {dec((bags * threshold * EPS_GRAMS) / 1000)} kg de pâte façonnée ; vous en déclarez {dec(kg)} kg.
                  Vérifiez le nombre de pâtons, leur grammage et le nombre de sacs saisis. Si la saisie est juste, indiquez ce qui s’est passé.</p>
                <textarea className="area" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif (obligatoire) : ex. farine humide, coupure de courant…" />
              </div></div>
            : patons > 0 && <Notice tone="ok">Rendement au moins égal à la référence de {num(threshold)} EPS/sac.</Notice>}
          <div className="forecast">
            <p>Prévision au seuil pour {dec(bags, 2)} sac(s) — pâtons attendus au minimum selon le grammage :</p>
            <div className="format-grid">{FORMATS.map(f => <div key={f.label} className="format-tile"><span>{f.label}</span><b>{num(forecast(bags, f.grams, threshold))}</b></div>)}</div>
          </div>
        </Card>
        <Card title="D — Récapitulatif du lot à créer">
          <div className="recap">
            <Table head={['Matière consommée', 'Quantité']} rows={used.map(m => [matLabel(m.mat), <b>{matQty(m.mat, m.qty)}</b>])} />
            <Table head={['Format', 'Pâtons', 'Poids']} rows={[...lines.map(l => [l.label, <b>{num(l.qty)}</b>, `${dec((l.qty * l.grams) / 1000)} kg`]),
              [<b>Total</b>, <b>{num(patons)}</b>, <b>{dec(kg)} kg</b>]]} />
          </div>
          {motifError && <Notice tone="warn">{motifError}</Notice>}
          {state.offline && <Notice tone="warn">Hors-ligne : le lot sera enregistré sur la tablette puis synchronisé automatiquement au retour du réseau.</Notice>}
          <div className="btn-row">
            <Big tone="ghost" onClick={() => setStep(1)}><ArrowLeft size={20} /> Retour</Big>
            <Big disabled={!!(matError || lineError || motifError)} onClick={validate}><Check size={20} /> Valider et remettre au four</Big>
          </div>
        </Card>
      </>}
    </Screen>
  )
}
