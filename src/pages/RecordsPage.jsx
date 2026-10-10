import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowRight, Bell, CalendarDays, Check, Clipboard,
  Download, FileBarChart, FileText, Printer, Search, Send, Share2, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import { getDashboard, getLedger, getTransactions, listContacts } from '../services/khata'
import { downloadCsv, printDocument } from '../utils/export'
import { applyThemePreference, formatDate, formatMoney, fromCents, setFormattingPreferences, todayISO, toCents } from '../utils/format'

const pageNames = {
  history: 'Transaction history',
  'customer-statements': 'Customer statements',
  'supplier-statements': 'Supplier statements',
  'daily-report': 'Daily report',
  'weekly-report': 'Weekly report',
  'monthly-report': 'Monthly report',
  'business-report': 'Business report',
  search: 'Search',
  notifications: 'Notifications',
  reminders: 'Payment reminders',
  'business-profile': 'Business profile',
  profile: 'User profile',
  settings: 'Settings',
  export: 'Data export',
  help: 'Help and support',
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysAgo(count) {
  const date = new Date()
  date.setDate(date.getDate() - count)
  return isoDate(date)
}

function getPeriod(mode) {
  const today = todayISO()
  if (mode === 'daily-report') return { from: today, to: today }
  if (mode === 'weekly-report') {
    const date = new Date()
    const offset = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - offset)
    return { from: isoDate(date), to: today }
  }
  const now = new Date()
  return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today }
}

function transactionLink(row) {
  if (row.direction === 'customer') return `/customers/${row.customer_id}/khata`
  if (row.direction === 'supplier' || row.direction === 'purchase') return `/suppliers/${row.supplier_id}/khata`
  return '/history'
}

function printRows(rows, filename) {
  downloadCsv(filename, rows.map((row) => ({
    Date: formatDate(row.transaction_date),
    Party: row.party,
    Type: row.type,
    Description: row.description,
    Amount: row.amount,
    Reference: row.reference_number,
  })))
}

