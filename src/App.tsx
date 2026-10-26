import { useEffect, useState } from 'react'
import { LogOut, RotateCcw, Wheat, WifiOff, Wifi } from 'lucide-react'
import { Provider, useApp } from './store/context'
import { Login } from './screens/Login'
import { Dashboard } from './screens/Dashboard'
import { Alerts } from './screens/Alerts'
import { Production } from './screens/Production'
import { Cuisson } from './screens/Cuisson'
import { Magasin } from './screens/Magasin'
import { BdlScreen } from './screens/Bdl'
import { Pos } from './screens/Pos'
import { Caisse } from './screens/Caisse'
import { Expenses, Versements, Invendus } from './screens/Finance'
import { Orders, Credit, Plan } from './screens/Commercial'
import { InventoryScreen, QualityScreen, PurchasesScreen } from './screens/Control'
import { Catalog, Org, Rbac, Devices, Audit, V3 } from './screens/Admin'
import { Reports, Treasury, Tour, Notifications } from './screens/Reports'
import { homeByRole, menuByRole, siteBound, type ScreenId } from './data/rbac'
import { roleLabels } from './data/org'
import { nowStamp } from './lib/format'

const screens: Record<ScreenId, () => React.ReactElement> = {
  dashboard: Dashboard, alerts: Alerts, production: Production, cuisson: Cuisson, magasin: Magasin, bdl: BdlScreen, pos: Pos,
  caisse: Caisse, invendus: Invendus, expenses: Expenses, versements: Versements, orders: Orders, credit: Credit, plan: Plan,
  inventory: InventoryScreen, quality: QualityScreen, purchases: PurchasesScreen, tour: Tour, catalog: Catalog, org: Org,
  reports: Reports, treasury: Treasury, audit: Audit, devices: Devices, v3: V3, notifications: Notifications, rbac: Rbac,
}

function Shell() {
  const { user, setUser, state, update, toast, reset, say, audit } = useApp()
  const [view, setView] = useState<ScreenId>('dashboard')

  useEffect(() => { if (user) setView(homeByRole[user.role]) }, [user])

  if (!user) return <><Login />{toast && <div className="toast">{toast}</div>}</>

  const menu = menuByRole[user.role]
  const current = menu.some(m => m.id === view) ? view : menu[0].id
  const bound = siteBound[current]
  const outOfSite = !!bound && !user.sites.includes(bound)
  const View = screens[current]
  const groups = Array.from(new Set(menu.map(m => m.group)))
  const logout = () => { audit('Déconnexion', `Déconnexion de ${user.name}`); setUser(null) }
  const toggleOffline = () => {
    if (state.offline) { update(s => ({ ...s, offline: false, queue: [] })); say(`Synchronisation de ${state.queue.length} opération(s) terminée`) }
    else { update(s => ({ ...s, offline: true })); say('Mode hors-ligne simulé : les ventes sont mises en file d’attente') }
  }

  return (
    <div className="shell2">
      <aside className="side2">
        <div className="logo2"><span className="logo-mark"><Wheat size={20} /></span><div><b>DÉLICE PLUS</b><small>Gestion boulangerie</small></div></div>
        <nav>{groups.map(g => <div key={g}><h5>{g}</h5>{menu.filter(m => m.group === g).map(m =>
          <button key={m.id} className={m.id === current ? 'active' : ''} onClick={() => setView(m.id)}>{m.label}</button>)}</div>)}</nav>
        <button className="reset" onClick={reset}><RotateCcw size={16} /> Réinitialiser la démo</button>
      </aside>
      <main className="main2">
        <header className="top2">
          <div><small>{roleLabels[user.role]} · {user.siteLabel}</small><h1>{user.name}</h1></div>
          <div className="top-actions">
            <span className="stamp">{nowStamp()} · Africa/Porto-Novo</span>
            <button className={`chip ${state.offline ? 'on' : ''}`} onClick={toggleOffline}>{state.offline ? <WifiOff size={16} /> : <Wifi size={16} />} {state.offline ? 'Hors-ligne' : 'En ligne'}</button>
            <button className="chip" onClick={logout}><LogOut size={16} /> Changer d’utilisateur</button>
          </div>
        </header>
        {state.offline && <div className="offline-bar"><WifiOff size={16} /> Mode hors-ligne — {state.queue.length} opération(s) en attente de synchronisation</div>}
        <section className="content2">{outOfSite
          ? <div className="notice warn">Aucune donnée de démonstration pour votre site ({user.siteLabel}) sur cet écran : les données de ce module appartiennent à SITE 1. Chaque compte reste limité à son propre site.</div>
          : <View />}</section>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default function App() {
  return <Provider><Shell /></Provider>
}
