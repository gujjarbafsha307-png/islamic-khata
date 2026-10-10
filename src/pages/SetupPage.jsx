import { Link } from 'react-router-dom'
import { CircleAlert, Settings2 } from 'lucide-react'

export default function SetupPage({ error }) {
  return (
    <main className="setup-screen">
      <div className="setup-card">
        <span className="setup-icon"><Settings2 size={21} /></span>
        <p className="eyebrow">ISLAMIC KHATA · SETUP</p>
        <h1>Connect your business ledger</h1>
        <p className="setup-copy">This workspace stores account and financial records in your own Supabase project. Configure its public URL and anon key to continue.</p>
        <div className="setup-code"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></div>
        <p className="setup-copy">Then apply the SQL migration in <code>supabase/migrations</code> and restart the development server. Never put a service-role key in frontend variables.</p>
        {error && <div className="inline-alert alert-error"><CircleAlert size={16} />{error}</div>}
        <Link className="button button-secondary" to="/welcome">Back to welcome</Link>
      </div>
    </main>
  )
}