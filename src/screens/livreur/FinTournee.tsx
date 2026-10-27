import { useState } from 'react'
import { Camera, Check, Flag, Send } from 'lucide-react'
import { useApp } from '../../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { nextAlertId } from '../../data/boulanger'
import { product, productName } from '../../data/shop'
import { LOSS_MOTIFS_T, RETURN_MOTIFS, type Proof } from '../../data/tour'
import { money, nowStamp, num } from '../../lib/format'
import { readPhoto } from '../../lib/photo'
import { driverTrace, TourBadge, useTour } from './shared'

export function LClose() {
  const { state, update, audit, say } = useApp()
  const { user, site, current: t, fig, remitStatus } = useTour()
  const [ret, setRet] = useState<Record<string, { qty: string; motif: string }>>({})
  const [loss, setLoss] = useState<{ code: string; qty: string; motif: string; photo?: Proof }>({ code: '', qty: '', motif: '' })
  const [remit, setRemit] = useState({ cash: '', momo: '' })
  const [comment, setComment] = useState('')
  if (!t) return <Screen title="Fin de tournée"><Notice>Aucune tournée.</Notice></Screen>
  const f = fig(t)
  const open = t.status === 'En cours'
  const tr = () => driverTrace(user.name, site, state.offline)
  const set = (patch: Partial<typeof t>, log: string) => {
    update(s => ({ ...s, tours: s.tours.map(x => x.id === t.id && x.site === site ? { ...x, ...patch } : x), queue: s.offline ? [{ id: t.id, text: log, at: nowStamp() }, ...s.queue] : s.queue }))
    audit('Fin de tournée', `${t.id} : ${log}`)
  }

  const saveReturns = (none = false) => {
    const lines = Object.entries(ret).filter(([, r]) => Number(r.qty) > 0)
    if (!none && !lines.length) return say('Saisissez les quantités retournées, ou déclarez « Aucun retour ».')
    if (lines.some(([, r]) => !r.motif)) return say('Le motif est obligatoire pour chaque retour.')
    if (lines.some(([code, r]) => Number(r.qty) > (f.rows.find(x => x.code === code)?.remaining || 0))) return say('Retour supérieur au chargement restant.')
    set(none ? { noReturns: true } : { returns: [...t.returns, ...lines.map(([code, r]) => ({ code, qty: Number(r.qty), motif: r.motif, trace: tr() }))] },
      none ? 'aucun retour' : `retours ${lines.map(([c, r]) => `${r.qty} ${productName(c)} (${r.motif})`).join(', ')}`)
    setRet({}); say(none ? 'Aucun retour déclaré' : 'Retours déclarés')
  }
  const lossValue = loss.code ? Number(loss.qty) * product(loss.code).retail : 0
  const needPhoto = lossValue >= state.lossPhotoThreshold
  const saveLoss = () => {
    const q = Number(loss.qty)
    if (!loss.code || !q || !loss.motif) return say('Produit, quantité et motif sont obligatoires.')
    if (q > (f.rows.find(x => x.code === loss.code)?.remaining || 0)) return say('Perte supérieure au chargement restant.')
    if (needPhoto && !loss.photo) return say('Photo obligatoire pour cette perte (au-delà du seuil fixé par la direction).')
    set({ losses: [...t.losses, { code: loss.code, qty: q, motif: loss.motif, photo: loss.photo, trace: tr() }] }, `perte ${q} ${productName(loss.code)} (${loss.motif})`)
    setLoss({ code: '', qty: '', motif: '' }); say('Perte déclarée')
  }

  // Bordereau de versement : transmis au bureau central, qui confirme à réception des fonds.
  const saveRemit = () => {
    if (remit.cash === '' || remit.momo === '') return say('Saisissez les montants remis en espèces et en Mobile Money (0 si aucun).')
    const r = { id: `BV-L-S${site.slice(-1)}-${t.id.split('-')[2]}`, cash: Number(remit.cash), momo: Number(remit.momo), trace: tr(), status: 'Transmis au bureau central' as const }
    update(s => ({
      ...s, tours: s.tours.map(x => x.id === t.id && x.site === site ? { ...x, remit: r } : x),
      versements: [{ id: r.id, site, amount: r.cash + r.momo, by: user.name, status: 'Déclaré par le livreur', flow: ['Déclaré par le livreur', 'Reçu au bureau central'], cash: r.cash, momo: r.momo, tourId: t.id }, ...s.versements],
      queue: s.offline ? [{ id: r.id, text: `Versement ${r.id}`, at: nowStamp() }, ...s.queue] : s.queue,
    }))
    audit('Versement de fin de tournée', `${r.id} : espèces ${money(r.cash)} · Mobile Money ${money(r.momo)}`)
    say(`Bordereau ${r.id} transmis au bureau central`)
  }

  const close = () => {
    if (!f.complete) return say('Déclarez les retours / pertes et le versement avant de clôturer.')
    const ok = f.qtyOk && f.cashOk
    const status = ok ? 'Soldée' as const : 'Soldée avec écart' as const
    const at = nowStamp()
    const qtyGap = f.rows.filter(r => r.remaining !== 0).map(r => `${productName(r.code)} : chargé ${r.loaded} ≠ livré ${r.delivered} + retourné ${r.returned} + pertes ${r.lost}`)
    const cashGap = !f.cashOk ? [`encaissé ${money(f.cash)} espèces / ${money(f.momo)} Mobile Money ≠ remis ${money(t.remit!.cash)} / ${money(t.remit!.momo)}`] : []
    update(s => ({
      ...s,
      tours: s.tours.map(x => x.id === t.id && x.site === site ? { ...x, status, close: tr(), comment: comment.trim() ? { at, text: comment.trim() } : x.comment } : x),
      bdls: s.bdls.map(x => x.id === t.bdl && x.toSite === site && x.kind === 'tournee' ? { ...x, status: 'Tournée soldée' } : x),
      // Alerte confidentielle : visible uniquement de la direction et du contrôleur central.
      alerts: ok ? s.alerts : [{ id: nextAlertId(s.alerts), type: 'Écart de tournée', severity: 'Moyenne' as const, value: null, status: 'Nouvelle' as const,
        detail: `${t.id} (${t.bdl}) : ${[...qtyGap, ...cashGap].join(' ; ')}`, people: `${user.name} (livreur)`,
        history: [{ at, by: 'Système', text: `Alerte générée à la clôture « Soldée avec écart »${comment.trim() ? ` — remarque du livreur : ${comment.trim()}` : ''}.` }] }, ...s.alerts],
      queue: s.offline ? [{ id: t.id, text: `Clôture ${t.id}`, at: nowStamp() }, ...s.queue] : s.queue,
    }))
    audit('Clôture de tournée', `${t.id} : ${status}`)
    say(`Tournée ${status.toLowerCase()}`)
  }

  return (
    <Screen title="Fin de tournée" sub={`${t.id} — retours, pertes, versement et équilibrage`}>
      <Card title="Contrôle : chargé = livré + retourné + pertes" actions={<Badge tone={f.qtyOk ? 'ok' : 'warn'}>{f.qtyOk ? 'Équilibré' : 'Écart à régulariser'}</Badge>}>
        <Table head={['Produit', 'Chargé', 'Livré / vendu', 'Retourné', 'Pertes', 'Équation']} rows={f.rows.map(r => [productName(r.code), num(r.loaded), num(r.delivered), num(r.returned), num(r.lost),
          <b className={r.remaining ? 'neg' : 'ok-text'}>{r.loaded} {r.remaining ? '≠' : '='} {r.delivered} + {r.returned} + {r.lost}</b>])} />
      </Card>

      {open && <>
        <Card title="Retours au magasin" sub="Produits et quantités ramenés, avec motif">
          {f.rows.map(r => <div key={r.code} className="btn-row">
            <span className="grow"><b>{productName(r.code)}</b> <small className="muted">restant {r.remaining}</small></span>
            <input className="num-input sm" inputMode="numeric" placeholder="0" value={ret[r.code]?.qty || ''} onChange={e => setRet({ ...ret, [r.code]: { motif: ret[r.code]?.motif || 'Invendu', qty: e.target.value.replace(/\D/g, '') } })} />
            <select className="ref-input" value={ret[r.code]?.motif || 'Invendu'} onChange={e => setRet({ ...ret, [r.code]: { qty: ret[r.code]?.qty || '', motif: e.target.value } })}>{RETURN_MOTIFS.map(m => <option key={m}>{m}</option>)}</select>
          </div>)}
          <div className="btn-row"><Big onClick={() => saveReturns()}>Déclarer les retours</Big><Big tone="ghost" onClick={() => saveReturns(true)}>Aucun retour</Big></div>
          {t.returns.length > 0 && <Table head={['Produit', 'Quantité', 'Motif', 'Heure']} rows={t.returns.map(r => [productName(r.code), num(r.qty), r.motif, r.trace.localAt.slice(11)])} />}
        </Card>

        <Card title="Pertes" sub="Motif obligatoire — photo au-delà du seuil fixé par la direction">
          <div className="btn-row">
            <select className="ref-input" value={loss.code} onChange={e => setLoss({ ...loss, code: e.target.value })}><option value="">Produit…</option>{f.rows.map(r => <option key={r.code} value={r.code}>{productName(r.code)}</option>)}</select>
            <input className="num-input sm" inputMode="numeric" placeholder="Qté" value={loss.qty} onChange={e => setLoss({ ...loss, qty: e.target.value.replace(/\D/g, '') })} />
            <select className="ref-input" value={loss.motif} onChange={e => setLoss({ ...loss, motif: e.target.value })}><option value="">Motif…</option>{LOSS_MOTIFS_T.map(m => <option key={m}>{m}</option>)}</select>
            <label className={`big-btn ghost file-btn sm ${needPhoto && !loss.photo ? 'required' : ''}`}><Camera size={16} /> {loss.photo ? 'Photo jointe' : needPhoto ? 'Photo obligatoire' : 'Photo'}
              <input type="file" accept="image/*" capture="environment" onChange={async e => { const file = e.target.files?.[0]; if (file) setLoss({ ...loss, photo: { kind: 'Photo', name: file.name, thumb: await readPhoto(file) } }); e.target.value = '' }} /></label>
          </div>
          <Big tone="ghost" onClick={saveLoss}>Déclarer la perte</Big>
          {t.losses.length > 0 && <Table head={['Produit', 'Quantité', 'Motif', 'Photo']} rows={t.losses.map(l => [productName(l.code), num(l.qty), l.motif, l.photo ? 'Jointe' : '—'])} />}
        </Card>
      </>}

      <Card title="Encaissements : attendu = remis au bureau central" actions={t.remit ? <Badge tone={f.cashOk ? 'ok' : 'warn'}>{f.cashOk ? 'Équilibré' : 'Écart à régulariser'}</Badge> : <Badge tone="neutral">Versement à déclarer</Badge>}>
        <Table head={['', 'Espèces', 'Mobile Money']} rows={[['Encaissé attendu', <b>{money(f.cash)}</b>, <b>{money(f.momo)}</b>],
          ...(t.remit ? [['Remis (déclaré)', money(t.remit.cash), money(t.remit.momo)]] : [])]} />
        {open && !t.remit && <>
          <div className="btn-row">
            <label className="field">Remis en espèces (FCFA)<input className="num-input" inputMode="numeric" value={remit.cash} onChange={e => setRemit({ ...remit, cash: e.target.value.replace(/\D/g, '') })} /></label>
            <label className="field">Remis en Mobile Money (FCFA)<input className="num-input" inputMode="numeric" value={remit.momo} onChange={e => setRemit({ ...remit, momo: e.target.value.replace(/\D/g, '') })} /></label>
          </div>
          <Big onClick={saveRemit}><Send size={18} /> Générer le bordereau de versement</Big>
        </>}
        {t.remit && <Notice tone="ok">Bordereau {t.remit.id} — {remitStatus(t)}.</Notice>}
      </Card>

      {open ? <Card title="Clôture de la tournée" sub="Possible quand les deux équations sont complétées (retours / pertes et versement déclarés)">
        {(!f.qtyOk || (t.remit && !f.cashOk)) && <textarea className="area" value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire explicatif sur l’écart (facultatif)" />}
        <Big disabled={!f.complete} onClick={close}><Flag size={20} /> Clôturer ma tournée</Big>
      </Card> : <Card title="Tournée clôturée" actions={<TourBadge s={t.status} />}>
        {t.comment && <p><b>Votre remarque :</b> {t.comment.text} <small className="muted">({t.comment.at})</small></p>}
        {t.status === 'Soldée' && <Notice tone="ok"><Check size={14} /> Tournée soldée : les deux équations sont équilibrées.</Notice>}
      </Card>}
    </Screen>
  )
}
