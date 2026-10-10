# Islamic Khata

A mobile-first bookkeeping workspace built with React, Vite, Supabase Auth and PostgreSQL. Financial records are stored in Supabase and are scoped to the authenticated business membership. The browser client must use the Supabase anon/public key only; never put a service-role key in `VITE_*` variables.

## Requirements

- Node.js 20.19+ or 22.12+
- A Supabase project with email/password authentication enabled (phone/password sign-in also requires phone auth to be enabled and configured)

## Configure Supabase

1. Create a Supabase project and copy the project URL and anon/public key from Project Settings > API.
2. Create a local `.env` file from `.env.example` and set:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
   ```

3. In the Supabase SQL Editor, run `supabase/migrations/202610100001_initial_schema.sql`.
4. In Authentication > URL Configuration, add the local app URL (normally `http://localhost:5173`) to the allowed redirect URLs. Configure email/phone verification and recovery templates for the providers you enable.
5. Restart Vite after changing environment variables.

The migration creates the profile, business/membership, settings, customers, suppliers, customer/supplier ledgers, purchases, payment allocations, income/expense categories and records, reminders, and audit log tables. It also installs row-level security and authenticated RPCs for creating businesses, contacts, purchases, ledger entries and cash entries.

## Run

```sh
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

## Verify

```sh
npm run lint
npm run build
```

## Ledger convention

Customer closing receivable is opening receivable + credit given - payments received + signed adjustments. Supplier closing payable is opening payable + credit purchases - supplier payments + signed adjustments. A negative customer result is a customer credit balance; it is not forced to zero. Customer receipts reduce receivables and are not counted again as income. Purchases and supplier payments are separate movements. Reports show cash movement categories and do not claim inventory profit because inventory cost is not tracked.

## Operational notes

- Supabase free-tier quotas, availability, backups, email delivery and phone/SMS delivery are controlled by Supabase and its providers; this project makes no unlimited or permanent-free hosting claim.
- The configured business language preference applies RTL direction and Urdu-capable font fallback. Most current screen copy is English; full Urdu translation is not yet included.
- Printing uses the browser print dialog; choose “Save as PDF” there. Reminders are user-authored and must be copied/shared by the user; no message-delivery integration is configured.
- No live Supabase integration tests can run until valid project credentials are configured and the migration is applied.
