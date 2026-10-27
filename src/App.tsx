import { useEffect, useState } from 'react'
import {
  BadgePercent, Banknote, Bell, BookOpen, Building2, CakeSlice, ChartColumn, CheckCircle2, ClipboardCheck, ClipboardList, Coins, CreditCard,
  Fingerprint, Flag, Flame, History, House, Landmark, LayoutDashboard, ListChecks, LogOut, Package, PackageOpen, Receipt, RefreshCw, RotateCcw,
  ScrollText, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Snowflake, Store, Thermometer, TriangleAlert, Truck, Warehouse, Wheat,
  WifiOff, Wifi, type LucideIcon,
} from 'lucide-react'
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
import { Catalog, Org, Rbac, Devices, Audit } from './screens/Admin'
import { Reports, Treasury, Tour, Notifications } from './screens/Reports'
import { homeByRole, menuByRole, siteBound, type ScreenId } from './data/rbac'
import { roleLabels } from './data/org'
import { hourNow, nowStamp, today } from './lib/format'
import { NavArgContext, NavContext } from './store/nav'
import { END_OF_DAY_HOUR } from './data/boulanger'
import { reconcileDay, stockConflicts, syncPending } from './data/daily'
import { BHome } from './screens/boulanger/Accueil'
import { BReception } from './screens/boulanger/Reception'
import { BPetrissee } from './screens/boulanger/Petrissee'
import { BLots } from './screens/boulanger/Lots'
import { BCuisson } from './screens/boulanger/RapportsCuisson'
import { BHistory } from './screens/boulanger/Historique'
import { MHome } from './screens/magasin/Accueil'
import { MReceptions } from './screens/magasin/Receptions'
import { MSorties } from './screens/magasin/Sorties'
import { MStocks } from './screens/magasin/Stocks'
import { MSuivi } from './screens/magasin/Suivi'
import { MHistory } from './screens/magasin/Historique'
import { SHome } from './screens/boutique/Accueil'
import { SReception } from './screens/boutique/Reception'
import { SSuivi } from './screens/boutique/Suivi'
import { SStock } from './screens/boutique/Stock'
import { SPertes } from './screens/boutique/Pertes'
import { SHistory } from './screens/boutique/Historique'
import { PHome } from './screens/patisserie/Accueil'
import { PProduction } from './screens/patisserie/Production'
import { PLots } from './screens/patisserie/Lots'
import { PStocks } from './screens/patisserie/Stocks'
import { PHistory } from './screens/patisserie/Historique'
import { LHome } from './screens/livreur/Accueil'
import { LLoad } from './screens/livreur/Chargement'
import { LDeliver } from './screens/livreur/Livraisons'
import { LCash } from './screens/livreur/Encaissements'
import { LClose } from './screens/livreur/FinTournee'
import { LHistory } from './screens/livreur/Historique'

const screens: Record<ScreenId, () => React.ReactElement> = {
  dashboard: Dashboard, alerts: Alerts, production: Production, cuisson: Cuisson, magasin: Magasin, bdl: BdlScreen, pos: Pos,
  caisse: Caisse, invendus: Invendus, expenses: Expenses, versements: Versements, orders: Orders, credit: Credit, plan: Plan,
  inventory: InventoryScreen, quality: QualityScreen, purchases: PurchasesScreen, tour: Tour, catalog: Catalog, org: Org,
  reports: Reports, treasury: Treasury, audit: Audit, devices: Devices, notifications: Notifications, rbac: Rbac,
  bHome: BHome, bReception: BReception, bPetrissee: BPetrissee, bLots: BLots, bCuisson: BCuisson, bHistory: BHistory,
  mHome: MHome, mReceptions: MReceptions, mSorties: MSorties, mStocks: MStocks, mSuivi: MSuivi, mHistory: MHistory,
  sHome: SHome, sReception: SReception, sSuivi: SSuivi, sStock: SStock, sPertes: SPertes, sHistory: SHistory,
  pHome: PHome, pProduction: PProduction, pLots: PLots, pStocks: PStocks, pHistory: PHistory,
  lHome: LHome, lLoad: LLoad, lDeliver: LDeliver, lCash: LCash, lClose: LClose, lHistory: LHistory,
}

