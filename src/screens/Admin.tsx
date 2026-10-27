import { useState } from 'react'
import { useApp } from '../store/context'
import { Badge, Big, Card, Notice, Screen, Table } from '../components/ui'
import { money } from '../lib/format'
import { can, rbacMatrix } from '../data/rbac'
import { products } from '../data/catalog'
import { clients, drivers, params, suppliers } from '../data/partners'
import { locationLabels, roleLabels, sites } from '../data/org'
import { productName, SHOP_PRODUCTS } from '../data/shop'
import { usePeriod } from '../components/PeriodFilter'

export function Catalog() {
  const { user } = useApp()
  return (
    <Screen title="Produits, recettes et tarifs" sub="Grilles détail / gros — historique daté, prix gérés par la Direction uniquement">
      {!can.editPrices(user!.role) && <Notice>Prix en lecture seule.</Notice>}
      <Card><Table head={['Code', 'Produit', 'Catégorie', 'Format', 'Prix détail', 'Prix gros', 'Recette', 'Coût de revient']} rows={products.map(p => [
        p.code, <b>{p.emoji} {p.name}</b>, p.category, p.format, money(p.retail), p.wholesale ? money(p.wholesale) : '—', p.recipe, money(p.cost)])} /></Card>
    </Screen>
  )
}

export function Org() {
  const { user, state, update, audit, say } = useApp()
  const [eps, setEps] = useState(String(state.epsThreshold))
  // Seuil de rendement boulangerie : paramétrable par la direction, appliqué aux 3 sites.
  const saveEps = () => {
    const v = Number(eps)
    if (!v || v <= 0) return say('Saisissez un seuil valide en EPS/sac.')
    update(s => ({ ...s, epsThreshold: v }))
    audit('Paramètre modifié', `Rendement minimum boulangerie : ${state.epsThreshold} → ${v} EPS/sac`)
    say('Seuil de rendement mis à jour')
  }
  // Tolérance d'écart BDL par produit (0 par défaut) et seuil de photo obligatoire des pertes.
  const [tol, setTol] = useState<Record<string, string>>(Object.fromEntries(SHOP_PRODUCTS.map(p => [p.code, String(state.bdlTolerance[p.code] ?? 0)])))
  const [photo, setPhoto] = useState(String(state.lossPhotoThreshold))
  const [oven, setOven] = useState({ rate: String(state.rejectThreshold).replace('.', ','), qty: String(state.rejectPhotoQty) })
  const saveOven = () => {
    const rate = Number(oven.rate.replace(',', '.')), qty = Number(oven.qty)
    if (!rate || rate <= 0 || !qty) return say('Saisissez un taux et un nombre valides.')
    update(s => ({ ...s, rejectThreshold: rate, rejectPhotoQty: qty }))
    audit('Paramètre modifié', `Cuisson : taux de rebut acceptable ${rate} %, photo exigée à partir de ${qty} rebuts par ligne`)
    say('Seuils de cuisson mis à jour')
  }
  const saveShop = () => {
    const t = Object.fromEntries(Object.entries(tol).map(([c, v]) => [c, Number(v) || 0]).filter(([, v]) => v))
    update(s => ({ ...s, bdlTolerance: t, lossPhotoThreshold: Number(photo) || 0 }))
    audit('Paramètre modifié', `Tolérances BDL : ${Object.entries(t).map(([c, v]) => `${c} ${v}`).join(', ') || 'aucune'} · photo des pertes au-delà de ${Number(photo) || 0} FCFA`)
    say('Paramètres des boutiques mis à jour')
  }
  const rows = params.map(p => p.label === 'Rendement minimum boulangerie' ? { ...p, value: `${state.epsThreshold} EPS/sac` }
    : p.label === 'Taux de rebut acceptable' ? { ...p, value: `${String(state.rejectThreshold).replace('.', ',')} %`, override: `Photo du rebut exigée à partir de ${state.rejectPhotoQty} par ligne` }
    : p.label.startsWith('Tolérance écart BDL') ? { ...p, override: Object.entries(state.bdlTolerance).map(([c, v]) => `${productName(c)} : ${v}`).join(' · ') || '—' } : p)
  return (
    <Screen title="Sites, tiers et seuils">
      <Card title="Sites et emplacements"><Table head={['Code', 'Site', 'Statut', 'Emplacements de stock']} rows={sites.map(s => [
        s.code, s.name, <Badge tone={s.status === 'Actif' ? 'ok' : 'neutral'}>{s.status}</Badge>,
        s.locations.length ? s.locations.map(l => `${l} (${locationLabels[l]})`).join(' · ') : s.note || '—'])} /></Card>
      <Card title="Fournisseurs"><Table head={['Code', 'Fournisseur', 'Spécialité', 'Conditions']} rows={suppliers.map(s => [s.code, s.name, s.specialty, s.terms])} /></Card>
      <Card title="Clients grossistes"><Table head={['Code', 'Client', 'Plafond de crédit', 'Encours', 'Relevé']} rows={clients.map(c => [c.code, c.name, money(c.ceiling), money(c.outstanding), c.statement])} /></Card>
      <Card title="Livreurs"><Table head={['Code', 'Livreur', 'Note']} rows={drivers.map(d => [d.code, d.name, d.note])} /></Card>
      <Card title="Seuils et paramètres de contrôle" sub="Toute modification est tracée en audit"><Table head={['Paramètre', 'Valeur globale', 'Surcharge']} rows={rows.map(p => [p.label, <b>{p.value}</b>, p.override])} />
        {can.setEpsThreshold(user!.role) && <div className="btn-row">
          <label className="unit-input"><input className="num-input sm" inputMode="numeric" value={eps} onChange={e => setEps(e.target.value.replace(/\D/g, ''))} /><span>EPS/sac</span></label>
          <Big tone="ghost" onClick={saveEps}>Modifier le rendement minimum</Big>
        </div>}</Card>
      {can.setEpsThreshold(user!.role) && <Card title="Cuisson : taux de rebut acceptable et photos des rebuts" sub="Au-delà du taux, l’enfourneur doit saisir un motif et une alerte est générée pour la direction">
        <div className="btn-row">
          <label className="field">Taux de rebut acceptable (%)<input className="num-input sm" inputMode="decimal" value={oven.rate} onChange={e => setOven({ ...oven, rate: e.target.value.replace(/[^\d,.]/g, '') })} /></label>
          <label className="field">Photo exigée à partir de (rebuts par ligne)<input className="num-input sm" inputMode="numeric" value={oven.qty} onChange={e => setOven({ ...oven, qty: e.target.value.replace(/\D/g, '') })} /></label>
        </div>
        <Big tone="ghost" onClick={saveOven}>Enregistrer les seuils de cuisson</Big>
      </Card>}
      {can.setEpsThreshold(user!.role) && <Card title="Boutiques : tolérance d’écart BDL et photos des pertes" sub="Tolérance en unités par produit (0 par défaut) — au-delà, le BDL passe « Réceptionné avec écart » et une alerte est générée">
        <div className="count-grid">{SHOP_PRODUCTS.map(p => <label key={p.code}>{productName(p.code)}
          <input className="num-input sm" inputMode="numeric" value={tol[p.code]} onChange={e => setTol({ ...tol, [p.code]: e.target.value.replace(/\D/g, '') })} /></label>)}
          <label>Photo obligatoire pour une perte au-delà de (FCFA)<input className="num-input sm" inputMode="numeric" value={photo} onChange={e => setPhoto(e.target.value.replace(/\D/g, ''))} /></label>
        </div>
        <Big tone="ghost" onClick={saveShop}>Enregistrer les paramètres des boutiques</Big>
      </Card>}
    </Screen>
  )
}