function HistoryPage() {
  const { business } = useAuth()
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('month')
  const [kind, setKind] = useState('all')
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayISO())
  const [sort, setSort] = useState('desc')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pageSize = 20

  useEffect(() => {
    let active = true
    getTransactions(business.id).then((data) => { if (active) setRows(data) })
      .catch((issue) => { if (active) setError(issue.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [business.id])

  const filtered = useMemo(() => rows.filter((row) => {
    const text = `${row.party} ${row.description} ${row.reference_number} ${row.type}`.toLowerCase()
    const inDates = period === 'all' || period === 'custom'
      ? period === 'all' || ((!from || row.transaction_date >= from) && (!to || row.transaction_date <= to))
      : period === 'today' ? row.transaction_date === todayISO()
        : period === 'yesterday' ? row.transaction_date === daysAgo(1)
          : period === 'week' ? row.transaction_date >= getPeriod('weekly-report').from
            : row.transaction_date >= getPeriod('monthly-report').from
    const inKind = kind === 'all' || (kind === 'customers' ? row.direction === 'customer'
      : kind === 'suppliers' ? ['supplier', 'purchase'].includes(row.direction)
        : kind === 'payments' ? row.type === 'payment'
          : kind === 'purchases' ? row.type === 'purchase'
            : kind === 'credit' ? row.type === 'credit'
              : row.type === kind)
    return inDates && inKind && text.includes(query.trim().toLowerCase())
  }).sort((a, b) => (sort === 'desc' ? -1 : 1) * `${a.transaction_date} ${a.created_at ?? ''}`.localeCompare(`${b.transaction_date} ${b.created_at ?? ''}`)), [from, kind, period, query, rows, sort, to])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  return <div className="page-stack">
    <section className="page-heading"><div><p className="eyebrow">ALL BUSINESS ACTIVITY</p><h1>Transaction history</h1><p className="page-subtitle">Ledger entries, purchases, income and expenses.</p></div><button className="button button-secondary" onClick={() => printDocument()}><Printer size={16} />Print</button></section>
    <section className="panel list-panel">
      <div className="history-filters">
        <label className="search-field"><Search size={16} /><input placeholder="Search name, description or reference" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /><button className="clear-search" aria-label="Clear search" onClick={() => { setQuery(''); setPage(1) }}>×</button></label>
        <select aria-label="Date range" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1) }}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom range</option><option value="all">All dates</option></select>
        <select aria-label="Transaction type" value={kind} onChange={(event) => { setKind(event.target.value); setPage(1) }}><option value="all">All records</option><option value="customers">Customers</option><option value="suppliers">Suppliers</option><option value="credit">Credit</option><option value="payments">Payments</option><option value="purchases">Purchases</option><option value="income">Income</option><option value="expense">Expenses</option></select>
        <button className="icon-button" aria-label="Sort by date" title={`Sort ${sort === 'desc' ? 'oldest first' : 'newest first'}`} onClick={() => setSort((value) => value === 'desc' ? 'asc' : 'desc')}><CalendarDays size={17} /></button>
      </div>
      {period === 'custom' && <div className="statement-filter"><label>From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /></label><label>To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></label></div>}
      {error && <div className="inline-alert alert-error">{error}</div>}
      {loading ? <div className="loading-block"><span className="spinner" />Loading transaction history…</div> : pageRows.length ? <>
        <div className="table-scroll"><table className="data-table history-table"><thead><tr><th>Date / time</th><th>Party</th><th>Type</th><th>Description</th><th>Method</th><th className="align-right">Amount</th></tr></thead><tbody>{pageRows.map((row) => <tr key={`${row.direction}-${row.id}`}><td>{formatDate(row.transaction_date)}<small className="table-subline">{row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</small></td><td><Link className="table-link" to={transactionLink(row)}>{row.party}</Link></td><td><span className={`type-pill type-${row.type}`}>{row.type}</span></td><td>{row.description || '—'}{row.reference_number && <small className="table-subline">Ref. {row.reference_number}</small>}</td><td>{row.payment_method?.replaceAll('_', ' ') || '—'}</td><td className="align-right"><strong>{formatMoney(row.amount)}</strong></td></tr>)}</tbody></table></div>
        <div className="table-footer"><span>{filtered.length} records · Page {page} of {pageCount}</span><div className="pager"><button className="button button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button button-secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div><button className="text-button" onClick={() => printRows(filtered, 'islamic-khata-history.csv')}><Download size={15} />Export CSV</button></div>
      </> : <div className="empty-state"><Search size={24} /><strong>No matching transactions</strong><span>Try changing the dates, type or search words.</span></div>}
    </section>
  </div>
}

function StatementPage({ kind }) {
  const { business } = useAuth()
  const isCustomer = kind === 'customer'
  const [contacts, setContacts] = useState([])
  const [contactId, setContactId] = useState('')
  const [ledger, setLedger] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayISO())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listContacts(business.id, kind).then((items) => {
      if (!active) return
      setContacts(items)
      if (items.length) setContactId(items[0].id)
    }).catch((issue) => { if (active) setError(issue.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [business.id, kind])

  useEffect(() => {
    if (!contactId) return undefined
    let active = true
    getLedger(business.id, kind, contactId).then((data) => { if (active) setLedger(data) })
      .catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false }
  }, [business.id, contactId, kind])

  const selected = ledger?.contact
  const before = ledger?.rows.filter((row) => from && row.transaction_date < from) ?? []
  const openingCents = before.reduce((sum, row) => sum + toCents(row.signed_delta), toCents(selected?.opening_balance ?? 0))
  const entries = ledger?.rows.filter((row) => (!from || row.transaction_date >= from) && (!to || row.transaction_date <= to)) ?? []
  const period = entries.reduce((result, row) => {
    const balance = result.balance + toCents(row.signed_delta)
    return { balance, rows: [...result.rows, { ...row, new_balance: fromCents(balance) }] }
  }, { balance: openingCents, rows: [] }).rows
  const closing = period.at(-1)?.new_balance ?? fromCents(openingCents)
  const exportRows = period.map((row) => ({
    Date: formatDate(row.transaction_date),
    Description: row.description,
    Type: row.transaction_type,
    Amount: Number(row.amount),
    Balance: Number(row.new_balance),
    Reference: row.reference_number,
  }))

  return <div className="page-stack">
    <section className="page-heading"><div><p className="eyebrow">ACCOUNT STATEMENT</p><h1>{isCustomer ? 'Customer' : 'Supplier'} statements</h1><p className="page-subtitle">A date-bounded view of one account and its running balance.</p></div></section>
    <section className="panel statement-panel print-area">
      <div className="statement-controls no-print"><label>{isCustomer ? 'Customer' : 'Supplier'}<select value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">Choose account</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}</select></label><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="button button-secondary" onClick={() => { downloadCsv(`${selected?.full_name ?? 'account'}-statement.csv`, exportRows) }} disabled={!selected}><Download size={16} />CSV</button><button className="button button-secondary" onClick={() => printDocument()} disabled={!selected}><Printer size={16} />Print / PDF</button></div>
      {error && <div className="inline-alert alert-error">{error}</div>}
      {loading ? <div className="loading-block"><span className="spinner" />Loading accounts…</div> : selected ? <>
        <div className="statement-business"><p className="eyebrow">{business.name}</p><h2>{selected.full_name}</h2><span>{selected.phone || (isCustomer ? 'Customer' : 'Supplier')}</span><span>Statement: {from ? formatDate(from) : 'Beginning'} to {to ? formatDate(to) : 'Today'}</span></div>
        <div className="statement-balance-strip"><span>Opening balance <strong>{formatMoney(fromCents(openingCents))}</strong></span><span>Closing balance <strong>{formatMoney(closing)}</strong></span></div>
        {period.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th className="align-right">Amount</th><th className="align-right">Running balance</th></tr></thead><tbody>{period.map((row) => <tr key={row.id}><td>{formatDate(row.transaction_date)}</td><td>{row.description || row.transaction_type}</td><td>{row.transaction_type}</td><td className="align-right">{formatMoney(row.amount)}</td><td className="align-right"><strong>{formatMoney(row.new_balance)}</strong></td></tr>)}</tbody></table></div> : <div className="empty-state compact-empty"><FileText size={23} /><strong>No transactions in this period</strong><span>The opening and closing balances are the same.</span></div>}
      </> : <div className="empty-state"><FileText size={24} /><strong>No {isCustomer ? 'customers' : 'suppliers'} to show</strong><span>Create an account before preparing its statement.</span></div>}
    </section>
  </div>
}

function ReportPage({ mode }) {
  const { business } = useAuth()
  const [range, setRange] = useState(() => getPeriod(mode))
  const [rows, setRows] = useState([])
  const [balances, setBalances] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getTransactions(business.id), getDashboard(business.id)]).then(([transactions, dashboard]) => {
      if (active) {
        setRows(transactions)
        setBalances(dashboard)
      }
    }).catch((issue) => { if (active) setError(issue.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [business.id])

  const periodRows = rows.filter((row) => row.transaction_date >= range.from && row.transaction_date <= range.to)
  const sum = (matches) => fromCents(periodRows.filter(matches).reduce((total, row) => total + toCents(row.amount), 0))
  const metrics = [
    { label: 'Credit sales', value: sum((row) => row.direction === 'customer' && row.type === 'credit'), note: 'Amount given on credit' },
    { label: 'Cash collected', value: sum((row) => row.direction === 'customer' && row.type === 'payment'), note: 'Customer receipts' },
    { label: 'Purchases', value: sum((row) => row.direction === 'purchase'), note: 'Supplier purchase value' },
    { label: 'Supplier payments', value: sum((row) => row.direction === 'supplier' && row.type === 'payment'), note: 'Includes amounts paid on purchase' },
    { label: 'Other income', value: sum((row) => row.direction === 'income'), note: 'Separate from collections' },
    { label: 'Expenses', value: sum((row) => row.direction === 'expense'), note: 'Recorded business expenses' },
    { label: 'Receivables now', value: balances?.receivables ?? 0, note: 'Current customer balances' },
    { label: 'Payables now', value: balances?.payables ?? 0, note: 'Current supplier balances' },
  ]
  const reportRows = periodRows.map((row) => ({ Date: formatDate(row.transaction_date), Party: row.party, Type: row.type, Description: row.description, Amount: Number(row.amount) }))

  return <div className="page-stack">
    <section className="page-heading"><div><p className="eyebrow">SAVED BUSINESS RECORDS</p><h1>{pageNames[mode]}</h1><p className="page-subtitle">Sales, receipts, purchases and cash expenses stay distinct.</p></div><div className="heading-actions no-print"><button className="button button-secondary" onClick={() => downloadCsv(`${mode}.csv`, reportRows)} disabled={!periodRows.length}><Download size={16} />CSV</button><button className="button button-secondary" onClick={() => printDocument()}><Printer size={16} />Print</button></div></section>
    <section className="report-date-filter no-print"><label>From<input type="date" value={range.from} onChange={(event) => setRange((value) => ({ ...value, from: event.target.value }))} /></label><label>To<input type="date" value={range.to} onChange={(event) => setRange((value) => ({ ...value, to: event.target.value }))} /></label><span>{range.from && range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : 'Select a date range'}</span></section>
    {error && <div className="inline-alert alert-error">{error}</div>}
    {loading ? <div className="loading-block"><span className="spinner" />Calculating from saved records…</div> : <>
      <section className="report-metric-grid">{metrics.map((metric) => <article className="report-metric" key={metric.label}><span>{metric.label}</span><strong>{formatMoney(metric.value)}</strong><small>{metric.note}</small></article>)}</section>
      <div className="inline-alert alert-warn report-note"><ShieldCheck size={17} /><span>Cash movement is not profit. Inventory cost data is not tracked, so this report does not estimate inventory profit.</span></div>
      <section className="panel list-panel"><div className="panel-heading"><div><p className="eyebrow">{periodRows.length} RECORDS</p><h2>Activity in this period</h2></div></div>{periodRows.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Party</th><th>Type</th><th>Description</th><th className="align-right">Amount</th></tr></thead><tbody>{periodRows.map((row) => <tr key={`${row.direction}-${row.id}`}><td>{formatDate(row.transaction_date)}</td><td>{row.party}</td><td><span className={`type-pill type-${row.type}`}>{row.type}</span></td><td>{row.description || '—'}</td><td className="align-right">{formatMoney(row.amount)}</td></tr>)}</tbody></table></div> : <div className="empty-state compact-empty"><FileBarChart size={24} /><strong>No records in this date range</strong><span>Adjust the dates or record a transaction first.</span></div>}</section>
    </>}
  </div>
}

function SearchPage() {
  const { business } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ contacts: [], transactions: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) return undefined
    const timer = window.setTimeout(() => {
      setLoading(true)
      Promise.all([
        Promise.all([listContacts(business.id, 'customer'), listContacts(business.id, 'supplier')]),
        getTransactions(business.id),
      ]).then(([contactGroups, transactions]) => {
        const matchingContacts = contactGroups.flat().filter((contact) => `${contact.full_name} ${contact.phone} ${contact.shop_name ?? ''} ${contact.business_name ?? ''}`.toLowerCase().includes(term.toLowerCase()))
        const matchingTransactions = transactions.filter((row) => `${row.description ?? ''} ${row.reference_number ?? ''} ${row.party ?? ''}`.toLowerCase().includes(term.toLowerCase()))
        setResults({ contacts: matchingContacts, transactions: matchingTransactions })
        setError('')
      }).catch((issue) => setError(issue.message)).finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [business.id, query])

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">FIND A RECORD</p><h1>Search your khata</h1><p className="page-subtitle">Names, phone numbers, shops, descriptions and references.</p></div></section>
    <label className="search-field global-search"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, phone, shop or reference…" /><button className="clear-search" aria-label="Clear search" onClick={() => setQuery('')}>×</button></label>
    {error && <div className="inline-alert alert-error">{error}</div>}{loading && <div className="loading-block"><span className="spinner" />Searching business records…</div>}
    {query.trim().length >= 2 && !loading && <div className="search-results-grid">
      <section className="panel list-panel"><div className="panel-heading"><div><p className="eyebrow">PEOPLE</p><h2>Customers and suppliers</h2></div><span className="count-badge">{results.contacts.length}</span></div>{results.contacts.length ? results.contacts.map((contact) => { const isCustomer = 'shop_name' in contact; return <Link className="search-result-row" key={contact.id} to={`/${isCustomer ? 'customers' : 'suppliers'}/${contact.id}`}><span className="contact-avatar">{contact.full_name.slice(0, 1).toUpperCase()}</span><span><strong>{contact.full_name}</strong><small>{contact.phone || contact.shop_name || contact.business_name || 'Account'}</small></span><strong>{formatMoney(contact.balance)}</strong><ArrowRight size={16} /></Link> }) : <p className="empty-inline">No matching contacts.</p>}</section>
      <section className="panel list-panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Transactions</h2></div><span className="count-badge">{results.transactions.length}</span></div>{results.transactions.length ? results.transactions.slice(0, 30).map((row) => <Link className="search-transaction-row" key={`${row.direction}-${row.id}`} to={transactionLink(row)}><span><strong>{row.description || row.type}</strong><small>{row.party} · {formatDate(row.transaction_date)}</small></span><span className="type-pill">{row.type}</span><strong>{formatMoney(row.amount)}</strong></Link>) : <p className="empty-inline">No matching transaction descriptions or references.</p>}</section>
    </div>}
  </div>
}

function ReminderPage() {
  const { business } = useAuth()
  const [customers, setCustomers] = useState([])
  const [reminders, setReminders] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      listContacts(business.id, 'customer'),
      supabase.from('reminders').select('*, customers(full_name, phone)').eq('business_id', business.id).is('completed_at', null).order('due_date'),
    ]).then(([accounts, reminderResult]) => {
      if (reminderResult.error) throw reminderResult.error
      if (active) {
        setCustomers(accounts.filter((customer) => customer.balance > 0))
        setReminders(reminderResult.data ?? [])
      }
    }).catch((issue) => { if (active) setError(issue.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [business.id])

  async function addReminder(event) {
    event.preventDefault()
    setError('')
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    const contact = customers.find((customer) => customer.id === form.customer_id)
    const reminderText = form.message.trim() || `Assalamu alaikum ${contact.full_name}, a friendly reminder about your outstanding balance of ${formatMoney(contact.balance)} with ${business.name}. Thank you.`
    const { data, error: insertError } = await supabase.from('reminders').insert({
      business_id: business.id, customer_id: contact.id, due_date: form.due_date || null, message: reminderText,
    }).select('*, customers(full_name, phone)').single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setReminders((current) => [data, ...current])
    setStatus('Reminder saved. No message was sent.')
  }

  async function completeReminder(id) {
    const { error: updateError } = await supabase.from('reminders').update({ completed_at: new Date().toISOString() })
      .eq('business_id', business.id).eq('id', id)
    if (updateError) setError(updateError.message)
    else setReminders((current) => current.filter((reminder) => reminder.id !== id))
  }

  async function shareReminder(reminder) {
    try {
      if (navigator.share) await navigator.share({ text: reminder.message })
      else {
        await navigator.clipboard.writeText(reminder.message)
        setStatus('Reminder copied. You can paste it into your messaging app.')
      }
    } catch (issue) {
      if (issue.name !== 'AbortError') setError(issue.message || 'Could not share this reminder.')
    }
  }

  async function copyReminder(reminder) {
    try {
      await navigator.clipboard.writeText(reminder.message)
      setStatus('Reminder copied to clipboard.')
    } catch (issue) {
      setError(issue.message || 'Clipboard access is unavailable in this browser.')
    }
  }

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">FOLLOW UP, THOUGHTFULLY</p><h1>Payment reminders</h1><p className="page-subtitle">Prepare messages for outstanding customer balances. Nothing is sent automatically.</p></div></section>
    {error && <div className="inline-alert alert-error">{error}</div>}{status && <div className="inline-alert alert-success"><Check size={16} />{status}</div>}
    <section className="form-layout"><form className="form-panel" onSubmit={addReminder}><h2>Prepare a reminder</h2><label>Customer with balance<select name="customer_id" required defaultValue=""><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name} · {formatMoney(customer.balance)}</option>)}</select></label><label>Due date <span className="optional">optional</span><input type="date" name="due_date" /></label><label>Message <span className="optional">leave blank to use a polite default</span><textarea name="message" rows="4" maxLength="500" placeholder="Add a personal message, or use the generated balance reminder." /></label><button className="button button-primary" disabled={!customers.length}><Bell size={16} />Save reminder</button>{!customers.length && !loading && <span className="field-hint">There are no outstanding customer balances right now.</span>}</form>
      <aside className="form-aside"><div className="aside-icon"><Share2 size={18} /></div><h3>You choose how to follow up.</h3><p>Saved reminders stay in your business account. Copy or share one when you are ready; this app does not claim delivery or send messages automatically.</p></aside></section>
    <section className="panel list-panel"><div className="panel-heading"><div><p className="eyebrow">OPEN FOLLOW UPS</p><h2>Saved reminders</h2></div></div>{loading ? <div className="loading-block"><span className="spinner" />Loading reminders…</div> : reminders.length ? reminders.map((reminder) => <article className="reminder-row" key={reminder.id}><span className="reminder-avatar"><Bell size={17} /></span><div className="reminder-content"><strong>{reminder.customers?.full_name ?? 'Customer'}</strong><span>{reminder.customers?.phone || 'No phone saved'} · Due {formatDate(reminder.due_date)}</span><p>{reminder.message}</p></div><div className="reminder-actions"><button className="icon-button" title="Copy reminder" aria-label="Copy reminder" onClick={() => copyReminder(reminder)}><Clipboard size={16} /></button><button className="icon-button" title="Share reminder" aria-label="Share reminder" onClick={() => shareReminder(reminder)}><Send size={16} /></button><button className="button button-quiet" onClick={() => completeReminder(reminder.id)}><Check size={15} />Complete</button></div></article>) : <div className="empty-state compact-empty"><Bell size={23} /><strong>No open reminders</strong><span>Saved follow-ups will appear here.</span></div>}</section>
  </div>
}

