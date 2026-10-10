import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, Check, CircleAlert,
  FileText, Plus, Printer, ReceiptText, RotateCcw, Save,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import {
  addCategory, createCashEntry, createPurchase, getCategories, listContacts,
  recordCustomerTransaction, recordSupplierPayment,
} from '../services/khata'
import { printDocument } from '../utils/export'
import { formatDate, formatMoney, todayISO, toCents, fromCents } from '../utils/format'

const settings = {
  transaction: { title: 'Give credit', eyebrow: 'CUSTOMER LEDGER', description: 'Record a sale or amount given on credit.', entity: 'customer' },
  receive: { title: 'Receive payment', eyebrow: 'CUSTOMER COLLECTION', description: 'Record money collected from a customer.', entity: 'customer' },
  'supplier-payment': { title: 'Make supplier payment', eyebrow: 'SUPPLIER LEDGER', description: 'Record a payment made to a supplier.', entity: 'supplier' },
  purchase: { title: 'Record purchase', eyebrow: 'PURCHASE MANAGEMENT', description: 'Record a supplier purchase and any payment made now.', entity: 'supplier' },
  income: { title: 'Add income', eyebrow: 'CASH IN', description: 'Record income separate from customer collections.', entity: 'income' },
  expense: { title: 'Add expense', eyebrow: 'CASH OUT', description: 'Record a business expense and its category.', entity: 'expense' },
}

function Field({ label, children, className = '' }) {
  return <label className={className}>{label}{children}</label>
}