export function Rbac() {
  return (
    <Screen title="Rôles et autorisations" sub="Menus visibles par rôle — appliqué à chaque compte démo">
      <Card><Table head={['Rôle', 'Écrans accessibles']} rows={rbacMatrix.map(r => [<b>{roleLabels[r.role]}</b>, r.screens])} /></Card>
    </Screen>
  )
}

export function Devices() {
  const { state, update, audit, say } = useApp()
  const revoke = (id: string) => {
    update(s => ({ ...s, devices: s.devices.map(d => d.id === id ? { ...d, status: 'Révoqué' } : d) }))
    audit('Appareil', `${id} révoqué`); say('Appareil révoqué')
  }
  return (
    <Screen title="Gestion des appareils" sub="4 appareils enregistrés + 1 révoqué">
      <Card><Table head={['Appareil', 'Site', 'Statut', 'Note', '']} rows={state.devices.map(d => [<b>{d.label}</b>, d.site, <Badge tone={d.status === 'Actif' ? 'ok' : 'danger'}>{d.status}</Badge>, d.note || '—',
        d.status === 'Actif' ? <button className="link-btn" onClick={() => revoke(d.id)}>Révoquer</button> : ''])} /></Card>
    </Screen>
  )
}

export function Audit() {
  const { state } = useApp()
  const per = usePeriod(state.audit.map(a => a.localAt))
  return (
    <Screen title="Journal d’audit" sub="Écritures non modifiables — auteur, appareil, site, horodatage serveur et local">
      {per.bar}
      <Card><Table head={['Horodatage serveur', 'Heure locale', 'Auteur', 'Appareil', 'Site', 'Action', 'Détail']} rows={state.audit.filter(a => per.match(a.localAt)).map(a => [a.at, a.localAt, a.author, a.device, a.site, <b>{a.action}</b>, a.detail])} /></Card>
      <Notice>Aucune donnée validée n’est supprimable : toute correction passe par une contre-écriture tracée.</Notice>
    </Screen>
  )
}