function BusinessProfilePage() {
  const { business } = useAuth()
  const [settings, setSettings] = useState({ phone: '', address: '', business_type: '' })
  const [savedSettings, setSavedSettings] = useState({ phone: '', address: '', business_type: '' })
  const [name, setName] = useState(business.name)
  const [savedName, setSavedName] = useState(business.name)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.from('business_settings').select('phone, address, business_type').eq('business_id', business.id).single()
      .then(({ data, error: queryError }) => {
        if (queryError) throw queryError
        if (active && data) {
          setSettings(data)
          setSavedSettings(data)
        }
      }).catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false }
  }, [business.id])

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    const { error: saveError } = await supabase.rpc('update_business_profile', {
      p_business_id: business.id,
      p_name: form.name,
      p_phone: form.phone,
      p_address: form.address,
      p_business_type: form.business_type,
    })
    if (saveError) setError(saveError.message)
    else {
      setSavedName(form.name)
      setSavedSettings({ phone: form.phone, address: form.address, business_type: form.business_type })
      setMessage('Business profile saved.')
    }
    setBusy(false)
  }

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">BUSINESS IDENTITY</p><h1>Business profile</h1><p className="page-subtitle">These details can be used on account statements and receipts.</p></div></section><form className="form-panel settings-form" onSubmit={save}><div className="form-grid"><label>Business name<input name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength="120" /></label><label>Business type<input name="business_type" value={settings.business_type} onChange={(event) => setSettings((value) => ({ ...value, business_type: event.target.value }))} placeholder="Retail, wholesale…" /></label><label>Phone number<input name="phone" inputMode="tel" value={settings.phone} onChange={(event) => setSettings((value) => ({ ...value, phone: event.target.value }))} /></label><label>Address<input name="address" value={settings.address} onChange={(event) => setSettings((value) => ({ ...value, address: event.target.value }))} /></label></div>{error && <div className="inline-alert alert-error">{error}</div>}{message && <div className="inline-alert alert-success">{message}</div>}<div className="form-actions"><button className="button button-secondary" type="button" onClick={() => { setName(savedName); setSettings(savedSettings); setMessage(''); setError('') }}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div></form></div>
}

