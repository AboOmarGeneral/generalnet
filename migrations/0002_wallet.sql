create table if not exists wallets (
  id serial primary key,
  name text not null default 'محفظة شبكة الجنرال',
  created_by text not null,
  created_at timestamptz not null default now()
);
create table if not exists wallet_members (
  id serial primary key,
  wallet_id integer not null references wallets(id) on delete cascade,
  user_id text not null unique,
  role text not null check (role in ('manager', 'accountant')),
  display_name text not null,
  username text not null,
  created_at timestamptz not null default now(),
  unique (wallet_id, username)
);
create table if not exists subscribers (
  id serial primary key,
  wallet_id integer not null references wallets(id) on delete cascade,
  section text not null check (section in ('cards', 'home')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists movements (
  id serial primary key,
  wallet_id integer not null references wallets(id) on delete cascade,
  subscriber_id integer references subscribers(id) on delete cascade,
  book text not null check (book in ('cards', 'home', 'ops')),
  kind text not null check (kind in ('debt_add', 'debt_pay', 'expense', 'salary')),
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '',
  actor_user_id text not null,
  actor_name text not null,
  edited_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