function Shell() {
  const { user, setUser, state, update, toast, reset, say, audit } = useApp()
  const [view, setView] = useState<ScreenId>('dashboard')
  const [navArg, setNavArg] = useState<string | undefined>()
  const go = (id: ScreenId, arg?: string) => { setNavArg(arg); setView(id) }

  useEffect(() => { if (user) setView(homeByRole[user.role]) }, [user])

  // Réseau réel : passage automatique hors-ligne, puis synchronisation automatique au retour du réseau.
  useEffect(() => {
    const off = () => update(s => ({ ...s, offline: true }))
    const on = () => update(s => (s.offline ? syncPending(s) : s))
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    if (!navigator.onLine) off()
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [])

  // Rapprochement automatique de fin de journée (sorties magasin / consommations atelier) : alertes direction.
  useEffect(() => {
    const run = () => { if (hourNow() >= END_OF_DAY_HOUR) update(s => reconcileDay(s, today())) }
    run()
    const t = setInterval(run, 60000)
    return () => clearInterval(t)
  }, [])

  if (!user) return <><Login />{toast && <div className="toast">{toast}</div>}</>

  const menu = menuByRole[user.role]
  const current = menu.some(m => m.id === view) ? view : menu[0].id
  const bound = siteBound[current]
  const outOfSite = !!bound && !user.sites.includes(bound)
  const View = screens[current]
  const groups = Array.from(new Set(menu.map(m => m.group)))
  const logout = () => { audit('Déconnexion', `Déconnexion de ${user.name}`); setUser(null) }
  const toggleOffline = () => {
    if (state.offline) {
      update(syncPending)
      const c = stockConflicts(state)
      say(c.length ? `Synchronisation terminée — conflit à traiter : stock négatif ${c.join(', ')}` : `Synchronisation de ${state.queue.length} opération(s) terminée`)
    }
    else { update(s => ({ ...s, offline: true })); say('Mode hors-ligne simulé : les saisies sont mises en file d’attente') }
  }

  return (
    <div className={`shell2 ${user.role === 'livreur' ? 'phone-app' : ''}`}>
      <aside className="side2">
        <div className="logo2"><span className="logo-mark"><Wheat size={20} /></span><div><b>Gestion boulangerie</b></div></div>
        <nav>{groups.map(g => <div key={g}><h5>{g}</h5>{menu.filter(m => m.group === g).map(m =>
          {
            const Icon = NAV_ICONS[m.id] || LayoutDashboard
            return <button key={m.id} className={m.id === current ? 'active' : ''} onClick={() => go(m.id)}><Icon size={18} /><span>{m.label}</span></button>
          })}</div>)}</nav>
        <button className="reset" onClick={reset}><RotateCcw size={16} /> Réinitialiser la démo</button>
      </aside>
      <main className="main2">
        <header className="top2">
          <div><small>{roleLabels[user.role]} · {user.siteLabel}</small><h1>{user.name}</h1></div>
          <div className="top-actions">
            <span className="stamp">{nowStamp()} · Africa/Porto-Novo</span>
            <span className={`chip sync ${state.queue.length ? 'pending' : ''}`}>{state.queue.length
              ? <><RefreshCw size={16} /> {state.queue.length} en attente de synchronisation</>
              : <><CheckCircle2 size={16} /> Synchronisé</>}</span>
            <button className={`chip ${state.offline ? 'on' : ''}`} onClick={toggleOffline}>{state.offline ? <WifiOff size={16} /> : <Wifi size={16} />} {state.offline ? 'Hors-ligne' : 'En ligne'}</button>
            <button className="chip" onClick={logout}><LogOut size={16} /> Changer d’utilisateur</button>
          </div>
        </header>
        {state.offline && <div className="offline-bar"><WifiOff size={16} /> Mode hors-ligne — {state.queue.length} opération(s) en attente de synchronisation</div>}
        <section className="content2">{outOfSite
          ? <div className="notice warn">Aucune donnée de démonstration pour votre site ({user.siteLabel}) sur cet écran : les données de ce module appartiennent à SITE 1. Chaque compte reste limité à son propre site.</div>
          : <NavContext.Provider value={go}><NavArgContext.Provider value={navArg}><View key={`${current}-${navArg || ''}`} /></NavArgContext.Provider></NavContext.Provider>}</section>
      </main>
      {/* Livreur sur smartphone : onglets en bas de l'écran, à portée de pouce. */}
      {user.role === 'livreur' && <nav className="bottom-nav">{menu.map(m => {
        const Icon = NAV_ICONS[m.id] || House
        return <button key={m.id} className={m.id === current ? 'on' : ''} onClick={() => go(m.id)}><Icon size={22} /><span>{m.label.split(' ')[0]}</span></button>
      })}</nav>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// Pictogramme de chaque entrée de menu.
const NAV_ICONS: Partial<Record<ScreenId, LucideIcon>> = {
  dashboard: LayoutDashboard, alerts: TriangleAlert, reports: ChartColumn, treasury: Landmark, notifications: Bell,
  production: Wheat, cuisson: Flame, plan: ListChecks, magasin: Warehouse, bdl: ScrollText, inventory: ClipboardCheck,
  invendus: PackageOpen, quality: Thermometer, pos: ShoppingCart, caisse: Coins, versements: Banknote, orders: ClipboardList,
  credit: CreditCard, tour: Truck, expenses: Receipt, purchases: ShoppingBag, catalog: BadgePercent, org: Building2,
  rbac: ShieldCheck, devices: Smartphone, audit: Fingerprint,
  bHome: House, bReception: ClipboardCheck, bPetrissee: Wheat, bLots: Package, bCuisson: Flame, bHistory: History,
  mHome: House, mReceptions: PackageOpen, mSorties: Truck, mStocks: Warehouse, mSuivi: ListChecks, mHistory: History,
  sHome: House, sReception: PackageOpen, sSuivi: ListChecks, sStock: Store, sPertes: ClipboardList, sHistory: History,
  pHome: House, pProduction: CakeSlice, pLots: Snowflake, pStocks: Warehouse, pHistory: BookOpen,
  lHome: House, lLoad: Package, lDeliver: Truck, lCash: Banknote, lClose: Flag, lHistory: History,
}

export default function App() {
  return <Provider><Shell /></Provider>
}
