import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Archive, BookOpenText,
  Download, FileText, Pencil, Plus, Printer, Search, UserRoundPlus,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { archiveContact, getLedger, listContacts, saveContact } from '../services/khata'
import { downloadCsv, printDocument } from '../utils/export'
import { formatDate, formatMoney, fromCents, toCents } from '../utils/format'

function ContactForm({ kind, contact, onCancel, onSaved }) {
  const { business } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isCustomer = kind === 'customer'

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const id = await saveContact(business.id, kind, form, contact?.id)
      onSaved(id, form)
    } catch (issue) {
      setError(issue.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-panel contact-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field-span-2">{isCustomer ? 'Customer name' : 'Supplier name'}<input name="full_name" defaultValue={contact?.full_name ?? ''} autoFocus required maxLength="120" /></label>
        <label>Phone number<input name="phone" defaultValue={contact?.phone ?? ''} inputMode="tel" maxLength="40" /></label>
        {isCustomer ? <label>Email address <span className="optional">optional</span><input type="email" name="email" defaultValue={contact?.email ?? ''} /></label> : <label>Business name<input name="business_name" defaultValue={contact?.business_name ?? ''} /></label>}
        <label className="field-span-2">Address<input name="address" defaultValue={contact?.address ?? ''} /></label>
        {isCustomer && <label>Shop name<input name="shop_name" defaultValue={contact?.shop_name ?? ''} /></label>}
        {!contact && <label>Opening balance <span className="optional">PKR</span><input type="number" name="opening_balance" defaultValue="0" min="0" step="0.01" inputMode="decimal" required /></label>}
        <label className="field-span-2">Notes<textarea name="notes" defaultValue={contact?.notes ?? ''} rows="3" /></label>
      </div>
      {error && <div className="inline-alert alert-error" role="alert">{error}</div>}
      <div className="form-actions"><button className="button button-secondary" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : contact ? 'Save changes' : `Add ${isCustomer ? 'customer' : 'supplier'}`}</button></div>
    </form>
  )
}

