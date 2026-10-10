
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpenText, CirclePlus, Coins, FileBarChart,
  HandCoins, Plus, ShoppingBag, TrendingDown, TrendingUp, Users, WalletCards,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getDashboard } from '../services/khata'
import { formatDate, formatMoney } from '../utils/format'

function Metric({ label, value, icon: Icon, tone = '', note }) {
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><strong>{value}</strong><small>{note}</small></article>
}

function humanType(type) {
  return ({ credit: 'Credit given', payment: 'Payment received', purchase: 'Purchase', opening: 'Opening balance', adjustment: 'Adjustment' })[type] ?? type
}

export default function DashboardPage() {
  const { business } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getDashboard(business.id).then((result) => {
      if (active) setData(result)
    }).catch((issue) => {
      if (active) setError(issue.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [business.id])

  const quickActions = [
    { label: 'Add customer', to: '/customers/new', icon: Users },
    { label: 'Add supplier', to: '/suppliers/new', icon: CirclePlus },
    { label: 'Give credit', to: '/transactions/new', icon: HandCoins },
    { label: 'Receive payment', to: '/receive-payment', icon: ArrowDownLeft },
    { label: 'Make payment', to: '/make-payment', icon: ArrowUpRight },
    { label: 'Add purchase', to: '/purchases', icon: ShoppingBag },
    { label: 'Add income', to: '/income', icon: TrendingUp },
    { label: 'Add expense', to: '/expenses', icon: TrendingDown },
  ]

  return (
    <div className="page-stack">
      <section className="page-heading dashboard-heading">
        <div><p className="eyebrow">{formatDate(new Date())}</p><h1>Good day. Here’s your khata.</h1><p className="page-subtitle">A live view of {business.name}.</p></div>
        <Link className="button button-secondary report-shortcut" to="/reports/business"><FileBarChart size={17} />View reports</Link>
      </section>
      {error && <div className="inline-alert alert-error">{error}</div>}
      {loading ? <div className="loading-block"><span className="spinner" />Loading your business figures…</div> : data && <>
        <section className="metric-grid metric-grid-primary" aria-label="Current balances">
          <Metric label="Customer receivables" value={formatMoney(data.receivables)} icon={ArrowDownLeft} tone="metric-green" note="Current balance owed to you" />
          <Metric label="Supplier payables" value={formatMoney(data.payables)} icon={ArrowUpRight} tone="metric-orange" note="Current balance you owe" />
          <Metric label="Customers" value={data.customerCount} icon={Users} note="Active accounts" />
          <Metric label="Suppliers" value={data.supplierCount} icon={ShoppingBag} note="Active accounts" />
        </section>
        <section className="today-section">
          <div className="section-heading"><div><p className="eyebrow">TODAY</p><h2>Movement at a glance</h2></div><span className="live-mark"><span />Live records</span></div>
          <div className="metric-grid metric-grid-small">
            <Metric label="Credit given" value={formatMoney(data.creditToday)} icon={ArrowUpRight} tone="metric-soft-green" />
            <Metric label="Collections" value={formatMoney(data.collectionsToday)} icon={ArrowDownLeft} tone="metric-soft-blue" />
            <Metric label="Supplier payments" value={formatMoney(data.supplierPaymentsToday)} icon={WalletCards} tone="metric-soft-orange" />
            <Metric label="Purchases" value={formatMoney(data.purchasesToday)} icon={ShoppingBag} />
            <Metric label="Other income" value={formatMoney(data.incomeToday)} icon={Coins} />
            <Metric label="Expenses" value={formatMoney(data.expensesToday)} icon={TrendingDown} />
          </div>
        </section>
        <section className="dashboard-lower">
          <div className="panel recent-panel">
            <div className="panel-heading"><div><p className="eyebrow">THE LATEST</p><h2>Recent transactions</h2></div><Link className="subtle-link" to="/history">All activity <ArrowRight size={15} /></Link></div>
            {data.recent.length ? <div className="recent-list">{data.recent.map((row) => <Link key={row.id} to={row.kind === 'customer' ? `/customers/${row.customer_id}/khata` : row.kind === 'supplier' ? `/suppliers/${row.supplier_id}/khata` : '/history'} className="recent-row">
              <span className={`transaction-icon ${row.transaction_type === 'payment' ? 'transaction-in' : 'transaction-out'}`}>{row.transaction_type === 'payment' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
              <span className="recent-main"><strong>{row.party || 'Account'}</strong><small>{humanType(row.type)} · {formatDate(row.transaction_date)}</small></span>
              <strong className="recent-amount">{formatMoney(row.amount)}</strong>
            </Link>)}</div> : <div className="empty-state"><BookOpenText size={24} /><strong>Your ledger starts here</strong><span>Record a credit, payment, purchase or expense to see activity.</span></div>}
          </div>
          <div className="panel quick-panel">
            <div className="panel-heading"><div><p className="eyebrow">SHORTCUTS</p><h2>Quick actions</h2></div><span className="shortcut-badge"><Plus size={15} /></span></div>
            <div className="quick-action-grid">{quickActions.map(({ label, to, icon: Icon }) => <Link className="quick-action" to={to} key={to}><Icon size={17} /><span>{label}</span><ArrowRight className="quick-arrow" size={14} /></Link>)}</div>
            <Link className="quick-report-link" to="/reports/business"><FileBarChart size={17} />Open business reports<ArrowRight size={15} /></Link>
          </div>
        </section>
      </>}
    </div>
  )
}