import { useState } from 'react'
import { useApp } from '../../store/context'
import { useNav } from '../../store/nav'
import { Badge, Big, Card, Kpi, Notice, Screen, Steps, Table } from '../../components/ui'
import { traceFor } from '../../data/trace'
import { atelierLabel, BON_FLOW, bonDay, BS, fmtQty, matName, needsTreatment, nextMoveId, sameBon, siteMat, supplierName, type BonSortie } from '../../data/stock'
import { dayOf, nowStamp, num } from '../../lib/format'
import { TraceInfo } from '../boulanger/shared'
import { BonBadge, useStore } from './shared'

type F = 'all' | 'emis' | 'conf' | 'clos' | 'ecart' | 'refus'
const FILTERS: [F, string][] = [['all', 'Tous'], ['emis', BS.emis], ['conf', BS.conf], ['clos', BS.clos], ['ecart', 'Avec écart'], ['refus', BS.refus]]
const match = (f: F, b: BonSortie) => f === 'all' || (f === 'emis' && b.status === BS.emis) || (f === 'conf' && b.status === BS.conf)
  || (f === 'clos' && b.status === BS.clos) || (f === 'refus' && b.status === BS.refus) || (f === 'ecart' && (!!b.ecart || b.reconcile?.result === 'Écart à traiter'))

