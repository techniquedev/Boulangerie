import { createContext, useContext } from 'react'
import type { ScreenId } from '../data/rbac'

// Permet à un écran d'ouvrir un autre écran du menu (ex. actions rapides de l'accueil boulanger).
export const NavContext = createContext<(id: ScreenId) => void>(() => {})
export const useNav = () => useContext(NavContext)
