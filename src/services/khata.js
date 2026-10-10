import { supabase } from '../lib/supabase'
import { fromCents, toCents, todayISO } from '../utils/format'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. Add the required environment variables and restart the app.')
  return supabase
}

function unwrap(result) {
  if (result.error) throw result.error
  return result.data
}

export async function listContacts(businessId, kind) {
  const client = requireClient()
  const table = kind === 'customer' ? 'customers' : 'suppliers'
  const ledger = kind === 'customer' ? 'customer_transactions' : 'supplier_transactions'
  const [{ data: contacts, error }, { data: entries, error: ledgerError }] = await Promise.all([
    client.from(table).select('*').eq('business_id', businessId).is('archived_at', null).order('full_name'),
    client.from(ledger).select('customer_id, supplier_id, signed_delta').eq('business_id', businessId),
  ])
  if (error) throw error
  if (ledgerError) throw ledgerError
  const contactKey = kind === 'customer' ? 'customer_id' : 'supplier_id'
  const sums = new Map()
  for (const entry of entries ?? []) sums.set(entry[contactKey], (sums.get(entry[contactKey]) ?? 0) + toCents(entry.signed_delta))
  return (contacts ?? []).map((contact) => ({
    ...contact,
    balance: fromCents(toCents(contact.opening_balance) + (sums.get(contact.id) ?? 0)),
  }))
}

export async function getContact(businessId, kind, id) {
  const client = requireClient()
  const { data, error } = await client.from(kind === 'customer' ? 'customers' : 'suppliers')
    .select('*').eq('business_id', businessId).eq('id', id).single()
  if (error) throw error
  return data
}

export async function archiveContact(businessId, kind, id) {
  const client = requireClient()
  const { error } = await client.from(kind === 'customer' ? 'customers' : 'suppliers')
    .update({ archived_at: new Date().toISOString() }).eq('business_id', businessId).eq('id', id)
  if (error) throw error
}