function ProfilePage() {
  const { profile, user, updatePassword } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [mobile, setMobile] = useState(profile?.mobile ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function saveProfile(event) {
    event.preventDefault()
    setBusy(true)
    const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName.trim(), mobile: mobile.trim(), updated_at: new Date().toISOString() }).eq('id', user.id)
    setBusy(false)
    if (updateError) setError(updateError.message)
    else setMessage('Profile updated. Refresh the page to see the latest account label.')
  }

  async function savePassword(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setMessage('Password changed successfully.')
    } catch (issue) {
      setError(issue.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>User profile</h1><p className="page-subtitle">Personal details and account security.</p></div></section>{error && <div className="inline-alert alert-error">{error}</div>}{message && <div className="inline-alert alert-success">{message}</div>}<form className="form-panel settings-form" onSubmit={saveProfile}><h2>Personal details</h2><div className="form-grid"><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label><label>Mobile number<input value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" /></label><label>Email address<input value={user.email ?? 'Phone sign-in'} readOnly /></label></div><div className="form-actions"><span /><button className="button button-primary" disabled={busy}>Save profile</button></div></form><form className="form-panel settings-form" onSubmit={savePassword}><h2>Change password</h2><div className="form-grid"><label className="field-span-2">New password<input type="password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required autoComplete="new-password" /></label></div><p className="field-hint">Use at least 8 characters. Your password is managed by Supabase Auth.</p><div className="form-actions"><span /><button className="button button-secondary" disabled={busy || newPassword.length < 8}>Update password</button></div></form></div>
}

function SettingsPage() {
  const { business } = useAuth()
  const [form, setForm] = useState({ currency: 'PKR', language: 'en', date_format: 'dd/MM/yyyy', theme: 'light' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase.from('business_settings').select('currency, language, date_format, theme').eq('business_id', business.id).single()
      .then(({ data, error: queryError }) => {
        if (queryError) throw queryError
        if (active && data) {
          setForm(data)
          document.documentElement.lang = data.language
          document.documentElement.dir = data.language === 'ur' ? 'rtl' : 'ltr'
          applyThemePreference(data.theme)
        }
      }).catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false }
  }, [business.id])

  function setValue(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const { error: updateError } = await supabase.from('business_settings').update({ ...form, updated_at: new Date().toISOString() }).eq('business_id', business.id)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setFormattingPreferences(form)
    document.documentElement.lang = form.language
    document.documentElement.dir = form.language === 'ur' ? 'rtl' : 'ltr'
    applyThemePreference(form.theme)
    setMessage('Settings saved.')
  }

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="page-subtitle">Set language, currency, date format and appearance for this business.</p></div></section><form className="form-panel settings-form" onSubmit={save}><div className="settings-section"><h2>Regional format</h2><div className="form-grid"><label>Currency<select value={form.currency} onChange={(event) => setValue('currency', event.target.value)}><option value="PKR">PKR · Pakistani rupee</option><option value="USD">USD · US dollar</option><option value="AED">AED · UAE dirham</option></select></label><label>Language<select value={form.language} onChange={(event) => setValue('language', event.target.value)}><option value="en">English</option><option value="ur">اردو</option></select></label><label>Date format<select value={form.date_format} onChange={(event) => setValue('date_format', event.target.value)}><option value="dd/MM/yyyy">DD/MM/YYYY</option><option value="MM/dd/yyyy">MM/DD/YYYY</option><option value="yyyy-MM-dd">YYYY-MM-DD</option></select></label><label>Appearance<select value={form.theme} onChange={(event) => setValue('theme', event.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select></label></div></div>{error && <div className="inline-alert alert-error">{error}</div>}{message && <div className="inline-alert alert-success">{message}</div>}<div className="form-actions"><button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div></form><section className="panel settings-info"><ShieldCheck size={19} /><div><strong>Session security</strong><span>Your active session is protected by Supabase Auth. Signing out ends this session on this device.</span></div><Link to="/profile">Manage password</Link></section></div>
}

function ExportPage() {
  const { business } = useAuth()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function exportData(type) {
    setBusy(type)
    setError('')
    setMessage('')
    try {
      let rows
      if (type === 'customers' || type === 'suppliers') rows = await listContacts(business.id, type === 'customers' ? 'customer' : 'supplier')
      else if (type === 'activity') rows = await getTransactions(business.id)
      else {
        const table = type === 'purchases' ? 'purchases' : type === 'income' ? 'income_transactions' : 'expense_transactions'
        const { data, error: queryError } = await supabase.from(table).select('*').eq('business_id', business.id).order(type === 'purchases' ? 'purchase_date' : 'transaction_date')
        if (queryError) throw queryError
        rows = data ?? []
      }
      downloadCsv(`${business.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${type}.csv`, rows)
      setMessage(`${rows.length} ${type} records exported.`)
    } catch (issue) {
      setError(issue.message)
    } finally {
      setBusy('')
    }
  }

  const exports = [
    ['customers', 'Customer records', 'Names, contact information, opening and current balances.'],
    ['suppliers', 'Supplier records', 'Names, contact information, opening and current balances.'],
    ['activity', 'Transaction history', 'Customer and supplier ledger entries, purchases, income and expenses.'],
    ['purchases', 'Purchase records', 'Purchase amounts, dates, supplier and amounts paid.'],
    ['income', 'Income records', 'Income category, date, amount and references.'],
    ['expenses', 'Expense records', 'Expense category, date, amount and references.'],
  ]

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">YOUR BUSINESS DATA</p><h1>Data export</h1><p className="page-subtitle">Download CSV files generated from your saved business records.</p></div></section>{error && <div className="inline-alert alert-error">{error}</div>}{message && <div className="inline-alert alert-success">{message}</div>}<div className="export-list">{exports.map(([type, title, description]) => <article className="export-row" key={type}><span className="export-icon"><Download size={18} /></span><span><strong>{title}</strong><small>{description}</small></span><button className="button button-secondary" onClick={() => exportData(type)} disabled={Boolean(busy)}>{busy === type ? 'Preparing…' : 'Export CSV'}</button></article>)}</div></div>
}

function NotificationsPage() {
  const { business } = useAuth()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getTransactions(business.id).then((data) => { if (active) setRows(data.slice(0, 30)) })
      .catch((issue) => { if (active) setError(issue.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [business.id])
  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">BUSINESS ACTIVITY</p><h1>Notifications</h1><p className="page-subtitle">Recent saved entries for your business. No push messages are sent.</p></div></section>{error && <div className="inline-alert alert-error">{error}</div>}<section className="panel notification-list">{loading ? <div className="loading-block"><span className="spinner" />Loading activity…</div> : rows.length ? rows.map((row) => <Link className="notification-row" key={`${row.direction}-${row.id}`} to={transactionLink(row)}><span className="notification-mark">{row.type === 'payment' ? <ArrowDownLeft size={17} /> : <Bell size={17} />}</span><span><strong>{row.type.replaceAll('_', ' ')} · {row.party}</strong><small>{row.description || 'Business record updated'} · {formatDate(row.transaction_date)}</small></span><strong>{formatMoney(row.amount)}</strong></Link>) : <div className="empty-state"><Bell size={24} /><strong>No activity yet</strong><span>New saved transactions will appear here.</span></div>}</section></div>
}

function HelpPage() {
  const faqs = [
    ['How is a customer balance calculated?', 'Opening receivable + credit given − payments received + signed adjustments. A negative balance is shown as customer credit, not silently set to zero.'],
    ['Does a customer payment count as income?', 'No. A collection reduces that customer’s receivable. Record other income separately so collections are not counted as a second sale.'],
    ['How do I save or print a statement?', 'Open a customer or supplier statement, select its date range, then choose Print / PDF in the browser print dialog.'],
    ['Where is my business data stored?', 'In the Supabase project configured for this installation. Access is restricted by authenticated business membership and PostgreSQL row-level security.'],
    ['Can reminders be sent automatically?', 'No. You decide whether to copy or share each saved reminder. The app does not report message delivery.'],
  ]
  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">HELP DESK</p><h1>Help and support</h1><p className="page-subtitle">Answers about balances, saved records and the service connection.</p></div></section><section className="faq-list">{faqs.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}<ArrowRight size={16} /></summary><p>{answer}</p></details>)}</section><section className="panel support-panel"><div className="aside-icon"><ShieldCheck size={18} /></div><div><h2>Need account or database help?</h2><p>Contact the administrator of the Supabase project configured for this workspace. Do not share passwords, anon keys or private customer records in support messages.</p><a href="https://supabase.com/docs" target="_blank" rel="noreferrer" className="subtle-link">Supabase documentation <ArrowRight size={15} /></a></div></section></div>
}

export default function RecordsPage({ mode }) {
  if (mode === 'history') return <HistoryPage />
  if (mode === 'customer-statements') return <StatementPage kind="customer" />
  if (mode === 'supplier-statements') return <StatementPage kind="supplier" />
  if (mode.includes('report')) return <ReportPage mode={mode} />
  if (mode === 'search') return <SearchPage />
  if (mode === 'reminders') return <ReminderPage />
  if (mode === 'business-profile') return <BusinessProfilePage />
  if (mode === 'profile') return <ProfilePage />
  if (mode === 'settings') return <SettingsPage />
  if (mode === 'export') return <ExportPage />
  if (mode === 'notifications') return <NotificationsPage />
  return <HelpPage />
}