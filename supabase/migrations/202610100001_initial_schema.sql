create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  mobile text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  currency text not null default 'PKR',
  language text not null default 'en' check (language in ('en', 'ur')),
  date_format text not null default 'dd/MM/yyyy',
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  address text not null default '',
  phone text not null default '',
  business_type text not null default '',
  logo_url text,
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  shop_name text not null default '',
  opening_balance numeric(14, 2) not null default 0 check (opening_balance >= 0),
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null default '',
  business_name text not null default '',
  address text not null default '',
  opening_balance numeric(14, 2) not null default 0 check (opening_balance >= 0),
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.customer_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  transaction_type text not null check (transaction_type in ('opening', 'credit', 'payment', 'adjustment')),
  amount numeric(14, 2) not null check (amount <> 0),
  signed_delta numeric(14, 2) not null,
  description text not null default '',
  transaction_date date not null default current_date,
  payment_method text not null default '',
  reference_number text not null default '',
  notes text not null default '',
  idempotency_key uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers(id, business_id),
  unique (business_id, idempotency_key)
);

create table public.supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null,
  transaction_type text not null check (transaction_type in ('opening', 'purchase', 'payment', 'adjustment')),
  amount numeric(14, 2) not null check (amount <> 0),
  signed_delta numeric(14, 2) not null,
  description text not null default '',
  transaction_date date not null default current_date,
  payment_method text not null default '',
  reference_number text not null default '',
  notes text not null default '',
  idempotency_key uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (supplier_id, business_id) references public.suppliers(id, business_id),
  unique (business_id, idempotency_key)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null,
  description text not null default '',
  amount numeric(14, 2) not null check (amount > 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0 and amount_paid <= amount),
  purchase_date date not null default current_date,
  reference_number text not null default '',
  notes text not null default '',
  idempotency_key uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (supplier_id, business_id) references public.suppliers(id, business_id),
  unique (business_id, idempotency_key)
);

create table public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'cash',
  reference_number text not null default '',
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table public.income_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (business_id, name),
  unique (id, business_id)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (business_id, name),
  unique (id, business_id)
);

create table public.income_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  transaction_date date not null default current_date,
  payment_method text not null default 'cash',
  reference_number text not null default '',
  notes text not null default '',
  idempotency_key uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (category_id, business_id) references public.income_categories(id, business_id),
  unique (business_id, idempotency_key)
);

