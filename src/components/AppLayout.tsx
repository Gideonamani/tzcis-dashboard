import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import './AppLayout.css'
import { useTheme } from '../context/ThemeContext'

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/interactive', label: 'Interactive' },
]

const AppLayout = () => {
  const { mode, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={['app-shell', collapsed ? 'is-collapsed' : ''].filter(Boolean).join(' ')}>
      <aside className={['nav-tray', collapsed ? 'is-collapsed' : ''].filter(Boolean).join(' ')}>
        <button
          type="button"
          className="nav-tray__collapse"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
        </button>
        <div className="nav-tray__brand">
          <div className="nav-tray__logo">tz</div>
          <div className="nav-tray__brand-text">
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
              aria-label={collapsed ? item.label : undefined}
            >
              <span className="nav-tray__pill" aria-hidden="true" />
              <span className="nav-tray__link-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="nav-tray__theme-toggle" onClick={toggle}>
          <span className="nav-tray__theme-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="nav-tray__theme-text">
            Toggle Dark/Light Mode
            <small>{mode === 'dark' ? 'Dark mode active' : 'Light mode active'}</small>
          </span>
        </button>
        <div className="nav-tray__footer">tzCIS · {new Date().getFullYear()}</div>
      </aside>
      <main className="app-shell__content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
