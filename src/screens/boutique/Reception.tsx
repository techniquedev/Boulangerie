import { useState } from 'react'
import { Camera, Check, EyeOff, PackageOpen } from 'lucide-react'
import { useApp } from '../../store/context'
import { useNav } from '../../store/nav'
import { Badge, Big, Card, Notice, Screen, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { nextAlertId } from '../../data/boulanger'
import { BDL_ST, nextShopMoveId, product, type ShopMove } from '../../data/shop'
import type { BdlPhoto } from '../../data/types'
import { nowStamp, num, stampAt } from '../../lib/format'
import { readPhoto } from '../../lib/photo'
import { BdlBadge, countedTotal, useShop } from './shared'

// Réception à l'aveugle : seule la liste des articles attendus est affichée, jamais les quantités expédiées.
export function SReception() {
  const { state, update, audit, say } = useApp()
  const go = useNav()
  const { user, site, shop, bdls } = useShop()
  const open = bdls.filter(b => b.status === BDL_ST.transit || b.status === BDL_ST.partial)
  const [sel, setSel] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [remark, setRemark] = useState('')
  const [photos, setPhotos] = useState<BdlPhoto[]>([])
  const [partial, setPartial] = useState(false)
  const [result, setResult] = useState<{ id: string; status: string } | null>(null)
  const b = open.find(x => x.id === sel)

  const start = (id: string) => { setSel(id); setCounts({}); setRemark(''); setPhotos([]); setPartial(false); setResult(null) }
  const missing = b ? b.lines.filter((_, i) => counts[i] === undefined || counts[i] === '').length : 0

  const addPhoto = async (files: FileList | null) => {
    if (!files?.length) return
    setPhotos([...photos, ...await Promise.all([...files].map(async f => ({ kind: 'Livraison', name: f.name, thumb: await readPhoto(f) })))])
  }

  // Validation : intégration des quantités comptées au stock vendant, puis rapprochement automatique (sauf réception partielle).
  const validate = () => {
    if (!b) return
    if (missing) return say('Comptez chaque article : aucune validation possible tant qu’une ligne est vide.')
    const ts = Date.now(), t = traceFor(user.name, site, state.offline)
    const c = b.lines.map((_, i) => Number(counts[i]) || 0)
    const pass = { ts, trace: t, counts: c, partial, remark: remark.trim() || undefined, photos }
    const passes = [...(b.counts || []), pass]
    const totals = b.lines.map((_, i) => passes.reduce((s, p) => s + (p.counts[i] || 0), 0))
    const tol = (code?: string) => (code ? state.bdlTolerance[code] ?? 0 : 0)
    const gaps = b.lines.map((l, i) => ({ l, diff: totals[i] - l.sent })).filter(g => Math.abs(g.diff) > tol(g.l.code))
    const status = partial ? BDL_ST.partial : gaps.length ? BDL_ST.gap : BDL_ST.ok
    update(s => {
      const moves: ShopMove[] = b.lines.flatMap((l, i) => c[i] > 0 ? [{ id: '', site, code: l.code!, lot: l.lot || '', dlc: l.dlc, qty: c[i], kind: 'Réception BDL' as const, ref: b.id, ts, trace: t }] : [])
        .map((m, i) => ({ ...m, id: nextShopMoveId(s.shopMoves, site, i) }))
      // Alerte confidentielle (direction et contrôleur central uniquement).
      const alerts = status === BDL_ST.gap ? [{
        id: nextAlertId(s.alerts), type: 'Écart BDL', severity: 'Haute' as const,
        value: gaps.reduce((v, g) => v + Math.abs(g.diff) * product(g.l.code!).retail, 0),
        detail: `${b.id} (${shop}) : ${gaps.map(g => `${g.l.label} compté ${num(g.l.sent + g.diff)} pour ${num(g.l.sent)} expédié(s)`).join(' ; ')}`,
        people: `${b.by || 'Magasin du site'} (magasin du site) / ${user.name} (boutiquier)`, status: 'Nouvelle' as const,
        ref: { kind: 'BDL' as const, id: b.id, site },
        history: [{ at: nowStamp(), by: 'Système', text: 'Alerte générée automatiquement à la validation du comptage.' }],
      }, ...s.alerts] : s.alerts
      return {
        ...s, alerts, shopMoves: [...s.shopMoves, ...moves],
        bdls: s.bdls.map(x => x.id === b.id && x.toSite === site ? { ...x, status, counts: passes, lines: x.lines.map((l, i) => ({ ...l, counted: totals[i] })) } : x),
        queue: s.offline ? [{ id: b.id, text: `Réception ${b.id}`, at: nowStamp() }, ...s.queue] : s.queue,
      }
    })
    audit('Réception BDL', `${b.id} : comptage à l’aveugle validé (${partial ? 'réception partielle' : status})`)
    say(state.offline ? `Réception ${b.id} enregistrée hors-ligne : en attente de synchronisation` : `Réception ${b.id} prise en compte`)
    setResult({ id: b.id, status }); setSel(null)
  }

  return (
    <Screen title="Réception des livraisons à l’aveugle" sub={`${shop} — comptez la marchandise et saisissez les quantités réellement reçues`}>
      <Notice><EyeOff size={14} /> Réception à l’aveugle : les quantités expédiées par le magasin ne sont jamais affichées. Le système compare lui-même expédié et compté.</Notice>

      {result && <Card title={`Réception ${result.id} prise en compte`} actions={<Badge tone={result.status === BDL_ST.gap ? 'danger' : result.status === BDL_ST.partial ? 'warn' : 'ok'}>{result.status}</Badge>}>
        {result.status === BDL_ST.gap
          ? <Notice tone="warn">Votre comptage ne correspond pas à la livraison. Merci de vérifier votre comptage ; le stock vendant a été mis à jour avec les quantités que vous avez comptées.</Notice>
          : result.status === BDL_ST.partial
            ? <Notice>Réception partielle enregistrée : le reliquat reste suivi sur ce bordereau. Comptez le complément à son arrivée.</Notice>
            : <Notice tone="ok">Réception conforme : le stock vendant est mis à jour.</Notice>}
        <div className="btn-row"><Big tone="ghost" onClick={() => go('sSuivi')}>Suivre mes réceptions</Big><Big tone="ghost" onClick={() => setResult(null)}>Fermer</Big></div>
      </Card>}

      {!b && <Card title="Bordereaux en transit vers la boutique">
        {open.length ? <Table head={['N° de bordereau', 'Date d’émission', 'Magasin émetteur', 'Lignes d’articles', 'Statut', '']} rows={open.map(x => [
          <b>{x.id}</b>, x.ts ? stampAt(new Date(x.ts)) : '—', `Magasin du site${x.by ? ` (${x.by})` : ''}`, num(x.lines.length), <BdlBadge b={x} />,
          <Big onClick={() => start(x.id)}><PackageOpen size={18} /> {x.status === BDL_ST.partial ? 'Compter le complément' : 'Compter'}</Big>])} />
          : <Notice tone="ok">Aucune livraison en transit.</Notice>}
      </Card>}

      {b && <Card title={`Comptage — ${b.id}`} sub={`Émis le ${b.ts ? stampAt(new Date(b.ts)) : '—'} par le magasin du site${b.status === BDL_ST.partial ? ' · complément d’une réception partielle' : ''}`} actions={<BdlBadge b={b} />}>
        <Table head={['Article attendu', 'Format', 'Unité', 'Lot / date limite', ...(b.status === BDL_ST.partial ? ['Déjà compté'] : []), 'Quantité comptée']} rows={b.lines.map((l, i) => {
          const p = l.code ? product(l.code) : null
          return [<b>{p ? p.name : l.label}</b>, p?.format || '—', 'unité', l.lot ? `${l.lot} · ${l.dlc}` : '—',
            ...(b.status === BDL_ST.partial ? [num(countedTotal(b, i))] : []),
            <input className={`num-input ${counts[i] === undefined || counts[i] === '' ? 'empty' : ''}`} inputMode="numeric" placeholder="Compter" value={counts[i] ?? ''}
              onChange={e => setCounts({ ...counts, [i]: e.target.value.replace(/\D/g, '') })} />]
        })} />
        <textarea className="area" value={remark} onChange={e => setRemark(e.target.value)} placeholder="Remarque (facultatif) : cartons abîmés, livraison en retard…" />
        <div className="btn-row">
          <label className="big-btn ghost file-btn"><Camera size={20} /> Photo de la livraison
            <input type="file" accept="image/*" capture="environment" multiple onChange={e => { void addPhoto(e.target.files); e.target.value = '' }} /></label>
          <label className="check big-check"><input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)} /> Livraison incomplète : d’autres colis sont annoncés (réception partielle)</label>
        </div>
        {photos.length > 0 && <div className="photo-row">{photos.map((p, i) => <figure key={i}><img src={p.thumb} alt={p.name} /><figcaption>{p.kind}</figcaption>
          <button className="link-btn" onClick={() => setPhotos(photos.filter((_, k) => k !== i))}>Retirer</button></figure>)}</div>}
        {missing > 0 && <Notice tone="warn">{missing} ligne(s) restent à compter. Saisissez 0 pour un article absent.</Notice>}
        <div className="btn-row">
          <Big disabled={missing > 0} onClick={validate}><Check size={20} /> Valider mon comptage</Big>
          <Big tone="ghost" onClick={() => setSel(null)}>Annuler</Big>
        </div>
      </Card>}
    </Screen>
  )
}
