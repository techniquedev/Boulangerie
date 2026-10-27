import { useState } from 'react'
import { Check, PackageX, TriangleAlert } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { emptyStock, MATS, matLabel, matQty, traceFor, type BonSortie } from '../../data/boulanger'
import { dec, nowStamp } from '../../lib/format'
import { cleanNum, toNum, TraceInfo, useBaker } from './shared'

type Mode = 'all' | 'short' | 'refuse'
const statusTone = (b: BonSortie) => (b.status === 'À confirmer' ? 'warn' : b.status === 'Refusé' ? 'danger' : 'ok')

export function BReception() {
  const { state, update, audit, say } = useApp()
  const { user, site, siteName, bons } = useBaker()
  const [sel, setSel] = useState(bons.find(b => b.status === 'À confirmer')?.id || bons[0]?.id)
  const [mode, setMode] = useState<Mode | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [got, setGot] = useState<Record<number, string>>({})
  const [why, setWhy] = useState<Record<number, string>>({})
  const [refusal, setRefusal] = useState('')
  const b = bons.find(x => x.id === sel)

  const pick = (id: string) => { setSel(id); setMode(null); setConfirming(false); setGot({}); setWhy({}); setRefusal('') }
  const start = (m: Mode) => { setMode(m); setConfirming(m === 'all') }

  if (!b) return <Screen title="Réception des matières"><Notice>Aucun bon de sortie pour l’atelier {siteName}.</Notice></Screen>

  const received = (i: number) => (mode === 'short' ? Math.min(toNum(got[i] ?? String(b.lines[i].qty).replace('.', ',')), b.lines[i].qty) : b.lines[i].qty)
  const shortLines = mode === 'short' ? b.lines.map((l, i) => i).filter(i => received(i) < b.lines[i].qty) : []
  const shortError = mode === 'short' && (!shortLines.length ? 'Indiquez au moins une quantité manquante.' : shortLines.some(i => !why[i]?.trim()) ? 'Un motif est obligatoire pour chaque quantité manquante.' : '')
  const refuseError = mode === 'refuse' && !refusal.trim() ? 'Le motif du refus est obligatoire.' : ''

  const finalize = () => {
    const t = traceFor(user.name, site, state.offline)
    const ts = Date.now()
    if (mode === 'refuse') {
      update(s => ({
        ...s, bonsSortie: s.bonsSortie.map(x => x.id === b.id ? { ...x, status: 'Refusé', refusal: refusal.trim(), confirm: t, confirmTs: ts } : x),
        queue: s.offline ? [{ id: b.id, text: `Refus du bon ${b.id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }))
      audit('Bon de sortie refusé', `${b.id} refusé par l’atelier ${siteName} — motif : ${refusal.trim()}`)
      say(`Bon ${b.id} refusé : aucun mouvement de stock`)
    } else {
      const lines = b.lines.map((l, i) => ({ ...l, received: received(i), motif: received(i) < l.qty ? why[i].trim() : undefined }))
      update(s => {
        const matStock = { ...s.matStock }
        const atelier = { ...(s.atelier[site] ?? emptyStock()) }
        lines.forEach(l => {
          const m = MATS.find(x => x.key === l.mat)!
          matStock[m.mp] = (matStock[m.mp] ?? 0) - l.received / m.perCentral   // magasin central décrémenté
          atelier[l.mat] += l.received                                          // atelier boulangerie incrémenté
        })
        return {
          ...s, matStock, atelier: { ...s.atelier, [site]: atelier },
          bonsSortie: s.bonsSortie.map(x => x.id === b.id ? { ...x, lines, status: 'Confirmé', ecart: mode === 'short', confirm: t, confirmTs: ts } : x),
          queue: s.offline ? [{ id: b.id, text: `Réception du bon ${b.id}`, at: nowStamp() }, ...s.queue] : s.queue,
        }
      })
      audit('Réception de matières', `${b.id} confirmé par l’atelier ${siteName} : ${lines.map(l => `${matLabel(l.mat)} ${matQty(l.mat, l.received)}${l.motif ? ` (attendu ${matQty(l.mat, l.qty)}, motif : ${l.motif})` : ''}`).join(' · ')}`)
      say(state.offline ? `Réception ${b.id} enregistrée hors-ligne : en attente de synchronisation` : `Réception ${b.id} confirmée : stock atelier mis à jour`)
    }
    setMode(null); setConfirming(false)
  }

  return (
    <Screen title="Réception des matières" sub={`Bons de sortie du magasin central vers l’atelier boulangerie ${siteName} — US-20, double validation`}>
      <div className="split">
        <div className="list-col">
          {bons.map(x => <button key={x.id} className={`list-item ${x.id === b.id ? 'on' : ''}`} onClick={() => pick(x.id)}>
            <b>{x.id}</b><small>{x.issuedAt}</small><Badge tone={statusTone(x)}>{x.status}{x.ecart ? ' (écart signalé)' : ''}</Badge>
          </button>)}
        </div>

        <Card title={`Bon de sortie ${b.id}`} sub={`Émis le ${b.issuedAt} par ${b.by} (magasin central)`} actions={<Badge tone={statusTone(b)}>{b.status}</Badge>}>
          <Table head={b.status === 'À confirmer' ? ['Matière', 'Quantité attendue', ...(mode === 'short' ? ['Quantité reçue', 'Motif du manque'] : [])] : ['Matière', 'Attendue', 'Reçue', 'Motif']}
            rows={b.lines.map((l, i) => b.status === 'À confirmer'
              ? [<b>{matLabel(l.mat)}</b>, matQty(l.mat, l.qty), ...(mode === 'short' ? [
                <label className="unit-input"><input className="num-input sm" inputMode="decimal" value={got[i] ?? String(l.qty).replace('.', ',')} disabled={confirming}
                  onChange={e => setGot({ ...got, [i]: cleanNum(e.target.value) })} /><span>{l.mat === 'farine' ? 'sacs' : 'kg'}</span></label>,
                received(i) < l.qty ? <input className="ref-input wide" value={why[i] || ''} disabled={confirming} placeholder={`Manque ${dec(l.qty - received(i), 2)} — motif`} onChange={e => setWhy({ ...why, [i]: e.target.value })} /> : '—',
              ] : [])]
              : [<b>{matLabel(l.mat)}</b>, matQty(l.mat, l.qty), b.status === 'Refusé' ? '—' : matQty(l.mat, l.received ?? l.qty),
                l.motif ? <span className="neg">{l.motif}</span> : '—'])} />

          {b.status === 'Refusé' && <Notice tone="danger">Bon refusé — motif : {b.refusal}. Aucun mouvement de stock.</Notice>}
          {b.confirm && <TraceInfo t={b.confirm} />}

          {b.status === 'À confirmer' && !mode && <div className="btn-row">
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
              ? <>Vous refusez le bon {b.id}. Motif : « {refusal.trim()} ». Aucune matière n’entrera dans le stock atelier.</>
              : <>Vous confirmez avoir reçu : {b.lines.map((l, i) => `${matLabel(l.mat)} ${matQty(l.mat, received(i))}`).join(' · ')}.
                Le stock du magasin central sera décrémenté et le stock de l’atelier incrémenté.</>}</p>
            <div className="btn-row">
              <Big tone={mode === 'refuse' ? 'danger' : undefined} onClick={finalize}><Check size={20} /> {mode === 'refuse' ? 'Confirmer le refus' : 'Je confirme la réception'}</Big>
              <Big tone="ghost" onClick={() => { setConfirming(false); if (mode === 'all') setMode(null) }}>Retour</Big>
            </div>
          </div>}
        </Card>
      </div>
      <Notice>Seules les matières confirmées comme reçues alimentent le stock atelier et peuvent être déclarées consommées dans une pétrissée.</Notice>
    </Screen>
  )
}