export default function FinancePage({ mode }) {
  const { business } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const config = settings[mode]
  const params = new URLSearchParams(location.search)
  const presetContact = params.get('customer') || params.get('supplier') || ''
  const isContactEntry = ['transaction', 'receive', 'supplier-payment', 'purchase'].includes(mode)
  const categoryKind = mode === 'income' ? 'income' : 'expense'
  const [contacts, setContacts] = useState([])
  const [categories, setCategories] = useState([])
  const [recent, setRecent] = useState([])
  const [selectedId, setSelectedId] = useState(presetContact)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [pending, setPending] = useState(null)
  const [entryType, setEntryType] = useState(mode === 'transaction' ? 'credit' : 'payment')
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [purchasePaid, setPurchasePaid] = useState('0')
  const idempotencyKey = useRef(null)

  useEffect(() => {
    let active = true
    const contactLoad = isContactEntry ? listContacts(business.id, config.entity) : Promise.resolve([])
    const categoryLoad = ['income', 'expense'].includes(mode) ? getCategories(business.id, categoryKind) : Promise.resolve([])
    Promise.all([contactLoad, categoryLoad]).then(([contactRows, categoryRows]) => {
      if (!active) return
      setContacts(contactRows)
      setCategories(categoryRows)
      if (!presetContact && contactRows.length) setSelectedId(contactRows[0].id)
      return loadRecent()
    }).catch((issue) => {
      if (active) setError(issue.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }

    async function loadRecent() {
      if (!['purchase', 'income', 'expense'].includes(mode)) return
      const table = mode === 'purchase' ? 'purchases' : `${mode}_transactions`
      const { data, error: queryError } = await supabase.from(table).select('*').eq('business_id', business.id)
        .order(mode === 'purchase' ? 'purchase_date' : 'transaction_date', { ascending: false }).limit(8)
      if (queryError) throw queryError
      if (active) setRecent(data ?? [])
    }
  }, [business.id, categoryKind, config.entity, isContactEntry, mode, presetContact])

  const selected = contacts.find((contact) => contact.id === selectedId)
  const amountLabel = mode === 'receive' ? 'Payment amount' : mode === 'supplier-payment' ? 'Payment amount' : mode === 'purchase' ? 'Purchase amount' : 'Amount'
  function handleReview(event) {
    event.preventDefault()
    setError('')
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount === 0 || (entryType !== 'adjustment' && amount < 0)) {
      setError(entryType === 'adjustment' ? 'Enter a non-zero adjustment amount.' : 'Amount must be greater than zero.')
      return
    }
    if (mode === 'purchase' && Number(form.amount_paid || 0) > amount) {
      setError('The amount paid cannot be greater than the purchase amount.')
      return
    }
    if (entryType === 'adjustment' && !form.notes.trim()) {
      setError('Add a reason for this balance correction.')
      return
    }
    if (isContactEntry && !selectedId) {
      setError(`Add a ${config.entity} before recording this transaction.`)
      return
    }
    if (['income', 'expense'].includes(mode) && !form.category_id) {
      setError('Select a category for this entry.')
      return
    }
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID()
    setPending({ ...form, amount, idempotency_key: idempotencyKey.current, type: entryType })
  }

  async function confirmEntry() {
    if (!pending || busy) return
    setBusy(true)
    setError('')
    try {
      const form = { ...pending, contact_id: selectedId }
      let result
      if (mode === 'transaction' || mode === 'receive') {
        result = await recordCustomerTransaction(business.id, {
          ...form,
          type: mode === 'receive' ? 'payment' : entryType,
          description: form.description || (mode === 'receive' ? 'Payment received' : 'Credit given'),
        })
      } else if (mode === 'supplier-payment') {
        result = await recordSupplierPayment(business.id, form)
      } else if (mode === 'purchase') {
        result = await createPurchase(business.id, form)
      } else {
        result = await createCashEntry(business.id, mode, form)
      }
      const link = mode === 'income' || mode === 'expense' ? '/history' : mode === 'purchase' || mode === 'supplier-payment' ? `/suppliers/${selectedId}/khata` : `/customers/${selectedId}/khata`
      setSuccess({
        id: result?.id ?? result,
        link,
        balance: result?.balance,
        amount: pending.amount,
        date: pending.date || todayISO(),
        type: mode,
        party: selected?.full_name,
        paymentMethod: pending.payment_method || 'cash',
      })
      setPending(null)
      idempotencyKey.current = null
    } catch (issue) {
      setError(issue.message || 'The entry was not saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function createNewCategory() {
    setError('')
    if (!categoryName.trim()) return
    try {
      const category = await addCategory(business.id, categoryKind, categoryName)
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)))
      setCategoryName('')
      setShowCategoryForm(false)
    } catch (issue) {
      setError(issue.message)
    }
  }

  const expectedBalance = selected && pending
    ? fromCents(toCents(selected.balance) + toCents(mode === 'receive' || mode === 'supplier-payment' ? -Math.abs(pending.amount) : pending.amount))
    : null

  return (
    <div className="page-stack">
      <section className="page-heading"><div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p className="page-subtitle">{config.description}</p></div><Link className="back-link" to={mode === 'income' || mode === 'expense' ? '/dashboard' : `/${config.entity}s`}><ArrowLeft size={16} />Back</Link></section>
      {error && <div className="inline-alert alert-error" role="alert"><CircleAlert size={17} />{error}</div>}
      {success ? <section className="panel success-panel">
        <span className="success-check"><Check size={23} /></span><p className="eyebrow">SAVED TO YOUR KHATA</p><h2>{mode === 'receive' ? 'Payment received' : mode === 'supplier-payment' ? 'Supplier payment recorded' : mode === 'purchase' ? 'Purchase recorded' : mode === 'income' ? 'Income recorded' : mode === 'expense' ? 'Expense recorded' : 'Ledger updated'}</h2>
        <p>{formatMoney(success.amount)} · {formatDate(success.date)}</p>
        {success.balance != null && <div className="new-balance-result"><span>Updated balance</span><strong>{formatMoney(success.balance)}</strong></div>}
        <div className="form-actions"><Link className="button button-primary" to={success.link}><FileText size={16} />Open updated ledger</Link>{mode === 'receive' && <button className="button button-secondary" onClick={() => printDocument()}><Printer size={16} />Print / save receipt PDF</button>}<button className="button button-quiet" onClick={() => setSuccess(null)}><RotateCcw size={15} />Add another</button></div>
        {mode === 'receive' && <div className="receipt-print"><p>{business.name}</p><h3>Payment receipt</h3><span>Received from</span><b>{success.party}</b><span>Amount received</span><strong>{formatMoney(success.amount)}</strong><span>Payment method</span><b>{success.paymentMethod.replaceAll('_', ' ')}</b><span>Date</span><b>{formatDate(success.date)}</b><span>Receipt {String(success.id).slice(0, 8)}</span></div>}
      </section> : <>
        <section className="form-layout">
          <form className="form-panel finance-form" onSubmit={handleReview}>
            {loading ? <div className="loading-block"><span className="spinner" />Loading accounts and categories…</div> : <>
              {isContactEntry && <>
                <Field label={config.entity === 'customer' ? 'Customer' : 'Supplier'}><select name="contact_id" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required><option value="">Choose {config.entity}</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name} · {formatMoney(contact.balance)}</option>)}</select></Field>
                {selected && <div className="current-balance"><span>Current {config.entity === 'customer' ? 'receivable' : 'payable'}</span><strong>{formatMoney(selected.balance)}</strong><Link to={`/${config.entity}s/${selected.id}/khata`}>View ledger <ArrowRight size={14} /></Link></div>}
              </>}
              {mode === 'transaction' && <Field label="Entry type"><select value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="credit">Credit given</option><option value="opening">Opening balance</option><option value="adjustment">Balance correction</option></select></Field>}
              {mode === 'receive' && <div className="payment-purpose"><ArrowDownLeft size={16} /><span>Customer collection reduces receivables; it is not counted again as a sale or other income.</span></div>}
              {mode === 'purchase' && <Field label="Purchase date"><input type="date" name="date" defaultValue={todayISO()} required /></Field>}
              {mode !== 'purchase' && <Field label={mode === 'transaction' && entryType === 'adjustment' ? 'Signed adjustment amount' : amountLabel}><input type="number" name="amount" min={entryType === 'adjustment' ? undefined : '0.01'} step="0.01" inputMode="decimal" placeholder="0.00" required /></Field>}
              {mode === 'purchase' && <div className="form-grid two-col"><Field label="Purchase amount"><input type="number" name="amount" value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} min="0.01" step="0.01" inputMode="decimal" required /></Field><Field label="Paid now"><input type="number" name="amount_paid" value={purchasePaid} onChange={(event) => setPurchasePaid(event.target.value)} min="0" step="0.01" inputMode="decimal" /></Field></div>}
              {mode === 'purchase' && <PurchaseStatus amount={purchaseAmount} paid={purchasePaid} />}
              {['income', 'expense'].includes(mode) && <div className="category-field"><Field label="Category"><select name="category_id" defaultValue=""><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><button className="category-add-button" type="button" aria-label="Add category" title="Add category" onClick={() => setShowCategoryForm((visible) => !visible)}><Plus size={17} /></button></div>}
              {showCategoryForm && <div className="category-inline-form"><input aria-label="New category name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Category name" maxLength="60" /><button className="button button-secondary" type="button" onClick={createNewCategory} disabled={!categoryName.trim()}>Save category</button></div>}
              {mode !== 'receive' && <Field label={mode === 'transaction' && entryType === 'adjustment' ? 'Reason for correction' : 'Description'}><input name="description" placeholder={mode === 'purchase' ? 'Goods or service purchased' : 'Add a short description'} required={mode === 'transaction' && entryType === 'adjustment'} /></Field>}
              {(mode === 'receive' || mode === 'supplier-payment' || mode === 'purchase' || mode === 'income' || mode === 'expense') && <Field label="Payment method"><select name="payment_method" defaultValue="cash"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></Field>}
              {mode !== 'purchase' && <Field label="Date"><input type="date" name="date" defaultValue={todayISO()} required /></Field>}
              <Field label="Reference number (optional)"><input name="reference_number" maxLength="100" /></Field>
              {(mode === 'receive' || mode === 'supplier-payment' || mode === 'purchase' || entryType === 'adjustment') && <Field label="Notes"><textarea name="notes" rows="3" required={entryType === 'adjustment'} placeholder={entryType === 'adjustment' ? 'Reason is required for a correction' : 'Optional notes'} /></Field>}
              <div className="form-actions"><button className="button button-secondary" type="button" onClick={() => navigate(-1)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy || loading}><ReceiptText size={16} />Review entry</button></div>
            </>}
          </form>
          <aside className="form-aside"><div className="aside-icon"><Save size={18} /></div><h3>Recorded once, in the right place.</h3><p>{mode === 'receive' ? 'Collections reduce the customer balance. They are not added to sales or income totals.' : mode === 'supplier-payment' || mode === 'purchase' ? 'Purchases increase the supplier balance; payments reduce it. Both are recorded together when applicable.' : mode === 'income' ? 'Other income stays distinct from credit sales and later customer collections.' : mode === 'expense' ? 'Expenses affect cash movement. This report does not claim inventory profit.' : 'Each customer credit updates their running receivable and the dashboard.'}</p><div className="aside-formula">{config.entity === 'customer' ? 'Receivable = opening + credit − payments + adjustments' : config.entity === 'supplier' ? 'Payable = opening + purchases − payments + adjustments' : 'Entries are stored with their business date and category'}</div></aside>
        </section>
        {pending && <div className="confirm-scrim" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><p className="eyebrow">CONFIRM ENTRY</p><h2 id="confirm-title">Save this {pending.type === 'payment' ? 'payment' : mode === 'purchase' ? 'purchase' : mode}?</h2><p>{pending.description || config.title} · {formatDate(pending.date || todayISO())}</p><div className="confirm-amount"><span>Amount</span><strong>{formatMoney(pending.amount)}</strong></div>{selected && <div className="balance-comparison"><span>Current balance <strong>{formatMoney(selected.balance)}</strong></span><ArrowRight size={17} /><span>After entry <strong>{formatMoney(expectedBalance)}</strong></span></div>}<div className="form-actions"><button className="button button-secondary" onClick={() => setPending(null)} disabled={busy}>Go back</button><button className="button button-primary" onClick={confirmEntry} disabled={busy}>{busy ? 'Saving securely…' : 'Confirm and save'}</button></div></section></div>}
      </>}
      {recent.length > 0 && !success && <section className="panel recent-records-panel"><div className="panel-heading"><div><p className="eyebrow">SAVED RECORDS</p><h2>Recent {mode === 'purchase' ? 'purchases' : `${mode} entries`}</h2></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Description</th><th className="align-right">Amount</th><th>Status</th></tr></thead><tbody>{recent.map((row) => <tr key={row.id}><td>{formatDate(mode === 'purchase' ? row.purchase_date : row.transaction_date)}</td><td>{row.description || config.title}</td><td className="align-right">{formatMoney(row.amount)}</td><td>{mode === 'purchase' ? row.amount_paid >= row.amount ? 'Paid' : row.amount_paid > 0 ? 'Partially paid' : 'Unpaid' : 'Recorded'}</td></tr>)}</tbody></table></div></section>}
    </div>
  )
}

function PurchaseStatus({ amount, paid }) {
  const total = Number(amount || 0)
  const settled = Number(paid || 0)
  if (!total) return null
  return <div className="purchase-status"><span>Remaining payable</span><strong>{formatMoney(Math.max(total - settled, 0))}</strong><small>{settled >= total ? 'Paid in full' : settled > 0 ? 'Partially paid' : 'Unpaid purchase'}</small></div>
}