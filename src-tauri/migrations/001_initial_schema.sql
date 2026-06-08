pragma foreign_keys = on;

create table if not exists app_settings (
  key text primary key,
  value_json text not null,
  updated_at text not null default current_timestamp
);

create table if not exists import_batches (
  id text primary key,
  source_type text not null,
  file_name text not null,
  file_path text,
  file_hash text not null,
  period_month text,
  imported_at text not null default current_timestamp,
  note text,
  unique(source_type, file_hash)
);

create table if not exists raw_transactions (
  id text primary key,
  batch_id text not null references import_batches(id),
  source_row_no integer not null,
  transaction_date text not null,
  raw_type text not null,
  raw_category text,
  raw_account text,
  amount numeric not null,
  currency text not null default 'CNY',
  note text,
  row_hash text not null,
  created_at text not null default current_timestamp,
  unique(batch_id, source_row_no),
  unique(row_hash)
);

create table if not exists categories (
  id text primary key,
  name text not null,
  parent_id text references categories(id),
  category_kind text not null,
  rigidity text,
  is_personal integer not null default 0,
  is_active integer not null default 1,
  sort_order integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique(name, category_kind)
);

create table if not exists category_mappings (
  id text primary key,
  source_type text not null,
  raw_category text not null,
  category_id text not null references categories(id),
  confidence numeric,
  is_active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique(source_type, raw_category)
);

create table if not exists confirmed_transactions (
  id text primary key,
  source_kind text not null,
  raw_transaction_id text references raw_transactions(id),
  period_month text not null,
  transaction_date text not null,
  transaction_type text not null,
  amount numeric not null,
  currency text not null default 'CNY',
  category_id text references categories(id),
  raw_category_snapshot text,
  include_in_stats integer not null default 1,
  confirmation_status text not null default 'pending',
  adjustment_reason text,
  note text,
  version_no integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists asset_categories (
  id text primary key,
  name text not null,
  parent_id text references asset_categories(id),
  level text not null,
  is_active integer not null default 1,
  sort_order integer not null default 0,
  unique(name, parent_id)
);

create table if not exists assets (
  id text primary key,
  name text not null,
  asset_type text not null,
  main_asset_category_id text not null references asset_categories(id),
  sub_asset_category_id text references asset_categories(id),
  currency text not null default 'CNY',
  platform text,
  is_dca integer not null default 0,
  status text not null default 'active',
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique(name, platform)
);

create table if not exists tags (
  id text primary key,
  name text not null unique,
  group_name text,
  is_system integer not null default 0,
  is_active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists asset_tag_links (
  asset_id text not null references assets(id),
  tag_id text not null references tags(id),
  primary key(asset_id, tag_id)
);

create table if not exists dca_plans (
  id text primary key,
  asset_id text not null references assets(id),
  name text,
  frequency text not null,
  amount numeric not null,
  currency text not null default 'CNY',
  start_date text not null,
  end_date text,
  weekly_rules_json text,
  monthly_day integer,
  month_end_rule text,
  is_active integer not null default 1,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists investment_cashflows (
  id text primary key,
  asset_id text not null references assets(id),
  period_month text not null,
  flow_date text not null,
  flow_type text not null,
  amount numeric not null,
  currency text not null default 'CNY',
  fx_rate_to_cny numeric not null default 1,
  amount_cny numeric not null,
  source_kind text not null,
  dca_plan_id text references dca_plans(id),
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists monthly_asset_snapshots (
  id text primary key,
  asset_id text not null references assets(id),
  period_month text not null,
  snapshot_date text not null,
  original_amount numeric not null,
  currency text not null default 'CNY',
  fx_rate_to_cny numeric not null default 1,
  amount_cny numeric not null,
  status text not null default 'held',
  version_no integer not null default 1,
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique(asset_id, period_month, version_no)
);

create table if not exists credit_card_adjustments (
  id text primary key,
  period_month text not null,
  current_billed_amount numeric not null default 0,
  current_unbilled_amount numeric not null default 0,
  previous_unbilled_amount numeric not null default 0,
  net_adjustment numeric not null,
  version_no integer not null default 1,
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique(period_month, version_no)
);

create table if not exists exchange_rates (
  id text primary key,
  period_month text not null,
  rate_date text not null,
  from_currency text not null,
  to_currency text not null default 'CNY',
  rate numeric not null,
  source_kind text not null default 'manual',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique(rate_date, from_currency, to_currency)
);

create table if not exists portfolio_targets (
  id text primary key,
  version_name text not null,
  effective_from text not null,
  is_active integer not null default 1,
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists portfolio_target_items (
  id text primary key,
  target_id text not null references portfolio_targets(id),
  main_asset_category_id text not null references asset_categories(id),
  target_percent numeric not null,
  min_percent numeric,
  max_percent numeric,
  expected_annual_return numeric,
  risk_level text,
  unique(target_id, main_asset_category_id)
);

create table if not exists monthly_closes (
  id text primary key,
  period_month text not null unique,
  close_date text not null,
  status text not null,
  version_no integer not null default 1,
  confirmed_at text,
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists monthly_report_versions (
  id text primary key,
  period_month text not null,
  version_no integer not null,
  html_path text,
  pdf_path text,
  excel_path text,
  generated_at text not null default current_timestamp,
  note text,
  unique(period_month, version_no)
);

create table if not exists audit_logs (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  old_value_json text,
  new_value_json text,
  created_at text not null default current_timestamp
);

create index if not exists idx_raw_transactions_date on raw_transactions(transaction_date);
create index if not exists idx_confirmed_transactions_month on confirmed_transactions(period_month);
create index if not exists idx_asset_snapshots_month on monthly_asset_snapshots(period_month);
create index if not exists idx_cashflows_asset_month on investment_cashflows(asset_id, period_month);
