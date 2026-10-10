import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import AppShell from './components/AppShell'
import AuthPage from './pages/AuthPage'
import ContactsPage from './pages/ContactsPage'
import DashboardPage from './pages/DashboardPage'
import FinancePage from './pages/FinancePage'
import RecordsPage from './pages/RecordsPage'
import SetupPage from './pages/SetupPage'
import './App.css'

function ProtectedArea() {
  const { user, ready, business, loadError } = useAuth()
  if (!isSupabaseConfigured) return <SetupPage />
  if (!ready) return <div className="full-loader"><span className="spinner" />Loading your khata...</div>
  if (!user) return <Navigate to="/login" replace />
  if (loadError) return <SetupPage error={loadError} />
  if (!business) return <SetupPage error="Your account is not linked to a business yet. Register a business or contact its owner." />
  return <AppShell><Outlet /></AppShell>
}

function PublicRoute({ mode }) {
  const { user, ready } = useAuth()
  if (isSupabaseConfigured && !ready) return <div className="full-loader"><span className="spinner" />Loading...</div>
  if (user && mode !== 'reset-password') return <Navigate to="/dashboard" replace />
  return <AuthPage mode={mode} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute mode="welcome" />} />
      <Route path="/welcome" element={<PublicRoute mode="welcome" />} />
      <Route path="/login" element={<PublicRoute mode="login" />} />
      <Route path="/register" element={<PublicRoute mode="register" />} />
      <Route path="/forgot-password" element={<PublicRoute mode="forgot-password" />} />
      <Route path="/reset-password" element={<PublicRoute mode="reset-password" />} />
      <Route element={<ProtectedArea />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/customers" element={<ContactsPage key="customer-list" kind="customer" mode="list" />} />
        <Route path="/customers/new" element={<ContactsPage key="customer-new" kind="customer" mode="new" />} />
        <Route path="/customers/:id" element={<ContactsPage key="customer-detail" kind="customer" mode="detail" />} />
        <Route path="/customers/:id/khata" element={<ContactsPage key="customer-ledger" kind="customer" mode="ledger" />} />
        <Route path="/customers/:id/statement" element={<ContactsPage key="customer-statement" kind="customer" mode="statement" />} />
        <Route path="/suppliers" element={<ContactsPage key="supplier-list" kind="supplier" mode="list" />} />
        <Route path="/suppliers/new" element={<ContactsPage key="supplier-new" kind="supplier" mode="new" />} />
        <Route path="/suppliers/:id" element={<ContactsPage key="supplier-detail" kind="supplier" mode="detail" />} />
        <Route path="/suppliers/:id/khata" element={<ContactsPage key="supplier-ledger" kind="supplier" mode="ledger" />} />
        <Route path="/suppliers/:id/statement" element={<ContactsPage key="supplier-statement" kind="supplier" mode="statement" />} />
        <Route path="/transactions/new" element={<FinancePage key="credit-entry" mode="transaction" />} />
        <Route path="/receive-payment" element={<FinancePage key="receive-entry" mode="receive" />} />
        <Route path="/make-payment" element={<FinancePage key="supplier-payment-entry" mode="supplier-payment" />} />
        <Route path="/purchases" element={<FinancePage key="purchase-entry" mode="purchase" />} />
        <Route path="/income" element={<FinancePage key="income-entry" mode="income" />} />
        <Route path="/expenses" element={<FinancePage key="expense-entry" mode="expense" />} />
        <Route path="/history" element={<RecordsPage mode="history" />} />
        <Route path="/statements/customers" element={<RecordsPage mode="customer-statements" />} />
        <Route path="/statements/suppliers" element={<RecordsPage mode="supplier-statements" />} />
        <Route path="/reports/daily" element={<RecordsPage key="daily-report" mode="daily-report" />} />
        <Route path="/reports/weekly" element={<RecordsPage key="weekly-report" mode="weekly-report" />} />
        <Route path="/reports/monthly" element={<RecordsPage key="monthly-report" mode="monthly-report" />} />
        <Route path="/reports/business" element={<RecordsPage key="business-report" mode="business-report" />} />
        <Route path="/search" element={<RecordsPage mode="search" />} />
        <Route path="/notifications" element={<RecordsPage mode="notifications" />} />
        <Route path="/reminders" element={<RecordsPage mode="reminders" />} />
        <Route path="/business-profile" element={<RecordsPage mode="business-profile" />} />
        <Route path="/profile" element={<RecordsPage mode="profile" />} />
        <Route path="/settings" element={<RecordsPage mode="settings" />} />
        <Route path="/export" element={<RecordsPage mode="export" />} />
        <Route path="/help" element={<RecordsPage mode="help" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