function ContactList({ kind }) {
  const { business } = useAuth()
  const isCustomer = kind === 'customer'
  const noun = isCustomer ? 'customer' : 'supplier'
  const [contacts, setContacts] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listContacts(business.id, kind).then((rows) => {
      if (active) setContacts(rows)
    }).catch((issue) => {
      if (active) setError(issue.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [business.id, kind])

  const filtered = useMemo(() => contacts.filter((contact) => {
    const searchText = `${contact.full_name} ${contact.phone} ${contact.shop_name ?? ''} ${contact.business_name ?? ''}`.toLowerCase()
    return searchText.includes(query.trim().toLowerCase()) && (filter === 'all' || (filter === 'owing' ? contact.balance > 0 : contact.balance < 0))
  }), [contacts, filter, query])

  return (
    <div className="page-stack">
      <section className="page-heading"><div><p className="eyebrow">YOUR PEOPLE</p><h1>{isCustomer ? 'Customers' : 'Suppliers'}</h1><p className="page-subtitle">Keep contact details and account balances together.</p></div><Link className="button button-primary" to={`/${noun}s/new`}><Plus size={17} />Add {noun}</Link></section>
      <section className="panel list-panel">
        <div className="list-toolbar"><label className="search-field"><Search size={17} /><input aria-label={`Search ${noun}s`} placeholder={`Search by name, phone or ${isCustomer ? 'shop' : 'business'}…`} value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label><select aria-label="Filter accounts" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All accounts</option><option value="owing">{isCustomer ? 'Owes your business' : 'You owe supplier'}</option><option value="credit">Credit balance</option></select></div>
        {error && <div className="inline-alert alert-error">{error}</div>}
        {loading ? <div className="loading-block"><span className="spinner" />Loading {noun}s…</div> : filtered.length ? <div className="contact-list">
          <div className="table-head contact-grid"><span>NAME</span><span>{isCustomer ? 'PHONE / SHOP' : 'PHONE / BUSINESS'}</span><span>ACCOUNT BALANCE</span><span /></div>
          {filtered.map((contact) => <Link to={`/${noun}s/${contact.id}`} className="contact-row contact-grid" key={contact.id}>
            <span className="contact-name"><span className="contact-avatar">{contact.full_name.slice(0, 1).toUpperCase()}</span><span><strong>{contact.full_name}</strong><small>Added {formatDate(contact.created_at)}</small></span></span>
            <span className="contact-meta"><strong>{contact.phone || 'No phone added'}</strong><small>{isCustomer ? contact.shop_name || contact.email || 'Customer' : contact.business_name || 'Supplier'}</small></span>
            <span className={`balance-cell ${contact.balance < 0 ? 'balance-credit' : ''}`}><strong>{formatMoney(Math.abs(contact.balance))}</strong><small>{contact.balance > 0 ? isCustomer ? 'Receivable' : 'Payable' : contact.balance < 0 ? 'Credit balance' : 'Settled'}</small></span>
            <ArrowRight className="row-arrow" size={16} />
          </Link>)}
        </div> : <div className="empty-state"><UserRoundPlus size={25} /><strong>{query ? 'No matching records' : `No ${noun}s yet`}</strong><span>{query ? 'Try another name, number or business.' : `Add a ${noun} to start keeping their account.`}</span>{!query && <Link className="button button-secondary" to={`/${noun}s/new`}>Add {noun}</Link>}</div>}
      </section>
    </div>
  )
}

function NewContactPage({ kind }) {
  const navigate = useNavigate()
  const isCustomer = kind === 'customer'
  const base = isCustomer ? '/customers' : '/suppliers'
  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">NEW ACCOUNT</p><h1>Add {isCustomer ? 'customer' : 'supplier'}</h1><p className="page-subtitle">Opening balances become part of the account ledger.</p></div><Link className="back-link" to={base}><ArrowLeft size={16} />Back</Link></section><ContactForm kind={kind} onCancel={() => navigate(base)} onSaved={(id) => navigate(`${base}/${id}`)} /></div>
}

function AccountPage({ kind, mode }) {
  const { id } = useParams()
  const { business } = useAuth()
  const navigate = useNavigate()
  const isCustomer = kind === 'customer'
  const base = `/${isCustomer ? 'customers' : 'suppliers'}`
  const [account, setAccount] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    let active = true
    getLedger(business.id, kind, id).then(({ contact, rows: entries }) => {
      if (active) {
        setAccount(contact)
        setRows(entries)
      }
    }).catch((issue) => {
      if (active) setError(issue.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [business.id, id, kind])

  if (loading) return <div className="loading-block"><span className="spinner" />Loading account…</div>
  if (error && !account) return <div className="inline-alert alert-error">{error}</div>
  if (!account) return <div className="empty-state"><strong>Account not found</strong><Link to={base}>Back to {isCustomer ? 'customers' : 'suppliers'}</Link></div>

  if (editing) return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">EDIT ACCOUNT</p><h1>{account.full_name}</h1></div><button className="back-link" onClick={() => setEditing(false)}><ArrowLeft size={16} />Cancel</button></section><ContactForm kind={kind} contact={account} onCancel={() => setEditing(false)} onSaved={(_savedId, form) => { setAccount((current) => ({ ...current, ...form })); setEditing(false) }} /></div>

  const periodRows = rows.filter((row) => (!fromDate || row.transaction_date >= fromDate) && (!toDate || row.transaction_date <= toDate))
  const openingCents = rows.filter((row) => fromDate && row.transaction_date < fromDate)
    .reduce((sum, row) => sum + toCents(row.signed_delta), toCents(account.opening_balance))
  const statementLedger = periodRows.reduce((result, row) => {
    const balance = result.balance + toCents(row.signed_delta)
    return { balance, rows: [...result.rows, { ...row, new_balance: fromCents(balance) }] }
  }, { balance: openingCents, rows: [] }).rows
  const statementRows = statementLedger.map((row) => ({
    Date: formatDate(row.transaction_date),
    Description: row.description || row.transaction_type,
    Type: row.transaction_type,
    Amount: row.transaction_type === 'payment' ? `-${row.amount}` : row.amount,
    Balance: formatMoney(row.new_balance),
  }))
  const closingBalance = statementLedger.at(-1)?.new_balance ?? fromCents(openingCents)

  async function handleArchive() {
    if (!window.confirm(`Archive ${account.full_name}? Their ledger will remain available in financial history.`)) return
    try {
      await archiveContact(business.id, kind, id)
      navigate(base)
    } catch (issue) {
      setError(issue.message)
    }
  }

  function printStatement() {
    document.title = `${account.full_name} - Islamic Khata statement`
    printDocument()
  }

  return (
    <div className="page-stack">
      <section className="page-heading account-heading"><div><Link className="back-link" to={base}><ArrowLeft size={15} />All {isCustomer ? 'customers' : 'suppliers'}</Link><p className="eyebrow">{isCustomer ? 'CUSTOMER ACCOUNT' : 'SUPPLIER ACCOUNT'}</p><h1>{account.full_name}</h1><p className="page-subtitle">{account.phone || 'No phone number'}{(account.shop_name || account.business_name) && ` · ${account.shop_name || account.business_name}`}</p></div><div className="heading-actions"><Link className="button button-secondary" to={`${base}/${id}/statement`}><FileText size={16} />Statement</Link><button className="button button-secondary" onClick={() => setEditing(true)}><Pencil size={15} />Edit</button><button className="icon-button" aria-label={`Archive ${account.full_name}`} title="Archive account" onClick={handleArchive}><Archive size={17} /></button></div></section>
      {error && <div className="inline-alert alert-error">{error}</div>}
      <section className="account-summary">
        <div className="account-balance-block"><span>{isCustomer ? 'Current receivable' : 'Current payable'}</span><strong>{formatMoney(Math.abs(account.balance))}</strong><small>{account.balance < 0 ? 'This account has a credit balance' : account.balance === 0 ? 'This account is settled' : 'Calculated from opening balance and ledger entries'}</small></div>
        <div className="account-summary-meta"><div><span>Opening balance</span><strong>{formatMoney(account.opening_balance)}</strong></div><div><span>Contact since</span><strong>{formatDate(account.created_at)}</strong></div><div><span>Ledger entries</span><strong>{rows.length}</strong></div></div>
      </section>
      <div className="account-action-row">
        {isCustomer ? <>
          <Link className="button button-primary" to={`/transactions/new?customer=${id}`}><ArrowUpRight size={17} />Give credit</Link>
          <Link className="button button-secondary" to={`/receive-payment?customer=${id}`}><ArrowDownLeft size={17} />Receive payment</Link>
        </> : <>
          <Link className="button button-primary" to={`/purchases?supplier=${id}`}><Plus size={17} />Record purchase</Link>
          <Link className="button button-secondary" to={`/make-payment?supplier=${id}`}><ArrowUpRight size={17} />Make payment</Link>
        </>}
        <Link className="button button-quiet" to={`${base}/${id}/khata`}><BookOpenText size={16} />Open khata</Link>
      </div>
      {mode === 'statement' ? <section className="panel statement-panel print-area">
        <div className="panel-heading"><div><p className="eyebrow">ISLAMIC KHATA · {business.name}</p><h2>{account.full_name} statement</h2></div><div className="heading-actions no-print"><button className="button button-secondary" onClick={() => downloadCsv(`${account.full_name}-statement.csv`, statementRows)}><Download size={16} />CSV</button><button className="button button-secondary" onClick={printStatement}><Printer size={16} />Print / PDF</button></div></div>
        <div className="statement-filter no-print"><label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div>
        <div className="statement-balance-strip"><span>Opening balance for period <strong>{formatMoney(fromCents(openingCents))}</strong></span><span>Closing balance <strong>{formatMoney(closingBalance)}</strong></span></div>
        <LedgerTable rows={statementLedger} />
      </section> : <section className="panel ledger-panel">
        <div className="panel-heading"><div><p className="eyebrow">ACCOUNT ACTIVITY</p><h2>{mode === 'ledger' ? 'Khata ledger' : 'Recent ledger entries'}</h2></div><Link className="subtle-link" to={`${base}/${id}/khata`}>Full ledger <ArrowRight size={15} /></Link></div>
        <LedgerTable rows={mode === 'ledger' ? rows.slice().reverse() : rows.slice(-8).reverse()} />
      </section>}
    </div>
  )
}

function LedgerTable({ rows }) {
  if (!rows.length) return <div className="empty-state compact-empty"><BookOpenText size={23} /><strong>No ledger entries in this period</strong><span>Opening balances and new transactions appear here.</span></div>
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th className="align-right">Amount</th><th className="align-right">Balance</th></tr></thead><tbody>{rows.map((row) => {
    const positive = Number(row.signed_delta) >= 0
    return <tr key={row.id}><td>{formatDate(row.transaction_date)}</td><td><strong>{row.description || row.transaction_type}</strong>{row.reference_number && <small className="table-subline">Ref. {row.reference_number}</small>}</td><td><span className={`type-pill type-${row.transaction_type}`}>{row.transaction_type}</span></td><td className={`align-right ${positive ? 'amount-positive' : 'amount-negative'}`}>{positive ? '+' : '-'}{formatMoney(Math.abs(Number(row.amount)))}</td><td className="align-right balance-cell">{formatMoney(row.new_balance)}</td></tr>
  })}</tbody></table></div>
}

export default function ContactsPage({ kind, mode }) {
  if (mode === 'list') return <ContactList kind={kind} />
  if (mode === 'new') return <NewContactPage kind={kind} />
  return <AccountPage kind={kind} mode={mode} />
}