export async function saveContact(businessId, kind, form, id) {
  const client = requireClient()
  if (id) {
    const { error } = await client.from(kind === 'customer' ? 'customers' : 'suppliers')
      .update(kind === 'customer' ? {
        full_name: form.full_name, phone: form.phone, email: form.email, address: form.address,
        shop_name: form.shop_name, notes: form.notes,
      } : {
        full_name: form.full_name, phone: form.phone, business_name: form.business_name,
        address: form.address, notes: form.notes,
      })
      .eq('business_id', businessId).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await client.rpc(kind === 'customer' ? 'create_customer' : 'create_supplier', kind === 'customer' ? {
    p_business_id: businessId,
    p_full_name: form.full_name,
    p_phone: form.phone ?? '',
    p_email: form.email ?? '',
    p_address: form.address ?? '',
    p_shop_name: form.shop_name ?? '',
    p_opening_balance: Number(form.opening_balance || 0),
    p_notes: form.notes ?? '',
    p_idempotency_key: crypto.randomUUID(),
  } : {
    p_business_id: businessId,
    p_full_name: form.full_name,
    p_phone: form.phone ?? '',
    p_business_name: form.business_name ?? '',
    p_address: form.address ?? '',
    p_opening_balance: Number(form.opening_balance || 0),
    p_notes: form.notes ?? '',
    p_idempotency_key: crypto.randomUUID(),
  })
  return unwrap({ data, error })
}

export async function getLedger(businessId, kind, id) {
  const client = requireClient()
  const contact = await getContact(businessId, kind, id)
  const isCustomer = kind === 'customer'
  const table = isCustomer ? 'customer_transactions' : 'supplier_transactions'
  const key = isCustomer ? 'customer_id' : 'supplier_id'
  const { data, error } = await client.from(table).select('*').eq('business_id', businessId).eq(key, id)
    .order('transaction_date').order('created_at')
  if (error) throw error
  let running = toCents(contact.opening_balance)
  const rows = (data ?? []).map((entry) => {
    const previous = running
    running += toCents(entry.signed_delta)
    return { ...entry, previous_balance: fromCents(previous), new_balance: fromCents(running) }
  })
  return { contact: { ...contact, balance: fromCents(running) }, rows }
}

export async function recordCustomerTransaction(businessId, values) {
  const client = requireClient()
  return unwrap(await client.rpc('record_customer_transaction', {
    p_business_id: businessId,
    p_customer_id: values.contact_id,
    p_type: values.type,
    p_amount: Number(values.amount),
    p_description: values.description || values.type,
    p_date: values.date || todayISO(),
    p_payment_method: values.payment_method || '',
    p_reference: values.reference_number || '',
    p_notes: values.notes || '',
    p_idempotency_key: values.idempotency_key || crypto.randomUUID(),
  }))
}

export async function recordSupplierPayment(businessId, values) {
  const client = requireClient()
  return unwrap(await client.rpc('record_supplier_payment', {
    p_business_id: businessId,
    p_supplier_id: values.contact_id,
    p_amount: Number(values.amount),
    p_date: values.date || todayISO(),
    p_payment_method: values.payment_method || 'cash',
    p_reference: values.reference_number || '',
    p_notes: values.notes || '',
    p_idempotency_key: values.idempotency_key || crypto.randomUUID(),
  }))
}

export async function createPurchase(businessId, values) {
  const client = requireClient()
  return unwrap(await client.rpc('create_purchase', {
    p_business_id: businessId,
    p_supplier_id: values.contact_id,
    p_description: values.description || 'Purchase',
    p_amount: Number(values.amount),
    p_amount_paid: Number(values.amount_paid || 0),
    p_date: values.date || todayISO(),
    p_reference: values.reference_number || '',
    p_notes: values.notes || '',
    p_payment_method: values.payment_method || 'cash',
    p_idempotency_key: values.idempotency_key || crypto.randomUUID(),
  }))
}

export async function createCashEntry(businessId, kind, values) {
  const client = requireClient()
  return unwrap(await client.rpc('create_cash_entry', {
    p_business_id: businessId,
    p_kind: kind,
    p_category_id: values.category_id || null,
    p_amount: Number(values.amount),
    p_description: values.description || '',
    p_date: values.date || todayISO(),
    p_payment_method: values.payment_method || 'cash',
    p_reference: values.reference_number || '',
    p_notes: values.notes || '',
    p_idempotency_key: values.idempotency_key || crypto.randomUUID(),
  }))
}

export async function getCategories(businessId, kind) {
  const client = requireClient()
  const { data, error } = await client.from(kind === 'income' ? 'income_categories' : 'expense_categories')
    .select('id, name').eq('business_id', businessId).order('name')
  if (error) throw error
  return data ?? []
}

export async function addCategory(businessId, kind, name) {
  const client = requireClient()
  const { data, error } = await client.from(kind === 'income' ? 'income_categories' : 'expense_categories')
    .insert({ business_id: businessId, name: name.trim() }).select('id, name').single()
  if (error) throw error
  return data
}

export async function getDashboard(businessId) {
  const client = requireClient()
  const today = todayISO()
  const [customers, suppliers, customerTransactions, supplierTransactions, purchases, income, expenses] = await Promise.all([
    listContacts(businessId, 'customer'),
    listContacts(businessId, 'supplier'),
    client.from('customer_transactions').select('*, customers(full_name)').eq('business_id', businessId).eq('transaction_date', today).order('created_at', { ascending: false }),
    client.from('supplier_transactions').select('*, suppliers(full_name)').eq('business_id', businessId).eq('transaction_date', today).order('created_at', { ascending: false }),
    client.from('purchases').select('*, suppliers(full_name)').eq('business_id', businessId).eq('purchase_date', today),
    client.from('income_transactions').select('*').eq('business_id', businessId).eq('transaction_date', today),
    client.from('expense_transactions').select('*').eq('business_id', businessId).eq('transaction_date', today),
  ])
  for (const result of [customerTransactions, supplierTransactions, purchases, income, expenses]) {
    if (result.error) throw result.error
  }
  const customerRows = customerTransactions.data ?? []
  const supplierRows = supplierTransactions.data ?? []
  const recent = [
    ...customerRows.map((row) => ({ ...row, party: row.customers?.full_name, kind: 'customer', type: row.transaction_type })),
    ...supplierRows.map((row) => ({ ...row, party: row.suppliers?.full_name, kind: 'supplier', type: row.transaction_type })),
    ...(income.data ?? []).map((row) => ({ ...row, party: 'Business income', kind: 'business', type: 'income' })),
    ...(expenses.data ?? []).map((row) => ({ ...row, party: 'Business expense', kind: 'business', type: 'expense' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)
  const centsTotal = (rows, field = 'amount') => rows.reduce((sum, row) => sum + toCents(row[field]), 0)
  return {
    customers,
    suppliers,
    receivables: fromCents(customers.reduce((sum, row) => sum + toCents(row.balance), 0)),
    payables: fromCents(suppliers.reduce((sum, row) => sum + toCents(row.balance), 0)),
    customerCount: customers.length,
    supplierCount: suppliers.length,
    creditToday: fromCents(centsTotal(customerRows.filter((row) => row.transaction_type === 'credit'))),
    collectionsToday: fromCents(centsTotal(customerRows.filter((row) => row.transaction_type === 'payment'))),
    supplierPaymentsToday: fromCents(centsTotal(supplierRows.filter((row) => row.transaction_type === 'payment'))),
    purchasesToday: fromCents(centsTotal(purchases.data ?? [])),
    incomeToday: fromCents(centsTotal(income.data ?? [])),
    expensesToday: fromCents(centsTotal(expenses.data ?? [])),
    recent,
  }
}

export async function getTransactions(businessId) {
  const client = requireClient()
  const results = await Promise.all([
    client.from('customer_transactions').select('*, customers(full_name)').eq('business_id', businessId),
    client.from('supplier_transactions').select('*, suppliers(full_name)').eq('business_id', businessId),
    client.from('purchases').select('*, suppliers(full_name)').eq('business_id', businessId),
    client.from('income_transactions').select('*').eq('business_id', businessId),
    client.from('expense_transactions').select('*').eq('business_id', businessId),
  ])
  for (const result of results) if (result.error) throw result.error
  const [customers, suppliers, purchases, income, expenses] = results.map(({ data }) => data ?? [])
  return [
    ...customers.map((row) => ({ ...row, party: row.customers?.full_name ?? 'Customer', type: row.transaction_type, direction: 'customer' })),
    ...suppliers.map((row) => ({ ...row, party: row.suppliers?.full_name ?? 'Supplier', type: row.transaction_type, direction: 'supplier' })),
    ...purchases.map((row) => ({ ...row, party: row.suppliers?.full_name ?? 'Supplier', type: 'purchase', direction: 'purchase' })),
    ...income.map((row) => ({ ...row, party: 'Business', type: 'income', direction: 'income' })),
    ...expenses.map((row) => ({ ...row, party: 'Business', type: 'expense', direction: 'expense' })),
  ].sort((a, b) => `${b.transaction_date} ${b.created_at ?? ''}`.localeCompare(`${a.transaction_date} ${a.created_at ?? ''}`))
}