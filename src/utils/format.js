let activeCurrency = 'PKR'
let activeDateFormat = 'dd/MM/yyyy'

export function setFormattingPreferences(preferences = {}) {
  if (preferences.currency) activeCurrency = preferences.currency
  if (preferences.date_format) activeDateFormat = preferences.date_format
}

export function applyThemePreference(theme = 'light') {
  const prefersDark = theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = prefersDark ? 'dark' : theme
}

export function formatMoney(amount, currency = 'PKR') {
  const selectedCurrency = currency === 'PKR' ? activeCurrency : currency
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: selectedCurrency,
    maximumFractionDigits: 2,
  }).format(Number(amount ?? 0))
}

export function formatDate(value, options = {}) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (options.month || options.weekday) {
    return new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', year: 'numeric', ...options }).format(date)
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  if (activeDateFormat === 'MM/dd/yyyy') return `${month}/${day}/${year}`
  if (activeDateFormat === 'yyyy-MM-dd') return `${year}-${month}-${day}`
  return `${day}/${month}/${year}`
}

export function todayISO() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export function toCents(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

export function fromCents(value) {
  return value / 100
}