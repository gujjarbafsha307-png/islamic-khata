import { useEffect, useState } from 'react'
import { AuthContext } from './auth-context'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { applyThemePreference, setFormattingPreferences } from '../utils/format'

const bootstrappingUsers = new Set()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [business, setBusiness] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!supabase) return undefined
    let active = true

    async function loadAccount(nextSession) {
      if (!active) return
      setSession(nextSession)
      if (!nextSession?.user) {
        setBusiness(null)
        setProfile(null)
        setLoadError('')
        setReady(true)
        return
      }

      setReady(false)
      setLoadError('')
      const user = nextSession.user
      const { data: membershipRows, error: membershipError } = await supabase
        .from('business_members')
        .select('business_id, role, businesses(id, name, owner_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (membershipError) {
        if (active) {
          setLoadError(membershipError.message)
          setReady(true)
        }
        return
      }

      let membership = membershipRows?.[0]
      const businessName = user.user_metadata?.business_name
      if (!membership && businessName && !bootstrappingUsers.has(user.id)) {
        bootstrappingUsers.add(user.id)
        const { data: businessId, error } = await supabase.rpc('create_business_and_owner', {
          p_name: businessName,
          p_full_name: user.user_metadata?.full_name ?? '',
          p_mobile: user.user_metadata?.mobile ?? '',
        })
        bootstrappingUsers.delete(user.id)
        if (error) {
          if (active) {
            setLoadError(error.message)
            setReady(true)
          }
          return
        }
        const { data: businessRow, error: businessError } = await supabase
          .from('businesses')
          .select('id, name, owner_id')
          .eq('id', businessId)
          .single()
        if (businessError) {
          if (active) {
            setLoadError(businessError.message)
            setReady(true)
          }
          return
        }
        membership = { business_id: businessId, role: 'owner', businesses: businessRow }
      }

      const [profileResult, settingsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, mobile').eq('id', user.id).maybeSingle(),
        membership?.business_id
          ? supabase.from('business_settings').select('currency, date_format, language, theme').eq('business_id', membership.business_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (!active) return
      setBusiness(membership?.businesses ?? null)
      setProfile(profileResult.data ?? {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? '',
        mobile: user.user_metadata?.mobile ?? '',
      })
      if (settingsResult.data) {
        setFormattingPreferences(settingsResult.data)
        document.documentElement.lang = settingsResult.data.language
        document.documentElement.dir = settingsResult.data.language === 'ur' ? 'rtl' : 'ltr'
        applyThemePreference(settingsResult.data.theme)
      }
      setLoadError(profileResult.error?.message ?? settingsResult.error?.message ?? '')
      setReady(true)
    }

    supabase.auth.getSession().then(({ data }) => loadAccount(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => loadAccount(nextSession))
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signUp(fields) {
    const credentials = fields.email
      ? { email: fields.email }
      : { phone: fields.mobile }
    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      password: fields.password,
      options: { data: { full_name: fields.fullName, mobile: fields.mobile, business_name: fields.businessName } },
    })
    if (error) throw error
    return data
  }

  async function signIn(identity, password) {
    const credentials = identity.includes('@') ? { email: identity } : { phone: identity }
    const { error } = await supabase.auth.signInWithPassword({ ...credentials, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile, business, ready, loadError,
      signUp, signIn, signOut, resetPassword, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}