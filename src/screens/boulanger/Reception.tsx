import { useState } from 'react'
import { Check, PackageX, TriangleAlert } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { atelierLabel, BS, fmtQty, matName, sameBon, siteMat, workshopKey, type BonSortie } from '../../data/stock'
import { dec, nowStamp } from '../../lib/format'
import { cleanNum, toNum, TraceInfo, useBaker } from './shared'

type Mode = 'all' | 'short' | 'refuse'
// Libellés côté atelier : « À confirmer » / « Confirmé » (le magasinier voit le cycle complet du bon).
const label = (b: BonSortie) => (b.status === BS.emis ? 'À confirmer' : b.status === BS.refus ? 'Refusé' : 'Confirmé')
const tone = (b: BonSortie) => (b.status === BS.emis ? 'warn' : b.status === BS.refus ? 'danger' : 'ok')

export function BReception() {
  const { state, update, audit, say } = useApp()
  const { user, site, siteName, bons } = useBaker()
  const [sel, setSel] = useState(bons.find(b => b.status === BS.emis)?.id || bons[0]?.id)
  const [mode, setMode] = useState<Mode | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [got, setGot] = useState<Record<number, string>>({})
  const [why, setWhy] = useState<Record<number, string>>({})
  const [refusal, setRefusal] = useState('')
  const b = bons.find(x => x.id === sel)

  const pick = (id: string) => { setSel(id); setMode(null); setConfirming(false); setGot({}); setWhy({}); setRefusal('') }
  const start = (m: Mode) => { setMode(m); setConfirming(m === 'all') }

  if (!b) return <Screen title="Réception des matières"><Notice>Aucun bon de sortie pour votre atelier ({siteName}).</Notice></Screen>

  const received = (i: number) => (mode === 'refuse' ? 0 : mode === 'short' ? Math.min(toNum(got[i] ?? String(b.lines[i].qty).replace('.', ',')), b.lines[i].qty) : b.lines[i].qty)
  const shortLines = mode === 'short' ? b.lines.map((_, i) => i).filter(i => received(i) < b.lines[i].qty) : []
  const shortError = mode === 'short' && (!shortLines.length ? 'Indiquez au moins une quantité manquante.' : shortLines.some(i => !why[i]?.trim()) ? 'Un motif est obligatoire pour chaque quantité manquante.' : '')
  const refuseError = mode === 'refuse' && !refusal.trim() ? 'Le motif du refus est obligatoire.' : ''

  // Seconde validation : la matière confirmée entre dans le stock de l'atelier (le magasin du site a été décrémenté à l'émission).
  const finalize = () => {
    const t = traceFor(user.name, site, state.offline)
    const lines = b.lines.map((l, i) => ({ ...l, received: received(i), motif: mode === 'refuse' ? refusal.trim() : received(i) < l.qty ? why[i].trim() : undefined }))
    const status = mode === 'refuse' ? BS.refus : BS.conf
    update(s => {
      const k = workshopKey(site, b.atelier)
      const w = { ...(s.workshop[k] || {}) }
      lines.forEach(l => { w[l.mp] = +((w[l.mp] || 0) + l.received).toFixed(4) })
      return {
        ...s, workshop: { ...s.workshop, [k]: w },
        bonsSortie: s.bonsSortie.map(x => sameBon(x, b) ? { ...x, lines, status, ecart: lines.some(l => l.received < l.qty), refusal: mode === 'refuse' ? refusal.trim() : undefined, confirm: t, confirmTs: Date.now() } : x),
        queue: s.offline ? [{ id: b.id, text: `${mode === 'refuse' ? 'Refus' : 'Réception'} du bon ${b.id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }
    })
    if (mode === 'refuse') {
      audit('Bon de sortie refusé', `${b.id} refusé par ${atelierLabel(b.atelier)} ${siteName} — motif : ${refusal.trim()}`)
      say(`Bon ${b.id} refusé : le magasinier du site est informé`)
    } else {
      audit('Réception de matières', `${b.id} confirmé par ${atelierLabel(b.atelier)} ${siteName} : ${lines.map(l => `${matName(l.mp)} ${fmtQty(l.mp, l.received)}${l.motif ? ` (attendu ${fmtQty(l.mp, l.qty)}, motif : ${l.motif})` : ''}`).join(' · ')}`)
      say(state.offline ? `Réception ${b.id} enregistrée hors-ligne : en attente de synchronisation` : `Réception ${b.id} confirmée : stock atelier mis à jour`)
    }
    setMode(null); setConfirming(false)
  }

  return (
    <Screen title="Réception des matières" sub={`Bons de sortie du magasin du site vers votre atelier — ${siteName} · double validation`}>
      <div className="split">
        <div className="list-col scroll-list">
          {bons.map(x => <button key={x.id} className={`list-item ${x.id === b.id ? 'on' : ''}`} onClick={() => pick(x.id)}>
            <b>{x.id}</b><small>{x.trace.localAt} · {atelierLabel(x.atelier)}</small><Badge tone={tone(x)}>{label(x)}{x.ecart && x.status !== BS.refus ? ' (écart signalé)' : ''}</Badge>
          </button>)}
        </div>

        <Card title={`Bon de sortie ${b.id}`} sub={`${atelierLabel(b.atelier)} · émis le ${b.trace.localAt} par ${b.by} (magasin du site)`} actions={<Badge tone={tone(b)}>{label(b)}</Badge>}>
          <Table head={b.status === BS.emis ? ['Matière', 'Quantité attendue', ...(mode === 'short' ? ['Quantité reçue', 'Motif du manque'] : [])] : ['Matière', 'Attendue', 'Reçue', 'Motif']}
            rows={b.lines.map((l, i) => b.status === BS.emis
              ? [<b>{matName(l.mp)}</b>, fmtQty(l.mp, l.qty), ...(mode === 'short' ? [
                <label className="unit-input"><input className="num-input sm" inputMode="decimal" value={got[i] ?? String(l.qty).replace('.', ',')} disabled={confirming}
                  onChange={e => setGot({ ...got, [i]: cleanNum(e.target.value) })} /><span>{siteMat(l.mp).unit}</span></label>,
                received(i) < l.qty ? <input className="ref-input wide" value={why[i] || ''} disabled={confirming} placeholder={`Manque ${dec(l.qty - received(i), 2)} — motif`} onChange={e => setWhy({ ...why, [i]: e.target.value })} /> : '—',
              ] : [])]
              : [<b>{matName(l.mp)}</b>, fmtQty(l.mp, l.qty), b.status === BS.refus ? '—' : fmtQty(l.mp, l.received ?? l.qty),
                l.motif && b.status !== BS.refus ? <span className="neg">{l.motif}</span> : '—'])} />

          {b.status === BS.refus && <Notice tone="danger">Bon refusé — motif : {b.refusal}. Aucune matière n’est entrée dans le stock de l’atelier.</Notice>}
          {b.confirm && <TraceInfo t={b.confirm} />}

          {b.status === BS.emis && !mode && <div className="btn-row">
            <Big onClick={() => start('all')}><Check size={20} /> Tout est reçu</Big>
            <Big tone="ghost" onClick={() => start('short')}><TriangleAlert size={20} /> Signaler un manque</Big>
            <Big tone="danger" onClick={() => start('refuse')}><PackageX size={20} /> Refuser le bon</Big>
          </div>}

          {mode === 'refuse' && !confirming && <textarea className="area" value={refusal} onChange={e => setRefusal(e.target.value)} placeholder="Motif du refus (obligatoire)" />}

          {mode && !confirming && <div className="btn-row">
            <Big disabled={!!(shortError || refuseError)} onClick={() => setConfirming(true)}>Continuer</Big>
            <Big tone="ghost" onClick={() => setMode(null)}>Annuler</Big>
          </div>}
          {mode && !confirming && (shortError || refuseError) && <Notice tone="warn">{shortError || refuseError}</Notice>}

          {confirming && <div className="confirm-box">
            <b>Seconde validation</b>
            <p>{mode === 'refuse'
              ? <>Vous refusez le bon {b.id}. Motif : « {refusal.trim()} ». Aucune matière n’entrera dans le stock de l’atelier.</>
              : <>Vous confirmez avoir reçu : {b.lines.map((l, i) => `${matName(l.mp)} ${fmtQty(l.mp, received(i))}`).join(' · ')}.
                Ces quantités entrent dans le stock de l’atelier.</>}</p>
            <div className="btn-row">
              <Big tone={mode === 'refuse' ? 'danger' : undefined} onClick={finalize}><Check size={20} /> {mode === 'refuse' ? 'Confirmer le refus' : 'Je confirme la réception'}</Big>
              <Big tone="ghost" onClick={() => { setConfirming(false); if (mode === 'all') setMode(null) }}>Retour</Big>
            </div>
          </div>}
        </Card>
      </div>
      <Notice>Seules les matières confirmées comme reçues alimentent le stock de l’atelier et peuvent être déclarées consommées.</Notice>
    </Screen>
  )
}
