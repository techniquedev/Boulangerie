import { createContext, useContext } from 'react'
import type { ScreenId } from '../data/rbac'

// Permet à un écran d'ouvrir un autre écran du menu (ex. actions rapides de l'accueil), avec un paramètre facultatif
// (ex. la ligne de production du formulaire à ouvrir).
export const NavContext = createContext<(id: ScreenId, arg?: string) => void>(() => {})
export const NavArgContext = createContext<string | undefined>(undefined)
export const useNav = () => useContext(NavContext)
export const useNavArg = () => useContext(NavArgContext)