export function MSuivi() {
  const { state, update, audit, say } = useApp()
  const go = useNav()
  const { user, site, siteName, bons, groups } = useStore()
  const [f, setF] = useState<F>(bons.some(needsTreatment) ? 'ecart' : 'all')
  const list = bons.filter(b => match(f, b))
  const [sel, setSel] = useState((bons.find(needsTreatment) || bons[0])?.id)
  const b = list.find(x => x.id === sel) || list[0]
  const [form, setForm] = useState({ text: '', mp: '', qty: '' })

  const partial = groups.filter(g => g.partial)
  const reconciled = bons.filter(x => x.reconcile)
  const recDays = Array.from(new Set(reconciled.map(bonDay))).slice(0, 10)

  // Traitement d'un écart : justification écrite, ou contre-écriture tracée (retour au magasin des matières non reçues).
  const treat = (kind: 'Justification' | 'Contre-écriture') => {
    if (!b || !form.text.trim()) return say('Un commentaire / motif est obligatoire.')
    const qty = Number(form.qty.replace(',', '.'))
    if (kind === 'Contre-écriture' && (!form.mp || !qty)) return say('Choisissez la matière et la quantité de la contre-écriture.')
    const ts = Date.now(), t = traceFor(user.name, site, state.offline)
    const entry = { at: nowStamp(), by: user.name, kind, text: kind === 'Contre-écriture' ? `${matName(form.mp)} ${qty > 0 ? '+' : ''}${fmtQty(form.mp, qty)} au magasin — ${form.text.trim()}` : form.text.trim() }
    update(s => ({
      ...s,
      bonsSortie: s.bonsSortie.map(x => sameBon(x, b) ? { ...x, treatment: [...(x.treatment || []), entry] } : x),
      movements: kind === 'Contre-écriture' ? [...s.movements, { id: nextMoveId(s.movements), site, mp: form.mp, loc: siteMat(form.mp).loc, qty, kind: 'Contre-écriture', ref: b.id, ts, trace: t, motif: form.text.trim() }] : s.movements,
    }))
    audit(kind === 'Contre-écriture' ? 'Contre-écriture de stock' : 'Justification d’écart', `${b.id} : ${entry.text}`)
    say(kind === 'Contre-écriture' ? 'Contre-écriture tracée : stock du magasin mis à jour' : 'Justification enregistrée')
    setForm({ text: '', mp: '', qty: '' })
  }

  const stepOf = (x: BonSortie) => (x.status === BS.clos ? 3 : x.status === BS.conf ? 1 : 0)

  return (
    <Screen title="Suivi des bons et rapprochements" sub={`Bons de sortie et réceptions du magasin ${siteName} — les alertes de contrôle restent réservées à la direction`}>
      <div className="kpi-row">
        <Kpi label="Bons émis (en attente)" value={num(bons.filter(x => x.status === BS.emis).length)} tone="warn" />
        <Kpi label="Confirmés par l’atelier" value={num(bons.filter(x => x.status === BS.conf).length)} />
        <Kpi label="Clôturés" value={num(bons.filter(x => x.status === BS.clos).length)} />
        <Kpi label="Écarts à traiter" value={num(bons.filter(needsTreatment).length)} tone={bons.some(needsTreatment) ? 'danger' : 'ok'} />
      </div>

      <Card title="Bons de sortie">
        <div className="filter-row">{FILTERS.map(([k, l]) => <button key={k} className={f === k ? 'chip on' : 'chip'} onClick={() => setF(k)}>{l} ({bons.filter(x => match(k, x)).length})</button>)}</div>
        {!b ? <p className="muted">Aucun bon pour ce filtre.</p> : <div className="split">
          <div className="list-col scroll-list">{list.map(x => <button key={x.id} className={`list-item ${x.id === b.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
            <b>{x.id}</b><small>{x.trace.localAt} · {atelierLabel(x.atelier)}</small><BonBadge b={x} />
          </button>)}</div>
          <div className="detail">
            <h3>{b.id} — {atelierLabel(b.atelier)}</h3>
            <Steps steps={BON_FLOW} current={stepOf(b)} />
            <Table head={['Matière', 'Sortie', 'Reçue par l’atelier', 'Motif de l’atelier']} rows={b.lines.map(l => [matName(l.mp), fmtQty(l.mp, l.qty),
              l.received === undefined ? '—' : <b className={l.received < l.qty ? 'neg' : ''}>{fmtQty(l.mp, l.received)}</b>, l.motif || '—'])} />
            {b.refusal && <Notice tone="danger">Bon refusé par l’atelier — motif : {b.refusal}</Notice>}
            <p className="trace">Émis par {b.by} le {b.trace.localAt}</p>
            {b.confirm && <TraceInfo t={b.confirm} />}
            {b.reconcile && <Notice tone={b.reconcile.result === 'Conforme' ? 'ok' : 'warn'}><b>Rapprochement de fin de journée ({b.reconcile.at}) : {b.reconcile.result}.</b> {b.reconcile.detail}</Notice>}
            {b.treatment?.length ? <ul className="timeline">{b.treatment.map((t, i) => <li key={i}><small>{t.at} · {t.by} · {t.kind}</small><span>{t.text}</span></li>)}</ul> : null}
            {(b.ecart || b.reconcile?.result === 'Écart à traiter') && <div className="close-box">
              <b>Justifier ou corriger l’écart</b>
              <textarea className="area" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="Commentaire / motif (obligatoire)" />
              <div className="btn-row">
                <Big tone="ghost" onClick={() => treat('Justification')}>Enregistrer la justification</Big>
              </div>
              <div className="btn-row">
                <select className="ref-input" value={form.mp} onChange={e => setForm({ ...form, mp: e.target.value })}><option value="">Matière…</option>{b.lines.map(l => <option key={l.mp} value={l.mp}>{matName(l.mp)}</option>)}</select>
                <label className="unit-input"><input className="num-input sm" inputMode="decimal" placeholder="± qté" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value.replace(/[^\d,.-]/g, '') })} /><span>{form.mp ? siteMat(form.mp).unit : ''}</span></label>
                <Big tone="ghost" onClick={() => treat('Contre-écriture')}>Contre-écriture au magasin</Big>
              </div>
              <small className="muted">Quantité positive : retour au magasin des matières non reçues par l’atelier. Écriture d’origine conservée.</small>
            </div>}
          </div>
        </div>}
      </Card>

      <Card title="Rapprochement de fin de journée" sub="Bons confirmés de l’atelier boulangerie rapprochés des consommations déclarées en production">
        <Table head={['Jour', 'Bons rapprochés', 'Résultat', 'Détail']} rows={recDays.map(d => {
          const x = reconciled.filter(y => bonDay(y) === d)
          const r = x[0].reconcile!
          return [d, x.map(y => y.id).join(', '), <Badge tone={r.result === 'Conforme' ? 'ok' : 'danger'}>{r.result}</Badge>, <small>{r.detail}</small>]
        })} />
      </Card>

      <Card title="Réceptions" actions={<button className="link-btn" onClick={() => go('mReceptions')}>Ouvrir les réceptions</button>}>
        <div className="kpi-row">
          <Kpi label="Réceptions complètes" value={num(groups.filter(g => !g.partial).length)} tone="ok" />
          <Kpi label="Réceptions partielles" value={num(partial.length)} tone={partial.length ? 'warn' : 'ok'} />
        </div>
        <Table head={['Facture', 'Fournisseur', 'Réception d’origine', 'Reliquat en attente de livraison']} rows={partial.map(g => [<b>{g.origin.invoiceNo}</b>,
          supplierName(g.origin.supplier), `${g.origin.id} (${dayOf(g.origin.ts)})`, g.reliquat.map(r => `${matName(r.mp)} ${fmtQty(r.mp, r.qty)}`).join(', ')])} />
      </Card>
    </Screen>
  )
}
