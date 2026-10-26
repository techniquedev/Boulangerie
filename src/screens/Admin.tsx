import { useApp } from '../store/context'
import { Badge, Card, Notice, Screen, Table } from '../components/ui'
import { money } from '../lib/format'
import { can, rbacMatrix } from '../data/rbac'
import { products } from '../data/catalog'
import { clients, drivers, params, suppliers } from '../data/partners'
import { locationLabels, roleLabels, sites } from '../data/org'

export function Catalog() {
  const { user } = useApp()
  return (
    <Screen title="Produits, recettes et tarifs" sub="Grilles détail / gros — historique daté, prix gérés par la Direction uniquement (US-13, US-15)">
      {!can.editPrices(user!.role) && <Notice>Prix en lecture seule.</Notice>}
      <Card><Table head={['Code', 'Produit', 'Catégorie', 'Format', 'Prix détail', 'Prix gros', 'Recette', 'Coût de revient']} rows={products.map(p => [
        p.code, <b>{p.emoji} {p.name}</b>, p.category, p.format, money(p.retail), p.wholesale ? money(p.wholesale) : '—', p.recipe, money(p.cost)])} /></Card>
    </Screen>
  )
}

export function Org() {
  return (
    <Screen title="Sites, tiers et seuils" sub="Boulangerie-Pâtisserie DÉLICE PLUS Sarl (US-14, US-16)">
      <Card title="Sites et emplacements"><Table head={['Code', 'Site', 'Statut', 'Emplacements de stock']} rows={sites.map(s => [
        s.code, s.name, <Badge tone={s.status === 'Actif' ? 'ok' : 'neutral'}>{s.status}</Badge>,
        s.locations.length ? s.locations.map(l => `${l} (${locationLabels[l]})`).join(' · ') : s.note || '—'])} /></Card>
      <Card title="Fournisseurs"><Table head={['Code', 'Fournisseur', 'Spécialité', 'Conditions']} rows={suppliers.map(s => [s.code, s.name, s.specialty, s.terms])} /></Card>
      <Card title="Clients grossistes"><Table head={['Code', 'Client', 'Plafond de crédit', 'Encours', 'Relevé']} rows={clients.map(c => [c.code, c.name, money(c.ceiling), money(c.outstanding), c.statement])} /></Card>
      <Card title="Livreurs"><Table head={['Code', 'Livreur', 'Note']} rows={drivers.map(d => [d.code, d.name, d.note])} /></Card>
      <Card title="Seuils et paramètres de contrôle" sub="Toute modification est tracée en audit"><Table head={['Paramètre', 'Valeur globale', 'Surcharge']} rows={params.map(p => [p.label, <b>{p.value}</b>, p.override])} /></Card>
    </Screen>
  )
}

export function Rbac() {
  return (
    <Screen title="Rôles et autorisations" sub="Menus visibles par rôle (US-02, ENF-05) — appliqué à chaque compte démo">
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
    <Screen title="Gestion des appareils" sub="4 appareils enregistrés + 1 révoqué (US-45)">
      <Card><Table head={['Appareil', 'Site', 'Statut', 'Note', '']} rows={state.devices.map(d => [<b>{d.label}</b>, d.site, <Badge tone={d.status === 'Actif' ? 'ok' : 'danger'}>{d.status}</Badge>, d.note || '—',
        d.status === 'Actif' ? <button className="link-btn" onClick={() => revoke(d.id)}>Révoquer</button> : ''])} /></Card>
    </Screen>
  )
}

export function Audit() {
  const { state } = useApp()
  return (
    <Screen title="Journal d’audit" sub="Écritures non modifiables — auteur, appareil, site, horodatage serveur et local (US-43, ENF-09)">
      <Card><Table head={['Horodatage serveur', 'Heure locale', 'Auteur', 'Appareil', 'Site', 'Action', 'Détail']} rows={state.audit.map(a => [a.at, a.localAt, a.author, a.device, a.site, <b>{a.action}</b>, a.detail])} /></Card>
      <Notice>Aucune donnée validée n’est supprimable : toute correction passe par une contre-écriture tracée (RG-03).</Notice>
    </Screen>
  )
}

export function V3() {
  const q = ['Quelle boutique a le plus fort taux de perte cette semaine ?', 'Quel est le rendement moyen par sac sur 30 jours ?', 'Quels fournisseurs ont les factures en écart ?']
  return (
    <Screen title="Intelligence artificielle (V3)" sub="Écrans présentés grisés — non disponibles dans cette version (US-36, US-37)">
      <div className="greyed">
        <Card title="Prévisions IA des ventes (US-36)" actions={<Badge tone="neutral">V3</Badge>}><p>Écart prévision / réalisé affiché sur le plan de production.</p></Card>
        <Card title="Assistant Direction en langage naturel (US-37)" actions={<Badge tone="neutral">V3 premium</Badge>}>
          <ul>{q.map(x => <li key={x}>{x}</li>)}</ul><input className="ref-input wide" disabled placeholder="Posez votre question…" />
        </Card>
      </div>
    </Screen>
  )
}
