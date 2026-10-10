import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BadgeHelp, Bell, BookOpenText,
  BriefcaseBusiness, ChartNoAxesCombined, ChevronDown, CircleUserRound, Coins, Download,
  FileBarChart, House, Menu, Search, Settings, ShoppingBag, Tags, Users,
  WalletCards, X, LogOut,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'

const groups = [
  { label: 'OVERVIEW', links: [
    { to: '/dashboard', label: 'Dashboard', icon: House },
    { to: '/history', label: 'Transaction history', icon: Activity },
    { to: '/search', label: 'Search', icon: Search },
  ] },
  { label: 'PEOPLE', links: [
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/suppliers', label: 'Suppliers', icon: BriefcaseBusiness },
    { to: '/reminders', label: 'Payment reminders', icon: Bell },
  ] },
  { label: 'MONEY', links: [
    { to: '/transactions/new', label: 'Add transaction', icon: ArrowLeftRight },
    { to: '/receive-payment', label: 'Receive payment', icon: ArrowDownLeft },
    { to: '/make-payment', label: 'Make payment', icon: ArrowUpRight },
    { to: '/purchases', label: 'Purchases', icon: ShoppingBag },
    { to: '/income', label: 'Income', icon: Coins },
    { to: '/expenses', label: 'Expenses', icon: WalletCards },
  ] },
  { label: 'INSIGHTS', links: [
    { to: '/statements/customers', label: 'Customer statements', icon: BookOpenText },
    { to: '/statements/suppliers', label: 'Supplier statements', icon: BookOpenText },
    { to: '/reports/daily', label: 'Daily report', icon: FileBarChart },
    { to: '/reports/weekly', label: 'Weekly report', icon: ChartNoAxesCombined },
    { to: '/reports/monthly', label: 'Monthly report', icon: ChartNoAxesCombined },
    { to: '/reports/business', label: 'Business report', icon: ChartNoAxesCombined },
    { to: '/export', label: 'Data export', icon: Download },
  ] },
  { label: 'BUSINESS', links: [
    { to: '/business-profile', label: 'Business profile', icon: Tags },
    { to: '/profile', label: 'User profile', icon: CircleUserRound },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/help', label: 'Help and support', icon: BadgeHelp },
  ] },
]

const routeTitles = Object.fromEntries(groups.flatMap((group) => group.links.map(({ to, label }) => [to, label])))

export default function AppShell() {
  const { business, profile, signOut, loadError } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const pageTitle = routeTitles[location.pathname] ?? (location.pathname.includes('/customers/') ? 'Customer account' : 'Supplier account')

  async function handleSignOut() {
    setSigningOut(true)
    setError('')
    try {
      await signOut()
      navigate('/login')
    } catch (issue) {
      setError(issue.message)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="app-frame">
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <Link to="/dashboard" className="brand-lockup" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">IK</span>
          <span><strong>Islamic Khata</strong><small>Books in balance</small></span>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={(event) => { event.preventDefault(); setMenuOpen(false) }}><X size={18} /></button>
        </Link>
        <div className="business-switcher">
          <span className="business-avatar">{business?.name?.slice(0, 1)?.toUpperCase() ?? 'B'}</span>
          <span className="business-name"><strong>{business?.name ?? 'Your business'}</strong><small>PKR · Pakistan</small></span>
          <ChevronDown size={15} />
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-caption">{group.label}</span>
              {group.links.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mini"><span className="user-avatar">{profile?.full_name?.slice(0, 1)?.toUpperCase() || 'U'}</span><span><strong>{profile?.full_name || 'Account owner'}</strong><small>Business owner</small></span></div>
          <button className="signout-button" onClick={handleSignOut} disabled={signingOut}><LogOut size={16} />{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-divider">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <Link to="/notifications" className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /></Link>
            <Link to="/profile" className="topbar-profile"><span className="user-avatar">{profile?.full_name?.slice(0, 1)?.toUpperCase() || 'U'}</span><span>{profile?.full_name || 'Profile'}</span></Link>
          </div>
        </header>
        <main className="page-content">
          {(error || loadError) && <div className="inline-alert alert-error" role="alert">{error || loadError}</div>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}