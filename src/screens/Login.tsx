import { useState } from 'react'
import { AlertTriangle, ChevronRight, Eye, EyeOff, Wheat } from 'lucide-react'
import { users, roleLabels, COMPANY, DEMO_PASSWORD, GROUPS, findUser, deactivated } from '../data/org'
import type { User } from '../data/types'
import { useApp } from '../store/context'

const initials = (name: string) => name.split(' ').map(x => x[0]).slice(0, 2).join('')

export function Login() {
  const { setUser, audit } = useApp()
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [show, setShow] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(true)

  // Un clic sur un compte remplit automatiquement les deux champs.
  const choose = (u: User) => { setIdentifiant(u.email); setMotDePasse(DEMO_PASSWORD); setError('') }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found = findUser(identifiant)
    if (deactivated.some(d => d.email.toLowerCase() === identifiant.trim().toLowerCase())) return setError('Ce compte est désactivé.')
    if (!found || motDePasse !== DEMO_PASSWORD) return setError('Identifiant ou mot de passe incorrect.')
    setError('')
    audit('Connexion', `Connexion de ${found.name}`)
    setUser(found)
  }

  const selected = findUser(identifiant)

  return (
    <div className="login2">
      <div className="login2-brand">
        <span className="logo-mark"><Wheat size={26} /></span>
        <h1>DÉLICE PLUS</h1>
        <p>{COMPANY}</p>
        <small>Gestion centralisée multi-sites · Bénin · FCFA · Africa/Porto-Novo</small>
      </div>
      <div className="login2-panel">
        <div>
          <h2>Connexion</h2>
          <p className="muted">Cliquez sur un compte : l’identifiant et le mot de passe se remplissent, puis cliquez sur « Se connecter ».</p>
        </div>

        <form className="login-form2" onSubmit={submit}>
          <label>Identifiant
            <input value={identifiant} onChange={e => { setIdentifiant(e.target.value); setError('') }} placeholder="prenom@deliceplus.bj" autoComplete="off" />
          </label>
          <label>Mot de passe
            <div className="pw-field">
              <input type={show ? 'text' : 'password'} value={motDePasse} onChange={e => { setMotDePasse(e.target.value); setError('') }} placeholder="Mot de passe" autoComplete="off" />
              <button type="button" className="link-btn" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </label>
          {selected && !error && <p className="muted small-note">{selected.name} — {roleLabels[selected.role]} · {selected.siteLabel}</p>}
          {error && <div className="notice danger"><AlertTriangle size={16} /> {error}</div>}
          <button className="big-btn" type="submit">Se connecter</button>
        </form>

        <div className="demo-box">
          <button type="button" className="demo-head" onClick={() => setOpen(!open)}>
            <span>Comptes de démonstration ({users.length})</span><ChevronRight className={open ? 'rotated' : ''} />
          </button>
          {open && GROUPS.map(g => <div key={g} className="demo-group">
            <h4>{g}</h4>
            <div className="dtable-wrap"><table className="dtable">
              <thead><tr><th>Poste</th><th>Nom</th><th>Identifiant</th><th>PIN</th><th>Site</th></tr></thead>
              <tbody>{users.filter(x => x.group === g).map(x =>
                <tr key={x.email} className={`clickable ${selected?.email === x.email ? 'picked-row' : ''}`} onClick={() => choose(x)}>
                  <td>{roleLabels[x.role]}</td>
                  <td><span className="row-name"><span className="avatar-s">{initials(x.name)}</span><b>{x.name}</b></span></td>
                  <td>{x.email}</td><td><b>{x.pin}</b></td><td>{x.siteLabel}</td>
                </tr>)}</tbody></table></div>
          </div>)}
          <p className="muted small-note pad">Mot de passe commun à tous les comptes : <b>{DEMO_PASSWORD}</b></p>
        </div>
      </div>
    </div>
  )
}
