import { useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, Flame, Hand, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/context'
import { useNav, useNavArg } from '../../store/nav'
import { Badge, Big, Card, Notice, Screen, Steps, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { figures, nextAlertId, REJECT_REASONS, type CuissonReport, type RejectLine, type RejectPhoto, type RejectReason } from '../../data/boulanger'
import { dec, nowStamp, num } from '../../lib/format'
import { readPhoto } from '../../lib/photo'
import { cleanNum, toNum } from '../boulanger/shared'
import { useTakeCharge } from './Lots'
import { formatsOf, handedAt, LotBadge, RateGauge, rateTone, useOven } from './shared'

type Rej = { format: string; reason: RejectReason | ''; qty: string; note: string; image?: RejectPhoto }

export function ECuisson() {
  const { state, update, audit, say } = useApp()
  const go = useNav()
  const arg = useNavArg()
  const { user, site, queue, threshold, photoQty } = useOven()
  const take = useTakeCharge()
  const [sel, setSel] = useState<string | undefined>(queue.some(l => l.id === arg) ? arg : queue[0]?.id)
  const [step, setStep] = useState(arg === 'rebuts' ? 1 : 0)
  const [good, setGood] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Rej[]>([])
  const [motif, setMotif] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const lot = queue.find(l => l.id === sel)

  if (done) return (
    <Screen title="Saisie de cuisson">
      <Card title={`Cuisson du lot ${done} validée`} sub="Rapport de cuisson publié pour le boulanger et la direction — historisé de façon non modifiable" actions={<Badge tone="ok">Cuit → Mis en stock</Badge>}>
        <Notice tone="ok">Les pains conformes sont transférés au stock de produits finis pour la distribution ; les rebuts sont enregistrés avec leurs motifs et photos.</Notice>
        <div className="btn-row"><Big onClick={() => { setDone(null); setSel(queue.find(l => l.id !== done)?.id); setStep(0); setGood({}); setRows([]); setMotif('') }}><Flame size={20} /> Lot suivant</Big>
          <Big tone="ghost" onClick={() => go('eMine')}>Voir mes cuissons</Big></div>
      </Card>
    </Screen>
  )
  if (!lot) return <Screen title="Saisie de cuisson"><Notice tone="ok">Aucun lot remis au four en attente de cuisson.</Notice></Screen>

  const formats = formatsOf(lot)
  const received = figures(lot).patons
  const goodTotal = formats.reduce((a, f) => a + toNum(good[f.label] || ''), 0)
  const rejLines = rows.filter(r => toNum(r.qty) > 0)
  const rejTotal = rejLines.reduce((a, r) => a + toNum(r.qty), 0)
  const balance = received - goodTotal - rejTotal
  const rate = received ? (rejTotal / received) * 100 : 0
  const over = rate > threshold
  const rowError = rejLines.find(r => !r.reason) ? 'Chaque rebut doit porter un motif.'
    : rejLines.find(r => r.reason === 'Autre' && !r.note.trim()) ? 'Précisez le motif « Autre ».'
    : rejLines.find(r => toNum(r.qty) >= photoQty && !r.image) ? `Photo obligatoire pour une ligne de ${photoQty} rebuts ou plus (seuil fixé par la direction).` : ''
  const error = balance !== 0 ? `Validation bloquée : ${num(Math.abs(balance))} pain(s) ${balance > 0 ? 'restent à justifier (en conformes ou en rebuts motivés)' : 'de trop par rapport aux pâtons reçus'}.`
    : rowError || (over && !motif.trim() ? `Taux de rebuts supérieur au seuil de ${dec(threshold, 1)} % : motif complémentaire obligatoire.` : '')
  const setRow = (i: number, v: Partial<Rej>) => setRows(rows.map((r, k) => k === i ? { ...r, ...v } : r))
  const perFormat = (label: string) => toNum(good[label] || '') + rejLines.filter(r => r.format === label).reduce((a, r) => a + toNum(r.qty), 0)

  // Validation : rapport de cuisson, statut « Cuit » puis transfert des conformes au stock de produits finis.
  const validate = () => {
    if (error) return say(error)
    const t = traceFor(user.name, site, state.offline), at = nowStamp()
    const report: CuissonReport = {
      by: user.name, at, received, good: goodTotal, trace: t, rateMotif: over ? motif.trim() : undefined,
      goodBy: Object.fromEntries(formats.map(f => [f.label, toNum(good[f.label] || '')])),
      rejects: rejLines.map<RejectLine>(r => ({ format: r.format, reason: r.reason as RejectReason, qty: toNum(r.qty), note: r.note.trim() || undefined, photo: !!r.image, image: r.image })),
    }
    update(s => ({
      ...s,
      lots: s.lots.map(x => x.id === lot.id && x.site === lot.site ? { ...x, cuisson: report, status: 'Mis en stock',
        oven: x.oven || { by: user.name, trace: t, ts: Date.now() },
        history: [...x.history, { status: 'Cuit', at, by: user.name }, { status: 'Mis en stock', at, by: 'Système' }] } : x),
      // Alerte confidentielle : visible uniquement de la direction et du contrôleur central.
      alerts: over ? [{ id: nextAlertId(s.alerts), type: 'Rebut excessif en cuisson', severity: 'Moyenne' as const, value: null, status: 'Nouvelle' as const,
        detail: `${lot.id} (${site}) : ${rejTotal} rebuts sur ${received} pâtons, soit ${dec(rate, 2)} % (seuil ${dec(threshold, 1)} %) — motif de l’enfourneur : ${motif.trim()}`,
        people: `${user.name} (enfourneur)`, history: [{ at, by: 'Système', text: 'Alerte générée à la validation de la cuisson.' }] }, ...s.alerts] : s.alerts,
      queue: s.offline ? [{ id: lot.id, text: `Cuisson ${lot.id}`, at }, ...s.queue] : s.queue,
    }))
    audit('Cuisson validée', `${lot.id} : ${goodTotal} conformes + ${rejTotal} rebuts = ${received} pâtons (${dec(rate, 2)} %)`)
    say(state.offline ? `Cuisson ${lot.id} enregistrée hors-ligne : en attente de synchronisation` : `Lot ${lot.id} cuit : ${num(goodTotal)} pains mis en stock`)
    setDone(lot.id)
  }

  const equality = (
    <div className={`equality ${balance === 0 ? 'ok' : 'danger'}`}>
      <span>{num(received)}</span><i>−</i><span>{num(goodTotal)}</span><i>−</i><span>{num(rejTotal)}</span><i>=</i><span>{num(balance)}</span>
      <b>{balance === 0 ? '✓ Solde nul : égalité respectée' : `Solde de ${num(Math.abs(balance))} à justifier`}</b>
      <small>pâtons reçus − pains conformes − rebuts = solde restant</small>
    </div>
  )

  return (
    <Screen title="Saisie de cuisson et déclaration des rebuts" sub="Pâtons reçus = pains conformes + rebuts — les pâtons du boulanger ne sont pas modifiables">
      {queue.length > 1 && <div className="filter-row">{queue.map(l => <button key={l.id} className={l === lot ? 'chip on' : 'chip'} onClick={() => { setSel(l.id); setGood({}); setRows([]); setMotif(''); setStep(0) }}>{l.id}</button>)}</div>}
      <Card title={`Lot ${lot.id}`} sub={`Remis au four le ${handedAt(lot)} par ${lot.trace.author} · ${num(received)} pâtons`} actions={<LotBadge s={lot.status} />}>
        {lot.status === 'Remis au four'
          ? <><Notice tone="warn">Prenez d’abord le lot en charge : il passera « En cours de cuisson » sous votre responsabilité.</Notice>
            <Big onClick={() => take(lot)}><Hand size={20} /> Prendre en charge et commencer</Big></>
          : <>{equality}<Steps steps={['Pains conformes', 'Rebuts', 'Contrôle et validation']} current={step} /></>}
      </Card>

      {lot.status === 'En cours de cuisson' && step === 0 && <Card title="A — Pains conformes sortis du four" sub="Un champ par format, repris automatiquement du lot">
        <Table head={['Format', 'Pâtons reçus', 'Pains conformes', 'Solde du format']} rows={formats.map(f => [<b>{f.label}</b>, num(f.qty),
          <input className="num-input sm" inputMode="numeric" placeholder="0" value={good[f.label] || ''} onChange={e => setGood({ ...good, [f.label]: cleanNum(e.target.value, false) })} />,
          <span className={f.qty - perFormat(f.label) ? 'neg' : 'ok-text'}>{num(f.qty - perFormat(f.label))}</span>])} />
        <div className="btn-row"><Big onClick={() => setStep(1)}>Suivant : rebuts <ArrowRight size={20} /></Big></div>
      </Card>}

      {lot.status === 'En cours de cuisson' && step === 1 && <Card title="B — Déclaration détaillée des rebuts" sub={`Motif obligatoire ; photo exigée à partir de ${photoQty} rebuts sur une ligne`}>
        <Table head={['Format', 'Motif', 'Précision', 'Quantité', 'Photo', '']} rows={rows.map((r, i) => {
          const need = toNum(r.qty) >= photoQty
          return [
            <select className="ref-input" value={r.format} onChange={e => setRow(i, { format: e.target.value })}>{formats.map(f => <option key={f.label}>{f.label}</option>)}</select>,
            <div className="pay-modes">{REJECT_REASONS.map(m => <button key={m} className={`chip ${r.reason === m ? 'on' : ''}`} onClick={() => setRow(i, { reason: m })}>{m}</button>)}</div>,
            r.reason === 'Autre' ? <input className="ref-input" value={r.note} placeholder="Motif (obligatoire)" onChange={e => setRow(i, { note: e.target.value })} /> : '—',
            <input className="num-input sm" inputMode="numeric" placeholder="0" value={r.qty} onChange={e => setRow(i, { qty: cleanNum(e.target.value, false) })} />,
            r.image ? <span className="photo-cell"><img src={r.image.thumb} alt={r.image.name} /><button className="link-btn" onClick={() => setRow(i, { image: undefined })}>Retirer</button></span>
              : <label className={`big-btn ghost file-btn sm ${need ? 'required' : ''}`}><Camera size={16} /> {need ? 'Photo obligatoire' : 'Photo'}
                <input type="file" accept="image/*" capture="environment" onChange={async e => { const f = e.target.files?.[0]; if (f) setRow(i, { image: { name: f.name, thumb: await readPhoto(f) } }); e.target.value = '' }} /></label>,
            <button className="icon-btn" title="Retirer la ligne" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={18} /></button>,
          ]
        })} />
        <div className="btn-row"><Big tone="ghost" onClick={() => setRows([...rows, { format: formats[0].label, reason: '', qty: '', note: '' }])}><Plus size={20} /> Ajouter une ligne de rebuts</Big></div>
        {rejLines.length > 0 && <Table head={['Total par motif', ...REJECT_REASONS]} rows={[
          ...formats.filter(f => rejLines.some(r => r.format === f.label)).map(f => [f.label, ...REJECT_REASONS.map(m => num(rejLines.filter(r => r.format === f.label && r.reason === m).reduce((a, r) => a + toNum(r.qty), 0)))]),
          [<b>Total</b>, ...REJECT_REASONS.map(m => <b>{num(rejLines.filter(r => r.reason === m).reduce((a, r) => a + toNum(r.qty), 0))}</b>)],
        ]} />}
        {rowError && <Notice tone="warn">{rowError}</Notice>}
        <div className="btn-row">
          <Big tone="ghost" onClick={() => setStep(0)}><ArrowLeft size={20} /> Conformes</Big>
          <Big onClick={() => setStep(2)}>Suivant : contrôle <ArrowRight size={20} /></Big>
        </div>
      </Card>}

      {lot.status === 'En cours de cuisson' && step === 2 && <Card title="C — Contrôle et validation">
        <div className="gauge-box"><p>Taux de rebuts du lot (rebuts ÷ pâtons reçus)</p><RateGauge rate={rate} threshold={threshold} /></div>
        {over && <div className="pedago"><div>
          <b>Taux de rebuts de {dec(rate, 2)} %, au-dessus du seuil acceptable de {dec(threshold, 1)} %.</b>
          <p>Vérifiez vos comptages ; si la saisie est juste, indiquez la cause (réglage du four, pâte, manipulation…).</p>
          <textarea className="area" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif complémentaire (obligatoire)" />
        </div></div>}
        {!over && rejTotal >= 0 && balance === 0 && <Notice tone={rateTone(rate, threshold) === 'ok' ? 'ok' : 'warn'}>Taux de rebuts sous le seuil : aucun avertissement.</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        {state.offline && <Notice tone="warn">Hors-ligne : la cuisson sera enregistrée sur la tablette puis synchronisée automatiquement.</Notice>}
        <div className="btn-row">
          <Big tone="ghost" onClick={() => setStep(1)}><ArrowLeft size={20} /> Rebuts</Big>
          <Big disabled={!!error} onClick={validate}><Check size={20} /> Valider la cuisson</Big>
        </div>
      </Card>}
    </Screen>
  )
}
