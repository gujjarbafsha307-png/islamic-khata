import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpenCheck, CircleAlert, Fingerprint, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

const copy = {
  welcome: { title: 'A clearer view of every balance.', subtitle: 'A practical, private khata for the people and business you look after.' },
  login: { title: 'Welcome back.', subtitle: 'Sign in to your business khata.' },
  register: { title: 'Start your business khata.', subtitle: 'Set up your account and keep every entry in one place.' },
  'forgot-password': { title: 'Reset your password.', subtitle: 'We’ll send a secure password reset link to your email.' },
  'reset-password': { title: 'Choose a new password.', subtitle: 'Use a strong password you have not used before.' },
}

export default function AuthPage({ mode }) {
  const { signUp, signIn, resetPassword, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState({ fullName: '', mobile: '', email: '', businessName: '', identity: '', password: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [currentMode, setCurrentMode] = useState(mode)
  const content = copy[currentMode]
  const isRegister = currentMode === 'register'

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Follow the setup instructions before creating an account.')
      return
    }
    if (isRegister && values.password !== values.confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    if ((currentMode === 'register' || currentMode === 'reset-password') && values.password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      if (currentMode === 'register') {
        if (!values.mobile.trim() || !values.businessName.trim()) throw new Error('Mobile number and business name are required.')
        const result = await signUp(values)
        if (result.session) navigate('/dashboard')
        else setMessage('Account created. Check your email or phone for the verification step, then sign in.')
      } else if (currentMode === 'login') {
        await signIn(values.identity.trim(), values.password)
        navigate('/dashboard')
      } else if (currentMode === 'forgot-password') {
        await resetPassword(values.email.trim())
        setMessage('If an account exists for that email, Supabase has sent a password reset link.')
      } else if (currentMode === 'reset-password') {
        if (values.password !== values.confirmPassword) throw new Error('The passwords do not match.')
        await updatePassword(values.password)
        setMessage('Password updated. You can continue using your account.')
        navigate('/dashboard')
      }
    } catch (issue) {
      setError(issue.message || 'The request could not be completed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const setMode = (next) => {
    setCurrentMode(next)
    setError('')
    setMessage('')
    navigate(next === 'welcome' ? '/welcome' : `/${next}`)
  }

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <Link to="/welcome" className="brand-lockup auth-brand"><span className="brand-mark">IK</span><span><strong>Islamic Khata</strong><small>Books in balance</small></span></Link>
        <div className="story-content">
          <p className="eyebrow">A GOOD ACCOUNT, KEPT WELL</p>
          <h1>{content.title}</h1>
          <p className="story-subtitle">{content.subtitle}</p>
          <div className="story-rule" />
          <div className="story-note"><BookOpenCheck size={19} /><span>Customers, suppliers and daily cash movement, together in one dependable ledger.</span></div>
          <div className="story-note"><ShieldCheck size={19} /><span>Your business records stay behind your own authenticated account.</span></div>
        </div>
        <span className="story-foot">Made for the everyday work of Pakistani businesses</span>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          {currentMode !== 'welcome' && <button className="back-link" onClick={() => setMode('welcome')}><ArrowLeft size={16} />Back</button>}
          {currentMode === 'welcome' && <p className="eyebrow form-eyebrow">YOUR BUSINESS, IN GOOD ORDER</p>}
          <h2>{currentMode === 'welcome' ? 'Keep your khata close.' : currentMode === 'login' ? 'Sign in' : currentMode === 'register' ? 'Create account' : currentMode === 'forgot-password' ? 'Password recovery' : 'Update password'}</h2>
          <p className="form-intro">{currentMode === 'welcome' ? 'Start with your business, then record your first balance.' : content.subtitle}</p>
          {currentMode === 'welcome' ? (
            <div className="welcome-actions">
              <button className="button button-primary button-wide" onClick={() => setMode('register')}>Create a free account <ArrowRight size={17} /></button>
              <button className="button button-secondary button-wide" onClick={() => setMode('login')}>Sign in to your account</button>
              {!isSupabaseConfigured && <div className="inline-alert alert-warn"><CircleAlert size={17} /><span>Backend setup is required before accounts and records can be saved.</span></div>}
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {currentMode === 'register' && <>
                <label>Full name<input name="fullName" value={values.fullName} onChange={update} autoComplete="name" required /></label>
                <label>Mobile number<input name="mobile" value={values.mobile} onChange={update} autoComplete="tel" inputMode="tel" required /></label>
                <label>Email address <span className="optional">optional</span><input type="email" name="email" value={values.email} onChange={update} autoComplete="email" /></label>
                <label>Business name<input name="businessName" value={values.businessName} onChange={update} required /></label>
              </>}
              {currentMode === 'login' && <label>Email or mobile number<input name="identity" value={values.identity} onChange={update} autoComplete="username" required /></label>}
              {currentMode === 'forgot-password' && <label>Email address<input type="email" name="email" value={values.email} onChange={update} autoComplete="email" required /></label>}
              {currentMode !== 'forgot-password' && <label>{currentMode === 'reset-password' ? 'New password' : 'Password'}<input type="password" name="password" value={values.password} onChange={update} autoComplete={currentMode === 'login' ? 'current-password' : 'new-password'} minLength="8" required /></label>}
              {(currentMode === 'register' || currentMode === 'reset-password') && <label>Confirm password<input type="password" name="confirmPassword" value={values.confirmPassword} onChange={update} autoComplete="new-password" minLength="8" required /></label>}
              {error && <div className="inline-alert alert-error" role="alert"><CircleAlert size={17} />{error}</div>}
              {message && <div className="inline-alert alert-success" role="status">{message}</div>}
              <button className="button button-primary button-wide" type="submit" disabled={busy || !isSupabaseConfigured}>
                {busy ? 'Please wait…' : currentMode === 'register' ? 'Create account' : currentMode === 'login' ? 'Sign in' : currentMode === 'forgot-password' ? 'Send reset link' : 'Save new password'}
                {!busy && <ArrowRight size={17} />}
              </button>
              <div className="auth-form-links">
                {currentMode === 'login' && <button type="button" className="text-button" onClick={() => setMode('forgot-password')}>Forgot password?</button>}
                {currentMode === 'login' && <span>New here? <button type="button" className="text-button" onClick={() => setMode('register')}>Create account</button></span>}
                {currentMode === 'register' && <span>Already registered? <button type="button" className="text-button" onClick={() => setMode('login')}>Sign in</button></span>}
              </div>
              {!isSupabaseConfigured && <p className="config-hint"><Fingerprint size={15} />Connect Supabase before submitting credentials.</p>}
            </form>
          )}
          <p className="privacy-foot">Private by design <span>·</span> Financial data is not stored in this browser</p>
        </div>
      </section>
    </main>
  )
}