create table public.expense_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  transaction_date date not null default current_date,
  payment_method text not null default 'cash',
  reference_number text not null default '',
  notes text not null default '',
  idempotency_key uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (category_id, business_id) references public.expense_categories(id, business_id),
  unique (business_id, idempotency_key)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  due_date date,
  message text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers(id, business_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index customers_business_name_idx on public.customers (business_id, full_name);
create index customers_business_phone_idx on public.customers (business_id, phone);
create index suppliers_business_name_idx on public.suppliers (business_id, full_name);
create index customer_transactions_ledger_idx on public.customer_transactions (business_id, customer_id, transaction_date, created_at);
create index supplier_transactions_ledger_idx on public.supplier_transactions (business_id, supplier_id, transaction_date, created_at);
create index purchases_business_date_idx on public.purchases (business_id, purchase_date desc);
create index income_business_date_idx on public.income_transactions (business_id, transaction_date desc);
create index expenses_business_date_idx on public.expense_transactions (business_id, transaction_date desc);
create index audit_logs_business_date_idx on public.audit_logs (business_id, created_at desc);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_business_and_owner(p_name text, p_full_name text, p_mobile text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_business_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Business name is required'; end if;

  insert into public.profiles (id, full_name, mobile)
  values (auth.uid(), coalesce(p_full_name, ''), coalesce(p_mobile, ''))
  on conflict (id) do update set full_name = excluded.full_name, mobile = excluded.mobile, updated_at = now();

  insert into public.businesses (name, owner_id) values (trim(p_name), auth.uid()) returning id into new_business_id;
  insert into public.business_members (business_id, user_id, role) values (new_business_id, auth.uid(), 'owner');
  insert into public.business_settings (business_id) values (new_business_id);
  insert into public.income_categories (business_id, name) values (new_business_id, 'Other income');
  insert into public.expense_categories (business_id, name) values
    (new_business_id, 'Rent'), (new_business_id, 'Electricity'), (new_business_id, 'Salaries'),
    (new_business_id, 'Transport'), (new_business_id, 'Maintenance'), (new_business_id, 'Other expenses');
  return new_business_id;
end;
$$;

create or replace function public.record_customer_transaction(
  p_business_id uuid, p_customer_id uuid, p_type text, p_amount numeric,
  p_description text, p_date date, p_payment_method text default '',
  p_reference text default '', p_notes text default '', p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  new_id uuid;
  delta numeric(14, 2);
  resulting_balance numeric(14, 2);
begin
  if not public.is_business_member(p_business_id) then raise exception 'Not authorized'; end if;
  if p_type not in ('opening', 'credit', 'payment', 'adjustment') then raise exception 'Invalid transaction type'; end if;
  if p_amount is null or p_amount = 0 or (p_type <> 'adjustment' and p_amount < 0) then raise exception 'Amount must be greater than zero'; end if;
  delta := case when p_type = 'payment' then -abs(p_amount) else p_amount end;

  insert into public.customer_transactions
    (business_id, customer_id, transaction_type, amount, signed_delta, description, transaction_date,
     payment_method, reference_number, notes, idempotency_key)
  values
    (p_business_id, p_customer_id, p_type, abs(p_amount), delta, coalesce(p_description, ''), coalesce(p_date, current_date),
     coalesce(p_payment_method, ''), coalesce(p_reference, ''), coalesce(p_notes, ''), p_idempotency_key)
  on conflict (business_id, idempotency_key) do nothing
  returning id into new_id;

  if new_id is null then
    select id into new_id from public.customer_transactions where business_id = p_business_id and idempotency_key = p_idempotency_key;
  else
    insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
    values (p_business_id, auth.uid(), 'created', 'customer_transaction', new_id,
      jsonb_build_object('type', p_type, 'amount', abs(p_amount), 'signed_delta', delta));
  end if;

  select c.opening_balance + coalesce(sum(t.signed_delta), 0) into resulting_balance
  from public.customers c left join public.customer_transactions t on t.customer_id = c.id and t.business_id = c.business_id
  where c.id = p_customer_id and c.business_id = p_business_id group by c.id;
  if resulting_balance is null then raise exception 'Customer not found'; end if;
  return jsonb_build_object('id', new_id, 'balance', resulting_balance);
end;
$$;

create or replace function public.record_supplier_payment(
  p_business_id uuid, p_supplier_id uuid, p_amount numeric, p_date date,
  p_payment_method text default 'cash', p_reference text default '', p_notes text default '',
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  new_id uuid;
  resulting_balance numeric(14, 2);
begin
  if not public.is_business_member(p_business_id) then raise exception 'Not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  insert into public.supplier_transactions
    (business_id, supplier_id, transaction_type, amount, signed_delta, description, transaction_date,
     payment_method, reference_number, notes, idempotency_key)
  values (p_business_id, p_supplier_id, 'payment', p_amount, -p_amount, 'Supplier payment', coalesce(p_date, current_date),
     coalesce(p_payment_method, 'cash'), coalesce(p_reference, ''), coalesce(p_notes, ''), p_idempotency_key)
  on conflict (business_id, idempotency_key) do nothing returning id into new_id;
  if new_id is null then
    select id into new_id from public.supplier_transactions where business_id = p_business_id and idempotency_key = p_idempotency_key;
  else
    insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
    values (p_business_id, auth.uid(), 'created', 'supplier_payment', new_id, jsonb_build_object('amount', p_amount));
  end if;
  select s.opening_balance + coalesce(sum(t.signed_delta), 0) into resulting_balance
  from public.suppliers s left join public.supplier_transactions t on t.supplier_id = s.id and t.business_id = s.business_id
  where s.id = p_supplier_id and s.business_id = p_business_id group by s.id;
  if resulting_balance is null then raise exception 'Supplier not found'; end if;
  return jsonb_build_object('id', new_id, 'balance', resulting_balance);
end;
$$;

create or replace function public.create_purchase(
  p_business_id uuid, p_supplier_id uuid, p_description text, p_amount numeric, p_amount_paid numeric,
  p_date date, p_reference text default '', p_notes text default '', p_payment_method text default 'cash',
  p_idempotency_key uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_purchase_id uuid;
  payment_key uuid;
begin
  if not public.is_business_member(p_business_id) then raise exception 'Not authorized'; end if;
  if p_amount is null or p_amount <= 0 or p_amount_paid is null or p_amount_paid < 0 or p_amount_paid > p_amount then
    raise exception 'Purchase amount or payment is invalid';
  end if;
  insert into public.purchases
    (business_id, supplier_id, description, amount, amount_paid, purchase_date, reference_number, notes, idempotency_key)
  values (p_business_id, p_supplier_id, coalesce(p_description, ''), p_amount, p_amount_paid, coalesce(p_date, current_date),
    coalesce(p_reference, ''), coalesce(p_notes, ''), p_idempotency_key)
  on conflict (business_id, idempotency_key) do nothing returning id into new_purchase_id;
  if new_purchase_id is null then
    select id into new_purchase_id from public.purchases where business_id = p_business_id and idempotency_key = p_idempotency_key;
    return new_purchase_id;
  end if;

  insert into public.supplier_transactions
    (business_id, supplier_id, transaction_type, amount, signed_delta, description, transaction_date, reference_number, notes, idempotency_key)
  values (p_business_id, p_supplier_id, 'purchase', p_amount, p_amount, coalesce(p_description, 'Purchase'),
    coalesce(p_date, current_date), coalesce(p_reference, ''), coalesce(p_notes, ''), p_idempotency_key);
  if p_amount_paid > 0 then
    payment_key := gen_random_uuid();
    insert into public.purchase_payments
      (business_id, purchase_id, amount, payment_date, payment_method, reference_number, idempotency_key)
    values (p_business_id, new_purchase_id, p_amount_paid, coalesce(p_date, current_date), coalesce(p_payment_method, 'cash'),
      coalesce(p_reference, ''), payment_key);
    insert into public.supplier_transactions
      (business_id, supplier_id, transaction_type, amount, signed_delta, description, transaction_date,
       payment_method, reference_number, idempotency_key)
    values (p_business_id, p_supplier_id, 'payment', p_amount_paid, -p_amount_paid, 'Payment with purchase',
      coalesce(p_date, current_date), coalesce(p_payment_method, 'cash'), coalesce(p_reference, ''), payment_key);
  end if;
  insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
  values (p_business_id, auth.uid(), 'created', 'purchase', new_purchase_id,
    jsonb_build_object('amount', p_amount, 'amount_paid', p_amount_paid));
  return new_purchase_id;
end;
$$;

create or replace function public.create_cash_entry(
  p_business_id uuid, p_kind text, p_category_id uuid, p_amount numeric, p_description text,
  p_date date, p_payment_method text default 'cash', p_reference text default '', p_notes text default '',
  p_idempotency_key uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_business_member(p_business_id) then raise exception 'Not authorized'; end if;
  if p_kind not in ('income', 'expense') or p_amount is null or p_amount <= 0 then raise exception 'Entry type or amount is invalid'; end if;
  if p_kind = 'income' then
    insert into public.income_transactions
      (business_id, category_id, amount, description, transaction_date, payment_method, reference_number, notes, idempotency_key)
    values (p_business_id, p_category_id, p_amount, coalesce(p_description, ''), coalesce(p_date, current_date),
      coalesce(p_payment_method, 'cash'), coalesce(p_reference, ''), coalesce(p_notes, ''), p_idempotency_key)
    on conflict (business_id, idempotency_key) do nothing returning id into new_id;
  else
    insert into public.expense_transactions
      (business_id, category_id, amount, description, transaction_date, payment_method, reference_number, notes, idempotency_key)
    values (p_business_id, p_category_id, p_amount, coalesce(p_description, ''), coalesce(p_date, current_date),
      coalesce(p_payment_method, 'cash'), coalesce(p_reference, ''), coalesce(p_notes, ''), p_idempotency_key)
    on conflict (business_id, idempotency_key) do nothing returning id into new_id;
  end if;
  if new_id is null then
    if p_kind = 'income' then select id into new_id from public.income_transactions where business_id = p_business_id and idempotency_key = p_idempotency_key;
    else select id into new_id from public.expense_transactions where business_id = p_business_id and idempotency_key = p_idempotency_key; end if;
  else
    insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
    values (p_business_id, auth.uid(), 'created', p_kind, new_id, jsonb_build_object('amount', p_amount));
  end if;
  return new_id;
end;
$$;

create or replace function public.create_customer(
  p_business_id uuid, p_full_name text, p_phone text, p_email text, p_address text,
  p_shop_name text, p_opening_balance numeric, p_notes text, p_idempotency_key uuid
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_customer_id uuid;
begin
  if not public.is_business_member(p_business_id) then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_full_name, ''))) = 0 or p_opening_balance is null or p_opening_balance < 0 then
    raise exception 'Customer details or opening balance are invalid';
  end if;
  insert into public.customers
    (business_id, full_name, phone, email, address, shop_name, opening_balance, notes)
  values (p_business_id, trim(p_full_name), coalesce(p_phone, ''), coalesce(p_email, ''), coalesce(p_address, ''),
    coalesce(p_shop_name, ''), p_opening_balance, coalesce(p_notes, ''))
  returning id into new_customer_id;
  if p_opening_balance > 0 then
    insert into public.customer_transactions
      (business_id, customer_id, transaction_type, amount, signed_delta, description, idempotency_key)
    values (p_business_id, new_customer_id, 'opening', p_opening_balance, 0, 'Opening balance', p_idempotency_key);
  end if;
  insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
  values (p_business_id, auth.uid(), 'created', 'customer', new_customer_id, jsonb_build_object('opening_balance', p_opening_balance));
  return new_customer_id;
end;
$$;

create or replace function public.create_supplier(
  p_business_id uuid, p_full_name text, p_phone text, p_business_name text, p_address text,
  p_opening_balance numeric, p_notes text, p_idempotency_key uuid
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_supplier_id uuid;
begin
  if not public.is_business_member(p_business_id) then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_full_name, ''))) = 0 or p_opening_balance is null or p_opening_balance < 0 then
    raise exception 'Supplier details or opening balance are invalid';
  end if;
  insert into public.suppliers
    (business_id, full_name, phone, business_name, address, opening_balance, notes)
  values (p_business_id, trim(p_full_name), coalesce(p_phone, ''), coalesce(p_business_name, ''),
    coalesce(p_address, ''), p_opening_balance, coalesce(p_notes, ''))
  returning id into new_supplier_id;
  if p_opening_balance > 0 then
    insert into public.supplier_transactions
      (business_id, supplier_id, transaction_type, amount, signed_delta, description, idempotency_key)
    values (p_business_id, new_supplier_id, 'opening', p_opening_balance, 0, 'Opening balance', p_idempotency_key);
  end if;
  insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
  values (p_business_id, auth.uid(), 'created', 'supplier', new_supplier_id, jsonb_build_object('opening_balance', p_opening_balance));
  return new_supplier_id;
end;
$$;

create or replace function public.audit_record_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, details)
  values (old.business_id, auth.uid(), 'updated', tg_table_name, old.id,
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  return new;
end;
$$;

create or replace function public.update_business_profile(
  p_business_id uuid, p_name text, p_phone text, p_address text, p_business_type text
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Only the business owner may update its profile'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Business name is required'; end if;
  update public.businesses set name = trim(p_name) where id = p_business_id;
  update public.business_settings
    set phone = coalesce(p_phone, ''), address = coalesce(p_address, ''), business_type = coalesce(p_business_type, ''), updated_at = now()
    where business_id = p_business_id;
  insert into public.audit_logs (business_id, user_id, action, entity_type, details)
  values (p_business_id, auth.uid(), 'updated', 'business_profile', jsonb_build_object('name', trim(p_name)));
end;
$$;

create trigger customers_audit_update before update on public.customers for each row execute function public.audit_record_update();
create trigger suppliers_audit_update before update on public.suppliers for each row execute function public.audit_record_update();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.customer_transactions enable row level security;
alter table public.supplier_transactions enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_payments enable row level security;
alter table public.income_categories enable row level security;
alter table public.expense_categories enable row level security;
alter table public.income_transactions enable row level security;
alter table public.expense_transactions enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_own on public.profiles for select using (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy businesses_read_member on public.businesses for select using (public.is_business_member(id));
create policy members_read_self on public.business_members for select using (user_id = auth.uid());

create policy settings_member_all on public.business_settings for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy customers_member_all on public.customers for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy suppliers_member_all on public.suppliers for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy customer_transactions_member_read on public.customer_transactions for select using (public.is_business_member(business_id));
create policy supplier_transactions_member_read on public.supplier_transactions for select using (public.is_business_member(business_id));
create policy purchases_member_read on public.purchases for select using (public.is_business_member(business_id));
create policy purchase_payments_member_read on public.purchase_payments for select using (public.is_business_member(business_id));
create policy income_categories_member_all on public.income_categories for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy expense_categories_member_all on public.expense_categories for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy income_member_read on public.income_transactions for select using (public.is_business_member(business_id));
create policy expense_member_read on public.expense_transactions for select using (public.is_business_member(business_id));
create policy reminders_member_all on public.reminders for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy audit_member_read on public.audit_logs for select using (public.is_business_member(business_id));

revoke all on function public.create_business_and_owner(text, text, text) from public;
revoke all on function public.record_customer_transaction(uuid, uuid, text, numeric, text, date, text, text, text, uuid) from public;
revoke all on function public.record_supplier_payment(uuid, uuid, numeric, date, text, text, text, uuid) from public;
revoke all on function public.create_purchase(uuid, uuid, text, numeric, numeric, date, text, text, text, uuid) from public;
revoke all on function public.create_cash_entry(uuid, text, uuid, numeric, text, date, text, text, text, uuid) from public;
revoke all on function public.create_customer(uuid, text, text, text, text, text, numeric, text, uuid) from public;
revoke all on function public.create_supplier(uuid, text, text, text, text, numeric, text, uuid) from public;
revoke all on function public.update_business_profile(uuid, text, text, text, text) from public;
grant execute on function public.create_business_and_owner(text, text, text) to authenticated;
grant execute on function public.record_customer_transaction(uuid, uuid, text, numeric, text, date, text, text, text, uuid) to authenticated;
grant execute on function public.record_supplier_payment(uuid, uuid, numeric, date, text, text, text, uuid) to authenticated;
grant execute on function public.create_purchase(uuid, uuid, text, numeric, numeric, date, text, text, text, uuid) to authenticated;
grant execute on function public.create_cash_entry(uuid, text, uuid, numeric, text, date, text, text, text, uuid) to authenticated;
grant execute on function public.create_customer(uuid, text, text, text, text, text, numeric, text, uuid) to authenticated;
grant execute on function public.create_supplier(uuid, text, text, text, text, numeric, text, uuid) to authenticated;
grant execute on function public.update_business_profile(uuid, text, text, text, text) to authenticated;