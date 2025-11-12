import { NavLink, Outlet } from 'react-router-dom'
import './AppLayout.css'

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/interactive', label: 'Interactive' },
]

const AppLayout = () => (
  <div className="app-shell">
    <aside className="nav-tray">
      <div className="nav-tray__brand">
        <div className="nav-tray__logo">tz</div>
        <div>
          <p className="nav-tray__title">CIS Dashboard</p>
          <p className="nav-tray__subtitle">Insights</p>
        </div>
      </div>
      <nav className="nav-tray__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              ['nav-tray__link', isActive ? 'is-active' : ''].filter(Boolean).join(' ')
            }
          >
            <span className="nav-tray__pill" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="nav-tray__footer">tzCIS · {new Date().getFullYear()}</div>
    </aside>
    <main className="app-shell__content">
      <Outlet />
    </main>
  </div>
)

export default AppLayout
