use quick_xml::escape::unescape;
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::{env, fs};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};
use thiserror::Error;

const INITIAL_SCHEMA: &str = include_str!("../migrations/001_initial_schema.sql");
const INITIAL_SEED: &str = include_str!("../migrations/002_initial_seed.sql");
const MOBILE_PWA_INDEX: &str = include_str!("../../mobile/pwa/index.html");
const MOBILE_PWA_APP_JS: &str = include_str!("../../mobile/pwa/app.js");
const MOBILE_PWA_STYLES: &str = include_str!("../../mobile/pwa/styles.css");
const MOBILE_PWA_SW: &str = include_str!("../../mobile/pwa/sw.js");
const MOBILE_PWA_MANIFEST: &str = include_str!("../../mobile/pwa/manifest.webmanifest");
const MOBILE_PWA_LOGO: &str = include_str!("../../mobile/assets/logo-qianji-a.svg");
const MOBILE_PWA_VERSION: &str = "0.3.30";

struct Database {
  work_connection: Mutex<Connection>,
  dashboard_connection: Mutex<Connection>,
  split_databases: bool,
}

struct SecuritySession {
  unlocked: Mutex<bool>,
}

#[derive(Deserialize, Serialize, Clone)]
struct MobileSyncRecordInput {
  local_id: String,
  server_id: Option<String>,
  record_kind: Option<String>,
  operation: Option<String>,
  sync_status: Option<String>,
  transaction_type: Option<String>,
  amount: Option<f64>,
  currency: Option<String>,
  category: Option<String>,
  transaction_date: Option<String>,
  period_month: Option<String>,
  note: Option<String>,
  current_billed_amount: Option<f64>,
  current_unbilled_amount: Option<f64>,
  previous_unbilled_amount: Option<f64>,
  net_adjustment: Option<f64>,
  payload_json: Option<serde_json::Value>,
  created_at: Option<String>,
  updated_at: Option<String>,
}

#[derive(Deserialize, Clone)]
struct MobileSyncPushInput {
  device_id: Option<String>,
  account_id: Option<String>,
  app_version: Option<String>,
  records: Vec<MobileSyncRecordInput>,
}

#[derive(Deserialize)]
struct MobileSyncStatusInput {
  device_id: Option<String>,
  account_id: Option<String>,
  app_version: Option<String>,
  pending_count: i64,
  synced_count: i64,
}

#[derive(Deserialize)]
struct MobilePairInput {
  device_id: Option<String>,
  device_name: Option<String>,
  pairing_code: String,
  app_version: Option<String>,
}

#[derive(Serialize)]
struct MobilePairingInfo {
  enabled: bool,
  mobile_app_version: String,
  account_id: String,
  pairing_code: String,
  pairing_url_path: String,
  pairing_url: String,
  paired_device_count: i64,
  devices: Vec<MobileSyncDeviceInfo>,
}

#[derive(Serialize)]
struct MobileSyncDeviceInfo {
  device_id: String,
  device_name: Option<String>,
  app_version: Option<String>,
  pending_count: i64,
  synced_count: i64,
  paired_at: Option<String>,
  last_seen_at: String,
}

#[derive(Deserialize)]
struct MobileUnpairInput {
  device_id: Option<String>,
  account_id: Option<String>,
}

#[derive(Deserialize)]
struct MobilePasswordInput {
  password: String,
}

#[derive(Deserialize)]
struct MobilePasswordChangeInput {
  current_password: String,
  new_password: String,
}

#[derive(Serialize)]
struct MobilePairResult {
  account_id: String,
  device_id: String,
  paired: bool,
}

#[derive(Serialize)]
struct MobileSyncAck {
  local_id: String,
  server_id: String,
  sync_status: String,
}

#[derive(Serialize)]
struct MobileSyncPushResult {
  accepted_count: usize,
  records: Vec<MobileSyncAck>,
}

#[derive(Serialize)]
struct MobileSyncInboxRecord {
  id: String,
  account_id: Option<String>,
  device_id: String,
  local_id: String,
  record_kind: String,
  operation: String,
  transaction_type: Option<String>,
  transaction_date: Option<String>,
  period_month: Option<String>,
  amount: Option<f64>,
  category: Option<String>,
  note: Option<String>,
  net_adjustment: Option<f64>,
  sync_status: String,
  received_at: String,
}

#[derive(Deserialize, Clone)]
struct CloudMobileDraftInput {
  id: String,
  user_id: String,
  device_id: Option<String>,
  local_id: String,
  record_kind: String,
  transaction_type: Option<String>,
  transaction_date: Option<String>,
  period_month: Option<String>,
  amount: Option<f64>,
  currency: Option<String>,
  category: Option<String>,
  note: Option<String>,
  payload_json: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct MobileSyncSummary {
  enabled: bool,
  account_id: Option<String>,
  device_id: Option<String>,
  app_version: Option<String>,
  pending_on_phone: i64,
  synced_on_phone: i64,
  received_in_desktop: i64,
  reviewed_in_desktop: i64,
  last_seen_at: Option<String>,
  records: Vec<MobileSyncInboxRecord>,
}

#[derive(Serialize)]
struct MobileAssetAllocation {
  category: String,
  amount: f64,
  percent: f64,
}

#[derive(Serialize)]
struct MobilePortfolioTarget {
  category: String,
  target_percent: f64,
  current_amount: f64,
  current_percent: f64,
  deviation_percent: f64,
}

#[derive(Serialize)]
struct MobileCategoryMonthAmount {
  period_month: String,
  category: String,
  amount: f64,
}

#[derive(Serialize)]
struct MobileDashboardSnapshot {
  snapshot_month: String,
  target_saving_rate: f64,
  asset_gross_value: f64,
  credit_card_net_adjustment: f64,
  net_worth: f64,
  investment_buy: f64,
  investment_sell: f64,
  investment_dividend: f64,
  monthly_trends: Vec<MonthlyTrend>,
  expense_categories: Vec<CategoryBreakdown>,
  expense_year_rank: Vec<CategoryBreakdown>,
  expense_category_trends: Vec<MobileCategoryMonthAmount>,
  asset_allocations: Vec<MobileAssetAllocation>,
  investment_assets: Vec<InvestmentAssetPerformance>,
  investment_group_performances: Vec<InvestmentGroupPerformance>,
  investment_group_trends: Vec<InvestmentGroupTrend>,
  investment_cashflow_calendar: Vec<InvestmentCashflowCalendarItem>,
  asset_entry_items: Vec<AssetEntryItem>,
  dca_cashflows: Vec<GeneratedDcaCashflow>,
  portfolio_targets: Vec<MobilePortfolioTarget>,
  spending_anomalies: Vec<SpendingAnomaly>,
}

#[derive(Debug, Error)]
enum AppError {
  #[error("database error: {0}")]
  Database(#[from] rusqlite::Error),
  #[error("io error: {0}")]
  Io(#[from] std::io::Error),
  #[error("app path is unavailable")]
  AppPathUnavailable,
  #[error("app is locked")]
  Locked,
  #[error("invalid password")]
  InvalidPassword,
  #[error("password must be at least 6 characters")]
  WeakPassword,
  #[error("unsupported csv encoding")]
  UnsupportedCsvEncoding,
  #[error("上传失败：缺少账单字段：{0}")]
  MissingCsvField(&'static str),
  #[error("invalid csv value: {0}")]
  InvalidCsvValue(String),
}

impl serde::Serialize for AppError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    serializer.serialize_str(&self.to_string())
  }
}

#[derive(Serialize)]
struct DashboardSeedSummary {
  official_start_date: String,
  target_saving_rate: f64,
  asset_count: i64,
  snapshot_month: String,
  asset_gross_value: f64,
  credit_card_net_adjustment: f64,
  net_worth: f64,
  confirmed_income: f64,
  confirmed_expense: f64,
  saving_amount: f64,
  saving_rate: f64,
  target_saving_amount: f64,
  investment_buy: f64,
  investment_sell: f64,
  investment_dividend: f64,
  investment_return_rate: Option<f64>,
  monthly_trends: Vec<MonthlyTrend>,
  expense_categories: Vec<CategoryBreakdown>,
  expense_category_trends: Vec<MobileCategoryMonthAmount>,
  income_categories: Vec<CategoryBreakdown>,
  expense_year_rank: Vec<CategoryBreakdown>,
  income_year_rank: Vec<CategoryBreakdown>,
  spending_anomalies: Vec<SpendingAnomaly>,
  asset_allocations: Vec<AssetAllocationBreakdown>,
  us_equity_allocations: Vec<AssetAllocationBreakdown>,
  custom_allocation_detail_allocations: Vec<AssetAllocationBreakdown>,
  allocation_target_groups: Vec<AllocationTargetGroup>,
  asset_allocation_trends: Vec<AssetAllocationTrend>,
  investment_assets: Vec<InvestmentAssetPerformance>,
  investment_cashflow_calendar: Vec<InvestmentCashflowCalendarItem>,
  asset_entry_items: Vec<AssetEntryItem>,
  dca_cashflows: Vec<GeneratedDcaCashflow>,
  investment_group_performances: Vec<InvestmentGroupPerformance>,
  investment_group_trends: Vec<InvestmentGroupTrend>,
  discretionary_trends: Vec<DiscretionaryTrend>,
  monthly_report_html: String,
  portfolio_targets: Vec<PortfolioTargetSummary>,
}

#[derive(Serialize)]
struct MonthlyTrend {
  period_month: String,
  income: f64,
  expense: f64,
  saving_amount: f64,
  saving_rate: f64,
  asset_gross_value: f64,
  credit_card_net_adjustment: f64,
  net_worth: f64,
  investment_buy: f64,
  investment_sell: f64,
  investment_dividend: f64,
  investment_gain: f64,
  investment_return_rate: Option<f64>,
  monthly_xirr: Option<f64>,
}

#[derive(Serialize)]
struct CategoryBreakdown {
  category: String,
  amount: f64,
  percent: f64,
  rigidity: Option<String>,
  month_over_month_delta: f64,
}

#[derive(Serialize)]
struct AssetAllocationBreakdown {
  category: String,
  amount: f64,
  percent: f64,
  target_percent: Option<f64>,
  deviation_percent: Option<f64>,
}

#[derive(Serialize)]
struct AllocationTargetGroup {
  parent_category_id: String,
  parent_category: String,
  rows: Vec<AssetAllocationBreakdown>,
}

#[derive(Serialize)]
struct AssetAllocationTrend {
  period_month: String,
  category: String,
  amount: f64,
  percent: f64,
}

#[derive(Serialize)]
struct InvestmentAssetPerformance {
  asset_name: String,
  beginning_value: f64,
  ending_value: f64,
  buy: f64,
  sell: f64,
  dividend: f64,
  gain: f64,
  period_return: Option<f64>,
  monthly_xirr: Option<f64>,
}

#[derive(Serialize)]
struct SpendingAnomaly {
  transaction_date: String,
  category: String,
  amount: f64,
  note: Option<String>,
  reason: String,
}

#[derive(Serialize)]
struct InvestmentCashflowCalendarItem {
  flow_date: String,
  asset_name: String,
  flow_type: String,
  amount: f64,
}

#[derive(Serialize)]
struct InvestmentGroupPerformance {
  group_name: String,
  buy: f64,
  sell: f64,
  dividend: f64,
  gain: f64,
  ending_value: f64,
  return_rate: Option<f64>,
}

#[derive(Serialize)]
struct InvestmentGroupTrend {
  period_month: String,
  group_name: String,
  buy: f64,
  sell: f64,
  dividend: f64,
  gain: f64,
  ending_value: f64,
  return_rate: Option<f64>,
}

#[derive(Serialize)]
struct DiscretionaryTrend {
  period_month: String,
  amount: f64,
}

#[derive(Serialize)]
struct PortfolioTargetSummary {
  category: String,
  target_percent: f64,
  current_amount: f64,
  current_percent: f64,
  deviation_percent: f64,
}

#[derive(Serialize)]
struct OnboardingStatus {
  completed: bool,
  target_saving_rate: f64,
  dashboard_enabled_sections: Vec<String>,
  dashboard_enabled_items: Vec<String>,
  dashboard_custom_settings: DashboardCustomSettings,
  custom_analysis_prompts: Vec<String>,
  allocation_targets: Vec<OnboardingAllocationTargetInput>,
  skip_allocation_targets: bool,
  asset_category_tree: Vec<OnboardingAssetCategoryInput>,
  asset_count: i64,
  portfolio_target_count: i64,
}

#[derive(Serialize)]
struct SecurityStatus {
  password_set: bool,
  unlocked: bool,
  privacy_mode: bool,
  environment_label: Option<String>,
}

#[derive(Serialize)]
struct ImportResult {
  batch_id: String,
  duplicate_file: bool,
  overwritten_existing: bool,
  imported_count: i64,
  expense_count: i64,
  income_count: i64,
  potential_duplicate_count: i64,
  period_months: Vec<String>,
}

struct ParsedSharkRow {
  source_row_no: i64,
  line: String,
  transaction_date: String,
  raw_type: String,
  raw_category: String,
  raw_account: String,
  amount: f64,
  note: String,
  transaction_kind: String,
}

#[derive(Serialize, Clone)]
struct CategoryOption {
  id: String,
  name: String,
  category_kind: String,
  is_auto_created: bool,
  created_from_raw_category: Option<String>,
  rigidity: Option<String>,
  is_personal: bool,
  note: Option<String>,
}

#[derive(Serialize)]
struct TransactionReviewRow {
  id: String,
  transaction_date: String,
  raw_type: String,
  transaction_type: String,
  raw_category: String,
  category_id: Option<String>,
  category_name: Option<String>,
  raw_account: String,
  amount: f64,
  currency: String,
  note: String,
  potential_duplicate: bool,
  duplicate_review_status: String,
}

#[derive(Serialize)]
struct CategorySummary {
  category_id: Option<String>,
  category_name: String,
  amount: f64,
  count: i64,
}

#[derive(Serialize)]
struct TransactionReview {
  period_month: String,
  transaction_type: String,
  rows: Vec<TransactionReviewRow>,
  summary: Vec<CategorySummary>,
  categories: Vec<CategoryOption>,
  auto_created_categories: Vec<CategoryOption>,
}

#[derive(Deserialize)]
struct NewCategoryInput {
  name: String,
  category_kind: String,
  rigidity: Option<String>,
  is_personal: bool,
  note: Option<String>,
}

#[derive(Deserialize)]
struct ConfirmTransactionInput {
  raw_transaction_id: Option<String>,
  transaction_date: String,
  transaction_type: String,
  amount: f64,
  currency: String,
  category_id: Option<String>,
  raw_category_snapshot: Option<String>,
  include_in_stats: bool,
  note: Option<String>,
  adjustment_reason: Option<String>,
}

#[derive(Serialize)]
struct ConfirmResult {
  period_month: String,
  transaction_type: String,
  confirmed_count: i64,
  included_amount: f64,
}

#[derive(Serialize)]
struct AssetEntryItem {
  id: String,
  name: String,
  asset_type: String,
  main_asset_category_id: String,
  sub_asset_category_id: Option<String>,
  main_category: String,
  sub_category: Option<String>,
  tags: String,
  currency: String,
  platform: Option<String>,
  is_dca: bool,
  asset_status: String,
  note: Option<String>,
  month_end_amount: f64,
  month_status: String,
  previous_snapshot_month: String,
  previous_month_amount: f64,
  previous_month_status: String,
  confirmed: bool,
  dca_plans: Vec<DcaPlanItem>,
}

#[derive(Serialize)]
struct MonthlyStepStatus {
  import: bool,
  expense: bool,
  income: bool,
  assets: bool,
  credit_card: bool,
  final_done: bool,
}

#[derive(Deserialize)]
struct NewDcaPlanInput {
  frequency: String,
  amount: f64,
  start_date: String,
  end_date: Option<String>,
  weekly_rules_json: Option<String>,
  monthly_day: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone)]
struct DcaPlanItem {
  id: Option<String>,
  frequency: String,
  amount: f64,
  start_date: String,
  end_date: Option<String>,
  weekly_rules_json: Option<String>,
  monthly_day: Option<i64>,
}

#[derive(Deserialize)]
struct NewAssetInput {
  name: String,
  asset_type: String,
  main_asset_category_id: String,
  sub_asset_category_id: Option<String>,
  currency: String,
  platform: Option<String>,
  tags: Vec<String>,
  #[serde(default)]
  month_end_amount: f64,
  is_dca: bool,
  status: String,
  note: Option<String>,
  dca_plans: Vec<NewDcaPlanInput>,
}

#[derive(Serialize, Deserialize, Clone)]
struct OnboardingAllocationTargetInput {
  level: String,
  parent_category_id: Option<String>,
  category_id: Option<String>,
  asset_id: Option<String>,
  label: String,
  target_percent: f64,
}

#[derive(Serialize, Deserialize, Clone)]
struct OnboardingAssetCategoryInput {
  id: String,
  label: String,
  children: Vec<OnboardingAssetCategoryInput>,
}

#[derive(Serialize, Deserialize, Clone)]
struct DashboardCustomSettings {
  #[serde(default)]
  discretionary_category_ids: Vec<String>,
  #[serde(default = "default_allocation_detail_parent_id")]
  allocation_detail_parent_id: String,
  #[serde(default = "default_allocation_detail_depth")]
  allocation_detail_depth: String,
  #[serde(default = "default_custom_item_sections")]
  custom_item_sections: HashMap<String, String>,
}

#[derive(Deserialize)]
struct OnboardingInput {
  target_saving_rate: f64,
  assets: Vec<NewAssetInput>,
  asset_category_tree: Vec<OnboardingAssetCategoryInput>,
  allocation_targets: Vec<OnboardingAllocationTargetInput>,
  dashboard_sections: Vec<String>,
  dashboard_items: Vec<String>,
  dashboard_custom_settings: DashboardCustomSettings,
  custom_analysis_prompts: Vec<String>,
  skip_asset_entry: bool,
  skip_allocation_targets: bool,
}

#[derive(Deserialize, Clone)]
struct AssetMonthEntryInput {
  asset_id: String,
  name: Option<String>,
  asset_type: Option<String>,
  main_asset_category_id: Option<String>,
  sub_asset_category_id: Option<String>,
  tags: Vec<String>,
  platform: Option<String>,
  is_dca: bool,
  note: Option<String>,
  dca_plans: Vec<DcaPlanItem>,
  month_end_amount: f64,
  currency: String,
  extra_buy: f64,
  sell: f64,
  dividend: f64,
  status: String,
  confirmed: bool,
  #[serde(default = "default_fx_rate")]
  fx_rate_to_cny: f64,
  #[serde(default)]
  amount_cny: f64,
  cashflows: Vec<AssetCashflowInput>,
}

#[derive(Serialize, Deserialize, Clone)]
struct AssetCashflowInput {
  id: Option<String>,
  asset_id: String,
  flow_date: String,
  flow_type: String,
  amount: f64,
  currency: String,
  #[serde(default = "default_fx_rate")]
  fx_rate_to_cny: f64,
  #[serde(default)]
  amount_cny: f64,
  source_kind: String,
  dca_plan_id: Option<String>,
  note: Option<String>,
  included: bool,
}

#[derive(Deserialize)]
struct FxRateKeyInput {
  rate_date: String,
  from_currency: String,
  to_currency: String,
}

#[derive(Deserialize)]
struct SaveFxRateInput {
  rate_date: String,
  source_date: Option<String>,
  from_currency: String,
  to_currency: String,
  rate: f64,
  primary_source: String,
  secondary_rate: Option<f64>,
  secondary_source: Option<String>,
  variance_pct: Option<f64>,
  status: String,
  message: Option<String>,
}

#[derive(Deserialize)]
struct SaveFxOverrideInput {
  rate_date: String,
  from_currency: String,
  to_currency: String,
  rate: f64,
  reason: Option<String>,
}

#[derive(Serialize)]
struct FxRateRecord {
  rate_date: String,
  source_date: Option<String>,
  from_currency: String,
  to_currency: String,
  rate: Option<f64>,
  primary_source: Option<String>,
  secondary_rate: Option<f64>,
  secondary_source: Option<String>,
  variance_pct: Option<f64>,
  status: String,
  message: Option<String>,
  is_overridden: bool,
  override_reason: Option<String>,
}

#[derive(Serialize)]
struct GeneratedDcaCashflow {
  id: String,
  asset_id: String,
  asset_name: String,
  flow_date: String,
  flow_type: String,
  amount: f64,
  currency: String,
  source_kind: String,
  dca_plan_id: Option<String>,
  note: Option<String>,
  included: bool,
}

#[derive(Serialize, Deserialize)]
struct CreditCardEntry {
  id: String,
  name: String,
  institution: Option<String>,
  note: Option<String>,
  is_active: bool,
  billed_amount: f64,
  unbilled_amount: f64,
  previous_unbilled_amount: f64,
  #[serde(default)]
  previous_unbilled_override: bool,
  previous_unbilled_override_reason: Option<String>,
  #[serde(default)]
  previous_unbilled_source_found: bool,
  net_adjustment: f64,
  confirmed: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct ContentTemplate {
  id: String,
  name: String,
  template_type: String,
  content: String,
  is_default: bool,
  note: Option<String>,
  created_at: String,
  updated_at: String,
}

#[derive(Deserialize)]
struct ContentTemplateInput {
  id: Option<String>,
  name: String,
  template_type: String,
  content: String,
  is_default: bool,
  note: Option<String>,
}

#[derive(Deserialize)]
struct TemplateRenderInput {
  template_id: Option<String>,
  template_type: String,
  period_month: String,
  privacy_mode: bool,
  content_override: Option<String>,
}

#[derive(Serialize)]
struct TemplateRenderResult {
  template_id: Option<String>,
  template_name: String,
  template_type: String,
  period_month: String,
  html: String,
  plain_text: String,
}

fn work_database_path(app: &tauri::App) -> Result<PathBuf, AppError> {
  if let Some(test_path) = env::var_os("FINANCIAL_PLANNING_WORK_DB_PATH")
    .or_else(|| env::var_os("FINANCIAL_PLANNING_DB_PATH"))
  {
    let path = PathBuf::from(test_path);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent)?;
    }
    return Ok(path);
  }

  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|_| AppError::AppPathUnavailable)?;
  fs::create_dir_all(&app_data_dir)?;
  Ok(app_data_dir.join("financial_planning.sqlite3"))
}

fn dashboard_database_path(work_path: &Path) -> Result<PathBuf, AppError> {
  if let Some(test_path) = env::var_os("FINANCIAL_PLANNING_DASHBOARD_DB_PATH") {
    let path = PathBuf::from(test_path);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent)?;
    }
    return Ok(path);
  }

  Ok(work_path.to_path_buf())
}

fn open_database(path: PathBuf) -> Result<Connection, AppError> {
  let connection = Connection::open(path)?;
  connection.execute_batch("pragma foreign_keys = on;")?;
  connection.execute_batch(INITIAL_SCHEMA)?;
  ensure_runtime_schema(&connection)?;
  connection.execute_batch(INITIAL_SEED)?;
  Ok(connection)
}

fn ensure_runtime_schema(connection: &Connection) -> Result<(), AppError> {
  add_column_if_missing(
    connection,
    "raw_transactions",
    "standard_category_id",
    "standard_category_id text references categories(id)",
  )?;
  add_column_if_missing(
    connection,
    "raw_transactions",
    "potential_duplicate",
    "potential_duplicate integer not null default 0",
  )?;
  add_column_if_missing(
    connection,
    "raw_transactions",
    "duplicate_key",
    "duplicate_key text",
  )?;
  add_column_if_missing(
    connection,
    "raw_transactions",
    "duplicate_review_status",
    "duplicate_review_status text not null default 'pending'",
  )?;
  add_column_if_missing(
    connection,
    "categories",
    "is_auto_created",
    "is_auto_created integer not null default 0",
  )?;
  add_column_if_missing(
    connection,
    "categories",
    "source",
    "source text",
  )?;
  add_column_if_missing(
    connection,
    "categories",
    "created_from_raw_category",
    "created_from_raw_category text",
  )?;
  add_column_if_missing(
    connection,
    "categories",
    "note",
    "note text",
  )?;
  add_column_if_missing(
    connection,
    "assets",
    "monthly_update_managed",
    "monthly_update_managed integer not null default 0",
  )?;
  connection.execute(
    "create index if not exists idx_raw_transactions_month_type on raw_transactions(transaction_date, raw_type)",
    [],
  )?;
  connection.execute(
    "create index if not exists idx_confirmed_transactions_month_type on confirmed_transactions(period_month, transaction_type)",
    [],
  )?;
  connection.execute(
    "
    create table if not exists monthly_step_status (
      period_month text not null,
      step_key text not null,
      completed integer not null default 0,
      completed_at text,
      updated_at text not null default current_timestamp,
      primary key(period_month, step_key)
    )
    ",
    [],
  )?;
  connection.execute(
    "
    create table if not exists mobile_sync_devices (
      device_id text primary key,
      account_id text,
      device_name text,
      app_version text,
      pending_count integer not null default 0,
      synced_count integer not null default 0,
      paired_at text,
      last_seen_at text not null default current_timestamp
    )
    ",
    [],
  )?;
  connection.execute(
    "
    create table if not exists mobile_sync_inbox (
      id text primary key,
      account_id text,
      device_id text not null,
      local_id text not null,
      record_kind text not null,
      operation text not null default 'create',
      transaction_type text,
      transaction_date text,
      period_month text,
      amount numeric,
      currency text not null default 'CNY',
      category text,
      note text,
      current_billed_amount numeric,
      current_unbilled_amount numeric,
      previous_unbilled_amount numeric,
      net_adjustment numeric,
      payload_json text not null,
      sync_status text not null default 'received',
      received_at text not null default current_timestamp,
      reviewed_at text,
      updated_at text not null default current_timestamp,
      unique(device_id, local_id)
    )
    ",
    [],
  )?;
  connection.execute(
    "create index if not exists idx_mobile_sync_inbox_status on mobile_sync_inbox(sync_status, received_at)",
    [],
  )?;
  add_column_if_missing(connection, "mobile_sync_devices", "account_id", "account_id text")?;
  add_column_if_missing(connection, "mobile_sync_devices", "device_name", "device_name text")?;
  add_column_if_missing(connection, "mobile_sync_devices", "paired_at", "paired_at text")?;
  add_column_if_missing(connection, "mobile_sync_inbox", "account_id", "account_id text")?;
  add_column_if_missing(
    connection,
    "mobile_sync_inbox",
    "operation",
    "operation text not null default 'create'",
  )?;
  connection.execute(
    "
    create table if not exists credit_cards (
      id text primary key,
      name text not null,
      institution text,
      note text,
      is_active integer not null default 1,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    )
    ",
    [],
  )?;
  connection.execute(
    "
    create table if not exists monthly_credit_card_entries (
      id text primary key,
      credit_card_id text not null references credit_cards(id),
      period_month text not null,
      billed_amount numeric not null default 0,
      unbilled_amount numeric not null default 0,
      previous_unbilled_amount numeric not null default 0,
      net_adjustment numeric not null default 0,
      note text,
      confirmed integer not null default 0,
      updated_at text not null default current_timestamp,
      unique(credit_card_id, period_month)
    )
    ",
    [],
  )?;
  add_column_if_missing(
    connection,
    "monthly_credit_card_entries",
    "previous_unbilled_override",
    "previous_unbilled_override integer not null default 0",
  )?;
  add_column_if_missing(
    connection,
    "monthly_credit_card_entries",
    "previous_unbilled_override_reason",
    "previous_unbilled_override_reason text",
  )?;
  connection.execute(
    "
    create table if not exists monthly_dca_cashflow_overrides (
      id text primary key,
      asset_id text not null references assets(id),
      period_month text not null,
      flow_date text not null,
      dca_plan_id text,
      amount numeric not null default 0,
      currency text not null default 'CNY',
      included integer not null default 1,
      note text,
      updated_at text not null default current_timestamp
    )
    ",
    [],
  )?;
  connection.execute(
    "
    create table if not exists content_templates (
      id text primary key,
      name text not null,
      template_type text not null,
      content text not null,
      is_default integer not null default 0,
      note text,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    )
    ",
    [],
  )?;
  connection.execute(
    "create index if not exists idx_content_templates_type on content_templates(template_type, is_default)",
    [],
  )?;
  connection.execute(
    "
    create table if not exists monthly_update_runs (
      period_month text primary key,
      status text not null,
      completed_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    )
    ",
    [],
  )?;
  connection.execute(
    "
    create table if not exists fx_rate_cache (
      id text primary key,
      rate_date text not null,
      source_date text,
      from_currency text not null,
      to_currency text not null,
      rate numeric not null,
      primary_source text not null,
      secondary_rate numeric,
      secondary_source text,
      variance_pct numeric,
      status text not null default 'ready',
      message text,
      fetched_at text not null default current_timestamp,
      updated_at text not null default current_timestamp,
      unique(rate_date, from_currency, to_currency)
    )
    ",
    [],
  )?;
  connection.execute(
    "create index if not exists idx_fx_rate_cache_pair on fx_rate_cache(rate_date, from_currency, to_currency)",
    [],
  )?;
  connection.execute(
    "
    create table if not exists fx_rate_overrides (
      id text primary key,
      rate_date text not null,
      from_currency text not null,
      to_currency text not null,
      rate numeric not null,
      reason text,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp,
      unique(rate_date, from_currency, to_currency)
    )
    ",
    [],
  )?;
  connection.execute(
    "
    create table if not exists monthly_fx_rate_locks (
      id text primary key,
      period_month text not null,
      rate_date text not null,
      source_date text,
      from_currency text not null,
      to_currency text not null,
      rate numeric not null,
      source text not null,
      primary_rate numeric,
      secondary_rate numeric,
      variance_pct numeric,
      lock_status text not null default 'locked',
      locked_at text not null default current_timestamp,
      unique(period_month, rate_date, from_currency, to_currency)
    )
    ",
    [],
  )?;
  connection.execute(
    "
    create table if not exists template_render_logs (
      id text primary key,
      template_id text references content_templates(id),
      template_type text not null,
      period_month text not null,
      rendered_at text not null default current_timestamp
    )
    ",
    [],
  )?;
  seed_default_content_templates(connection)?;
  normalize_builtin_asset_category_labels(connection)?;
  Ok(())
}

fn normalize_builtin_asset_category_labels(connection: &Connection) -> Result<(), AppError> {
  let categories = [
    ("asset_cat_us_equity", "全球资产", None, "main", 50_i64, 1_i64),
    ("asset_sub_us_market", "美股", Some("asset_cat_us_equity"), "sub", 60_i64, 1_i64),
    ("asset_sub_sp500", "标普", Some("asset_sub_us_market"), "sub", 61_i64, 1_i64),
    ("asset_sub_nasdaq", "纳斯达克", Some("asset_sub_us_market"), "sub", 62_i64, 1_i64),
    ("asset_sub_hk_market", "港股", Some("asset_cat_us_equity"), "sub", 70_i64, 1_i64),
    ("asset_sub_emerging_market", "新兴市场", Some("asset_cat_us_equity"), "sub", 80_i64, 1_i64),
    ("asset_sub_us_tech", "科技", Some("asset_cat_us_equity"), "sub", 81_i64, 0_i64),
    ("asset_sub_info_tech", "信息科技", Some("asset_cat_us_equity"), "sub", 82_i64, 0_i64),
    ("asset_sub_other_us", "其他美股", Some("asset_cat_us_equity"), "sub", 83_i64, 0_i64),
  ];
  for (id, label, parent_id, level, sort_order, is_active) in categories {
    connection.execute(
      "
      insert into asset_categories (id, name, parent_id, level, sort_order, is_active)
      values (?1, ?2, ?3, ?4, ?5, ?6)
      on conflict(id) do update set
        name = excluded.name,
        parent_id = excluded.parent_id,
        level = excluded.level,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active
      ",
      params![id, label, parent_id, level, sort_order, is_active],
    )?;
  }
  connection.execute(
    "
    update assets
    set sub_asset_category_id = 'asset_sub_nasdaq',
      updated_at = current_timestamp
    where sub_asset_category_id in ('asset_sub_us_tech', 'asset_sub_info_tech')
    ",
    [],
  )?;
  connection.execute(
    "
    update assets
    set sub_asset_category_id = 'asset_sub_us_market',
      updated_at = current_timestamp
    where sub_asset_category_id = 'asset_sub_other_us'
    ",
    [],
  )?;
  if let Some(raw_tree) = connection
    .query_row(
      "select value_json from app_settings where key = 'asset_category_tree'",
      [],
      |row| row.get::<_, String>(0),
    )
    .optional()?
  {
    if let Ok(parsed_tree) = serde_json::from_str::<Vec<OnboardingAssetCategoryInput>>(&raw_tree) {
      let normalized_tree = normalize_asset_category_tree_labels(parsed_tree);
      let normalized_json = serde_json::to_string(&normalized_tree).unwrap_or_else(|_| raw_tree.clone());
      if normalized_json != raw_tree {
        connection.execute(
          "
          insert into app_settings (key, value_json, updated_at)
          values ('asset_category_tree', ?1, current_timestamp)
          on conflict(key) do update set value_json = excluded.value_json, updated_at = current_timestamp
          ",
          params![normalized_json],
        )?;
      }
    }
  }
  Ok(())
}

fn add_column_if_missing(
  connection: &Connection,
  table: &str,
  column: &str,
  definition: &str,
) -> Result<(), AppError> {
  let mut statement = connection.prepare(&format!("pragma table_info({table})"))?;
  let rows = statement.query_map([], |row| row.get::<_, String>(1))?;
  for row in rows {
    if row? == column {
      return Ok(());
    }
  }
  connection.execute(&format!("alter table {table} add column {definition}"), [])?;
  Ok(())
}

fn seed_default_content_templates(connection: &Connection) -> Result<(), AppError> {
  let defaults = [
    (
      "monthly_report",
      "系统默认月报模板",
      "<article><h1>{{月份}} 财务月报</h1><section><h2>本月总览</h2><p>收入 {{总收入}}，支出 {{总支出}}，储蓄 {{储蓄金额}}，储蓄率 {{储蓄率}}。</p><p>资产原值 {{资产原值}}，信用卡净调整 {{信用卡净调整}}，净资产 {{净资产}}。</p></section><section><h2>支出结构</h2><p>支出 Top 分类：{{支出Top分类}}。</p></section><section><h2>资产配置</h2><p>配置偏离：{{资产配置偏离}}。</p></section><section><h2>投资表现</h2><p>买入 {{本月买入}}，卖出 {{本月卖出}}，分红 {{本月分红}}，收益 {{本月收益}}。</p></section><section><h2>本月提醒</h2><p>{{本月提醒}}</p></section></article>",
    ),
    (
      "cashflow_analysis",
      "系统默认收支分析模板",
      "{{月份}} 收入 {{总收入}}，支出 {{总支出}}，储蓄 {{储蓄金额}}，储蓄率 {{储蓄率}}，目标储蓄率 {{目标储蓄率}}。",
    ),
    (
      "expense_structure_analysis",
      "系统默认支出结构模板",
      "{{月份}} 支出 Top 分类：{{支出Top分类}}。",
    ),
    (
      "income_structure_analysis",
      "系统默认收入结构模板",
      "{{月份}} 收入 Top 分类：{{收入Top分类}}。",
    ),
    (
      "asset_allocation_analysis",
      "系统默认资产配置模板",
      "{{月份}} 净资产 {{净资产}}，资产配置偏离：{{资产配置偏离}}。",
    ),
    (
      "investment_performance_analysis",
      "系统默认投资表现模板",
      "{{月份}} 买入 {{本月买入}}，卖出 {{本月卖出}}，分红 {{本月分红}}，收益 {{本月收益}}。",
    ),
    (
      "next_month_reminder",
      "系统默认下月提醒模板",
      "{{月份}} 本月提醒：{{本月提醒}}。",
    ),
  ];
  for (template_type, name, content) in defaults {
    let id = make_id("tmpl", template_type);
    connection.execute(
      "
      insert into content_templates (id, name, template_type, content, is_default, note)
      select ?1, ?2, ?3, ?4, 1, '系统默认模板'
      where not exists (
        select 1 from content_templates where template_type = ?3 and is_default = 1
      )
      ",
      params![id, name, template_type, content],
    )?;
  }
  Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
  hex::encode(Sha256::digest(bytes))
}

fn make_id(prefix: &str, seed: &str) -> String {
  format!("{prefix}_{}", &sha256_hex(seed.as_bytes())[..24])
}

fn make_unique_id(prefix: &str, seed: &str) -> String {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_nanos())
    .unwrap_or(0);
  make_id(prefix, &format!("{seed}|{nanos}"))
}

fn default_fx_rate() -> f64 {
  1.0
}

fn dca_override_id(asset_id: &str, period_month: &str, flow_date: &str, dca_plan_id: Option<&str>) -> String {
  make_id(
    "dca_override",
    &format!("{}|{}|{}|{}", asset_id, period_month, flow_date, dca_plan_id.unwrap_or("none")),
  )
}

fn decode_utf16le(bytes: &[u8]) -> Result<String, AppError> {
  let data = if bytes.starts_with(&[0xff, 0xfe]) {
    &bytes[2..]
  } else {
    bytes
  };
  if data.len() % 2 != 0 {
    return Err(AppError::UnsupportedCsvEncoding);
  }
  let units: Vec<u16> = data
    .chunks_exact(2)
    .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
    .collect();
  String::from_utf16(&units).map_err(|_| AppError::UnsupportedCsvEncoding)
}

fn decode_utf16be(bytes: &[u8]) -> Result<String, AppError> {
  let data = if bytes.starts_with(&[0xfe, 0xff]) {
    &bytes[2..]
  } else {
    bytes
  };
  if data.len() % 2 != 0 {
    return Err(AppError::UnsupportedCsvEncoding);
  }
  let units: Vec<u16> = data
    .chunks_exact(2)
    .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
    .collect();
  String::from_utf16(&units).map_err(|_| AppError::UnsupportedCsvEncoding)
}

fn decode_with_iconv(bytes: &[u8], encoding: &str) -> Result<String, AppError> {
  let mut child = Command::new("/usr/bin/iconv")
    .args(["-f", encoding, "-t", "UTF-8"])
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .spawn()?;
  if let Some(stdin) = child.stdin.as_mut() {
    stdin.write_all(bytes)?;
  }
  let output = child.wait_with_output()?;
  if !output.status.success() {
    return Err(AppError::UnsupportedCsvEncoding);
  }
  String::from_utf8(output.stdout).map_err(|_| AppError::UnsupportedCsvEncoding)
}

fn decode_csv_text(bytes: &[u8]) -> Result<String, AppError> {
  if bytes.starts_with(&[0xff, 0xfe]) {
    return decode_utf16le(bytes);
  }
  if bytes.starts_with(&[0xfe, 0xff]) {
    return decode_utf16be(bytes);
  }
  if bytes.starts_with(&[0xef, 0xbb, 0xbf]) {
    return String::from_utf8(bytes[3..].to_vec()).map_err(|_| AppError::UnsupportedCsvEncoding);
  }
  if let Ok(text) = String::from_utf8(bytes.to_vec()) {
    return Ok(text);
  }
  decode_utf16le(bytes)
    .or_else(|_| decode_utf16be(bytes))
    .or_else(|_| decode_with_iconv(bytes, "GB18030"))
    .map_err(|_| AppError::InvalidCsvValue("上传失败：账单文件编码无法识别，请导出为 UTF-8 / UTF-16 / GB18030 CSV，或 XLSX。".to_string()))
}

fn normalize_header(value: &str) -> String {
  value.trim().trim_start_matches('\u{feff}').to_string()
}

fn percent_decode_path(value: &str) -> String {
  let bytes = value.as_bytes();
  let mut result = Vec::with_capacity(bytes.len());
  let mut index = 0;
  while index < bytes.len() {
    if bytes[index] == b'%' && index + 2 < bytes.len() {
      if let Ok(hex) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
        result.push(hex);
        index += 3;
        continue;
      }
    }
    result.push(bytes[index]);
    index += 1;
  }
  String::from_utf8_lossy(&result).to_string()
}

fn unescape_copied_path(value: &str) -> String {
  let mut output = String::with_capacity(value.len());
  let mut chars = value.chars();
  while let Some(ch) = chars.next() {
    if ch == '\\' {
      if let Some(next) = chars.next() {
        output.push(next);
      }
    } else {
      output.push(ch);
    }
  }
  output
}

fn normalize_import_file_path(file_path: &str) -> String {
  let mut value = file_path.trim().trim_matches('\u{feff}').to_string();
  if (value.starts_with('"') && value.ends_with('"')) || (value.starts_with('\'') && value.ends_with('\'')) {
    value = value[1..value.len().saturating_sub(1)].to_string();
  }
  if let Some(stripped) = value.strip_prefix("file://") {
    value = percent_decode_path(stripped);
  }
  value = unescape_copied_path(&value);
  if value == "~" {
    if let Some(home) = env::var_os("HOME") {
      return PathBuf::from(home).to_string_lossy().to_string();
    }
  }
  if let Some(rest) = value.strip_prefix("~/") {
    if let Some(home) = env::var_os("HOME") {
      return PathBuf::from(home).join(rest).to_string_lossy().to_string();
    }
  }
  value
}

fn parse_delimited_line(line: &str, delimiter: char) -> Vec<String> {
  let mut values = Vec::new();
  let mut current = String::new();
  let mut chars = line.chars().peekable();
  let mut in_quotes = false;
  while let Some(ch) = chars.next() {
    if ch == '"' {
      if in_quotes && chars.peek() == Some(&'"') {
        current.push('"');
        chars.next();
      } else {
        in_quotes = !in_quotes;
      }
    } else if ch == delimiter && !in_quotes {
      values.push(current.trim().to_string());
      current.clear();
    } else {
      current.push(ch);
    }
  }
  values.push(current.trim().to_string());
  values
}

fn normalize_transaction_type(raw_type: &str) -> Option<&'static str> {
  match raw_type.trim() {
    "支出" => Some("expense"),
    "收入" => Some("income"),
    _ => None,
  }
}

fn parse_shark_date(value: &str) -> Result<String, AppError> {
  let trimmed = value.trim();
  if trimmed.len() == 10 && trimmed.chars().nth(4) == Some('-') {
    return Ok(trimmed.to_string());
  }
  let normalized = trimmed
    .replace('年', "-")
    .replace('月', "-")
    .replace('日', "");
  let parts: Vec<&str> = normalized.split('-').filter(|part| !part.is_empty()).collect();
  if parts.len() != 3 {
    return Err(AppError::InvalidCsvValue(format!("日期 {value}")));
  }
  let year = parts[0]
    .parse::<i32>()
    .map_err(|_| AppError::InvalidCsvValue(format!("日期 {value}")))?;
  let month = parts[1]
    .parse::<u32>()
    .map_err(|_| AppError::InvalidCsvValue(format!("日期 {value}")))?;
  let day = parts[2]
    .parse::<u32>()
    .map_err(|_| AppError::InvalidCsvValue(format!("日期 {value}")))?;
  Ok(format!("{year:04}-{month:02}-{day:02}"))
}

fn period_from_date(date: &str) -> String {
  date.chars().take(7).collect()
}

fn parse_amount(value: &str) -> Result<f64, AppError> {
  value
    .trim()
    .replace(',', "")
    .parse::<f64>()
    .map(|amount| amount.abs())
    .map_err(|_| AppError::InvalidCsvValue(format!("金额 {value}")))
}

fn mobile_sync_device_id(input: Option<String>) -> String {
  input
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| "worthtrace-mobile-local".to_string())
}

fn mobile_account_id(connection: &Connection) -> Result<String, AppError> {
  let existing = setting_string(connection, "mobile_sync_account_id", "")?;
  if !existing.trim().is_empty() {
    return Ok(existing);
  }
  let account_id = make_unique_id("acct", "worthtrace-mobile-account");
  upsert_setting(connection, "mobile_sync_account_id", &serde_json::to_string(&account_id).unwrap())?;
  Ok(account_id)
}

fn mobile_pairing_code(connection: &Connection) -> Result<String, AppError> {
  let account_id = mobile_account_id(connection)?;
  let code = make_id("pair", &account_id).chars().rev().take(8).collect::<String>().to_uppercase();
  upsert_setting(connection, "mobile_sync_pairing_code", &serde_json::to_string(&code).unwrap())?;
  Ok(code)
}

fn ensure_mobile_sync_schema(connection: &Connection) -> Result<(), AppError> {
  ensure_runtime_schema(connection)
}

fn upsert_mobile_device(
  connection: &Connection,
  device_id: &str,
  account_id: Option<&str>,
  device_name: Option<&str>,
  app_version: Option<&str>,
  pending_count: i64,
  synced_count: i64,
) -> Result<(), AppError> {
  connection.execute(
    "
    insert into mobile_sync_devices (device_id, account_id, device_name, app_version, pending_count, synced_count, paired_at, last_seen_at)
    values (?1, ?2, ?3, ?4, ?5, ?6, case when ?2 is null then null else current_timestamp end, current_timestamp)
    on conflict(device_id) do update set
      account_id = coalesce(excluded.account_id, mobile_sync_devices.account_id),
      device_name = coalesce(excluded.device_name, mobile_sync_devices.device_name),
      app_version = coalesce(excluded.app_version, mobile_sync_devices.app_version),
      pending_count = excluded.pending_count,
      synced_count = excluded.synced_count,
      paired_at = case
        when mobile_sync_devices.paired_at is null and excluded.account_id is not null then current_timestamp
        else mobile_sync_devices.paired_at
      end,
      last_seen_at = current_timestamp
    ",
    params![device_id, account_id, device_name, app_version, pending_count, synced_count],
  )?;
  Ok(())
}

fn bind_mobile_device(connection: &Connection, input: MobilePairInput) -> Result<MobilePairResult, AppError> {
  let expected_code = mobile_pairing_code(connection)?;
  if input.pairing_code.trim().to_uppercase() != expected_code {
    return Err(AppError::InvalidCsvValue("绑定码不正确，请在电脑端重新查看绑定码。".to_string()));
  }
  let account_id = mobile_account_id(connection)?;
  let device_id = mobile_sync_device_id(input.device_id);
  connection.execute(
    "delete from mobile_sync_devices where account_id = ?1 and device_id <> ?2",
    params![account_id, device_id],
  )?;
  upsert_mobile_device(
    connection,
    &device_id,
    Some(&account_id),
    input.device_name.as_deref(),
    input.app_version.as_deref(),
    0,
    0,
  )?;
  Ok(MobilePairResult {
    account_id,
    device_id,
    paired: true,
  })
}

fn list_mobile_devices(connection: &Connection, account_id: &str) -> Result<Vec<MobileSyncDeviceInfo>, AppError> {
  let mut statement = connection.prepare(
    "
    select device_id, device_name, app_version, pending_count, synced_count, paired_at, last_seen_at
    from mobile_sync_devices
    where account_id = ?1
    order by last_seen_at desc
    ",
  )?;
  let rows = statement.query_map(params![account_id], |row| {
    Ok(MobileSyncDeviceInfo {
      device_id: row.get(0)?,
      device_name: row.get(1)?,
      app_version: row.get(2)?,
      pending_count: row.get(3)?,
      synced_count: row.get(4)?,
      paired_at: row.get(5)?,
      last_seen_at: row.get(6)?,
    })
  })?;
  let mut devices = Vec::new();
  for row in rows {
    devices.push(row?);
  }
  Ok(devices)
}

fn reset_mobile_pairing(connection: &Connection) -> Result<MobilePairingInfo, AppError> {
  ensure_mobile_sync_schema(connection)?;
  connection.execute("delete from mobile_sync_devices", [])?;
  let account_id = make_unique_id("acct", "worthtrace-mobile-account");
  upsert_setting(connection, "mobile_sync_account_id", &serde_json::to_string(&account_id).unwrap())?;
  let pairing_code = make_id("pair", &account_id).chars().rev().take(8).collect::<String>().to_uppercase();
  upsert_setting(connection, "mobile_sync_pairing_code", &serde_json::to_string(&pairing_code).unwrap())?;
  let pairing_url_path = mobile_pairing_path(&pairing_code);
  Ok(MobilePairingInfo {
    enabled: true,
    mobile_app_version: MOBILE_PWA_VERSION.to_string(),
    account_id,
    pairing_url_path,
    pairing_url: mobile_pairing_url(&pairing_code),
    pairing_code,
    paired_device_count: 0,
    devices: Vec::new(),
  })
}

fn unpair_mobile_device(connection: &Connection, input: MobileUnpairInput) -> Result<(), AppError> {
  ensure_mobile_sync_schema(connection)?;
  let expected_account_id = mobile_account_id(connection)?;
  if input.account_id.as_deref().unwrap_or_default() != expected_account_id {
    return Err(AppError::InvalidCsvValue("手机账户不匹配，请重新绑定。".to_string()));
  }
  let device_id = mobile_sync_device_id(input.device_id);
  connection.execute(
    "delete from mobile_sync_devices where account_id = ?1 and device_id = ?2",
    params![expected_account_id, device_id],
  )?;
  Ok(())
}

fn mobile_asset_entries_from_payload(
  record_kind: &str,
  period_month: Option<&str>,
  payload: Option<&serde_json::Value>,
) -> Result<Option<(String, Vec<AssetMonthEntryInput>)>, AppError> {
  if record_kind != "monthly_update_assets" {
    return Ok(None);
  }
  let Some(payload) = payload else {
    return Ok(None);
  };
  let period = payload
    .get("period_month")
    .and_then(|value| value.as_str())
    .or(period_month)
    .unwrap_or("")
    .to_string();
  if period.trim().is_empty() {
    return Ok(None);
  }
  let Some(entries_value) = payload.get("entries") else {
    return Ok(None);
  };
  let entries = serde_json::from_value::<Vec<AssetMonthEntryInput>>(entries_value.clone())
    .map_err(|err| AppError::InvalidCsvValue(format!("手机资产录入草稿无法套用：{err}")))?;
  Ok(Some((period, entries)))
}

fn apply_mobile_asset_entry_batches(
  connection: &mut Connection,
  batches: Vec<(String, String, Vec<AssetMonthEntryInput>)>,
) -> Result<(), AppError> {
  for (inbox_id, period_month, entries) in batches {
    if entries.is_empty() {
      continue;
    }
    save_asset_month_entries_for_connection(connection, &period_month, &entries)?;
    connection.execute(
      "
      update mobile_sync_inbox
      set sync_status = 'reviewed', reviewed_at = current_timestamp, updated_at = current_timestamp
      where id = ?1
      ",
      params![inbox_id],
    )?;
  }
  Ok(())
}

fn mobile_record_operation(record: &MobileSyncRecordInput) -> String {
  record
    .operation
    .as_deref()
    .or_else(|| record.payload_json.as_ref()?.get("operation")?.as_str())
    .unwrap_or("create")
    .trim()
    .to_lowercase()
}

fn mobile_confirmed_transaction_id(account_id: &str, device_id: &str, local_id: &str) -> String {
  make_id("mobile_confirmed", &format!("{account_id}|{device_id}|{local_id}"))
}

fn mobile_category_id(
  connection: &Connection,
  category: Option<&str>,
  transaction_type: &str,
) -> Result<Option<String>, AppError> {
  let name = category.unwrap_or("").trim();
  if name.is_empty() {
    return Ok(None);
  }
  if let Some(id) = connection
    .query_row(
      "select id from categories where name = ?1 and category_kind = ?2",
      params![name, transaction_type],
      |row| row.get::<_, String>(0),
    )
    .optional()?
  {
    return Ok(Some(id));
  }
  let id = make_id("cat", &format!("mobile|{transaction_type}|{name}"));
  let rigidity: Option<&str> = if transaction_type == "expense" { Some("flexible") } else { None };
  connection.execute(
    "
    insert into categories (
      id, name, category_kind, rigidity, is_personal, is_active,
      sort_order, is_auto_created, source, created_from_raw_category, note
    )
    values (?1, ?2, ?3, ?4, 1, 1, 999, 1, 'mobile', ?2, '手机记账自动新增')
    on conflict(name, category_kind) do nothing
    ",
    params![id, name, transaction_type, rigidity],
  )?;
  let actual_id = connection.query_row(
    "select id from categories where name = ?1 and category_kind = ?2",
    params![name, transaction_type],
    |row| row.get::<_, String>(0),
  )?;
  Ok(Some(actual_id))
}

fn apply_mobile_transaction_record(
  connection: &Connection,
  account_id: &str,
  device_id: &str,
  record: &MobileSyncRecordInput,
) -> Result<(), AppError> {
  if record.record_kind.as_deref().unwrap_or("transaction") != "transaction" {
    return Ok(());
  }
  let local_id = record.local_id.trim();
  if local_id.is_empty() {
    return Ok(());
  }
  let operation = mobile_record_operation(record);
  let id = mobile_confirmed_transaction_id(account_id, device_id, local_id);
  if operation == "delete" {
    let deleted = connection.execute(
      "delete from confirmed_transactions where id = ?1 and source_kind = 'mobile'",
      params![id],
    )?;
    if deleted > 0 {
      connection.execute(
        "
        insert into audit_logs (id, entity_type, entity_id, action, old_value_json, new_value_json)
        values (?1, 'confirmed_transactions', ?2, 'mobile_delete', ?3, null)
        ",
        params![
          make_unique_id("audit", &format!("mobile_delete|{id}")),
          id,
          serde_json::json!({ "device_id": device_id, "local_id": local_id }).to_string()
        ],
      )?;
    }
    return Ok(());
  }
  if operation != "create" && operation != "update" {
    return Err(AppError::InvalidCsvValue(format!("不支持的手机记账操作：{operation}")));
  }
  let transaction_type = record.transaction_type.as_deref().unwrap_or("").trim();
  if transaction_type != "income" && transaction_type != "expense" {
    return Err(AppError::InvalidCsvValue("手机记账类型必须是收入或支出".to_string()));
  }
  let transaction_date = record.transaction_date.as_deref().unwrap_or("").trim();
  if transaction_date.len() < 10 {
    return Err(AppError::InvalidCsvValue("手机记账日期无效".to_string()));
  }
  let amount = record.amount.unwrap_or(0.0).abs();
  if !amount.is_finite() || amount <= 0.0 {
    return Err(AppError::InvalidCsvValue("手机记账金额必须大于 0".to_string()));
  }
  let period_month = period_from_date(transaction_date);
  let category_id = mobile_category_id(connection, record.category.as_deref(), transaction_type)?;
  let existed: bool = connection.query_row(
    "select exists(select 1 from confirmed_transactions where id = ?1)",
    params![id],
    |row| row.get(0),
  )?;
  connection.execute(
    "
    insert into confirmed_transactions (
      id, source_kind, raw_transaction_id, period_month, transaction_date,
      transaction_type, amount, currency, category_id, raw_category_snapshot,
      include_in_stats, confirmation_status, adjustment_reason, note
    )
    values (?1, 'mobile', null, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, 'confirmed', null, ?9)
    on conflict(id) do update set
      period_month = excluded.period_month,
      transaction_date = excluded.transaction_date,
      transaction_type = excluded.transaction_type,
      amount = excluded.amount,
      currency = excluded.currency,
      category_id = excluded.category_id,
      raw_category_snapshot = excluded.raw_category_snapshot,
      include_in_stats = 1,
      confirmation_status = 'confirmed',
      adjustment_reason = null,
      note = excluded.note,
      updated_at = current_timestamp
    ",
    params![
      id,
      period_month,
      transaction_date,
      transaction_type,
      amount,
      record.currency.as_deref().unwrap_or("CNY"),
      category_id,
      record.category,
      record.note
    ],
  )?;
  connection.execute(
    "
    insert into audit_logs (id, entity_type, entity_id, action, old_value_json, new_value_json)
    values (?1, 'confirmed_transactions', ?2, ?3, ?4, ?5)
    ",
    params![
      make_unique_id("audit", &format!("mobile_upsert|{id}|{}", record.updated_at.as_deref().unwrap_or(""))),
      id,
      if existed { "mobile_update" } else { "mobile_create" },
      if existed { Some(serde_json::json!({ "replaced": true }).to_string()) } else { None },
      serde_json::json!({
        "device_id": device_id,
        "local_id": local_id,
        "period_month": period_month,
        "transaction_date": transaction_date,
        "transaction_type": transaction_type,
        "amount": amount,
        "category": record.category,
        "note": record.note
      }).to_string()
    ],
  )?;
  Ok(())
}

fn cloud_draft_as_mobile_record(draft: &CloudMobileDraftInput) -> MobileSyncRecordInput {
  MobileSyncRecordInput {
    local_id: draft.local_id.clone(),
    server_id: Some(draft.id.clone()),
    record_kind: Some(draft.record_kind.clone()),
    operation: draft
      .payload_json
      .as_ref()
      .and_then(|payload| payload.get("operation"))
      .and_then(|value| value.as_str())
      .map(str::to_string),
    sync_status: Some("synced".to_string()),
    transaction_type: draft.transaction_type.clone(),
    amount: draft.amount,
    currency: draft.currency.clone(),
    category: draft.category.clone(),
    transaction_date: draft.transaction_date.clone(),
    period_month: draft.period_month.clone(),
    note: draft.note.clone(),
    current_billed_amount: None,
    current_unbilled_amount: None,
    previous_unbilled_amount: None,
    net_adjustment: draft.payload_json.as_ref().and_then(|payload| payload.get("net_adjustment")).and_then(|value| value.as_f64()),
    payload_json: draft.payload_json.clone(),
    created_at: draft.payload_json.as_ref().and_then(|payload| payload.get("created_at")).and_then(|value| value.as_str()).map(str::to_string),
    updated_at: draft.payload_json.as_ref().and_then(|payload| payload.get("updated_at")).and_then(|value| value.as_str()).map(str::to_string),
  }
}

fn apply_mobile_records_to_connection(
  connection: &mut Connection,
  account_id: &str,
  device_id: &str,
  records: &[MobileSyncRecordInput],
) -> Result<(), AppError> {
  ensure_runtime_schema(connection)?;
  let tx = connection.unchecked_transaction()?;
  for record in records {
    apply_mobile_transaction_record(&tx, account_id, device_id, record)?;
  }
  tx.commit()?;
  Ok(())
}

fn apply_cloud_drafts_to_connection(
  connection: &mut Connection,
  account_id: &str,
  drafts: &[CloudMobileDraftInput],
) -> Result<(), AppError> {
  ensure_runtime_schema(connection)?;
  let tx = connection.unchecked_transaction()?;
  for draft in drafts {
    let record = cloud_draft_as_mobile_record(draft);
    let device_id = draft.device_id.as_deref().unwrap_or("worthtrace-cloud");
    apply_mobile_transaction_record(&tx, account_id, device_id, &record)?;
  }
  tx.commit()?;
  Ok(())
}

fn store_mobile_sync_records(
  connection: &mut Connection,
  input: MobileSyncPushInput,
) -> Result<MobileSyncPushResult, AppError> {
  let device_id = mobile_sync_device_id(input.device_id);
  let account_id = input.account_id.unwrap_or_default();
  let expected_account_id = mobile_account_id(connection)?;
  if account_id.trim() != expected_account_id {
    return Err(AppError::InvalidCsvValue("手机尚未绑定当前电脑账户，请先扫码绑定。".to_string()));
  }
  upsert_mobile_device(connection, &device_id, Some(&expected_account_id), None, input.app_version.as_deref(), 0, input.records.len() as i64)?;
  let tx = connection.unchecked_transaction()?;
  let mut acknowledgements = Vec::new();
  let mut asset_entry_batches: Vec<(String, String, Vec<AssetMonthEntryInput>)> = Vec::new();
  for record in input.records {
    let local_id = record.local_id.trim().to_string();
    if local_id.is_empty() {
      continue;
    }
    let id = make_unique_id("mobile", &format!("{device_id}|{local_id}"));
    let record_kind = record
      .record_kind
      .as_deref()
      .unwrap_or("transaction")
      .trim()
      .to_string();
    let operation = mobile_record_operation(&record);
    let payload_json = serde_json::to_string(&record)
      .map_err(|err| AppError::InvalidCsvValue(format!("手机同步数据无法保存：{err}")))?;
    if let Some((period_month, entries)) = mobile_asset_entries_from_payload(
      &record_kind,
      record.period_month.as_deref(),
      record.payload_json.as_ref(),
    )? {
      asset_entry_batches.push((id.clone(), period_month, entries));
    }
    apply_mobile_transaction_record(&tx, &expected_account_id, &device_id, &record)?;
    tx.execute(
      "
      insert into mobile_sync_inbox (
        id, account_id, device_id, local_id, record_kind, operation, transaction_type, transaction_date,
        period_month, amount, currency, category, note, current_billed_amount,
        current_unbilled_amount, previous_unbilled_amount, net_adjustment, payload_json, sync_status
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, 'received')
      on conflict(device_id, local_id) do update set
        account_id = excluded.account_id,
        record_kind = excluded.record_kind,
        operation = excluded.operation,
        transaction_type = excluded.transaction_type,
        transaction_date = excluded.transaction_date,
        period_month = excluded.period_month,
        amount = excluded.amount,
        currency = excluded.currency,
        category = excluded.category,
        note = excluded.note,
        current_billed_amount = excluded.current_billed_amount,
        current_unbilled_amount = excluded.current_unbilled_amount,
        previous_unbilled_amount = excluded.previous_unbilled_amount,
        net_adjustment = excluded.net_adjustment,
        payload_json = excluded.payload_json,
        sync_status = 'received',
        reviewed_at = null,
        updated_at = current_timestamp
      ",
      params![
        id,
        expected_account_id,
        device_id,
        local_id,
        record_kind,
        operation,
        record.transaction_type,
        record.transaction_date,
        record.period_month,
        record.amount,
        record.currency.unwrap_or_else(|| "CNY".to_string()),
        record.category,
        record.note,
        record.current_billed_amount,
        record.current_unbilled_amount,
        record.previous_unbilled_amount,
        record.net_adjustment,
        payload_json,
      ],
    )?;
    acknowledgements.push(MobileSyncAck {
      local_id,
      server_id: id,
      sync_status: "synced".to_string(),
    });
  }
  tx.commit()?;
  apply_mobile_asset_entry_batches(connection, asset_entry_batches)?;
  Ok(MobileSyncPushResult {
    accepted_count: acknowledgements.len(),
    records: acknowledgements,
  })
}

fn import_cloud_mobile_drafts_into_connection(
  connection: &mut Connection,
  drafts: Vec<CloudMobileDraftInput>,
) -> Result<MobileSyncPushResult, AppError> {
  ensure_mobile_sync_schema(connection)?;
  let account_id = mobile_account_id(connection)?;
  let device_id = "worthtrace-cloud".to_string();
  upsert_mobile_device(
    connection,
    &device_id,
    Some(&account_id),
    Some("云端手机草稿"),
    Some("cloud"),
    0,
    drafts.len() as i64,
  )?;
  let tx = connection.unchecked_transaction()?;
  let mut acknowledgements = Vec::new();
  let mut asset_entry_batches: Vec<(String, String, Vec<AssetMonthEntryInput>)> = Vec::new();
  for draft in drafts {
    let cloud_id = draft.id.trim().to_string();
    if cloud_id.is_empty() {
      continue;
    }
    let local_id = format!("cloud:{cloud_id}");
    let id = make_unique_id("mobile", &format!("{device_id}|{local_id}"));
    let payload_value = draft.payload_json.clone().unwrap_or_else(|| serde_json::json!({}));
    let payload_json = payload_value.to_string();
    let net_adjustment = payload_value.get("net_adjustment").and_then(|value| value.as_f64());
    let mobile_record = cloud_draft_as_mobile_record(&draft);
    let source_device_id = draft.device_id.as_deref().unwrap_or("worthtrace-cloud").to_string();
    let operation = mobile_record_operation(&mobile_record);
    let record_kind = if draft.record_kind.trim().is_empty() {
      "transaction".to_string()
    } else {
      draft.record_kind.clone()
    };
    apply_mobile_transaction_record(&tx, &account_id, &source_device_id, &mobile_record)?;
    tx.execute(
      "
      insert into mobile_sync_inbox (
        id, account_id, device_id, local_id, record_kind, operation, transaction_type, transaction_date,
        period_month, amount, currency, category, note, net_adjustment, payload_json, sync_status
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'received')
      on conflict(device_id, local_id) do update set
        account_id = excluded.account_id,
        record_kind = excluded.record_kind,
        operation = excluded.operation,
        transaction_type = excluded.transaction_type,
        transaction_date = excluded.transaction_date,
        period_month = excluded.period_month,
        amount = excluded.amount,
        currency = excluded.currency,
        category = excluded.category,
        note = excluded.note,
        net_adjustment = excluded.net_adjustment,
        payload_json = excluded.payload_json,
        sync_status = 'received',
        reviewed_at = null,
        updated_at = current_timestamp
      ",
      params![
        id,
        account_id,
        device_id,
        local_id,
        record_kind,
        operation,
        draft.transaction_type,
        draft.transaction_date,
        draft.period_month,
        draft.amount,
        draft.currency.unwrap_or_else(|| "CNY".to_string()),
        draft.category,
        draft.note,
        net_adjustment,
        payload_json
      ],
    )?;
    if let Some((period_month, entries)) = mobile_asset_entries_from_payload(&record_kind, draft.period_month.as_deref(), Some(&payload_value))? {
      asset_entry_batches.push((id.clone(), period_month, entries));
    }
    acknowledgements.push(MobileSyncAck {
      local_id: draft.local_id,
      server_id: id,
      sync_status: "received".to_string(),
    });
  }
  tx.commit()?;
  apply_mobile_asset_entry_batches(connection, asset_entry_batches)?;
  Ok(MobileSyncPushResult {
    accepted_count: acknowledgements.len(),
    records: acknowledgements,
  })
}

fn read_mobile_sync_summary(connection: &Connection, enabled: bool) -> Result<MobileSyncSummary, AppError> {
  ensure_mobile_sync_schema(connection)?;
  let account_id = if enabled {
    Some(mobile_account_id(connection)?)
  } else {
    None
  };
  let latest_device = connection
    .query_row(
      "
      select device_id, app_version, pending_count, synced_count, last_seen_at
      from mobile_sync_devices
      where (?1 is null or account_id = ?1)
      order by last_seen_at desc
      limit 1
      ",
      params![account_id],
      |row| {
        Ok((
          row.get::<_, String>(0)?,
          row.get::<_, Option<String>>(1)?,
          row.get::<_, i64>(2)?,
          row.get::<_, i64>(3)?,
          row.get::<_, String>(4)?,
        ))
      },
    )
    .optional()?;
  let (device_id, app_version, pending_on_phone, synced_on_phone, last_seen_at) = latest_device
    .map(|item| (Some(item.0), item.1, item.2, item.3, Some(item.4)))
    .unwrap_or((None, None, 0, 0, None));
  let received_in_desktop = connection.query_row(
    "select count(*) from mobile_sync_inbox where sync_status = 'received' and (?1 is null or account_id = ?1)",
    params![account_id],
    |row| row.get(0),
  )?;
  let reviewed_in_desktop = connection.query_row(
    "select count(*) from mobile_sync_inbox where sync_status = 'reviewed' and (?1 is null or account_id = ?1)",
    params![account_id],
    |row| row.get(0),
  )?;
  let mut statement = connection.prepare(
    "
    select id, account_id, device_id, local_id, record_kind, operation, transaction_type, transaction_date,
      period_month, amount, category, note, net_adjustment, sync_status, received_at
    from mobile_sync_inbox
    where (?1 is null or account_id = ?1)
    order by received_at desc
    limit 8
    ",
  )?;
  let records = statement
    .query_map(params![account_id], |row| {
      Ok(MobileSyncInboxRecord {
        id: row.get(0)?,
        account_id: row.get(1)?,
        device_id: row.get(2)?,
        local_id: row.get(3)?,
        record_kind: row.get(4)?,
        operation: row.get(5)?,
        transaction_type: row.get(6)?,
        transaction_date: row.get(7)?,
        period_month: row.get(8)?,
        amount: row.get(9)?,
        category: row.get(10)?,
        note: row.get(11)?,
        net_adjustment: row.get(12)?,
        sync_status: row.get(13)?,
        received_at: row.get(14)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(MobileSyncSummary {
    enabled,
    account_id,
    device_id,
    app_version,
    pending_on_phone,
    synced_on_phone,
    received_in_desktop,
    reviewed_in_desktop,
    last_seen_at,
    records,
  })
}

fn read_mobile_dashboard_snapshot(connection: &Connection) -> Result<MobileDashboardSnapshot, AppError> {
  ensure_runtime_schema(connection)?;
  let snapshot_month = latest_completed_period_month(connection)?;
  let target_saving_rate = setting_number(connection, "target_saving_rate", 0.3)?;
  let asset_gross_value: f64 = connection.query_row(
    "select coalesce(sum(amount_cny), 0) from monthly_asset_snapshots where period_month = ?1 and version_no = 1 and status = 'held'",
    params![snapshot_month],
    |row| row.get(0),
  )?;
  let credit_card_net_adjustment: f64 = connection.query_row(
    "select coalesce(sum(net_adjustment), 0) from monthly_credit_card_entries where period_month = ?1 and confirmed = 1",
    params![snapshot_month],
    |row| row.get(0),
  )?;
  let asset_allocations = asset_allocation_breakdown(connection, &snapshot_month, None)?
    .into_iter()
    .filter(|item| item.amount.abs() > 0.000_001)
    .map(|item| MobileAssetAllocation {
      category: item.category,
      amount: item.amount,
      percent: item.percent,
    })
    .collect();
  let monthly_trends = dashboard_monthly_trends(connection)?
    .into_iter()
    .filter(|item| item.period_month.as_str() <= snapshot_month.as_str())
    .collect();
  let (investment_buy, investment_sell, investment_dividend): (f64, f64, f64) = connection.query_row(
    "
    select
      coalesce(sum(case when flow_type = 'buy' then amount_cny else 0 end), 0),
      coalesce(sum(case when flow_type = 'sell' then amount_cny else 0 end), 0),
      coalesce(sum(case when flow_type = 'dividend' then amount_cny else 0 end), 0)
    from investment_cashflows ic
    join assets a on a.id = ic.asset_id
    where ic.period_month = ?1
      and a.main_asset_category_id <> 'asset_cat_cash'
    ",
    params![snapshot_month],
    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
  )?;
  let investment_assets = investment_asset_performance(connection, &snapshot_month)?;
  let investment_group_performances = investment_group_performances(connection, &snapshot_month)?;
  let investment_group_trends = investment_group_trends(connection)?
    .into_iter()
    .filter(|item| item.period_month.as_str() <= snapshot_month.as_str())
    .collect();
  let investment_cashflow_calendar = investment_cashflow_calendar(connection, &snapshot_month)?;
  let mobile_update_month = next_period_month(&snapshot_month);
  let asset_entry_items = asset_entry_items_for_connection(connection, &mobile_update_month)?;
  let dca_cashflows = generated_dca_cashflows_for_connection(connection, &mobile_update_month)?;
  let spending_anomalies = spending_anomalies(connection, &snapshot_month)?;
  let expense_categories = category_breakdown(connection, &snapshot_month, "expense")?;
  let expense_year_rank = category_year_rank(connection, &snapshot_month, "expense")?;
  let expense_category_trends = category_month_amounts(connection, &snapshot_month, "expense")?;
  let mut statement = connection.prepare(
    "
    select
      ac.name,
      pti.target_percent,
      coalesce(sum(mas.amount_cny), 0) as current_amount
    from portfolio_target_items pti
    join portfolio_targets pt on pt.id = pti.target_id and pt.is_active = 1
    join asset_categories ac on ac.id = pti.main_asset_category_id
    left join assets a on a.main_asset_category_id = ac.id
    left join monthly_asset_snapshots mas on mas.asset_id = a.id
      and mas.period_month = ?1
      and mas.version_no = 1
      and mas.status = 'held'
    group by ac.id, ac.name, pti.target_percent, ac.sort_order
    having abs(coalesce(sum(mas.amount_cny), 0)) > 0.000001
      or pti.target_percent is not null
    order by ac.sort_order
    ",
  )?;
  let mut rows = statement.query(params![snapshot_month])?;
  let mut portfolio_targets = Vec::new();
  while let Some(row) = rows.next()? {
    let category: String = row.get(0)?;
    let target_percent: f64 = row.get(1)?;
    let current_amount: f64 = row.get(2)?;
    let current_percent = if asset_gross_value > 0.0 {
      current_amount / asset_gross_value
    } else {
      0.0
    };
    portfolio_targets.push(MobilePortfolioTarget {
      category,
      target_percent,
      current_amount,
      current_percent,
      deviation_percent: current_percent - target_percent,
    });
  }
  Ok(MobileDashboardSnapshot {
    snapshot_month,
    target_saving_rate,
    asset_gross_value,
    credit_card_net_adjustment,
    net_worth: asset_gross_value + credit_card_net_adjustment,
    investment_buy,
    investment_sell,
    investment_dividend,
    monthly_trends,
    expense_categories,
    expense_year_rank,
    expense_category_trends,
    asset_allocations,
    investment_assets,
    investment_group_performances,
    investment_group_trends,
    investment_cashflow_calendar,
    asset_entry_items,
    dca_cashflows,
    portfolio_targets,
    spending_anomalies,
  })
}

fn http_response(status: &str, content_type: &str, body: &str) -> Vec<u8> {
  format!(
    "HTTP/1.1 {status}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: {content_type}; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    body.as_bytes().len()
  )
  .into_bytes()
}

fn http_bytes(status: &str, content_type: &str, body: &[u8]) -> Vec<u8> {
  let mut response = format!(
    "HTTP/1.1 {status}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
    body.len()
  )
  .into_bytes();
  response.extend_from_slice(body);
  response
}

fn http_json<T: Serialize>(value: &T) -> Vec<u8> {
  match serde_json::to_string(value) {
    Ok(body) => http_response("200 OK", "application/json", &body),
    Err(err) => http_response("500 Internal Server Error", "text/plain", &format!("json error: {err}")),
  }
}

fn http_error(status: &str, message: &str) -> Vec<u8> {
  http_response(status, "text/plain", message)
}

fn request_path_without_query(path: &str) -> &str {
  path.split('?').next().unwrap_or(path)
}

fn mobile_sync_lan_ip() -> String {
  for interface in ["en0", "en1", "en2"] {
    if let Ok(output) = Command::new("/usr/sbin/ipconfig").args(["getifaddr", interface]).output() {
      if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !value.is_empty() {
          return value;
        }
      }
    }
  }
  UdpSocket::bind("0.0.0.0:0")
    .and_then(|socket| {
      let _ = socket.connect("8.8.8.8:80");
      socket.local_addr()
    })
    .map(|addr| addr.ip().to_string())
    .unwrap_or_else(|_| "127.0.0.1".to_string())
}

fn mobile_pairing_path(pairing_code: &str) -> String {
  format!("/index.html?mobileVersion={MOBILE_PWA_VERSION}&resetCache=1&pairCode={pairing_code}")
}

fn mobile_pairing_url(pairing_code: &str) -> String {
  format!("http://{}:18742{}", mobile_sync_lan_ip(), mobile_pairing_path(pairing_code))
}

fn mobile_pwa_response(path: &str) -> Option<Vec<u8>> {
  match request_path_without_query(path) {
    "/" | "/index.html" => Some(http_response("200 OK", "text/html", MOBILE_PWA_INDEX)),
    "/app.js" => Some(http_response("200 OK", "application/javascript", MOBILE_PWA_APP_JS)),
    "/styles.css" => Some(http_response("200 OK", "text/css", MOBILE_PWA_STYLES)),
    "/sw.js" => Some(http_response("200 OK", "application/javascript", MOBILE_PWA_SW)),
    "/manifest.webmanifest" => Some(http_response("200 OK", "application/manifest+json", MOBILE_PWA_MANIFEST)),
    "/logo-qianji-a.svg" => Some(http_bytes("200 OK", "image/svg+xml", MOBILE_PWA_LOGO.as_bytes())),
    "/assets/logo-qianji-a.svg" => Some(http_bytes("200 OK", "image/svg+xml", MOBILE_PWA_LOGO.as_bytes())),
    _ => None,
  }
}

fn read_http_request(stream: &mut TcpStream) -> Result<(String, String, String), AppError> {
  stream.set_read_timeout(Some(Duration::from_secs(2)))?;
  let mut buffer = Vec::new();
  let mut temp = [0_u8; 8192];
  let mut header_end = None;
  loop {
    let count = stream.read(&mut temp)?;
    if count == 0 {
      break;
    }
    buffer.extend_from_slice(&temp[..count]);
    if let Some(position) = buffer.windows(4).position(|window| window == b"\r\n\r\n") {
      header_end = Some(position + 4);
      break;
    }
    if buffer.len() > 1024 * 1024 {
      return Err(AppError::InvalidCsvValue("手机同步请求过大".to_string()));
    }
  }
  let header_end = header_end.ok_or_else(|| AppError::InvalidCsvValue("手机同步请求格式无效".to_string()))?;
  let headers = String::from_utf8_lossy(&buffer[..header_end]).to_string();
  let mut lines = headers.lines();
  let request_line = lines.next().unwrap_or_default();
  let mut parts = request_line.split_whitespace();
  let method = parts.next().unwrap_or_default().to_string();
  let path = parts.next().unwrap_or_default().to_string();
  let content_length = headers
    .lines()
    .find_map(|line| {
      let (name, value) = line.split_once(':')?;
      if name.eq_ignore_ascii_case("content-length") {
        value.trim().parse::<usize>().ok()
      } else {
        None
      }
    })
    .unwrap_or(0);
  while buffer.len() < header_end + content_length {
    let count = stream.read(&mut temp)?;
    if count == 0 {
      break;
    }
    buffer.extend_from_slice(&temp[..count]);
  }
  let body_bytes = &buffer[header_end..std::cmp::min(buffer.len(), header_end + content_length)];
  let body = String::from_utf8_lossy(body_bytes).to_string();
  Ok((method, path, body))
}

fn handle_mobile_sync_stream(mut stream: TcpStream, work_db_path: PathBuf, dashboard_db_path: PathBuf) {
  let response = match read_http_request(&mut stream) {
    Ok((method, path, body)) => {
      if method == "OPTIONS" {
        http_response("204 No Content", "text/plain", "")
      } else if method == "GET" {
        if let Some(response) = mobile_pwa_response(&path) {
          response
        } else if path == "/mobile-sync/health" {
          http_response("200 OK", "text/plain", "WorthTrace mobile sync is ready")
        } else if path == "/mobile-sync/pairing" {
          match Connection::open(&work_db_path)
            .map_err(AppError::from)
            .and_then(|connection| {
              ensure_mobile_sync_schema(&connection)?;
              let account_id = mobile_account_id(&connection)?;
              let pairing_code = mobile_pairing_code(&connection)?;
              let paired_device_count = connection.query_row(
                "select count(*) from mobile_sync_devices where account_id = ?1",
                params![account_id],
                |row| row.get(0),
              )?;
              let devices = list_mobile_devices(&connection, &account_id)?;
              let pairing_url_path = mobile_pairing_path(&pairing_code);
              Ok(MobilePairingInfo {
                enabled: true,
                mobile_app_version: MOBILE_PWA_VERSION.to_string(),
                account_id,
                pairing_url_path,
                pairing_url: mobile_pairing_url(&pairing_code),
                pairing_code,
                paired_device_count,
                devices,
              })
            }) {
              Ok(info) => http_json(&info),
              Err(err) => http_error("500 Internal Server Error", &err.to_string()),
            }
        } else if path == "/mobile-sync/dashboard" {
          match Connection::open(&dashboard_db_path)
            .map_err(AppError::from)
            .and_then(|connection| read_mobile_dashboard_snapshot(&connection)) {
              Ok(snapshot) => http_json(&snapshot),
              Err(err) => http_error("500 Internal Server Error", &err.to_string()),
            }
        } else {
          http_error("404 Not Found", "not found")
        }
      } else if method == "POST" && path == "/mobile-sync/pair" {
        match serde_json::from_str::<MobilePairInput>(&body) {
          Ok(input) => match Connection::open(&work_db_path)
            .map_err(AppError::from)
            .and_then(|connection| {
              ensure_mobile_sync_schema(&connection)?;
              bind_mobile_device(&connection, input)
            }) {
              Ok(result) => http_json(&result),
              Err(err) => http_error("400 Bad Request", &err.to_string()),
            },
          Err(err) => http_error("400 Bad Request", &format!("invalid pair payload: {err}")),
        }
      } else if method == "POST" && path == "/mobile-sync/unpair" {
        match serde_json::from_str::<MobileUnpairInput>(&body) {
          Ok(input) => match Connection::open(&work_db_path)
            .map_err(AppError::from)
            .and_then(|connection| unpair_mobile_device(&connection, input)) {
              Ok(()) => http_json(&serde_json::json!({ "unpaired": true })),
              Err(err) => http_error("400 Bad Request", &err.to_string()),
            },
          Err(err) => http_error("400 Bad Request", &format!("invalid unpair payload: {err}")),
        }
      } else if method == "POST" && path == "/mobile-sync/auth" {
        match serde_json::from_str::<MobilePasswordInput>(&body) {
          Ok(input) => match Connection::open(&work_db_path)
            .map_err(AppError::from)
            .and_then(|connection| {
              if verify_password(&connection, &input.password)? {
                Ok(serde_json::json!({ "unlocked": true }))
              } else {
                Err(AppError::InvalidPassword)
              }
            }) {
              Ok(result) => http_json(&result),
              Err(err) => http_error("401 Unauthorized", &err.to_string()),
            },
          Err(err) => http_error("400 Bad Request", &format!("invalid auth payload: {err}")),
        }
      } else if method == "POST" && path == "/mobile-sync/password" {
        match serde_json::from_str::<MobilePasswordChangeInput>(&body) {
          Ok(input) => match Connection::open(&work_db_path)
            .map_err(AppError::from)
            .and_then(|connection| {
              if input.new_password.chars().count() < 6 {
                return Err(AppError::WeakPassword);
              }
              if !verify_password(&connection, &input.current_password)? {
                return Err(AppError::InvalidPassword);
              }
              let salt = generate_salt();
              let hash = hash_password(&input.new_password, &salt);
              upsert_setting(&connection, "security_password_salt", &serde_json::to_string(&salt).unwrap())?;
              upsert_setting(&connection, "security_password_hash", &serde_json::to_string(&hash).unwrap())?;
              Ok(serde_json::json!({ "changed": true }))
            }) {
              Ok(result) => http_json(&result),
              Err(err) => http_error("400 Bad Request", &err.to_string()),
            },
          Err(err) => http_error("400 Bad Request", &format!("invalid password payload: {err}")),
        }
      } else if method == "POST" && path == "/mobile-sync/status" {
        match serde_json::from_str::<MobileSyncStatusInput>(&body) {
          Ok(input) => match Connection::open(&work_db_path)
            .map_err(AppError::from)
            .and_then(|connection| {
              ensure_mobile_sync_schema(&connection)?;
              let device_id = mobile_sync_device_id(input.device_id);
              upsert_mobile_device(&connection, &device_id, input.account_id.as_deref(), None, input.app_version.as_deref(), input.pending_count, input.synced_count)?;
              read_mobile_sync_summary(&connection, true)
            }) {
              Ok(summary) => http_json(&summary),
              Err(err) => http_error("500 Internal Server Error", &err.to_string()),
            },
          Err(err) => http_error("400 Bad Request", &format!("invalid status payload: {err}")),
        }
      } else if method == "POST" && path == "/mobile-sync/push" {
        match serde_json::from_str::<MobileSyncPushInput>(&body) {
          Ok(input) => {
            let dashboard_input = input.clone();
            match Connection::open(&work_db_path)
              .map_err(AppError::from)
              .and_then(|mut connection| {
                ensure_mobile_sync_schema(&connection)?;
                store_mobile_sync_records(&mut connection, input)
              })
              .and_then(|result| {
                if work_db_path != dashboard_db_path {
                  let account_id = dashboard_input.account_id.as_deref().unwrap_or("");
                  let device_id = mobile_sync_device_id(dashboard_input.device_id.clone());
                  let mut dashboard_connection = Connection::open(&dashboard_db_path)?;
                  apply_mobile_records_to_connection(
                    &mut dashboard_connection,
                    account_id,
                    &device_id,
                    &dashboard_input.records,
                  )?;
                }
                Ok(result)
              }) {
              Ok(result) => http_json(&result),
              Err(err) => http_error("500 Internal Server Error", &err.to_string()),
            }
          }
          Err(err) => http_error("400 Bad Request", &format!("invalid sync payload: {err}")),
        }
      } else {
        http_error("404 Not Found", "not found")
      }
    }
    Err(err) => http_error("400 Bad Request", &err.to_string()),
  };
  let _ = stream.write_all(&response);
}

fn start_mobile_sync_server(work_db_path: PathBuf, dashboard_db_path: PathBuf) {
  thread::spawn(move || {
    let listener = match TcpListener::bind("0.0.0.0:18742") {
      Ok(listener) => listener,
      Err(err) => {
        eprintln!("mobile sync server unavailable: {err}");
        return;
      }
    };
    for stream in listener.incoming().flatten() {
      let work_path = work_db_path.clone();
      let dashboard_path = dashboard_db_path.clone();
      thread::spawn(move || handle_mobile_sync_stream(stream, work_path, dashboard_path));
    }
  });
}

fn cell_string(row: &[String], index: usize, field: &'static str) -> Result<String, AppError> {
  row
    .get(index)
    .map(|value| value.trim().to_string())
    .ok_or(AppError::MissingCsvField(field))
}

fn column_index(cell_ref: &str) -> usize {
  let mut index = 0_usize;
  for byte in cell_ref.bytes().take_while(|byte| byte.is_ascii_alphabetic()) {
    index = index * 26 + usize::from(byte.to_ascii_uppercase() - b'A' + 1);
  }
  index.saturating_sub(1)
}

fn attr_value(element: &BytesStart<'_>, name: &[u8]) -> Option<String> {
  element
    .attributes()
    .flatten()
    .find(|attribute| attribute.key.as_ref() == name)
    .and_then(|attribute| String::from_utf8(attribute.value.as_ref().to_vec()).ok())
}

fn push_general_ref(target: &mut String, reference: &quick_xml::events::BytesRef<'_>) -> Result<(), AppError> {
  let raw = reference
    .decode()
    .map_err(|_| AppError::InvalidCsvValue("上传失败：Excel 字符无法识别".to_string()))?;
  let escaped = format!("&{};", raw);
  let unescaped = unescape(&escaped)
    .map_err(|_| AppError::InvalidCsvValue("上传失败：Excel 字符无法识别".to_string()))?;
  target.push_str(&unescaped);
  Ok(())
}

fn unzip_xlsx_entry(path: &Path, entry: &str, required: bool) -> Result<Option<String>, AppError> {
  let output = Command::new("/usr/bin/unzip")
    .arg("-p")
    .arg(path)
    .arg(entry)
    .output()?;
  if !output.status.success() {
    if required {
      return Err(AppError::InvalidCsvValue(format!(
        "上传失败：无法读取 Excel 文件里的 {entry}"
      )));
    }
    return Ok(None);
  }
  String::from_utf8(output.stdout)
    .map(Some)
    .map_err(|_| AppError::InvalidCsvValue("上传失败：Excel 文件内容编码无法识别".to_string()))
}

fn parse_shared_strings(xml: &str) -> Result<Vec<String>, AppError> {
  let mut reader = Reader::from_str(xml);
  reader.config_mut().trim_text(true);
  let mut values = Vec::new();
  let mut current = String::new();
  let mut in_si = false;
  let mut in_t = false;

  loop {
    match reader.read_event() {
      Ok(Event::Start(element)) => match element.name().as_ref() {
        b"si" => {
          in_si = true;
          current.clear();
        }
        b"t" if in_si => in_t = true,
        _ => {}
      },
      Ok(Event::End(element)) => match element.name().as_ref() {
        b"si" => {
          values.push(current.clone());
          current.clear();
          in_si = false;
        }
        b"t" => in_t = false,
        _ => {}
      },
      Ok(Event::Text(text)) if in_t => {
        let decoded = text
          .xml_content()
          .map_err(|_| AppError::InvalidCsvValue("上传失败：Excel 文本无法识别".to_string()))?;
        let unescaped = unescape(&decoded)
          .map_err(|_| AppError::InvalidCsvValue("上传失败：Excel 文本无法识别".to_string()))?;
        current.push_str(&unescaped);
      }
      Ok(Event::GeneralRef(reference)) if in_t => {
        push_general_ref(&mut current, &reference)?;
      }
      Ok(Event::Eof) => break,
      Err(_) => return Err(AppError::InvalidCsvValue("上传失败：Excel 文本解析失败".to_string())),
      _ => {}
    }
  }
  Ok(values)
}

fn parse_xlsx_rows(path: &Path) -> Result<Vec<Vec<String>>, AppError> {
  let sheet_xml = unzip_xlsx_entry(path, "xl/worksheets/sheet1.xml", true)?
    .unwrap_or_default();
  let shared_strings = match unzip_xlsx_entry(path, "xl/sharedStrings.xml", false)? {
    Some(xml) => parse_shared_strings(&xml)?,
    None => Vec::new(),
  };

  let mut reader = Reader::from_str(&sheet_xml);
  reader.config_mut().trim_text(true);
  let mut rows: Vec<Vec<String>> = Vec::new();
  let mut current_row: Vec<String> = Vec::new();
  let mut current_col = 0_usize;
  let mut current_cell_type = String::new();
  let mut current_value = String::new();
  let mut in_cell = false;
  let mut in_value = false;
  let mut in_inline_text = false;

  loop {
    match reader.read_event() {
      Ok(Event::Start(element)) => match element.name().as_ref() {
        b"row" => {
          current_row.clear();
        }
        b"c" => {
          in_cell = true;
          current_cell_type = attr_value(&element, b"t").unwrap_or_default();
          current_col = attr_value(&element, b"r")
            .map(|reference| column_index(&reference))
            .unwrap_or(current_row.len());
          current_value.clear();
        }
        b"v" if in_cell => in_value = true,
        b"t" if in_cell => in_inline_text = true,
        _ => {}
      },
      Ok(Event::End(element)) => match element.name().as_ref() {
        b"c" => {
          while current_row.len() < current_col {
            current_row.push(String::new());
          }
          let value = if current_cell_type == "s" {
            current_value
              .parse::<usize>()
              .ok()
              .and_then(|index| shared_strings.get(index).cloned())
              .unwrap_or_default()
          } else {
            current_value.clone()
          };
          current_row.push(value);
          current_value.clear();
          current_cell_type.clear();
          in_cell = false;
          in_value = false;
          in_inline_text = false;
        }
        b"row" => {
          if current_row.iter().any(|value| !value.trim().is_empty()) {
            rows.push(current_row.clone());
          }
        }
        b"v" => in_value = false,
        b"t" => in_inline_text = false,
        _ => {}
      },
      Ok(Event::Text(text)) if in_value || in_inline_text => {
        let decoded = text
          .xml_content()
          .map_err(|_| AppError::InvalidCsvValue("上传失败：Excel 单元格无法识别".to_string()))?;
        let unescaped = unescape(&decoded)
          .map_err(|_| AppError::InvalidCsvValue("上传失败：Excel 单元格无法识别".to_string()))?;
        current_value.push_str(&unescaped);
      }
      Ok(Event::GeneralRef(reference)) if in_value || in_inline_text => {
        push_general_ref(&mut current_value, &reference)?;
      }
      Ok(Event::Eof) => break,
      Err(_) => return Err(AppError::InvalidCsvValue("上传失败：Excel 内容解析失败".to_string())),
      _ => {}
    }
  }
  Ok(rows)
}

fn parse_shark_rows_from_table(rows: Vec<Vec<String>>) -> Result<(Vec<ParsedSharkRow>, Vec<String>), AppError> {
  let mut iter = rows.into_iter().filter(|row| row.iter().any(|value| !value.trim().is_empty()));
  let headers = iter
    .next()
    .ok_or(AppError::MissingCsvField("表头"))?
    .into_iter()
    .map(|value| normalize_header(&value))
    .collect::<Vec<_>>();
  let field_index = |name: &'static str| -> Result<usize, AppError> {
    headers
      .iter()
      .position(|header| header == name)
      .ok_or(AppError::MissingCsvField(name))
  };
  let date_index = field_index("日期")?;
  let type_index = field_index("收支类型")?;
  let category_index = field_index("类别")?;
  let account_index = field_index("账户")?;
  let amount_index = field_index("金额")?;
  let note_index = field_index("备注")?;

  let mut parsed_rows: Vec<ParsedSharkRow> = Vec::new();
  let mut period_months: Vec<String> = Vec::new();
  for (line_index, columns) in iter.enumerate() {
    let source_row_no = (line_index + 2) as i64;
    let transaction_date = parse_shark_date(&cell_string(&columns, date_index, "日期")?)?;
    let raw_type = cell_string(&columns, type_index, "收支类型")?;
    let Some(transaction_kind) = normalize_transaction_type(&raw_type) else {
      continue;
    };
    let period_month = period_from_date(&transaction_date);
    if !period_months.contains(&period_month) {
      period_months.push(period_month);
    }
    let line = columns.join("\t");
    parsed_rows.push(ParsedSharkRow {
      source_row_no,
      line,
      transaction_date,
      raw_type,
      raw_category: cell_string(&columns, category_index, "类别")?,
      raw_account: cell_string(&columns, account_index, "账户")?,
      amount: parse_amount(&cell_string(&columns, amount_index, "金额")?)?,
      note: columns.get(note_index).map(|value| value.trim().to_string()).unwrap_or_default(),
      transaction_kind: transaction_kind.to_string(),
    });
  }
  period_months.sort();
  Ok((parsed_rows, period_months))
}

fn parse_shark_rows_from_file(path: &Path, bytes: &[u8]) -> Result<(Vec<ParsedSharkRow>, Vec<String>), AppError> {
  let extension = path
    .extension()
    .and_then(|extension| extension.to_str())
    .unwrap_or("")
    .to_ascii_lowercase();
  if extension == "xlsx" {
    return parse_shark_rows_from_table(parse_xlsx_rows(path)?);
  }

  let csv_text = decode_csv_text(bytes)?;
  let delimiter = csv_text
    .lines()
    .find(|line| !line.trim().is_empty())
    .map(|line| if line.matches('\t').count() >= line.matches(',').count() { '\t' } else { ',' })
    .unwrap_or('\t');
  let rows = csv_text
    .lines()
    .filter(|line| !line.trim().is_empty())
    .map(|line| parse_delimited_line(line, delimiter))
    .collect::<Vec<_>>();
  parse_shark_rows_from_table(rows)
}

fn mapped_category_id(
  connection: &Connection,
  source_type: &str,
  raw_category: &str,
) -> Result<Option<String>, AppError> {
  let category_id = connection
    .query_row(
      "
      select category_id
      from category_mappings
      where source_type = ?1 and raw_category = ?2 and is_active = 1
      ",
      params![source_type, raw_category],
      |row| row.get(0),
    )
    .optional()?;
  Ok(category_id)
}

fn create_imported_category_if_needed(
  connection: &Connection,
  raw_category: &str,
  category_kind: &str,
) -> Result<String, AppError> {
  let trimmed = raw_category.trim();
  if trimmed.is_empty() {
    return Err(AppError::InvalidCsvValue("分类为空，不能自动新增".to_string()));
  }
  if let Some(existing_id) = connection
    .query_row(
      "select id from categories where name = ?1 and category_kind = ?2",
      params![trimmed, category_kind],
      |row| row.get::<_, String>(0),
    )
    .optional()?
  {
    connection.execute(
      "
      insert into category_mappings (id, source_type, raw_category, category_id, confidence, is_active)
      values (?1, 'shark_csv', ?2, ?3, 1, 1)
      on conflict(source_type, raw_category) do update set
        category_id = excluded.category_id,
        confidence = 1,
        is_active = 1,
        updated_at = current_timestamp
      ",
      params![make_id("cat_map", &format!("shark_csv|{}", trimmed)), trimmed, existing_id],
    )?;
    return Ok(existing_id);
  }

  let category_id = make_id("cat", &format!("{}|{}|imported", category_kind, trimmed));
  let rigidity: Option<&str> = if category_kind == "expense" { Some("flexible") } else { None };
  connection.execute(
    "
    insert into categories (
      id, name, category_kind, rigidity, is_personal, is_active,
      sort_order, is_auto_created, source, created_from_raw_category, note
    )
    values (?1, ?2, ?3, ?4, 1, 1, 999, 1, 'imported', ?2, '导入时自动新增，待处理')
    on conflict(name, category_kind) do nothing
    ",
    params![category_id, trimmed, category_kind, rigidity],
  )?;
  let actual_id: String = connection.query_row(
    "select id from categories where name = ?1 and category_kind = ?2",
    params![trimmed, category_kind],
    |row| row.get(0),
  )?;
  connection.execute(
    "
    insert into category_mappings (id, source_type, raw_category, category_id, confidence, is_active)
    values (?1, 'shark_csv', ?2, ?3, 1, 1)
    on conflict(source_type, raw_category) do update set
      category_id = excluded.category_id,
      confidence = 1,
      is_active = 1,
      updated_at = current_timestamp
    ",
    params![make_id("cat_map", &format!("shark_csv|{}", trimmed)), trimmed, actual_id],
  )?;
  Ok(actual_id)
}

fn asset_dca_plans(connection: &Connection, asset_id: &str) -> Result<Vec<DcaPlanItem>, AppError> {
  let mut statement = connection.prepare(
    "
    select id, frequency, amount, start_date, end_date, weekly_rules_json, monthly_day
    from dca_plans
    where asset_id = ?1 and is_active = 1
    order by created_at, id
    ",
  )?;
  let plans = statement
    .query_map(params![asset_id], |row| {
      Ok(DcaPlanItem {
        id: Some(row.get(0)?),
        frequency: row.get(1)?,
        amount: row.get(2)?,
        start_date: row.get(3)?,
        end_date: row.get(4)?,
        weekly_rules_json: row.get(5)?,
        monthly_day: row.get(6)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(plans)
}

fn set_step_status(
  connection: &Connection,
  period_month: &str,
  step_key: &str,
  completed: bool,
) -> Result<(), AppError> {
  connection.execute(
    "
    insert into monthly_step_status (period_month, step_key, completed, completed_at, updated_at)
    values (?1, ?2, ?3, case when ?3 = 1 then current_timestamp else null end, current_timestamp)
    on conflict(period_month, step_key) do update set
      completed = excluded.completed,
      completed_at = excluded.completed_at,
      updated_at = current_timestamp
    ",
    params![period_month, step_key, if completed { 1 } else { 0 }],
  )?;
  Ok(())
}

fn read_step_status(connection: &Connection, period_month: &str, step_key: &str) -> Result<bool, AppError> {
  let value = connection
    .query_row(
      "select completed from monthly_step_status where period_month = ?1 and step_key = ?2",
      params![period_month, step_key],
      |row| row.get::<_, i64>(0),
    )
    .optional()?;
  Ok(value.unwrap_or(0) == 1)
}

fn latest_completed_period_month(connection: &Connection) -> Result<String, AppError> {
  let from_steps = connection
    .query_row(
      "
      select max(period_month)
      from monthly_step_status
      where step_key = 'final' and completed = 1
        and period_month < strftime('%Y-%m', 'now', 'localtime')
      ",
      [],
      |row| row.get::<_, Option<String>>(0),
    )?
    .filter(|value| !value.trim().is_empty());
  if let Some(period) = from_steps {
    return Ok(period);
  }

  let from_closes = connection
    .query_row(
      "
      select max(period_month)
      from monthly_closes
      where status in ('generated', 'historical_numbers_imported')
        and period_month < strftime('%Y-%m', 'now', 'localtime')
      ",
      [],
      |row| row.get::<_, Option<String>>(0),
    )?
    .filter(|value| !value.trim().is_empty());
  if let Some(period) = from_closes {
    return Ok(period);
  }

  if setting_bool(connection, "onboarding_completed", false)? {
    let from_initial_snapshot = connection
      .query_row(
        "
        select max(period_month)
        from monthly_asset_snapshots
        where version_no = 1
          and period_month < strftime('%Y-%m', 'now', 'localtime')
          and note = '初始化资产快照'
        ",
        [],
        |row| row.get::<_, Option<String>>(0),
      )?
      .filter(|value| !value.trim().is_empty());
    if let Some(period) = from_initial_snapshot {
      return Ok(period);
    }
  }

  Ok("2026-04".to_string())
}

fn dashboard_monthly_trends(connection: &Connection) -> Result<Vec<MonthlyTrend>, AppError> {
  let mut statement = connection.prepare(
    "
    with months as (
      select period_month from confirmed_transactions
      union
      select period_month from monthly_asset_snapshots
      union
      select period_month from monthly_credit_card_entries
    ),
    tx as (
      select
        period_month,
        sum(case when transaction_type = 'income' and include_in_stats = 1 and confirmation_status = 'confirmed' then amount else 0 end) as income,
        sum(case when transaction_type = 'expense' and include_in_stats = 1 and confirmation_status = 'confirmed' then amount else 0 end) as expense
      from confirmed_transactions
      group by period_month
    ),
    asset as (
      select period_month, sum(amount_cny) as asset_gross
      from monthly_asset_snapshots
      where version_no = 1 and status = 'held'
      group by period_month
    ),
    credit as (
      select period_month, sum(net_adjustment) as credit_net
      from monthly_credit_card_entries
      where confirmed = 1
      group by period_month
    ),
    flows as (
      select
        ic.period_month,
        sum(case when flow_type = 'buy' then amount_cny else 0 end) as buy,
        sum(case when flow_type = 'sell' then amount_cny else 0 end) as sell,
        sum(case when flow_type = 'dividend' then amount_cny else 0 end) as dividend
      from investment_cashflows ic
      join assets a on a.id = ic.asset_id
      where a.main_asset_category_id <> 'asset_cat_cash'
      group by ic.period_month
    )
    select
      m.period_month,
      coalesce(tx.income, 0),
      coalesce(tx.expense, 0),
      coalesce(asset.asset_gross, 0),
      coalesce(credit.credit_net, 0),
      coalesce(flows.buy, 0),
      coalesce(flows.sell, 0),
      coalesce(flows.dividend, 0)
    from months m
    left join tx on tx.period_month = m.period_month
    left join asset on asset.period_month = m.period_month
    left join credit on credit.period_month = m.period_month
    left join flows on flows.period_month = m.period_month
    order by m.period_month
    ",
  )?;
  let mut trends = statement
    .query_map([], |row| {
      let period_month: String = row.get(0)?;
      let income: f64 = row.get(1)?;
      let expense: f64 = row.get(2)?;
      let asset_gross_value: f64 = row.get(3)?;
      let credit_card_net_adjustment: f64 = row.get(4)?;
      let investment_buy: f64 = row.get(5)?;
      let investment_sell: f64 = row.get(6)?;
      let investment_dividend: f64 = row.get(7)?;
      let saving_amount = income - expense;
      let saving_rate = if income > 0.0 { saving_amount / income } else { 0.0 };
      Ok(MonthlyTrend {
        period_month,
        income,
        expense,
        saving_amount,
        saving_rate,
        asset_gross_value,
        credit_card_net_adjustment,
        net_worth: asset_gross_value + credit_card_net_adjustment,
        investment_buy,
        investment_sell,
        investment_dividend,
        investment_gain: 0.0,
        investment_return_rate: None,
        monthly_xirr: None,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  for trend in trends.iter_mut() {
    let previous = previous_period_month(&trend.period_month);
    let beginning_value: f64 = connection.query_row(
      "
      select coalesce(sum(amount_cny), 0)
      from monthly_asset_snapshots mas
      join assets a on a.id = mas.asset_id
      where mas.period_month = ?1
        and mas.version_no = 1
        and mas.status = 'held'
        and a.main_asset_category_id <> 'asset_cat_cash'
      ",
      params![previous],
      |row| row.get(0),
    )?;
    let ending_value: f64 = connection.query_row(
      "
      select coalesce(sum(amount_cny), 0)
      from monthly_asset_snapshots mas
      join assets a on a.id = mas.asset_id
      where mas.period_month = ?1
        and mas.version_no = 1
        and mas.status = 'held'
        and a.main_asset_category_id <> 'asset_cat_cash'
      ",
      params![trend.period_month],
      |row| row.get(0),
    )?;
    trend.investment_gain =
      ending_value - beginning_value - trend.investment_buy + trend.investment_sell + trend.investment_dividend;
    let investment_denominator = beginning_value + trend.investment_buy;
    trend.investment_return_rate = if beginning_value.abs() > 0.000_001 && investment_denominator.abs() > 0.000_001 {
      Some(trend.investment_gain / investment_denominator)
    } else {
      None
    };
    let mut flows = Vec::new();
    if beginning_value.abs() > 0.000_001 {
      flows.push((format!("{}-01", trend.period_month), -beginning_value));
    }
    let mut flow_statement = connection.prepare(
      "
      select flow_date, flow_type, amount_cny
      from investment_cashflows ic
      join assets a on a.id = ic.asset_id
      where ic.period_month = ?1
        and a.main_asset_category_id <> 'asset_cat_cash'
      order by flow_date
      ",
    )?;
    let period_flows = flow_statement
      .query_map(params![trend.period_month], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
      })?
      .collect::<Result<Vec<_>, _>>()?;
    for (date, flow_type, amount) in period_flows {
      let signed = match flow_type.as_str() {
        "buy" => -amount,
        "sell" | "dividend" => amount,
        _ => 0.0,
      };
      if signed.abs() > 0.000_001 {
        flows.push((date, signed));
      }
    }
    if ending_value.abs() > 0.000_001 {
      flows.push((month_end_date(&trend.period_month), ending_value));
    }
    trend.monthly_xirr = xirr(&flows);
  }
  Ok(trends)
}

fn category_breakdown(
  connection: &Connection,
  period_month: &str,
  transaction_type: &str,
) -> Result<Vec<CategoryBreakdown>, AppError> {
  let previous = previous_period_month(period_month);
  let mut statement = connection.prepare(
    "
    with current_rows as (
      select
        coalesce(c.name, ct.raw_category_snapshot, '未分类') as category,
        sum(ct.amount) as amount
      from confirmed_transactions ct
      left join categories c on c.id = ct.category_id
      where ct.period_month = ?1
        and ct.transaction_type = ?2
        and ct.include_in_stats = 1
        and ct.confirmation_status = 'confirmed'
        and coalesce(c.name, ct.raw_category_snapshot, '') <> 'Numbers校准调整'
      group by category
    ),
    previous_rows as (
      select
        coalesce(c.name, ct.raw_category_snapshot, '未分类') as category,
        sum(ct.amount) as amount
      from confirmed_transactions ct
      left join categories c on c.id = ct.category_id
      where ct.period_month = ?3
        and ct.transaction_type = ?2
        and ct.include_in_stats = 1
        and ct.confirmation_status = 'confirmed'
        and coalesce(c.name, ct.raw_category_snapshot, '') <> 'Numbers校准调整'
      group by category
    ),
    total as (
      select coalesce(sum(amount), 0) as total_amount from current_rows
    )
    select
      current_rows.category,
      null as rigidity,
      current_rows.amount,
      case when total.total_amount > 0 then current_rows.amount / total.total_amount else 0 end,
      current_rows.amount - coalesce(previous_rows.amount, 0)
    from current_rows
    cross join total
    left join previous_rows on previous_rows.category = current_rows.category
    order by current_rows.amount desc
    ",
  )?;
  let rows = statement
    .query_map(params![period_month, transaction_type, previous], |row| {
      Ok(CategoryBreakdown {
        category: row.get(0)?,
        rigidity: row.get(1)?,
        amount: row.get(2)?,
        percent: row.get(3)?,
        month_over_month_delta: row.get(4)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn category_year_rank(
  connection: &Connection,
  period_month: &str,
  transaction_type: &str,
) -> Result<Vec<CategoryBreakdown>, AppError> {
  let year_prefix = period_month.get(0..4).unwrap_or(period_month);
  let year_filter = format!("{}-%", year_prefix);
  let mut statement = connection.prepare(
    "
    with rows as (
      select
        coalesce(c.name, ct.raw_category_snapshot, '未分类') as category,
        sum(ct.amount) as amount
      from confirmed_transactions ct
      left join categories c on c.id = ct.category_id
      where ct.period_month like ?1
        and ct.period_month <= ?2
        and ct.transaction_type = ?3
        and ct.include_in_stats = 1
        and ct.confirmation_status = 'confirmed'
        and coalesce(c.name, ct.raw_category_snapshot, '') <> 'Numbers校准调整'
      group by category
    ),
    total as (
      select coalesce(sum(amount), 0) as total_amount from rows
    )
    select
      rows.category,
      null as rigidity,
      rows.amount,
      case when total.total_amount > 0 then rows.amount / total.total_amount else 0 end
    from rows cross join total
    order by rows.amount desc
    ",
  )?;
  let rows = statement
    .query_map(params![year_filter, period_month, transaction_type], |row| {
      Ok(CategoryBreakdown {
        category: row.get(0)?,
        rigidity: row.get(1)?,
        amount: row.get(2)?,
        percent: row.get(3)?,
        month_over_month_delta: 0.0,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn category_month_amounts(
  connection: &Connection,
  snapshot_month: &str,
  transaction_type: &str,
) -> Result<Vec<MobileCategoryMonthAmount>, AppError> {
  let mut statement = connection.prepare(
    "
    select
      ct.period_month,
      coalesce(c.name, ct.raw_category_snapshot, '未分类') as category,
      sum(ct.amount) as amount
    from confirmed_transactions ct
    left join categories c on c.id = ct.category_id
    where ct.period_month <= ?1
      and ct.transaction_type = ?2
      and ct.include_in_stats = 1
      and ct.confirmation_status = 'confirmed'
      and coalesce(c.name, ct.raw_category_snapshot, '') <> 'Numbers校准调整'
    group by ct.period_month, category
    order by ct.period_month, amount desc
    ",
  )?;
  let rows = statement
    .query_map(params![snapshot_month, transaction_type], |row| {
      Ok(MobileCategoryMonthAmount {
        period_month: row.get(0)?,
        category: row.get(1)?,
        amount: row.get(2)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn spending_anomalies(
  connection: &Connection,
  period_month: &str,
) -> Result<Vec<SpendingAnomaly>, AppError> {
  let average: f64 = connection.query_row(
    "
    select coalesce(avg(amount), 0)
    from confirmed_transactions
    where period_month = ?1
      and transaction_type = 'expense'
      and include_in_stats = 1
      and confirmation_status = 'confirmed'
    ",
    params![period_month],
    |row| row.get(0),
  )?;
  let threshold = (average * 2.5).max(1000.0);
  let mut statement = connection.prepare(
    "
    select
      ct.transaction_date,
      coalesce(c.name, ct.raw_category_snapshot, '未分类') as category,
      ct.amount,
      ct.note
    from confirmed_transactions ct
    left join categories c on c.id = ct.category_id
    where ct.period_month = ?1
      and ct.transaction_type = 'expense'
      and ct.include_in_stats = 1
      and ct.confirmation_status = 'confirmed'
      and ct.amount >= ?2
    order by ct.amount desc
    limit 12
    ",
  )?;
  let rows = statement
    .query_map(params![period_month, threshold], |row| {
      Ok(SpendingAnomaly {
        transaction_date: row.get(0)?,
        category: row.get(1)?,
        amount: row.get(2)?,
        note: row.get(3)?,
        reason: format!("超过本月单笔均值 {:.1} 倍，阈值 {:.2}", 2.5, threshold),
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn asset_allocation_breakdown(
  connection: &Connection,
  period_month: &str,
  parent_id: Option<&str>,
) -> Result<Vec<AssetAllocationBreakdown>, AppError> {
  if let Some(parent) = parent_id {
    let mut statement = connection.prepare(
      "
      with recursive direct as (
        select id, name, sort_order
        from asset_categories
        where parent_id = ?2
          and is_active = 1
      ),
      scope(category_id, root_id) as (
        select id, id from direct
        union all
        select child.id, scope.root_id
        from asset_categories child
        join scope on child.parent_id = scope.category_id
        where child.is_active = 1
      ),
      rows as (
        select
          direct.id as category_id,
          direct.name as category,
          coalesce(sum(mas.amount_cny), 0) as amount,
          pti.target_percent as target_percent
        from direct
        left join scope on scope.root_id = direct.id
        left join assets a on a.sub_asset_category_id = scope.category_id
        left join monthly_asset_snapshots mas on mas.asset_id = a.id
          and mas.period_month = ?1
          and mas.version_no = 1
          and mas.status = 'held'
        left join portfolio_targets pt on pt.is_active = 1
        left join portfolio_target_items pti on pti.target_id = pt.id and pti.main_asset_category_id = direct.id
        group by direct.id, direct.name, pti.target_percent, direct.sort_order
        order by direct.sort_order
      ),
      total as (
        select coalesce(sum(amount), 0) as total_amount from rows
      )
      select
        rows.category_id,
        rows.category,
        rows.amount,
        case when total.total_amount > 0 then rows.amount / total.total_amount else 0 end,
        rows.target_percent
      from rows cross join total
      ",
    )?;
    let custom_targets = custom_allocation_target_map(connection, "sub", Some(parent))?;
    let mut rows = statement.query(params![period_month, parent])?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
      let category_id: String = row.get(0)?;
      let target_percent: Option<f64> = custom_targets.get(&category_id).copied().or(row.get(4)?);
      let percent: f64 = row.get(3)?;
      let amount: f64 = row.get(2)?;
      if amount.abs() <= 0.000_001 && target_percent.is_none() {
        continue;
      }
      out.push(AssetAllocationBreakdown {
        category: row.get(1)?,
        amount,
        percent,
        target_percent,
        deviation_percent: target_percent.map(|target| percent - target),
      });
    }
    return Ok(out);
  }
  let (category_join, category_filter) = if parent_id.is_some() {
    ("sub", "sub.parent_id = ?2")
  } else {
    ("main", "main.level = 'main'")
  };
  let query = format!(
    "
    with rows as (
      select
        {category_join}.id as category_id,
        {category_join}.name as category,
        coalesce(sum(mas.amount_cny), 0) as amount,
        pti.target_percent as target_percent
      from asset_categories {category_join}
      left join assets a on {category_join}.id = {}
      left join monthly_asset_snapshots mas on mas.asset_id = a.id
        and mas.period_month = ?1
        and mas.version_no = 1
        and mas.status = 'held'
      left join portfolio_targets pt on pt.is_active = 1
      left join portfolio_target_items pti on pti.target_id = pt.id and pti.main_asset_category_id = {category_join}.id
      where {category_filter}
        and {category_join}.is_active = 1
      group by {category_join}.id, {category_join}.name, pti.target_percent, {category_join}.sort_order
      order by {category_join}.sort_order
    ),
	    total as (
	      select coalesce(sum(amount), 0) as total_amount from rows
    )
	    select
	      rows.category_id,
	      rows.category,
	      rows.amount,
	      case when total.total_amount > 0 then rows.amount / total.total_amount else 0 end,
	      rows.target_percent
	    from rows cross join total
	    ",
    if parent_id.is_some() {
      "a.sub_asset_category_id"
    } else {
      "a.main_asset_category_id"
    }
  );
  let mut statement = connection.prepare(&query)?;
  let custom_targets = custom_allocation_target_map(
    connection,
    if parent_id.is_some() { "sub" } else { "main" },
    parent_id,
  )?;
  let mut rows = if let Some(parent) = parent_id {
    statement.query(params![period_month, parent])?
  } else {
    statement.query(params![period_month])?
  };
  let mut out = Vec::new();
  while let Some(row) = rows.next()? {
    let category_id: String = row.get(0)?;
    let target_percent: Option<f64> = custom_targets.get(&category_id).copied().or(row.get(4)?);
    let percent: f64 = row.get(3)?;
    let amount: f64 = row.get(2)?;
    if amount.abs() <= 0.000_001 && target_percent.is_none() {
      continue;
    }
    out.push(AssetAllocationBreakdown {
      category: row.get(1)?,
      amount,
      percent,
      target_percent,
      deviation_percent: target_percent.map(|target| percent - target),
    });
  }
  Ok(out)
}

fn custom_allocation_target_map(
  connection: &Connection,
  level: &str,
  parent_id: Option<&str>,
) -> Result<HashMap<String, f64>, AppError> {
  let raw = setting_raw_json(connection, "dashboard_custom_allocation_targets", "[]")?;
  let targets: Vec<OnboardingAllocationTargetInput> = serde_json::from_str(&raw).unwrap_or_default();
  let mut out = HashMap::new();
  for target in targets {
    if target.level != level {
      continue;
    }
    if let Some(parent) = parent_id {
      if target.parent_category_id.as_deref() != Some(parent) {
        continue;
      }
    }
    let Some(category_id) = target.category_id else {
      continue;
    };
    let normalized = if target.target_percent.abs() > 1.0 {
      target.target_percent / 100.0
    } else {
      target.target_percent
    };
    if normalized.is_finite() && normalized >= 0.0 {
      out.insert(category_id, normalized);
    }
  }
  Ok(out)
}

fn allocation_target_groups(
  connection: &Connection,
  period_month: &str,
) -> Result<Vec<AllocationTargetGroup>, AppError> {
  let raw = setting_raw_json(connection, "dashboard_custom_allocation_targets", "[]")?;
  let targets: Vec<OnboardingAllocationTargetInput> = serde_json::from_str(&raw).unwrap_or_default();
  let mut parent_ids: Vec<String> = Vec::new();
  for target in targets.iter().filter(|target| target.level == "sub") {
    let Some(parent_id) = target.parent_category_id.as_ref().filter(|value| !value.trim().is_empty()) else {
      continue;
    };
    if !parent_ids.iter().any(|id| id == parent_id) {
      parent_ids.push(parent_id.clone());
    }
  }

  let mut groups = Vec::new();
  for parent_id in parent_ids {
    let parent_category = connection
      .query_row(
        "select name from asset_categories where id = ?1",
        params![parent_id],
        |row| row.get::<_, String>(0),
      )
      .optional()?
      .unwrap_or_else(|| parent_id.clone());
    let rows = asset_allocation_breakdown(connection, period_month, Some(&parent_id))?;
    if rows.iter().any(|row| row.target_percent.is_some()) {
      groups.push(AllocationTargetGroup {
        parent_category_id: parent_id,
        parent_category,
        rows,
      });
    }
  }
  Ok(groups)
}

fn investment_cashflow_calendar(
  connection: &Connection,
  period_month: &str,
) -> Result<Vec<InvestmentCashflowCalendarItem>, AppError> {
  let mut statement = connection.prepare(
    "
    select ic.flow_date, a.name, ic.flow_type, ic.amount_cny
    from investment_cashflows ic
    join assets a on a.id = ic.asset_id
    where ic.period_month = ?1
    order by ic.flow_date, a.name
    ",
  )?;
  let rows = statement
    .query_map(params![period_month], |row| {
      Ok(InvestmentCashflowCalendarItem {
        flow_date: row.get(0)?,
        asset_name: row.get(1)?,
        flow_type: row.get(2)?,
        amount: row.get(3)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn investment_group_performances(
  connection: &Connection,
  period_month: &str,
) -> Result<Vec<InvestmentGroupPerformance>, AppError> {
  let previous = previous_period_month(period_month);
  let mut statement = connection.prepare(
    "
    with flow_rows as (
      select
        asset_id,
        sum(case when flow_type = 'buy' then amount_cny else 0 end) as buy,
        sum(case when flow_type = 'sell' then amount_cny else 0 end) as sell,
        sum(case when flow_type = 'dividend' then amount_cny else 0 end) as dividend
      from investment_cashflows
      where period_month = ?1
      group by asset_id
    ),
    asset_rows as (
      select
        main.name as group_name,
        coalesce(prev.amount_cny, 0) as beginning_value,
        coalesce(curr.amount_cny, 0) as ending_value,
        coalesce(flow_rows.buy, 0) as buy,
        coalesce(flow_rows.sell, 0) as sell,
        coalesce(flow_rows.dividend, 0) as dividend
      from assets a
      join asset_categories main on main.id = a.main_asset_category_id
      left join monthly_asset_snapshots prev on prev.asset_id = a.id
        and prev.period_month = ?2
        and prev.version_no = 1
        and prev.status = 'held'
      left join monthly_asset_snapshots curr on curr.asset_id = a.id
        and curr.period_month = ?1
        and curr.version_no = 1
        and curr.status = 'held'
      left join flow_rows on flow_rows.asset_id = a.id
      where a.main_asset_category_id <> 'asset_cat_cash'
        and (
          coalesce(prev.amount_cny, 0) <> 0
          or coalesce(curr.amount_cny, 0) <> 0
          or flow_rows.asset_id is not null
        )
    )
    select
      group_name,
      sum(buy),
      sum(sell),
      sum(dividend),
      sum(ending_value - beginning_value - buy + sell + dividend) as gain,
      sum(ending_value),
      sum(beginning_value) as beginning_total,
      sum(beginning_value + buy) as denominator
    from asset_rows
    group by group_name
    order by ending_value desc
    ",
  )?;
  let rows = statement
    .query_map(params![period_month, previous], |row| {
      let gain: f64 = row.get(4)?;
      let beginning_total: f64 = row.get(6)?;
      let denominator: f64 = row.get(7)?;
      Ok(InvestmentGroupPerformance {
        group_name: row.get(0)?,
        buy: row.get(1)?,
        sell: row.get(2)?,
        dividend: row.get(3)?,
        gain,
        ending_value: row.get(5)?,
        return_rate: if beginning_total.abs() > 0.000_001 && denominator.abs() > 0.000_001 {
          Some(gain / denominator)
        } else {
          None
        },
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn asset_allocation_trends(connection: &Connection) -> Result<Vec<AssetAllocationTrend>, AppError> {
  let mut statement = connection.prepare(
    "
    with rows as (
      select
        mas.period_month,
        main.name as category,
        main.sort_order,
        coalesce(sum(mas.amount_cny), 0) as amount
      from monthly_asset_snapshots mas
      join assets a on a.id = mas.asset_id
      join asset_categories main on main.id = a.main_asset_category_id
      where mas.version_no = 1 and mas.status = 'held'
      group by mas.period_month, main.id, main.name, main.sort_order
    ),
    totals as (
      select period_month, coalesce(sum(amount), 0) as total_amount
      from rows
      group by period_month
    )
    select
      rows.period_month,
      rows.category,
      rows.amount,
      case when totals.total_amount > 0 then rows.amount / totals.total_amount else 0 end
    from rows
    join totals on totals.period_month = rows.period_month
    order by rows.period_month, rows.sort_order
    ",
  )?;
  let rows = statement
    .query_map([], |row| {
      Ok(AssetAllocationTrend {
        period_month: row.get(0)?,
        category: row.get(1)?,
        amount: row.get(2)?,
        percent: row.get(3)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn investment_group_trends(connection: &Connection) -> Result<Vec<InvestmentGroupTrend>, AppError> {
  let mut statement = connection.prepare(
    "
    select period_month
    from (
      select period_month from monthly_asset_snapshots
      union
      select period_month from investment_cashflows
    )
    order by period_month
    ",
  )?;
  let months = statement
    .query_map([], |row| row.get::<_, String>(0))?
    .collect::<Result<Vec<_>, _>>()?;
  let mut out = Vec::new();
  for month in months {
    for item in investment_group_performances(connection, &month)? {
      out.push(InvestmentGroupTrend {
        period_month: month.clone(),
        group_name: item.group_name,
        buy: item.buy,
        sell: item.sell,
        dividend: item.dividend,
        gain: item.gain,
        ending_value: item.ending_value,
        return_rate: item.return_rate,
      });
    }
  }
  Ok(out)
}

fn expanded_asset_category_ids(connection: &Connection, selected_ids: &[String]) -> Result<HashSet<String>, AppError> {
  let mut children_by_parent: HashMap<String, Vec<String>> = HashMap::new();
  let mut known_ids: HashSet<String> = HashSet::new();
  let mut statement = connection.prepare(
    "
    select id, parent_id
    from asset_categories
    where is_active = 1
    ",
  )?;
  let rows = statement.query_map([], |row| {
    Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
  })?;
  for row in rows {
    let (id, parent_id) = row?;
    known_ids.insert(id.clone());
    if let Some(parent) = parent_id {
      children_by_parent.entry(parent).or_default().push(id);
    }
  }

  let mut expanded = HashSet::new();
  let mut queue = VecDeque::new();
  for selected_id in selected_ids {
    if known_ids.contains(selected_id) {
      queue.push_back(selected_id.clone());
    }
  }
  while let Some(category_id) = queue.pop_front() {
    if !expanded.insert(category_id.clone()) {
      continue;
    }
    for child_id in children_by_parent.get(&category_id).cloned().unwrap_or_default() {
      queue.push_back(child_id);
    }
  }
  Ok(expanded)
}

fn discretionary_trends(connection: &Connection) -> Result<Vec<DiscretionaryTrend>, AppError> {
  let settings = setting_dashboard_custom_settings(connection)?;
  let selected_ids = if settings.discretionary_category_ids.is_empty() {
    default_dashboard_custom_settings().discretionary_category_ids
  } else {
    settings.discretionary_category_ids
  };
  let expanded_ids = expanded_asset_category_ids(connection, &selected_ids)?;
  if expanded_ids.is_empty() {
    return Ok(Vec::new());
  }

  let main_ids = expanded_ids
    .iter()
    .filter(|id| id.starts_with("asset_cat_"))
    .cloned()
    .collect::<Vec<_>>();
  let sub_ids = expanded_ids
    .iter()
    .filter(|id| id.starts_with("asset_sub_"))
    .cloned()
    .collect::<Vec<_>>();
  if main_ids.is_empty() && sub_ids.is_empty() {
    return Ok(Vec::new());
  }

  let mut filters = Vec::new();
  let mut query_params: Vec<String> = Vec::new();
  if !main_ids.is_empty() {
    filters.push(format!("a.main_asset_category_id in ({})", vec!["?"; main_ids.len()].join(",")));
    query_params.extend(main_ids);
  }
  if !sub_ids.is_empty() {
    filters.push(format!("a.sub_asset_category_id in ({})", vec!["?"; sub_ids.len()].join(",")));
    query_params.extend(sub_ids);
  }

  let sql = format!(
    "
    select
      mas.period_month,
      coalesce(sum(mas.amount_cny), 0)
    from monthly_asset_snapshots mas
    join assets a on a.id = mas.asset_id
    where mas.version_no = 1
      and mas.status = 'held'
      and ({})
    group by mas.period_month
    order by mas.period_month
    ",
    filters.join(" or ")
  );
  let mut statement = connection.prepare(&sql)?;
  let rows = statement
    .query_map(params_from_iter(query_params.iter()), |row| {
      Ok(DiscretionaryTrend {
        period_month: row.get(0)?,
        amount: row.get(1)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

fn investment_asset_performance(
  connection: &Connection,
  period_month: &str,
) -> Result<Vec<InvestmentAssetPerformance>, AppError> {
  let previous = previous_period_month(period_month);
  let mut statement = connection.prepare(
    "
    select
      a.id,
      a.name,
      coalesce(prev.amount_cny, 0) as beginning_value,
      coalesce(curr.amount_cny, 0) as ending_value,
      coalesce(sum(case when ic.flow_type = 'buy' then ic.amount_cny else 0 end), 0) as buy,
      coalesce(sum(case when ic.flow_type = 'sell' then ic.amount_cny else 0 end), 0) as sell,
      coalesce(sum(case when ic.flow_type = 'dividend' then ic.amount_cny else 0 end), 0) as dividend
    from assets a
    left join monthly_asset_snapshots prev on prev.asset_id = a.id
      and prev.period_month = ?2
      and prev.version_no = 1
      and prev.status = 'held'
    left join monthly_asset_snapshots curr on curr.asset_id = a.id
      and curr.period_month = ?1
      and curr.version_no = 1
      and curr.status = 'held'
    left join investment_cashflows ic on ic.asset_id = a.id and ic.period_month = ?1
    where a.main_asset_category_id <> 'asset_cat_cash'
      and (
        coalesce(prev.amount_cny, 0) <> 0
        or coalesce(curr.amount_cny, 0) <> 0
        or ic.id is not null
      )
    group by a.id, a.name, prev.amount_cny, curr.amount_cny
    order by ending_value desc, a.name
    ",
  )?;
  let rows = statement
    .query_map(params![period_month, previous], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, f64>(2)?,
        row.get::<_, f64>(3)?,
        row.get::<_, f64>(4)?,
        row.get::<_, f64>(5)?,
        row.get::<_, f64>(6)?,
      ))
    })?
    .collect::<Result<Vec<_>, _>>()?;

  let month_start = format!("{}-01", period_month);
  let month_end = month_end_date(period_month);
  let mut out = Vec::new();
  for (asset_id, asset_name, beginning_value, ending_value, buy, sell, dividend) in rows {
    let gain = ending_value - beginning_value - buy + sell + dividend;
    let denominator = beginning_value + buy;
    let period_return = if denominator.abs() > 0.000_001 {
      Some(gain / denominator)
    } else {
      None
    };
    let mut flows = Vec::new();
    if beginning_value.abs() > 0.000_001 {
      flows.push((month_start.clone(), -beginning_value));
    }
    let mut flow_statement = connection.prepare(
      "
      select flow_date, flow_type, amount_cny
      from investment_cashflows
      where asset_id = ?1 and period_month = ?2
      order by flow_date
      ",
    )?;
    let asset_flows = flow_statement
      .query_map(params![asset_id, period_month], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
      })?
      .collect::<Result<Vec<_>, _>>()?;
    for (date, flow_type, amount) in asset_flows {
      let signed = match flow_type.as_str() {
        "buy" => -amount,
        "sell" | "dividend" => amount,
        _ => 0.0,
      };
      if signed.abs() > 0.000_001 {
        flows.push((date, signed));
      }
    }
    if ending_value.abs() > 0.000_001 {
      flows.push((month_end.clone(), ending_value));
    }
    let monthly_xirr = xirr(&flows);
    out.push(InvestmentAssetPerformance {
      asset_name,
      beginning_value,
      ending_value,
      buy,
      sell,
      dividend,
      gain,
      period_return,
      monthly_xirr,
    });
  }
  Ok(out)
}

fn previous_period_month(period_month: &str) -> String {
  let mut parts = period_month.split('-');
  let year = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1970);
  let month = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1);
  if month <= 1 {
    format!("{}-12", year - 1)
  } else {
    format!("{}-{:02}", year, month - 1)
  }
}

fn latest_monthly_update_run_before(
  connection: &Connection,
  period_month: &str,
) -> Result<Option<String>, AppError> {
  connection
    .query_row(
      "
      select period_month
      from monthly_update_runs
      where status = 'generated'
        and period_month < ?1
      order by period_month desc
      limit 1
      ",
      params![period_month],
      |row| row.get(0),
    )
    .optional()
    .map_err(AppError::from)
}

fn month_end_date(period_month: &str) -> String {
  let mut parts = period_month.split('-');
  let year = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1970);
  let month = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1);
  let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
  let day = match month {
    2 if leap => 29,
    2 => 28,
    4 | 6 | 9 | 11 => 30,
    _ => 31,
  };
  format!("{}-{:02}-{:02}", year, month, day)
}

fn days_in_month(year: i64, month: i64) -> i64 {
  let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
  match month {
    2 if leap => 29,
    2 => 28,
    4 | 6 | 9 | 11 => 30,
    _ => 31,
  }
}

fn parse_period(period_month: &str) -> (i64, i64) {
  let mut parts = period_month.split('-');
  let year = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1970);
  let month = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1);
  (year, month)
}

fn days_between(start: &str, end: &str) -> f64 {
  fn serial(date: &str) -> i64 {
    let mut parts = date.split('-');
    let year = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1970);
    let month = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1);
    let day = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1);
    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let month_prime = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * month_prime + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
  }
  (serial(end) - serial(start)) as f64
}

fn xirr(cashflows: &[(String, f64)]) -> Option<f64> {
  if cashflows.len() < 2 {
    return None;
  }
  let has_positive = cashflows.iter().any(|(_, amount)| *amount > 0.0);
  let has_negative = cashflows.iter().any(|(_, amount)| *amount < 0.0);
  if !has_positive || !has_negative {
    return None;
  }
  let first_date = cashflows.first()?.0.clone();
  let mut rate = 0.1_f64;
  for _ in 0..80 {
    if rate <= -0.999_999 {
      rate = -0.999;
    }
    let mut value = 0.0_f64;
    let mut derivative = 0.0_f64;
    for (date, amount) in cashflows.iter() {
      let years = days_between(&first_date, date) / 365.0;
      let base = 1.0 + rate;
      value += amount / base.powf(years);
      derivative -= years * amount / base.powf(years + 1.0);
    }
    if value.abs() < 0.000_001 {
      return Some(rate);
    }
    if derivative.abs() < 0.000_001 || !derivative.is_finite() {
      break;
    }
    rate -= value / derivative;
    if !rate.is_finite() {
      return None;
    }
  }
  None
}

fn iso_weekday(year: i64, month: i64, day: i64) -> i64 {
  let (mut y, mut m) = (year, month);
  if m < 3 {
    m += 12;
    y -= 1;
  }
  let k = y % 100;
  let j = y / 100;
  let h = (day + ((13 * (m + 1)) / 5) + k + (k / 4) + (j / 4) + (5 * j)) % 7;
  match h {
    0 => 6,
    1 => 7,
    _ => h - 1,
  }
}

fn date_in_range(date: &str, start_date: &str, end_date: Option<&str>) -> bool {
  date >= start_date && end_date.map(|end| date <= end).unwrap_or(true)
}

fn is_china_public_holiday(date: &str) -> bool {
  matches!(
    date,
    "2026-01-01"
      | "2026-01-02"
      | "2026-01-03"
      | "2026-02-15"
      | "2026-02-16"
      | "2026-02-17"
      | "2026-02-18"
      | "2026-02-19"
      | "2026-02-20"
      | "2026-02-21"
      | "2026-02-22"
      | "2026-02-23"
      | "2026-04-04"
      | "2026-04-05"
      | "2026-04-06"
      | "2026-05-01"
      | "2026-05-02"
      | "2026-05-03"
      | "2026-05-04"
      | "2026-05-05"
      | "2026-06-19"
      | "2026-06-20"
      | "2026-06-21"
      | "2026-09-25"
      | "2026-09-26"
      | "2026-09-27"
      | "2026-10-01"
      | "2026-10-02"
      | "2026-10-03"
      | "2026-10-04"
      | "2026-10-05"
      | "2026-10-06"
      | "2026-10-07"
  )
}

fn build_monthly_step_status(connection: &Connection, period_month: &str) -> Result<MonthlyStepStatus, AppError> {
  let imported_count: i64 = connection.query_row(
    "select count(*) from raw_transactions where substr(transaction_date, 1, 7) = ?1",
    params![period_month],
    |row| row.get(0),
  )?;
  Ok(MonthlyStepStatus {
    import: read_step_status(connection, period_month, "import")? || imported_count > 0,
    expense: read_step_status(connection, period_month, "expense")?,
    income: read_step_status(connection, period_month, "income")?,
    assets: read_step_status(connection, period_month, "assets")?,
    credit_card: read_step_status(connection, period_month, "creditCard")?,
    final_done: read_step_status(connection, period_month, "final")?,
  })
}

fn setting_string(connection: &Connection, key: &str, fallback: &str) -> Result<String, AppError> {
  let value: Result<String, rusqlite::Error> = connection.query_row(
    "select value_json from app_settings where key = ?1",
    params![key],
    |row| row.get(0),
  );

  match value {
    Ok(raw) => Ok(serde_json::from_str::<String>(&raw).unwrap_or_else(|_| fallback.to_string())),
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(fallback.to_string()),
    Err(error) => Err(error.into()),
  }
}

fn setting_raw_json(connection: &Connection, key: &str, fallback: &str) -> Result<String, AppError> {
  let value: Result<String, rusqlite::Error> = connection.query_row(
    "select value_json from app_settings where key = ?1",
    params![key],
    |row| row.get(0),
  );

  match value {
    Ok(raw) => Ok(raw),
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(fallback.to_string()),
    Err(error) => Err(error.into()),
  }
}

fn setting_number(connection: &Connection, key: &str, fallback: f64) -> Result<f64, AppError> {
  let value: Result<String, rusqlite::Error> = connection.query_row(
    "select value_json from app_settings where key = ?1",
    params![key],
    |row| row.get(0),
  );

  match value {
    Ok(raw) => Ok(serde_json::from_str::<f64>(&raw).unwrap_or(fallback)),
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(fallback),
    Err(error) => Err(error.into()),
  }
}

fn setting_bool(connection: &Connection, key: &str, fallback: bool) -> Result<bool, AppError> {
  let value: Result<String, rusqlite::Error> = connection.query_row(
    "select value_json from app_settings where key = ?1",
    params![key],
    |row| row.get(0),
  );

  match value {
    Ok(raw) => Ok(serde_json::from_str::<bool>(&raw).unwrap_or(fallback)),
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(fallback),
    Err(error) => Err(error.into()),
  }
}

fn upsert_setting(connection: &Connection, key: &str, value_json: &str) -> Result<(), AppError> {
  connection.execute(
    "
    insert into app_settings (key, value_json, updated_at)
    values (?1, ?2, current_timestamp)
    on conflict(key) do update set
      value_json = excluded.value_json,
      updated_at = current_timestamp
    ",
    params![key, value_json],
  )?;
  Ok(())
}

fn upsert_setting_tx(tx: &Transaction<'_>, key: &str, value_json: &str) -> Result<(), AppError> {
  tx.execute(
    "
    insert into app_settings (key, value_json, updated_at)
    values (?1, ?2, current_timestamp)
    on conflict(key) do update set
      value_json = excluded.value_json,
      updated_at = current_timestamp
    ",
    params![key, value_json],
  )?;
  Ok(())
}

fn default_dashboard_sections() -> Vec<String> {
  vec![
    "总览".to_string(),
    "收支储蓄".to_string(),
    "支出结构".to_string(),
    "资产配置".to_string(),
    "投资表现".to_string(),
    "月报".to_string(),
  ]
}

fn default_dashboard_items() -> Vec<String> {
  vec![
    "cashflow_range_saving".to_string(),
    "cashflow_month_saving".to_string(),
    "cashflow_target_rate".to_string(),
    "cashflow_target_amount".to_string(),
    "cashflow_gap_chart".to_string(),
    "saving_goal_chart".to_string(),
    "expense_category_count".to_string(),
    "expense_largest_category".to_string(),
    "expense_category_share_chart".to_string(),
    "expense_category_delta_chart".to_string(),
    "expense_category_detail".to_string(),
    "expense_range_rank".to_string(),
    "expense_large_anomaly".to_string(),
    "allocation_trend_chart".to_string(),
    "allocation_current_chart".to_string(),
    "investment_cashflow_amounts".to_string(),
    "investment_weighted_return".to_string(),
    "investment_non_cash_group_count".to_string(),
    "investment_asset_return_chart".to_string(),
    "investment_group_perspective_chart".to_string(),
    "investment_return_xirr_chart".to_string(),
    "investment_group_return_table".to_string(),
    "report_template_picker".to_string(),
    "report_content_preview".to_string(),
    "report_export_actions".to_string(),
  ]
}

fn default_dashboard_custom_settings() -> DashboardCustomSettings {
  DashboardCustomSettings {
    discretionary_category_ids: vec!["asset_cat_cash".to_string(), "asset_cat_bond".to_string()],
    allocation_detail_parent_id: default_allocation_detail_parent_id(),
    allocation_detail_depth: default_allocation_detail_depth(),
    custom_item_sections: default_custom_item_sections(),
  }
}

fn default_allocation_detail_parent_id() -> String {
  "asset_cat_us_equity".to_string()
}

fn default_allocation_detail_depth() -> String {
  "second".to_string()
}

fn default_custom_item_sections() -> HashMap<String, String> {
  [
    ("allocation_discretionary_amount", "资产配置"),
    ("allocation_target_deviation_value", "资产配置"),
    ("allocation_sub_detail_ratio", "资产配置"),
    ("allocation_sub_target_gap_chart", "资产配置"),
  ]
  .into_iter()
  .map(|(key, value)| (key.to_string(), value.to_string()))
  .collect()
}

fn setting_dashboard_custom_settings(connection: &Connection) -> Result<DashboardCustomSettings, AppError> {
  let default_json = serde_json::to_string(&default_dashboard_custom_settings()).unwrap_or_else(|_| "{}".to_string());
  let raw = setting_raw_json(connection, "dashboard_custom_settings", &default_json)?;
  let mut settings = serde_json::from_str::<DashboardCustomSettings>(&raw).unwrap_or_else(|_| default_dashboard_custom_settings());
  for (key, value) in default_custom_item_sections() {
    settings.custom_item_sections.entry(key).or_insert(value);
  }
  Ok(settings)
}

fn default_asset_category_tree() -> Vec<OnboardingAssetCategoryInput> {
  vec![
    OnboardingAssetCategoryInput {
      id: "asset_cat_cash".to_string(),
      label: "现金".to_string(),
      children: vec![
        OnboardingAssetCategoryInput { id: "asset_sub_bank_payment".to_string(), label: "银行/支付账户".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_money_market_cash".to_string(), label: "货币现金".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_receivable".to_string(), label: "应收押金".to_string(), children: vec![] },
      ],
    },
    OnboardingAssetCategoryInput {
      id: "asset_cat_us_equity".to_string(),
      label: "全球资产".to_string(),
      children: vec![
        OnboardingAssetCategoryInput {
          id: "asset_sub_us_market".to_string(),
          label: "美股".to_string(),
          children: vec![
            OnboardingAssetCategoryInput { id: "asset_sub_sp500".to_string(), label: "标普".to_string(), children: vec![] },
            OnboardingAssetCategoryInput { id: "asset_sub_nasdaq".to_string(), label: "纳斯达克".to_string(), children: vec![] },
          ],
        },
        OnboardingAssetCategoryInput { id: "asset_sub_hk_market".to_string(), label: "港股".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_emerging_market".to_string(), label: "新兴市场".to_string(), children: vec![] },
      ],
    },
    OnboardingAssetCategoryInput {
      id: "asset_cat_dividend_low_vol".to_string(),
      label: "红利低波".to_string(),
      children: vec![
        OnboardingAssetCategoryInput { id: "asset_sub_dividend".to_string(), label: "红利".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_low_vol".to_string(), label: "低波".to_string(), children: vec![] },
      ],
    },
    OnboardingAssetCategoryInput {
      id: "asset_cat_bond".to_string(),
      label: "债券".to_string(),
      children: vec![
        OnboardingAssetCategoryInput { id: "asset_sub_short_bond".to_string(), label: "短债".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_pure_bond".to_string(), label: "纯债".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_treasury_bond".to_string(), label: "国债".to_string(), children: vec![] },
      ],
    },
    OnboardingAssetCategoryInput {
      id: "asset_cat_gold".to_string(),
      label: "黄金".to_string(),
      children: vec![
        OnboardingAssetCategoryInput { id: "asset_sub_gold_etf".to_string(), label: "黄金ETF".to_string(), children: vec![] },
      ],
    },
    OnboardingAssetCategoryInput {
      id: "asset_cat_a_share".to_string(),
      label: "A股权益".to_string(),
      children: vec![
        OnboardingAssetCategoryInput { id: "asset_sub_a_share_broad".to_string(), label: "宽基".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_a_share_sector_active".to_string(), label: "行业/主动".to_string(), children: vec![] },
      ],
    },
    OnboardingAssetCategoryInput {
      id: "asset_cat_other".to_string(),
      label: "其他".to_string(),
      children: vec![
        OnboardingAssetCategoryInput { id: "asset_sub_insurance_pension".to_string(), label: "保险/养老金".to_string(), children: vec![] },
        OnboardingAssetCategoryInput { id: "asset_sub_uncategorized".to_string(), label: "未分类".to_string(), children: vec![] },
      ],
    },
  ]
}

fn normalize_asset_category_tree_labels(mut tree: Vec<OnboardingAssetCategoryInput>) -> Vec<OnboardingAssetCategoryInput> {
  fn normalize_node(node: &mut OnboardingAssetCategoryInput) {
    node.label = match node.id.as_str() {
      "asset_cat_us_equity" => "全球资产".to_string(),
      "asset_sub_us_market" => "美股".to_string(),
      "asset_sub_sp500" => "标普".to_string(),
      "asset_sub_nasdaq" => "纳斯达克".to_string(),
      "asset_sub_hk_market" => "港股".to_string(),
      "asset_sub_emerging_market" => "新兴市场".to_string(),
      "asset_sub_us_tech" => "科技".to_string(),
      _ => node.label.clone(),
    };
    for child in node.children.iter_mut() {
      normalize_node(child);
    }
  }
  fn has_custom_node(nodes: &[OnboardingAssetCategoryInput]) -> bool {
    nodes.iter().any(|node| node.id.contains("_custom_") || has_custom_node(&node.children))
  }

  for node in tree.iter_mut() {
    normalize_node(node);
  }
  let should_upgrade_global = !has_custom_node(&tree)
    && tree.iter().any(|node| {
      node.id == "asset_cat_us_equity"
        && !node.children.iter().any(|child| child.id == "asset_sub_us_market")
        && node.children.iter().any(|child| child.id == "asset_sub_sp500")
        && node.children.iter().any(|child| child.id == "asset_sub_nasdaq")
    });
  if should_upgrade_global {
    if let Some(default_global) = default_asset_category_tree()
      .into_iter()
      .find(|node| node.id == "asset_cat_us_equity")
    {
      if let Some(global) = tree.iter_mut().find(|node| node.id == "asset_cat_us_equity") {
        global.label = default_global.label;
        global.children = default_global.children;
      }
    }
  }
  tree
}

fn setting_string_array(connection: &Connection, key: &str, fallback: Vec<String>) -> Result<Vec<String>, AppError> {
  let value: Result<String, rusqlite::Error> = connection.query_row(
    "select value_json from app_settings where key = ?1",
    params![key],
    |row| row.get(0),
  );

  match value {
    Ok(raw) => Ok(serde_json::from_str::<Vec<String>>(&raw).unwrap_or(fallback)),
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(fallback),
    Err(error) => Err(error.into()),
  }
}

fn setting_asset_category_tree(connection: &Connection) -> Result<Vec<OnboardingAssetCategoryInput>, AppError> {
  let value: Result<String, rusqlite::Error> = connection.query_row(
    "select value_json from app_settings where key = 'asset_category_tree'",
    [],
    |row| row.get(0),
  );

  match value {
    Ok(raw) => Ok(normalize_asset_category_tree_labels(
      serde_json::from_str::<Vec<OnboardingAssetCategoryInput>>(&raw).unwrap_or_else(|_| default_asset_category_tree()),
    )),
    Err(rusqlite::Error::QueryReturnedNoRows) => Ok(default_asset_category_tree()),
    Err(error) => Err(error.into()),
  }
}

fn sync_asset_category_tree(tx: &Transaction<'_>, tree: &[OnboardingAssetCategoryInput]) -> Result<(), AppError> {
  tx.execute("update asset_categories set is_active = 0", [])?;
  let mut sort_order = 10_i64;

  fn upsert_node(
    tx: &Transaction<'_>,
    node: &OnboardingAssetCategoryInput,
    nearest_main_id: Option<String>,
    sort_order: &mut i64,
  ) -> Result<(), AppError> {
    let trimmed_label = node.label.trim();
    if trimmed_label.is_empty() {
      return Err(AppError::InvalidCsvValue("资产分类名称不能为空".to_string()));
    }

    let mut next_main_id = nearest_main_id.clone();
    if node.id == "cash" {
      tx.execute(
        "
        insert into asset_categories (id, name, parent_id, level, is_active, sort_order)
        values ('asset_cat_cash', ?1, null, 'main', 1, ?2)
        on conflict(id) do update set name = excluded.name, parent_id = null, level = 'main', is_active = 1, sort_order = excluded.sort_order
        ",
        params![trimmed_label, *sort_order],
      )?;
      *sort_order += 10;
      next_main_id = Some("asset_cat_cash".to_string());
    } else if node.id == "gold" {
      tx.execute(
        "
        insert into asset_categories (id, name, parent_id, level, is_active, sort_order)
        values ('asset_cat_gold', ?1, null, 'main', 1, ?2)
        on conflict(id) do update set name = excluded.name, parent_id = null, level = 'main', is_active = 1, sort_order = excluded.sort_order
        ",
        params![trimmed_label, *sort_order],
      )?;
      *sort_order += 10;
      next_main_id = Some("asset_cat_gold".to_string());
    } else if node.id.starts_with("asset_cat_") {
      tx.execute(
        "
        insert into asset_categories (id, name, parent_id, level, is_active, sort_order)
        values (?1, ?2, null, 'main', 1, ?3)
        on conflict(id) do update set name = excluded.name, parent_id = null, level = 'main', is_active = 1, sort_order = excluded.sort_order
        ",
        params![node.id, trimmed_label, *sort_order],
      )?;
      *sort_order += 10;
      next_main_id = Some(node.id.clone());
    } else if node.id.starts_with("asset_sub_") {
      let parent_id = nearest_main_id.clone().unwrap_or_else(|| "asset_cat_us_equity".to_string());
      tx.execute(
        "
        insert into asset_categories (id, name, parent_id, level, is_active, sort_order)
        values (?1, ?2, ?3, 'sub', 1, ?4)
        on conflict(id) do update set name = excluded.name, parent_id = excluded.parent_id, level = 'sub', is_active = 1, sort_order = excluded.sort_order
        ",
        params![node.id, trimmed_label, parent_id, *sort_order],
      )?;
      *sort_order += 10;
      next_main_id = Some(node.id.clone());
    }

    for child in &node.children {
      upsert_node(tx, child, next_main_id.clone(), sort_order)?;
    }
    Ok(())
  }

  for node in tree {
    upsert_node(tx, node, None, &mut sort_order)?;
  }
  Ok(())
}

fn read_onboarding_status(connection: &Connection) -> Result<OnboardingStatus, AppError> {
  let target_saving_rate = setting_number(connection, "target_saving_rate", 0.3)?;
  let dashboard_enabled_sections = setting_string_array(
    connection,
    "dashboard_enabled_sections",
    default_dashboard_sections(),
  )?;
  let dashboard_enabled_items = setting_string_array(
    connection,
    "dashboard_enabled_items",
    default_dashboard_items(),
  )?;
  let dashboard_custom_settings = setting_dashboard_custom_settings(connection)?;
  let custom_analysis_prompts = setting_string_array(
    connection,
    "dashboard_custom_analysis_prompts",
    Vec::new(),
  )?;
  let allocation_targets = setting_raw_json(connection, "dashboard_custom_allocation_targets", "[]")?;
  let mut allocation_targets: Vec<OnboardingAllocationTargetInput> =
    serde_json::from_str(&allocation_targets).unwrap_or_default();
  if allocation_targets.is_empty() {
    let mut statement = connection.prepare(
      "
      select
        pti.main_asset_category_id,
        coalesce(ac.name, pti.main_asset_category_id) as category_name,
        pti.target_percent
      from portfolio_target_items pti
      join portfolio_targets pt on pt.id = pti.target_id
      left join asset_categories ac on ac.id = pti.main_asset_category_id
      where pt.is_active = 1
      order by coalesce(ac.sort_order, 999999), ac.name, pti.main_asset_category_id
      ",
    )?;
    let rows = statement.query_map([], |row| {
      let category_id: String = row.get(0)?;
      let label: String = row.get(1)?;
      let target_percent: f64 = row.get(2)?;
      Ok(OnboardingAllocationTargetInput {
        level: "main".to_string(),
        parent_category_id: None,
        category_id: Some(category_id),
        asset_id: None,
        label,
        target_percent,
      })
    })?;
    allocation_targets = rows.collect::<Result<Vec<_>, _>>()?;
  }
  let allocation_targets: Vec<OnboardingAllocationTargetInput> = allocation_targets
    .into_iter()
    .map(|target| OnboardingAllocationTargetInput {
      target_percent: target.target_percent * 100.0,
      ..target
    })
    .collect();
  let asset_category_tree = setting_asset_category_tree(connection)?;
  let asset_count: i64 = connection.query_row(
    "
    select count(*)
    from assets
    where status = 'active'
      and coalesce(monthly_update_managed, 0) = 1
    ",
    [],
    |row| row.get(0),
  )?;
  let portfolio_target_count: i64 = connection.query_row(
    "
    select count(*)
    from portfolio_target_items pti
    join portfolio_targets pt on pt.id = pti.target_id
    where pt.is_active = 1
    ",
    [],
    |row| row.get(0),
  )?;
  let business_count: i64 = connection.query_row(
    "
    select
      (select count(*) from monthly_closes) +
      (select count(*) from monthly_update_runs) +
      (select count(*) from confirmed_transactions) +
      (select count(*) from monthly_asset_snapshots) +
      (select count(*) from investment_cashflows) +
      (select count(*) from monthly_credit_card_entries) +
      (select count(*) from assets where coalesce(monthly_update_managed, 0) = 1)
    ",
    [],
    |row| row.get(0),
  )?;
	  let completed = setting_bool(connection, "onboarding_completed", false)? || business_count > 0;
  let skip_allocation_targets =
    setting_bool(connection, "onboarding_allocation_targets_skipped", allocation_targets.is_empty())? && allocation_targets.is_empty();

	  Ok(OnboardingStatus {
	    completed,
	    target_saving_rate,
	    dashboard_enabled_sections,
	    dashboard_enabled_items,
	    dashboard_custom_settings,
	    custom_analysis_prompts,
	    allocation_targets,
	    skip_allocation_targets,
	    asset_category_tree,
	    asset_count,
	    portfolio_target_count,
  })
}

fn save_onboarding_to_connection(connection: &mut Connection, input: &OnboardingInput) -> Result<(), AppError> {
  if !input.target_saving_rate.is_finite() || input.target_saving_rate < 0.0 || input.target_saving_rate > 1.0 {
    return Err(AppError::InvalidCsvValue("期望储蓄率需要在 0% 到 100% 之间".to_string()));
  }

  let tx = connection.transaction()?;
  upsert_setting_tx(&tx, "target_saving_rate", &serde_json::to_string(&input.target_saving_rate).unwrap())?;
  upsert_setting_tx(&tx, "onboarding_completed", "true")?;
  upsert_setting_tx(&tx, "onboarding_asset_entry_skipped", if input.skip_asset_entry { "true" } else { "false" })?;
  upsert_setting_tx(&tx, "onboarding_allocation_targets_skipped", if input.skip_allocation_targets { "true" } else { "false" })?;
  upsert_setting_tx(
    &tx,
    "dashboard_enabled_sections",
    &serde_json::to_string(&input.dashboard_sections).unwrap_or_else(|_| "[]".to_string()),
  )?;
  upsert_setting_tx(
    &tx,
    "dashboard_enabled_items",
    &serde_json::to_string(&input.dashboard_items).unwrap_or_else(|_| "[]".to_string()),
  )?;
  upsert_setting_tx(
    &tx,
    "dashboard_custom_settings",
    &serde_json::to_string(&input.dashboard_custom_settings).unwrap_or_else(|_| "{}".to_string()),
  )?;
  upsert_setting_tx(
    &tx,
    "dashboard_custom_analysis_prompts",
    &serde_json::to_string(&input.custom_analysis_prompts).unwrap_or_else(|_| "[]".to_string()),
  )?;
  upsert_setting_tx(
    &tx,
    "dashboard_custom_allocation_targets",
    &serde_json::to_string(&input.allocation_targets).unwrap_or_else(|_| "[]".to_string()),
  )?;
  let category_tree = if input.asset_category_tree.is_empty() {
    default_asset_category_tree()
  } else {
    input.asset_category_tree.clone()
  };
  upsert_setting_tx(
    &tx,
    "asset_category_tree",
    &serde_json::to_string(&category_tree).unwrap_or_else(|_| "[]".to_string()),
  )?;
  sync_asset_category_tree(&tx, &category_tree)?;
  let onboarding_snapshot_date: String = tx.query_row(
    "select date('now', 'localtime')",
    [],
    |row| row.get(0),
  )?;
  let onboarding_period_month = onboarding_snapshot_date
    .get(0..7)
    .unwrap_or(onboarding_snapshot_date.as_str())
    .to_string();
  let has_initial_asset_amount = input.assets.iter().any(|asset| {
    asset.month_end_amount.is_finite() && asset.month_end_amount > 0.0
  });
  if has_initial_asset_amount {
    upsert_setting_tx(
      &tx,
      "official_start_date",
      &serde_json::to_string(&onboarding_snapshot_date).unwrap_or_else(|_| "\"\"".to_string()),
    )?;
  }

  for asset in input.assets.iter().filter(|asset| !asset.name.trim().is_empty()) {
    if asset.is_dca && asset.dca_plans.is_empty() {
      return Err(AppError::InvalidCsvValue(format!("{} 已选择定投，但没有定投计划", asset.name)));
    }
    let normalized_platform = asset.platform.clone().unwrap_or_default();
    let existing_asset_id: Option<String> = tx
      .query_row(
        "
        select id
        from assets
        where name = ?1
          and coalesce(platform, '') = ?2
        order by created_at
        limit 1
        ",
        params![asset.name.trim(), normalized_platform],
        |row| row.get(0),
      )
      .optional()?;
    let asset_id = existing_asset_id.unwrap_or_else(|| {
      make_id(
        "asset",
        &format!(
          "onboarding|{}|{}|{:?}",
          asset.name.trim(),
          asset.platform.clone().unwrap_or_default(),
          SystemTime::now()
        ),
      )
    });
    tx.execute(
      "
      insert into assets (
        id, name, asset_type, main_asset_category_id, sub_asset_category_id,
        currency, platform, is_dca, status, note, monthly_update_managed
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active', ?9, 1)
      on conflict(id) do update set
        name = excluded.name,
        asset_type = excluded.asset_type,
        main_asset_category_id = excluded.main_asset_category_id,
        sub_asset_category_id = excluded.sub_asset_category_id,
        currency = excluded.currency,
        platform = excluded.platform,
        is_dca = excluded.is_dca,
        status = 'active',
        note = excluded.note,
        monthly_update_managed = 1,
        updated_at = current_timestamp
      ",
      params![
        asset_id,
        asset.name.trim(),
        asset.asset_type,
        asset.main_asset_category_id,
        asset.sub_asset_category_id,
        asset.currency,
        asset.platform,
        if asset.is_dca { 1 } else { 0 },
        asset.note
      ],
    )?;

    if asset.month_end_amount.is_finite() && asset.month_end_amount > 0.0 {
      let snapshot_id = make_id(
        "asset_snapshot",
        &format!("{}|{}|onboarding", asset_id, onboarding_period_month),
      );
      tx.execute(
        "
        insert into monthly_asset_snapshots (
          id, asset_id, period_month, snapshot_date, original_amount,
          currency, fx_rate_to_cny, amount_cny, status, version_no, note
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, 1, ?5, 'held', 1, '初始化资产快照')
        on conflict(asset_id, period_month, version_no) do update set
          snapshot_date = excluded.snapshot_date,
          original_amount = excluded.original_amount,
          currency = excluded.currency,
          fx_rate_to_cny = excluded.fx_rate_to_cny,
          amount_cny = excluded.amount_cny,
          status = excluded.status,
          note = excluded.note,
          updated_at = current_timestamp
        ",
        params![
          snapshot_id,
          asset_id,
          onboarding_period_month,
          onboarding_snapshot_date,
          asset.month_end_amount,
          asset.currency
        ],
      )?;
    }

    tx.execute("delete from asset_tag_links where asset_id = ?1", params![asset_id])?;
    for tag_name in asset.tags.iter().filter(|name| !name.trim().is_empty()) {
      let tag_id = make_id("tag", tag_name.trim());
      tx.execute(
        "
        insert into tags (id, name, group_name, is_system)
        values (?1, ?2, '自定义', 0)
        on conflict(name) do nothing
        ",
        params![tag_id, tag_name.trim()],
      )?;
      let actual_tag_id: String = tx.query_row(
        "select id from tags where name = ?1",
        params![tag_name.trim()],
        |row| row.get(0),
      )?;
      tx.execute(
        "insert or ignore into asset_tag_links (asset_id, tag_id) values (?1, ?2)",
        params![asset_id, actual_tag_id],
      )?;
    }

    tx.execute(
      "update dca_plans set is_active = 0, updated_at = current_timestamp where asset_id = ?1",
      params![asset_id],
    )?;
    if asset.is_dca {
      for (index, plan) in asset.dca_plans.iter().enumerate() {
        if plan.amount <= 0.0 {
          continue;
        }
        let plan_id = make_id("dca", &format!("{}|onboarding|{}|{}|{}", asset_id, index, plan.frequency, plan.start_date));
        tx.execute(
          "
          insert into dca_plans (
            id, asset_id, name, frequency, amount, currency, start_date, end_date,
            weekly_rules_json, monthly_day, is_active
          )
          values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1)
          on conflict(id) do update set
            frequency = excluded.frequency,
            amount = excluded.amount,
            currency = excluded.currency,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            weekly_rules_json = excluded.weekly_rules_json,
            monthly_day = excluded.monthly_day,
            is_active = 1,
            updated_at = current_timestamp
          ",
          params![
            plan_id,
            asset_id,
            format!("{} 定投 {}", asset.name.trim(), index + 1),
            plan.frequency,
            plan.amount,
            asset.currency,
            plan.start_date,
            plan.end_date,
            plan.weekly_rules_json,
            plan.monthly_day
          ],
        )?;
      }
    }
  }

  tx.execute("update portfolio_targets set is_active = 0, updated_at = current_timestamp", [])?;
  if !input.skip_allocation_targets && !input.allocation_targets.is_empty() {
    let target_id = make_unique_id("target", "onboarding");
    tx.execute(
      "
      insert into portfolio_targets (id, version_name, effective_from, is_active, note)
      values (?1, '初始化目标配比', date('now'), 1, '用户初始化设置')
      ",
      params![target_id],
    )?;
    for target in input.allocation_targets.iter().filter(|target| target.level == "main") {
      let Some(category_id) = target.category_id.as_ref().filter(|value| !value.trim().is_empty()) else {
        continue;
      };
      if !target.target_percent.is_finite() || target.target_percent < 0.0 || target.target_percent > 1.0 {
        return Err(AppError::InvalidCsvValue(format!("{} 的目标比例需要在 0% 到 100% 之间", target.label)));
      }
      let item_id = make_id("target_item", &format!("{}|{}", target_id, category_id));
      tx.execute(
        "
        insert into portfolio_target_items (
          id, target_id, main_asset_category_id, target_percent, risk_level
        )
        values (?1, ?2, ?3, ?4, null)
        ",
        params![item_id, target_id, category_id, target.target_percent],
      )?;
    }
  }

  tx.commit()?;
  Ok(())
}

fn table_exists_tx(tx: &Transaction<'_>, table_name: &str) -> Result<bool, AppError> {
  let count: i64 = tx.query_row(
    "select count(*) from sqlite_master where type = 'table' and name = ?1",
    params![table_name],
    |row| row.get(0),
  )?;
  Ok(count > 0)
}

fn reset_demo_onboarding_connection(connection: &mut Connection) -> Result<(), AppError> {
  connection.execute_batch("pragma foreign_keys = off;")?;
  let result = (|| -> Result<(), AppError> {
    let tx = connection.transaction()?;
    for table in [
      "raw_transactions",
      "import_batches",
      "confirmed_transactions",
      "asset_tag_links",
      "dca_plans",
      "investment_cashflows",
      "monthly_asset_snapshots",
      "credit_card_adjustments",
      "exchange_rates",
      "portfolio_target_items",
      "portfolio_targets",
      "monthly_closes",
      "monthly_report_versions",
      "audit_logs",
      "monthly_step_status",
      "credit_cards",
      "monthly_credit_card_entries",
      "monthly_dca_cashflow_overrides",
      "monthly_update_runs",
      "fx_rate_cache",
      "fx_rate_overrides",
      "monthly_fx_rate_locks",
      "template_render_logs",
      "assets",
    ] {
      if table_exists_tx(&tx, table)? {
        tx.execute(&format!("delete from {table}"), [])?;
      }
    }
    if table_exists_tx(&tx, "asset_categories")? {
      tx.execute("delete from asset_categories", [])?;
      sync_asset_category_tree(&tx, &default_asset_category_tree())?;
    }
    upsert_setting_tx(&tx, "official_start_date", "\"2026-04-30\"")?;
    upsert_setting_tx(&tx, "base_currency", "\"CNY\"")?;
    upsert_setting_tx(&tx, "target_saving_rate", "0.3")?;
    upsert_setting_tx(&tx, "onboarding_completed", "false")?;
    upsert_setting_tx(&tx, "onboarding_asset_entry_skipped", "false")?;
    upsert_setting_tx(&tx, "onboarding_allocation_targets_skipped", "false")?;
    upsert_setting_tx(
      &tx,
      "dashboard_enabled_sections",
      &serde_json::to_string(&default_dashboard_sections()).unwrap_or_else(|_| "[]".to_string()),
    )?;
    upsert_setting_tx(
      &tx,
      "dashboard_enabled_items",
      &serde_json::to_string(&default_dashboard_items()).unwrap_or_else(|_| "[]".to_string()),
    )?;
    upsert_setting_tx(
      &tx,
      "dashboard_custom_settings",
      &serde_json::to_string(&default_dashboard_custom_settings()).unwrap_or_else(|_| "{}".to_string()),
    )?;
    upsert_setting_tx(&tx, "dashboard_custom_analysis_prompts", "[]")?;
    upsert_setting_tx(&tx, "dashboard_custom_allocation_targets", "[]")?;
    upsert_setting_tx(
      &tx,
      "asset_category_tree",
      &serde_json::to_string(&default_asset_category_tree()).unwrap_or_else(|_| "[]".to_string()),
    )?;
    tx.commit()?;
    Ok(())
  })();
  connection.execute_batch("pragma foreign_keys = on;")?;
  result
}

fn reset_account_connection(connection: &mut Connection) -> Result<(), AppError> {
  connection.execute_batch("pragma foreign_keys = off;")?;
  let result = (|| -> Result<(), AppError> {
    let tx = connection.transaction()?;
    for table in [
      "raw_transactions",
      "import_batches",
      "confirmed_transactions",
      "category_mappings",
      "categories",
      "asset_tag_links",
      "dca_plans",
      "investment_cashflows",
      "monthly_asset_snapshots",
      "credit_card_adjustments",
      "exchange_rates",
      "portfolio_target_items",
      "portfolio_targets",
      "monthly_closes",
      "monthly_report_versions",
      "audit_logs",
      "monthly_step_status",
      "credit_cards",
      "monthly_credit_card_entries",
      "monthly_dca_cashflow_overrides",
      "monthly_update_runs",
      "fx_rate_cache",
      "fx_rate_overrides",
      "monthly_fx_rate_locks",
      "template_render_logs",
      "assets",
      "asset_categories",
      "tags",
      "content_templates",
      "app_settings",
    ] {
      if table_exists_tx(&tx, table)? {
        tx.execute(&format!("delete from {table}"), [])?;
      }
    }
    tx.execute_batch(INITIAL_SEED)?;
    sync_asset_category_tree(&tx, &default_asset_category_tree())?;
    upsert_setting_tx(&tx, "onboarding_completed", "false")?;
    upsert_setting_tx(&tx, "onboarding_asset_entry_skipped", "false")?;
    upsert_setting_tx(&tx, "onboarding_allocation_targets_skipped", "false")?;
    upsert_setting_tx(
      &tx,
      "dashboard_enabled_sections",
      &serde_json::to_string(&default_dashboard_sections()).unwrap_or_else(|_| "[]".to_string()),
    )?;
    upsert_setting_tx(
      &tx,
      "dashboard_enabled_items",
      &serde_json::to_string(&default_dashboard_items()).unwrap_or_else(|_| "[]".to_string()),
    )?;
    upsert_setting_tx(
      &tx,
      "dashboard_custom_settings",
      &serde_json::to_string(&default_dashboard_custom_settings()).unwrap_or_else(|_| "{}".to_string()),
    )?;
    upsert_setting_tx(&tx, "dashboard_custom_analysis_prompts", "[]")?;
    upsert_setting_tx(&tx, "dashboard_custom_allocation_targets", "[]")?;
    upsert_setting_tx(
      &tx,
      "asset_category_tree",
      &serde_json::to_string(&default_asset_category_tree()).unwrap_or_else(|_| "[]".to_string()),
    )?;
    tx.commit()?;
    seed_default_content_templates(connection)?;
    normalize_builtin_asset_category_labels(connection)?;
    Ok(())
  })();
  connection.execute_batch("pragma foreign_keys = on;")?;
  result
}

fn password_hash_exists(connection: &Connection) -> Result<bool, AppError> {
  let count: i64 = connection.query_row(
    "select count(*) from app_settings where key = 'security_password_hash'",
    [],
    |row| row.get(0),
  )?;
  Ok(count > 0)
}

fn generate_salt() -> String {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_nanos())
    .unwrap_or_default();
  format!("{:x}{:x}", nanos, std::process::id())
}

fn hash_password(password: &str, salt: &str) -> String {
  let mut digest = Sha256::digest(format!("{salt}:{password}").as_bytes()).to_vec();
  for _ in 0..120_000 {
    let mut hasher = Sha256::new();
    hasher.update(&digest);
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    digest = hasher.finalize().to_vec();
  }
  hex::encode(digest)
}

fn verify_password(connection: &Connection, password: &str) -> Result<bool, AppError> {
  let salt = setting_string(connection, "security_password_salt", "")?;
  let expected_hash = setting_string(connection, "security_password_hash", "")?;
  Ok(!expected_hash.is_empty() && hash_password(password, &salt) == expected_hash)
}

fn read_security_status(
  connection: &Connection,
  security: &SecuritySession,
) -> Result<SecurityStatus, AppError> {
  let password_set = password_hash_exists(connection)?;
  let unlocked = if password_set {
    *security.unlocked.lock().expect("security mutex poisoned")
  } else {
    true
  };
  let privacy_mode = setting_bool(connection, "security_privacy_mode", false)?;

  Ok(SecurityStatus {
    password_set,
    unlocked,
    privacy_mode,
    environment_label: env::var("FINANCIAL_PLANNING_ENV_LABEL").ok(),
  })
}

fn ensure_unlocked(connection: &Connection, security: &SecuritySession) -> Result<(), AppError> {
  if !password_hash_exists(connection)? {
    return Ok(());
  }

  if *security.unlocked.lock().expect("security mutex poisoned") {
    Ok(())
  } else {
    Err(AppError::Locked)
  }
}

fn template_type_label(template_type: &str) -> &'static str {
  match template_type {
    "monthly_report" => "月报模板",
    "cashflow_analysis" => "收支分析模板",
    "expense_structure_analysis" => "支出结构分析模板",
    "income_structure_analysis" => "收入结构分析模板",
    "asset_allocation_analysis" => "资产配置分析模板",
    "investment_performance_analysis" => "投资表现分析模板",
    "next_month_reminder" => "下月提醒模板",
    _ => "内容模板",
  }
}

fn escape_html(value: &str) -> String {
  value
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
    .replace('\'', "&#39;")
}

fn strip_html(value: &str) -> String {
  let mut out = String::new();
  let mut in_tag = false;
  for ch in value.chars() {
    match ch {
      '<' => in_tag = true,
      '>' => {
        in_tag = false;
        out.push(' ');
      }
      _ if !in_tag => out.push(ch),
      _ => {}
    }
  }
  out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn format_template_money(value: f64, privacy_mode: bool) -> String {
  if privacy_mode {
    return "****".to_string();
  }
  let sign = if value < 0.0 { "-" } else { "" };
  let amount = value.abs();
  let raw = format!("{amount:.2}");
  let mut parts = raw.split('.');
  let integer = parts.next().unwrap_or("0");
  let fraction = parts.next().unwrap_or("00");
  let mut grouped = String::new();
  for (index, ch) in integer.chars().rev().enumerate() {
    if index > 0 && index % 3 == 0 {
      grouped.push(',');
    }
    grouped.push(ch);
  }
  let grouped: String = grouped.chars().rev().collect();
  format!("{sign}{grouped}.{fraction}")
}

fn format_template_percent(value: f64) -> String {
  format!("{:.2}%", value * 100.0)
}

fn format_top_categories(rows: &[CategoryBreakdown], privacy_mode: bool) -> String {
  let items: Vec<String> = rows
    .iter()
    .filter(|item| item.amount.abs() > 0.000_001)
    .take(4)
    .map(|item| {
      format!(
        "{} {}（{}）",
        item.category,
        format_template_money(item.amount, privacy_mode),
        format_template_percent(item.percent)
      )
    })
    .collect();
  if items.is_empty() {
    "暂无数据".to_string()
  } else {
    items.join("、")
  }
}

fn template_variables(
  connection: &Connection,
  period_month: &str,
  privacy_mode: bool,
) -> Result<HashMap<String, String>, AppError> {
  let target_saving_rate = setting_number(connection, "target_saving_rate", 0.3)?;
  let confirmed_income: f64 = connection.query_row(
    "
    select coalesce(sum(amount), 0)
    from confirmed_transactions
    where period_month = ?1
      and transaction_type = 'income'
      and include_in_stats = 1
      and confirmation_status = 'confirmed'
    ",
    params![period_month],
    |row| row.get(0),
  )?;
  let confirmed_expense: f64 = connection.query_row(
    "
    select coalesce(sum(amount), 0)
    from confirmed_transactions
    where period_month = ?1
      and transaction_type = 'expense'
      and include_in_stats = 1
      and confirmation_status = 'confirmed'
    ",
    params![period_month],
    |row| row.get(0),
  )?;
  let asset_gross_value: f64 = connection.query_row(
    "
    select coalesce(sum(amount_cny), 0)
    from monthly_asset_snapshots
    where period_month = ?1
      and version_no = 1
      and status = 'held'
    ",
    params![period_month],
    |row| row.get(0),
  )?;
  let credit_card_net_adjustment: f64 = connection.query_row(
    "
    select coalesce(sum(net_adjustment), 0)
    from monthly_credit_card_entries
    where period_month = ?1 and confirmed = 1
    ",
    params![period_month],
    |row| row.get(0),
  )?;
  let (investment_buy, investment_sell, investment_dividend): (f64, f64, f64) = connection.query_row(
    "
    select
      coalesce(sum(case when flow_type = 'buy' then amount_cny else 0 end), 0),
      coalesce(sum(case when flow_type = 'sell' then amount_cny else 0 end), 0),
      coalesce(sum(case when flow_type = 'dividend' then amount_cny else 0 end), 0)
    from investment_cashflows ic
    join assets a on a.id = ic.asset_id
    where ic.period_month = ?1
      and a.main_asset_category_id <> 'asset_cat_cash'
    ",
    params![period_month],
    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
  )?;
  let trends = dashboard_monthly_trends(connection)?;
  let current_trend = trends.iter().find(|item| item.period_month == period_month);
  let saving_amount = confirmed_income - confirmed_expense;
  let saving_rate = if confirmed_income > 0.0 {
    saving_amount / confirmed_income
  } else {
    0.0
  };
  let investment_gain = current_trend.map(|item| item.investment_gain).unwrap_or(0.0);
  let expense_categories = category_breakdown(connection, period_month, "expense")?;
  let income_categories = category_breakdown(connection, period_month, "income")?;
  let allocation_rows = asset_allocation_breakdown(connection, period_month, None)?;
  let allocation_deviation: Vec<String> = allocation_rows
    .iter()
    .filter_map(|item| {
      item.deviation_percent.map(|deviation| {
        format!(
          "{} {}{}",
          item.category,
          if deviation >= 0.0 { "+" } else { "" },
          format_template_percent(deviation)
        )
      })
    })
    .filter(|item| !item.ends_with("0.00%"))
    .collect();
  let anomalies = spending_anomalies(connection, period_month)?;
  let mut reminders = Vec::new();
  if confirmed_income > 0.0 && saving_rate < target_saving_rate {
    reminders.push(format!("储蓄率低于目标 {}", format_template_percent(target_saving_rate)));
  }
  if investment_gain < 0.0 {
    reminders.push("本月投资收益为负".to_string());
  }
  if !anomalies.is_empty() {
    reminders.push(format!("有 {} 笔大额异常支出", anomalies.len()));
  }

  let mut values = HashMap::new();
  values.insert("月份".to_string(), period_month.to_string());
  values.insert("总收入".to_string(), format_template_money(confirmed_income, privacy_mode));
  values.insert("总支出".to_string(), format_template_money(confirmed_expense, privacy_mode));
  values.insert("储蓄金额".to_string(), format_template_money(saving_amount, privacy_mode));
  values.insert("储蓄率".to_string(), format_template_percent(saving_rate));
  values.insert("目标储蓄率".to_string(), format_template_percent(target_saving_rate));
  values.insert("资产原值".to_string(), format_template_money(asset_gross_value, privacy_mode));
  values.insert(
    "信用卡净调整".to_string(),
    format_template_money(credit_card_net_adjustment, privacy_mode),
  );
  values.insert(
    "净资产".to_string(),
    format_template_money(asset_gross_value + credit_card_net_adjustment, privacy_mode),
  );
  values.insert("本月买入".to_string(), format_template_money(investment_buy, privacy_mode));
  values.insert("本月卖出".to_string(), format_template_money(investment_sell, privacy_mode));
  values.insert("本月分红".to_string(), format_template_money(investment_dividend, privacy_mode));
  values.insert("本月收益".to_string(), format_template_money(investment_gain, privacy_mode));
  values.insert(
    "支出Top分类".to_string(),
    format_top_categories(&expense_categories, privacy_mode),
  );
  values.insert(
    "收入Top分类".to_string(),
    format_top_categories(&income_categories, privacy_mode),
  );
  values.insert(
    "资产配置偏离".to_string(),
    if allocation_deviation.is_empty() {
      "暂无数据".to_string()
    } else {
      allocation_deviation.join("、")
    },
  );
  values.insert(
    "本月提醒".to_string(),
    if reminders.is_empty() {
      "暂无数据".to_string()
    } else {
      reminders.join("；")
    },
  );
  Ok(values)
}

fn render_template_content(
  connection: &Connection,
  content: &str,
  period_month: &str,
  privacy_mode: bool,
) -> Result<String, AppError> {
  let values = template_variables(connection, period_month, privacy_mode)?;
  let mut rendered = content.to_string();
  for variable in [
    "月份",
    "总收入",
    "总支出",
    "储蓄金额",
    "储蓄率",
    "目标储蓄率",
    "资产原值",
    "信用卡净调整",
    "净资产",
    "本月买入",
    "本月卖出",
    "本月分红",
    "本月收益",
    "支出Top分类",
    "收入Top分类",
    "资产配置偏离",
    "本月提醒",
  ] {
    let value = values
      .get(variable)
      .map(|item| escape_html(item))
      .unwrap_or_else(|| "暂无数据".to_string());
    rendered = rendered.replace(&format!("{{{{{variable}}}}}"), &value);
  }
  Ok(rendered)
}

fn content_template_from_row(row: &rusqlite::Row<'_>) -> Result<ContentTemplate, rusqlite::Error> {
  Ok(ContentTemplate {
    id: row.get(0)?,
    name: row.get(1)?,
    template_type: row.get(2)?,
    content: row.get(3)?,
    is_default: row.get::<_, i64>(4)? == 1,
    note: row.get(5)?,
    created_at: row.get(6)?,
    updated_at: row.get(7)?,
  })
}

fn default_template_for_type(connection: &Connection, template_type: &str) -> Result<Option<ContentTemplate>, AppError> {
  connection
    .query_row(
      "
      select id, name, template_type, content, is_default, note, created_at, updated_at
      from content_templates
      where template_type = ?1
      order by is_default desc, updated_at desc
      limit 1
      ",
      params![template_type],
      content_template_from_row,
    )
    .optional()
    .map_err(AppError::from)
}

fn builtin_template_content(template_type: &str) -> &'static str {
  match template_type {
    "cashflow_analysis" => "{{月份}} 收入 {{总收入}}，支出 {{总支出}}，储蓄 {{储蓄金额}}，储蓄率 {{储蓄率}}，目标储蓄率 {{目标储蓄率}}。",
    "expense_structure_analysis" => "{{月份}} 支出 Top 分类：{{支出Top分类}}。",
    "income_structure_analysis" => "{{月份}} 收入 Top 分类：{{收入Top分类}}。",
    "asset_allocation_analysis" => "{{月份}} 净资产 {{净资产}}，资产配置偏离：{{资产配置偏离}}。",
    "investment_performance_analysis" => "{{月份}} 买入 {{本月买入}}，卖出 {{本月卖出}}，分红 {{本月分红}}，收益 {{本月收益}}。",
    "next_month_reminder" => "{{月份}} 本月提醒：{{本月提醒}}。",
    _ => "<article><h1>{{月份}} 财务月报</h1><section><h2>本月总览</h2><p>收入 {{总收入}}，支出 {{总支出}}，储蓄 {{储蓄金额}}，储蓄率 {{储蓄率}}。</p><p>资产原值 {{资产原值}}，信用卡净调整 {{信用卡净调整}}，净资产 {{净资产}}。</p></section><section><h2>支出结构</h2><p>支出 Top 分类：{{支出Top分类}}。</p></section><section><h2>资产配置</h2><p>配置偏离：{{资产配置偏离}}。</p></section><section><h2>投资表现</h2><p>买入 {{本月买入}}，卖出 {{本月卖出}}，分红 {{本月分红}}，收益 {{本月收益}}。</p></section><section><h2>本月提醒</h2><p>{{本月提醒}}</p></section></article>",
  }
}

fn wrap_plain_template_html(rendered: &str) -> String {
  if rendered.contains('<') && rendered.contains('>') {
    rendered.to_string()
  } else {
    format!(
      "<article><p>{}</p></article>",
      rendered
        .lines()
        .map(escape_html)
        .collect::<Vec<_>>()
        .join("<br />")
    )
  }
}

#[tauri::command]
fn get_onboarding_status(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<OnboardingStatus, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  read_onboarding_status(&connection)
}

#[tauri::command]
fn save_onboarding(
  input: OnboardingInput,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<OnboardingStatus, AppError> {
  let mut work_connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&work_connection, &security)?;
  save_onboarding_to_connection(&mut work_connection, &input)?;

  if db.split_databases {
    let mut dashboard_connection = db.dashboard_connection.lock().expect("database mutex poisoned");
    save_onboarding_to_connection(&mut dashboard_connection, &input)?;
  }

  read_onboarding_status(&work_connection)
}

#[tauri::command]
fn reset_demo_onboarding(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<OnboardingStatus, AppError> {
  if env::var("FINANCIAL_PLANNING_ENV_LABEL").unwrap_or_default().to_lowercase() != "demo" {
    return Err(AppError::InvalidCsvValue("重置初始化只允许在 Demo 环境执行".to_string()));
  }

  let mut work_connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&work_connection, &security)?;
  reset_demo_onboarding_connection(&mut work_connection)?;

  if db.split_databases {
    let mut dashboard_connection = db.dashboard_connection.lock().expect("database mutex poisoned");
    reset_demo_onboarding_connection(&mut dashboard_connection)?;
  }

  read_onboarding_status(&work_connection)
}

#[tauri::command]
fn list_content_templates(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<Vec<ContentTemplate>, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  seed_default_content_templates(&connection)?;
  let mut statement = connection.prepare(
    "
    select id, name, template_type, content, is_default, note, created_at, updated_at
    from content_templates
    order by template_type, is_default desc, updated_at desc
    ",
  )?;
  let rows = statement
    .query_map([], content_template_from_row)?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

#[tauri::command]
fn save_content_template(
  input: ContentTemplateInput,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<ContentTemplate, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  if input.name.trim().is_empty() {
    return Err(AppError::InvalidCsvValue("模板名称不能为空".to_string()));
  }
  if input.content.trim().is_empty() {
    return Err(AppError::InvalidCsvValue("模板内容不能为空".to_string()));
  }
  let id = input
    .id
    .filter(|value| !value.trim().is_empty())
    .unwrap_or_else(|| make_unique_id("tmpl", &format!("{}|{}", input.template_type, input.name)));
  if input.is_default {
    connection.execute(
      "update content_templates set is_default = 0, updated_at = current_timestamp where template_type = ?1",
      params![input.template_type],
    )?;
  }
  connection.execute(
    "
    insert into content_templates (id, name, template_type, content, is_default, note)
    values (?1, ?2, ?3, ?4, ?5, ?6)
    on conflict(id) do update set
      name = excluded.name,
      template_type = excluded.template_type,
      content = excluded.content,
      is_default = excluded.is_default,
      note = excluded.note,
      updated_at = current_timestamp
    ",
    params![
      id,
      input.name.trim(),
      input.template_type,
      input.content,
      if input.is_default { 1 } else { 0 },
      input.note
    ],
  )?;
  connection.query_row(
    "
    select id, name, template_type, content, is_default, note, created_at, updated_at
    from content_templates
    where id = ?1
    ",
    params![id],
    content_template_from_row,
  ).map_err(AppError::from)
}

#[tauri::command]
fn copy_content_template(
  id: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<ContentTemplate, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let source = connection.query_row(
    "
    select id, name, template_type, content, is_default, note, created_at, updated_at
    from content_templates
    where id = ?1
    ",
    params![id],
    content_template_from_row,
  )?;
  let new_id = make_unique_id("tmpl", &format!("{}|copy", source.id));
  connection.execute(
    "
    insert into content_templates (id, name, template_type, content, is_default, note)
    values (?1, ?2, ?3, ?4, 0, ?5)
    ",
    params![
      new_id,
      format!("{} 副本", source.name),
      source.template_type,
      source.content,
      source.note
    ],
  )?;
  connection.query_row(
    "
    select id, name, template_type, content, is_default, note, created_at, updated_at
    from content_templates
    where id = ?1
    ",
    params![new_id],
    content_template_from_row,
  ).map_err(AppError::from)
}

#[tauri::command]
fn delete_content_template(
  id: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<(), AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  connection.execute("delete from content_templates where id = ?1", params![id])?;
  seed_default_content_templates(&connection)?;
  Ok(())
}

#[tauri::command]
fn set_default_content_template(
  id: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<ContentTemplate, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let template_type: String = connection.query_row(
    "select template_type from content_templates where id = ?1",
    params![id],
    |row| row.get(0),
  )?;
  connection.execute(
    "update content_templates set is_default = 0, updated_at = current_timestamp where template_type = ?1",
    params![template_type],
  )?;
  connection.execute(
    "update content_templates set is_default = 1, updated_at = current_timestamp where id = ?1",
    params![id],
  )?;
  connection.query_row(
    "
    select id, name, template_type, content, is_default, note, created_at, updated_at
    from content_templates
    where id = ?1
    ",
    params![id],
    content_template_from_row,
  ).map_err(AppError::from)
}

#[tauri::command]
fn render_content_template(
  input: TemplateRenderInput,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<TemplateRenderResult, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let template = if let Some(id) = input.template_id.as_ref().filter(|value| !value.trim().is_empty()) {
    connection
      .query_row(
        "
        select id, name, template_type, content, is_default, note, created_at, updated_at
        from content_templates
        where id = ?1
        ",
        params![id],
        content_template_from_row,
      )
      .optional()?
  } else {
    default_template_for_type(&connection, &input.template_type)?
  };
  let (template_id, template_name, template_type, content) = if let Some(override_content) = input
    .content_override
    .as_ref()
    .filter(|value| !value.trim().is_empty())
  {
    (
      input.template_id.clone(),
      "当前编辑内容".to_string(),
      input.template_type.clone(),
      override_content.clone(),
    )
  } else if let Some(template) = template {
    (
      Some(template.id),
      template.name,
      template.template_type,
      template.content,
    )
  } else {
    (
      None,
      format!("系统默认{}", template_type_label(&input.template_type)),
      input.template_type.clone(),
      builtin_template_content(&input.template_type).to_string(),
    )
  };
  let rendered = render_template_content(&connection, &content, &input.period_month, input.privacy_mode)?;
  let html = wrap_plain_template_html(&rendered);
  connection.execute(
    "
    insert into template_render_logs (id, template_id, template_type, period_month)
    values (?1, ?2, ?3, ?4)
    ",
    params![
      make_unique_id("tmpl_log", &format!("{}|{}", template_type, input.period_month)),
      template_id,
      template_type,
      input.period_month
    ],
  )?;
  Ok(TemplateRenderResult {
    template_id,
    template_name,
    template_type,
    period_month: input.period_month,
    plain_text: strip_html(&html),
    html,
  })
}

#[tauri::command]
fn get_security_status(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<SecurityStatus, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  read_security_status(&connection, &security)
}

#[tauri::command]
fn set_app_password(
  password: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<SecurityStatus, AppError> {
  if password.chars().count() < 6 {
    return Err(AppError::WeakPassword);
  }

  let connection = db.work_connection.lock().expect("database mutex poisoned");
  if password_hash_exists(&connection)? {
    return Err(AppError::InvalidCsvValue("密码已存在，请从设置里验证当前密码后修改。".to_string()));
  }
  let salt = generate_salt();
  let hash = hash_password(&password, &salt);
  upsert_setting(&connection, "security_password_salt", &serde_json::to_string(&salt).unwrap())?;
  upsert_setting(&connection, "security_password_hash", &serde_json::to_string(&hash).unwrap())?;
  *security.unlocked.lock().expect("security mutex poisoned") = true;
  read_security_status(&connection, &security)
}

#[tauri::command]
fn unlock_app(
  password: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<SecurityStatus, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  if !verify_password(&connection, &password)? {
    return Err(AppError::InvalidPassword);
  }

  *security.unlocked.lock().expect("security mutex poisoned") = true;
  read_security_status(&connection, &security)
}

#[tauri::command]
fn change_app_password(
  current_password: Option<String>,
  new_password: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<SecurityStatus, AppError> {
  if new_password.chars().count() < 6 {
    return Err(AppError::WeakPassword);
  }

  let connection = db.work_connection.lock().expect("database mutex poisoned");
  if password_hash_exists(&connection)? {
    let current = current_password.unwrap_or_default();
    if !verify_password(&connection, &current)? {
      return Err(AppError::InvalidPassword);
    }
  }

  let salt = generate_salt();
  let hash = hash_password(&new_password, &salt);
  upsert_setting(&connection, "security_password_salt", &serde_json::to_string(&salt).unwrap())?;
  upsert_setting(&connection, "security_password_hash", &serde_json::to_string(&hash).unwrap())?;
  *security.unlocked.lock().expect("security mutex poisoned") = true;
  read_security_status(&connection, &security)
}

#[tauri::command]
fn reset_account(
  current_password: Option<String>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
  app: tauri::AppHandle,
) -> Result<(), AppError> {
  {
    let mut work_connection = db.work_connection.lock().expect("database mutex poisoned");
    if password_hash_exists(&work_connection)? {
      let current = current_password.unwrap_or_default();
      if !verify_password(&work_connection, &current)? {
        return Err(AppError::InvalidPassword);
      }
    }
    reset_account_connection(&mut work_connection)?;
  }

  if db.split_databases {
    let mut dashboard_connection = db.dashboard_connection.lock().expect("database mutex poisoned");
    reset_account_connection(&mut dashboard_connection)?;
  }

  *security.unlocked.lock().expect("security mutex poisoned") = false;
  std::thread::spawn(move || {
    std::thread::sleep(Duration::from_millis(250));
    app.exit(0);
  });
  Ok(())
}

#[tauri::command]
fn lock_app(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<SecurityStatus, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  *security.unlocked.lock().expect("security mutex poisoned") = false;
  read_security_status(&connection, &security)
}

#[tauri::command]
fn set_privacy_mode(
  enabled: bool,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<SecurityStatus, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  upsert_setting(
    &connection,
    "security_privacy_mode",
    if enabled { "true" } else { "false" },
  )?;
  read_security_status(&connection, &security)
}

#[tauri::command]
fn get_shark_csv_path(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<String, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  setting_string(&connection, "shark_csv_path", "")
}

#[tauri::command]
fn save_shark_csv_path(
  file_path: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<String, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let normalized = normalize_import_file_path(&file_path);
  upsert_setting(&connection, "shark_csv_path", &serde_json::to_string(&normalized).unwrap_or_else(|_| "\"\"".to_string()))?;
  Ok(normalized)
}

#[tauri::command]
fn import_shark_csv(
  file_path: String,
  expected_period_month: String,
  overwrite_existing: Option<bool>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<ImportResult, AppError> {
  let mut connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;

  let expected_period_month = expected_period_month.trim().to_string();
  if expected_period_month.len() != 7 {
    return Err(AppError::InvalidCsvValue("上传失败：当前更新月份无效，请先选择月份".to_string()));
  }
  let normalized_file_path = normalize_import_file_path(&file_path);
  if normalized_file_path.trim().is_empty() {
    return Err(AppError::InvalidCsvValue("上传失败：请先选择或填写账单文件路径".to_string()));
  }
  let path = Path::new(&normalized_file_path);
  if !path.exists() {
    return Err(AppError::InvalidCsvValue(format!("上传失败：找不到账单文件，请检查路径：{}", normalized_file_path)));
  }
  let bytes = fs::read(path)
    .map_err(|err| AppError::InvalidCsvValue(format!("上传失败：无法读取账单文件：{err}")))?;
  upsert_setting(&connection, "shark_csv_path", &serde_json::to_string(&normalized_file_path).unwrap_or_else(|_| "\"\"".to_string()))?;
  let file_hash = sha256_hex(&bytes);
  let overwrite_existing = overwrite_existing.unwrap_or(false);
  let existing_batch_id: Option<String> = connection
    .query_row(
      "select id from import_batches where source_type = 'shark_csv' and file_hash = ?1",
      params![file_hash],
      |row| row.get(0),
    )
    .optional()?;

  if let Some(batch_id) = existing_batch_id.as_ref() {
    let imported_count: i64 = connection.query_row(
      "select count(*) from raw_transactions where batch_id = ?1",
      params![batch_id],
      |row| row.get(0),
    )?;
    let potential_duplicate_count: i64 = connection.query_row(
      "select count(*) from raw_transactions where batch_id = ?1 and potential_duplicate = 1",
      params![batch_id],
      |row| row.get(0),
    )?;
    let expense_count: i64 = connection.query_row(
      "select count(*) from raw_transactions where batch_id = ?1 and raw_type = '支出'",
      params![batch_id],
      |row| row.get(0),
    )?;
    let income_count: i64 = connection.query_row(
      "select count(*) from raw_transactions where batch_id = ?1 and raw_type = '收入'",
      params![batch_id],
      |row| row.get(0),
    )?;
    let mut statement = connection.prepare(
      "
      select distinct substr(transaction_date, 1, 7)
      from raw_transactions
      where batch_id = ?1
      order by 1
      ",
    )?;
    let period_months = statement
      .query_map(params![batch_id], |row| row.get::<_, String>(0))?
      .collect::<Result<Vec<_>, _>>()?;
    if period_months.len() != 1 || period_months.first() != Some(&expected_period_month) {
      return Err(AppError::InvalidCsvValue(format!(
        "上传失败：文件月份为 {}，当前需要更新 {}",
        if period_months.is_empty() { "无有效月份".to_string() } else { period_months.join("、") },
        expected_period_month
      )));
    }
    if overwrite_existing {
      // Continue into the normal import path after validation. The old batch is removed inside the import transaction.
    } else {
    for month in period_months.iter() {
      set_step_status(&connection, month, "import", true)?;
      set_step_status(&connection, month, "expense", false)?;
      set_step_status(&connection, month, "income", false)?;
      set_step_status(&connection, month, "assets", false)?;
      set_step_status(&connection, month, "creditCard", false)?;
      set_step_status(&connection, month, "final", false)?;
    }
    return Ok(ImportResult {
      batch_id: batch_id.clone(),
      duplicate_file: true,
      overwritten_existing: false,
      imported_count,
      expense_count,
      income_count,
      potential_duplicate_count,
      period_months,
    });
    }
  }

  let (parsed_rows, period_months) = parse_shark_rows_from_file(path, &bytes)?;
  if parsed_rows.is_empty() {
    return Err(AppError::InvalidCsvValue("上传失败：文件里没有可识别的收入或支出记录".to_string()));
  }
  if period_months.len() != 1 || period_months.first() != Some(&expected_period_month) {
    return Err(AppError::InvalidCsvValue(format!(
      "上传失败：文件月份为 {}，当前需要更新 {}",
      if period_months.is_empty() { "无有效月份".to_string() } else { period_months.join("、") },
      expected_period_month
    )));
  }

  let batch_id = existing_batch_id.clone().unwrap_or_else(|| make_id("batch", &file_hash));
  let file_name = path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("鲨鱼账单")
    .to_string();
  let tx = connection.transaction()?;
  let source_note = if path
    .extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| extension.eq_ignore_ascii_case("xlsx"))
    .unwrap_or(false)
  {
    "鲨鱼 Excel 导入"
  } else {
    "鲨鱼 CSV 导入"
  };
  if let Some(existing_id) = existing_batch_id.as_ref() {
    tx.execute(
      "
      delete from confirmed_transactions
      where raw_transaction_id in (
        select id from raw_transactions where batch_id = ?1
      )
      ",
      params![existing_id],
    )?;
    tx.execute("delete from raw_transactions where batch_id = ?1", params![existing_id])?;
    tx.execute("delete from import_batches where id = ?1", params![existing_id])?;
  }
  tx.execute(
    "
    insert into import_batches (id, source_type, file_name, file_path, file_hash, note)
    values (?1, 'shark_csv', ?2, ?3, ?4, ?5)
    ",
    params![batch_id, file_name, normalized_file_path, file_hash, source_note],
  )?;

  let mut imported_count = 0_i64;
  let mut expense_count = 0_i64;
  let mut income_count = 0_i64;
  let mut potential_duplicate_count = 0_i64;
  for row in parsed_rows.iter() {
    let category_id = match mapped_category_id(&tx, "shark_csv", &row.raw_category)? {
      Some(id) => Some(id),
      None => Some(create_imported_category_if_needed(&tx, &row.raw_category, &row.transaction_kind)?),
    };
    let duplicate_key = sha256_hex(
      format!(
        "{}|{}|{:.2}|{}",
        row.transaction_date,
        row.transaction_kind,
        row.amount,
        row.note
      )
      .as_bytes(),
    );
    let existing_same_count: i64 = tx.query_row(
      "
      select count(*)
      from raw_transactions
      where duplicate_key = ?1
      ",
      params![duplicate_key],
      |row| row.get(0),
    )?;
    let potential_duplicate = existing_same_count > 0;
    if potential_duplicate {
      potential_duplicate_count += 1;
    }
    let row_hash = sha256_hex(format!("{}|{}|{}", file_hash, row.source_row_no, row.line).as_bytes());
    let row_id = make_id("raw", &row_hash);
    tx.execute(
      "
      insert into raw_transactions (
        id, batch_id, source_row_no, transaction_date, raw_type, raw_category,
        raw_account, amount, currency, note, row_hash, standard_category_id,
        potential_duplicate, duplicate_key
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'CNY', ?9, ?10, ?11, ?12, ?13)
      ",
      params![
        row_id,
        batch_id,
        row.source_row_no,
        row.transaction_date,
        row.raw_type,
        row.raw_category,
        row.raw_account,
        row.amount,
        row.note,
        row_hash,
        category_id,
        if potential_duplicate { 1 } else { 0 },
        duplicate_key
      ],
    )?;
    imported_count += 1;
    if row.transaction_kind == "expense" {
      expense_count += 1;
    } else if row.transaction_kind == "income" {
      income_count += 1;
    }
  }

  let period_month = period_months.last().cloned();
  tx.execute(
    "update import_batches set period_month = ?1 where id = ?2",
    params![period_month, batch_id],
  )?;
  for month in period_months.iter() {
    set_step_status(&tx, month, "import", true)?;
    set_step_status(&tx, month, "expense", false)?;
    set_step_status(&tx, month, "income", false)?;
    set_step_status(&tx, month, "assets", false)?;
    set_step_status(&tx, month, "creditCard", false)?;
    set_step_status(&tx, month, "final", false)?;
  }
  tx.commit()?;

  Ok(ImportResult {
    batch_id,
    duplicate_file: false,
    overwritten_existing: overwrite_existing && existing_batch_id.is_some(),
    imported_count,
    expense_count,
    income_count,
    potential_duplicate_count,
    period_months,
  })
}

#[tauri::command]
fn get_transaction_review(
  period_month: String,
  transaction_type: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<TransactionReview, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;

  let raw_type = if transaction_type == "expense" { "支出" } else { "收入" };
  let mut statement = connection.prepare(
    "
    select
      rt.id,
      rt.transaction_date,
      rt.raw_type,
      rt.raw_category,
      rt.standard_category_id,
      c.name,
      rt.raw_account,
      rt.amount,
      rt.currency,
      coalesce(rt.note, ''),
      rt.potential_duplicate,
      coalesce(rt.duplicate_review_status, 'pending')
    from raw_transactions rt
    left join categories c on c.id = rt.standard_category_id
    where substr(rt.transaction_date, 1, 7) = ?1
      and rt.raw_type = ?2
    order by rt.transaction_date, rt.source_row_no
    ",
  )?;
  let rows = statement
    .query_map(params![period_month, raw_type], |row| {
      Ok(TransactionReviewRow {
        id: row.get(0)?,
        transaction_date: row.get(1)?,
        raw_type: row.get(2)?,
        transaction_type: transaction_type.clone(),
        raw_category: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        category_id: row.get(4)?,
        category_name: row.get(5)?,
        raw_account: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
        amount: row.get(7)?,
        currency: row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "CNY".to_string()),
        note: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
        potential_duplicate: row.get::<_, i64>(10)? == 1,
        duplicate_review_status: row.get(11)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;

  let mut summary_statement = connection.prepare(
    "
    select
      rt.standard_category_id,
      coalesce(c.name, rt.raw_category, '未分类') as category_name,
      coalesce(sum(rt.amount), 0) as amount,
      count(*) as row_count
    from raw_transactions rt
    left join categories c on c.id = rt.standard_category_id
    where substr(rt.transaction_date, 1, 7) = ?1
      and rt.raw_type = ?2
    group by rt.standard_category_id, category_name
    order by amount desc
    ",
  )?;
  let summary = summary_statement
    .query_map(params![period_month, raw_type], |row| {
      Ok(CategorySummary {
        category_id: row.get(0)?,
        category_name: row.get(1)?,
        amount: row.get(2)?,
        count: row.get(3)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;

  let mut category_statement = connection.prepare(
    "
    select
      id, name, category_kind,
      coalesce(is_auto_created, 0),
      created_from_raw_category,
      rigidity,
      is_personal,
      note
    from categories
    where category_kind = ?1 and is_active = 1
    order by sort_order, name
    ",
  )?;
  let categories = category_statement
    .query_map(params![transaction_type], |row| {
      Ok(CategoryOption {
        id: row.get(0)?,
        name: row.get(1)?,
        category_kind: row.get(2)?,
        is_auto_created: row.get::<_, i64>(3)? == 1,
        created_from_raw_category: row.get(4)?,
        rigidity: row.get(5)?,
        is_personal: row.get::<_, i64>(6)? == 1,
        note: row.get(7)?,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  let auto_created_categories = categories
    .iter()
    .filter(|category| category.is_auto_created)
    .cloned()
    .collect::<Vec<_>>();

  Ok(TransactionReview {
    period_month,
    transaction_type,
    rows,
    summary,
    categories,
    auto_created_categories,
  })
}

#[tauri::command]
fn update_duplicate_review_status(
  raw_transaction_id: String,
  status: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<(), AppError> {
  let allowed = [
    "pending",
    "keep_both",
    "exclude_current",
    "exclude_other",
    "merged",
    "not_duplicate",
  ];
  if !allowed.contains(&status.as_str()) {
    return Err(AppError::InvalidCsvValue("重复处理状态无效".to_string()));
  }
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  connection.execute(
    "update raw_transactions set duplicate_review_status = ?1 where id = ?2",
    params![status, raw_transaction_id],
  )?;
  Ok(())
}

#[tauri::command]
fn update_duplicate_review_status_batch(
  raw_transaction_ids: Vec<String>,
  status: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<i64, AppError> {
  let allowed = [
    "pending",
    "keep_both",
    "exclude_current",
    "exclude_other",
    "merged",
    "not_duplicate",
  ];
  if !allowed.contains(&status.as_str()) {
    return Err(AppError::InvalidCsvValue("重复处理状态无效".to_string()));
  }
  let mut connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let tx = connection.transaction()?;
  let mut updated_count = 0_i64;
  for id in raw_transaction_ids.iter().filter(|id| !id.starts_with("manual-")) {
    updated_count += tx.execute(
      "update raw_transactions set duplicate_review_status = ?1 where id = ?2",
      params![status, id],
    )? as i64;
  }
  tx.commit()?;
  Ok(updated_count)
}

#[tauri::command]
fn create_category(
  input: NewCategoryInput,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<CategoryOption, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let name = input.name.trim();
  if name.is_empty() {
    return Err(AppError::InvalidCsvValue("分类名称不能为空".to_string()));
  }
  if input.category_kind != "expense" && input.category_kind != "income" {
    return Err(AppError::InvalidCsvValue("分类类型必须是收入或支出".to_string()));
  }
  let category_id = make_id("cat", &format!("manual|{}|{}", input.category_kind, name));
  connection.execute(
    "
    insert into categories (
      id, name, category_kind, rigidity, is_personal, is_active,
      sort_order, is_auto_created, source, created_from_raw_category, note
    )
    values (?1, ?2, ?3, ?4, ?5, 1, 500, 0, 'manual', null, ?6)
    on conflict(name, category_kind) do update set
      rigidity = excluded.rigidity,
      is_personal = excluded.is_personal,
      note = excluded.note,
      is_active = 1,
      updated_at = current_timestamp
    ",
    params![
      category_id,
      name,
      input.category_kind,
      input.rigidity,
      if input.is_personal { 1 } else { 0 },
      input.note
    ],
  )?;
  let item = connection.query_row(
    "
    select
      id, name, category_kind, coalesce(is_auto_created, 0),
      created_from_raw_category, rigidity, is_personal, note
    from categories
    where name = ?1 and category_kind = ?2
    ",
    params![name, input.category_kind],
    |row| {
      Ok(CategoryOption {
        id: row.get(0)?,
        name: row.get(1)?,
        category_kind: row.get(2)?,
        is_auto_created: row.get::<_, i64>(3)? == 1,
        created_from_raw_category: row.get(4)?,
        rigidity: row.get(5)?,
        is_personal: row.get::<_, i64>(6)? == 1,
        note: row.get(7)?,
      })
    },
  )?;
  Ok(item)
}

#[tauri::command]
fn confirm_transactions(
  period_month: String,
  transaction_type: String,
  items: Vec<ConfirmTransactionInput>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<ConfirmResult, AppError> {
  let mut connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let tx = connection.transaction()?;
  let previous_count: i64 = tx.query_row(
    "
    select count(*)
    from confirmed_transactions
    where period_month = ?1 and transaction_type = ?2
      and source_kind <> 'mobile'
    ",
    params![period_month, transaction_type],
    |row| row.get(0),
  )?;
  tx.execute(
    "
    delete from confirmed_transactions
    where period_month = ?1 and transaction_type = ?2
      and source_kind <> 'mobile'
    ",
    params![period_month, transaction_type],
  )?;

  let mut confirmed_count = 0_i64;
  let mut included_amount = 0.0_f64;
  for (index, item) in items.iter().enumerate() {
    if period_from_date(&item.transaction_date) != period_month {
      return Err(AppError::InvalidCsvValue(format!(
        "确认日期不属于月份 {}: {}",
        period_month, item.transaction_date
      )));
    }
    let source_kind = if item.raw_transaction_id.is_some() {
      "shark_csv"
    } else {
      "manual"
    };
    let seed = format!(
      "{}|{}|{}|{}|{}|{}|{}",
      period_month,
      transaction_type,
      index,
      item.raw_transaction_id.clone().unwrap_or_default(),
      item.transaction_date,
      item.amount,
      item.note.clone().unwrap_or_default()
    );
    let id = make_id("confirmed", &seed);
    let confirmation_status = if item.include_in_stats {
      "confirmed"
    } else {
      "excluded"
    };
    let adjustment_reason = item.adjustment_reason.clone().unwrap_or_default();
    tx.execute(
      "
      insert into confirmed_transactions (
        id, source_kind, raw_transaction_id, period_month, transaction_date,
        transaction_type, amount, currency, category_id, raw_category_snapshot,
        include_in_stats, confirmation_status, adjustment_reason, note
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      ",
      params![
        id,
        source_kind,
        item.raw_transaction_id,
        period_month,
        item.transaction_date,
        item.transaction_type,
        item.amount.abs(),
        item.currency,
        item.category_id,
        item.raw_category_snapshot,
        if item.include_in_stats { 1 } else { 0 },
        confirmation_status,
        if adjustment_reason.is_empty() && !item.include_in_stats {
          "用户排除"
        } else {
          &adjustment_reason
        },
        item.note
      ],
    )?;
    let should_audit = source_kind == "manual"
      || !adjustment_reason.is_empty()
      || !item.include_in_stats
      || item.raw_transaction_id.is_some();
    if should_audit {
      let new_value_json = serde_json::json!({
        "period_month": period_month,
        "transaction_type": transaction_type,
        "raw_transaction_id": item.raw_transaction_id,
        "transaction_date": item.transaction_date,
        "amount": item.amount.abs(),
        "currency": item.currency,
        "category_id": item.category_id,
        "include_in_stats": item.include_in_stats,
        "note": item.note,
        "adjustment_reason": adjustment_reason,
        "source_kind": source_kind
      })
      .to_string();
      tx.execute(
        "
        insert into audit_logs (id, entity_type, entity_id, action, old_value_json, new_value_json)
        values (?1, 'confirmed_transactions', ?2, ?3, null, ?4)
        ",
        params![
          make_unique_id("audit", &format!("{}|{}|{}", id, index, new_value_json)),
          id,
          if source_kind == "manual" { "manual_confirm" } else { "confirm_adjustment" },
          new_value_json
        ],
      )?;
    }
    confirmed_count += 1;
    if item.include_in_stats {
      included_amount += item.amount.abs();
    }
  }
  tx.execute(
    "
    insert into audit_logs (id, entity_type, entity_id, action, old_value_json, new_value_json)
    values (?1, 'confirmed_transactions', ?2, 'confirm_month_rewrite', ?3, ?4)
    ",
    params![
      make_unique_id("audit", &format!("rewrite|{}|{}|{}", period_month, transaction_type, confirmed_count)),
      format!("{}:{}", period_month, transaction_type),
      serde_json::json!({ "previous_count": previous_count }).to_string(),
      serde_json::json!({ "confirmed_count": confirmed_count, "included_amount": included_amount }).to_string()
    ],
  )?;
  set_step_status(&tx, &period_month, &transaction_type, true)?;
  tx.commit()?;

  Ok(ConfirmResult {
    period_month,
    transaction_type,
    confirmed_count,
    included_amount,
  })
}

#[tauri::command]
fn get_monthly_step_status(
  period_month: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MonthlyStepStatus, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  build_monthly_step_status(&connection, &period_month)
}

#[tauri::command]
fn set_monthly_step_status(
  period_month: String,
  step_key: String,
  completed: bool,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MonthlyStepStatus, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  set_step_status(&connection, &period_month, &step_key, completed)?;
  build_monthly_step_status(&connection, &period_month)
}

fn fx_rate_record_for_key(
  connection: &Connection,
  key: &FxRateKeyInput,
) -> Result<FxRateRecord, AppError> {
  let cached = connection
    .query_row(
      "
      select source_date, rate, primary_source, secondary_rate, secondary_source,
        variance_pct, status, message
      from fx_rate_cache
      where rate_date = ?1 and from_currency = ?2 and to_currency = ?3
      ",
      params![key.rate_date, key.from_currency, key.to_currency],
      |row| {
        Ok((
          row.get::<_, Option<String>>(0)?,
          row.get::<_, f64>(1)?,
          row.get::<_, String>(2)?,
          row.get::<_, Option<f64>>(3)?,
          row.get::<_, Option<String>>(4)?,
          row.get::<_, Option<f64>>(5)?,
          row.get::<_, String>(6)?,
          row.get::<_, Option<String>>(7)?,
        ))
      },
    )
    .optional()?;
  let override_row = connection
    .query_row(
      "
      select rate, reason
      from fx_rate_overrides
      where rate_date = ?1 and from_currency = ?2 and to_currency = ?3
      ",
      params![key.rate_date, key.from_currency, key.to_currency],
      |row| Ok((row.get::<_, f64>(0)?, row.get::<_, Option<String>>(1)?)),
    )
    .optional()?;

  let mut record = if let Some((source_date, rate, primary_source, secondary_rate, secondary_source, variance_pct, status, message)) = cached {
    FxRateRecord {
      rate_date: key.rate_date.clone(),
      source_date,
      from_currency: key.from_currency.clone(),
      to_currency: key.to_currency.clone(),
      rate: Some(rate),
      primary_source: Some(primary_source),
      secondary_rate,
      secondary_source,
      variance_pct,
      status,
      message,
      is_overridden: false,
      override_reason: None,
    }
  } else {
    FxRateRecord {
      rate_date: key.rate_date.clone(),
      source_date: None,
      from_currency: key.from_currency.clone(),
      to_currency: key.to_currency.clone(),
      rate: None,
      primary_source: None,
      secondary_rate: None,
      secondary_source: None,
      variance_pct: None,
      status: "missing".to_string(),
      message: Some("未获取汇率".to_string()),
      is_overridden: false,
      override_reason: None,
    }
  };

  if let Some((override_rate, override_reason)) = override_row {
    record.rate = Some(override_rate);
    record.status = "ready".to_string();
    record.message = Some("手动单次覆盖".to_string());
    record.is_overridden = true;
    record.override_reason = override_reason;
  }
  Ok(record)
}

#[tauri::command]
fn list_fx_rates(
  keys: Vec<FxRateKeyInput>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<Vec<FxRateRecord>, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  keys.iter().map(|key| fx_rate_record_for_key(&connection, key)).collect()
}

#[tauri::command]
fn save_fx_rate_cache(
  input: SaveFxRateInput,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<FxRateRecord, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let id = make_id(
    "fx_rate",
    &format!("{}|{}|{}", input.rate_date, input.from_currency, input.to_currency),
  );
  connection.execute(
    "
    insert into fx_rate_cache (
      id, rate_date, source_date, from_currency, to_currency, rate, primary_source,
      secondary_rate, secondary_source, variance_pct, status, message, fetched_at, updated_at
    )
    values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, current_timestamp, current_timestamp)
    on conflict(rate_date, from_currency, to_currency) do update set
      source_date = excluded.source_date,
      rate = excluded.rate,
      primary_source = excluded.primary_source,
      secondary_rate = excluded.secondary_rate,
      secondary_source = excluded.secondary_source,
      variance_pct = excluded.variance_pct,
      status = excluded.status,
      message = excluded.message,
      fetched_at = current_timestamp,
      updated_at = current_timestamp
    ",
    params![
      id,
      input.rate_date,
      input.source_date,
      input.from_currency,
      input.to_currency,
      input.rate,
      input.primary_source,
      input.secondary_rate,
      input.secondary_source,
      input.variance_pct,
      input.status,
      input.message
    ],
  )?;
  let key = FxRateKeyInput {
    rate_date: input.rate_date,
    from_currency: input.from_currency,
    to_currency: input.to_currency,
  };
  fx_rate_record_for_key(&connection, &key)
}

#[tauri::command]
fn save_fx_rate_override(
  input: SaveFxOverrideInput,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<FxRateRecord, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  if input.rate <= 0.0 {
    return Err(AppError::InvalidCsvValue("汇率必须大于 0".to_string()));
  }
  let id = make_id(
    "fx_override",
    &format!("{}|{}|{}", input.rate_date, input.from_currency, input.to_currency),
  );
  connection.execute(
    "
    insert into fx_rate_overrides (id, rate_date, from_currency, to_currency, rate, reason, updated_at)
    values (?1, ?2, ?3, ?4, ?5, ?6, current_timestamp)
    on conflict(rate_date, from_currency, to_currency) do update set
      rate = excluded.rate,
      reason = excluded.reason,
      updated_at = current_timestamp
    ",
    params![
      id,
      input.rate_date,
      input.from_currency,
      input.to_currency,
      input.rate,
      input.reason
    ],
  )?;
  let key = FxRateKeyInput {
    rate_date: input.rate_date,
    from_currency: input.from_currency,
    to_currency: input.to_currency,
  };
  fx_rate_record_for_key(&connection, &key)
}

fn lock_fx_rate_row(
  tx: &rusqlite::Transaction<'_>,
  period_month: &str,
  rate_date: &str,
  from_currency: &str,
  to_currency: &str,
  fallback_rate: f64,
) -> Result<(), AppError> {
  if from_currency == to_currency || fallback_rate <= 0.0 {
    return Ok(());
  }
  let cache_row = tx
    .query_row(
      "
      select source_date, rate, primary_source, secondary_rate, variance_pct, status
      from fx_rate_cache
      where rate_date = ?1 and from_currency = ?2 and to_currency = ?3
      ",
      params![rate_date, from_currency, to_currency],
      |row| {
        Ok((
          row.get::<_, Option<String>>(0)?,
          row.get::<_, f64>(1)?,
          row.get::<_, String>(2)?,
          row.get::<_, Option<f64>>(3)?,
          row.get::<_, Option<f64>>(4)?,
          row.get::<_, String>(5)?,
        ))
      },
    )
    .optional()?;
  let override_row = tx
    .query_row(
      "
      select rate
      from fx_rate_overrides
      where rate_date = ?1 and from_currency = ?2 and to_currency = ?3
      ",
      params![rate_date, from_currency, to_currency],
      |row| row.get::<_, f64>(0),
    )
    .optional()?;
  let (source_date, primary_rate, source, secondary_rate, variance_pct, lock_status) =
    if let Some((cache_source_date, cache_rate, cache_source, cache_secondary_rate, cache_variance_pct, cache_status)) = cache_row {
      let active_rate = override_row.unwrap_or(cache_rate);
      (
        cache_source_date,
        active_rate,
        if override_row.is_some() { "manual_override".to_string() } else { cache_source },
        cache_secondary_rate,
        cache_variance_pct,
        if cache_status == "warning" { "locked_warning".to_string() } else { "locked".to_string() },
      )
    } else {
      (
        Some(rate_date.to_string()),
        override_row.unwrap_or(fallback_rate),
        if override_row.is_some() { "manual_override".to_string() } else { "saved_entry_rate".to_string() },
        None,
        None,
        "locked_without_cache".to_string(),
      )
    };
  let lock_id = make_id(
    "fx_lock",
    &format!("{}|{}|{}|{}", period_month, rate_date, from_currency, to_currency),
  );
  tx.execute(
    "
    insert into monthly_fx_rate_locks (
      id, period_month, rate_date, source_date, from_currency, to_currency,
      rate, source, primary_rate, secondary_rate, variance_pct, lock_status, locked_at
    )
    values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, current_timestamp)
    on conflict(period_month, rate_date, from_currency, to_currency) do update set
      source_date = excluded.source_date,
      rate = excluded.rate,
      source = excluded.source,
      primary_rate = excluded.primary_rate,
      secondary_rate = excluded.secondary_rate,
      variance_pct = excluded.variance_pct,
      lock_status = excluded.lock_status,
      locked_at = current_timestamp
    ",
    params![
      lock_id,
      period_month,
      rate_date,
      source_date,
      from_currency,
      to_currency,
      primary_rate,
      source,
      primary_rate,
      secondary_rate,
      variance_pct,
      lock_status
    ],
  )?;
  Ok(())
}

fn lock_month_fx_rates(tx: &rusqlite::Transaction<'_>, period_month: &str) -> Result<(), AppError> {
  tx.execute("delete from monthly_fx_rate_locks where period_month = ?1", params![period_month])?;
  let mut snapshot_statement = tx.prepare(
    "
    select snapshot_date, currency, fx_rate_to_cny
    from monthly_asset_snapshots
    where period_month = ?1 and currency <> 'CNY'
    ",
  )?;
  let snapshot_rows = snapshot_statement
    .query_map(params![period_month], |row| {
      Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
    })?
    .collect::<Result<Vec<_>, _>>()?;
  drop(snapshot_statement);
  for (rate_date, from_currency, rate) in snapshot_rows {
    lock_fx_rate_row(tx, period_month, &rate_date, &from_currency, "CNY", rate)?;
  }

  let mut cashflow_statement = tx.prepare(
    "
    select flow_date, currency, fx_rate_to_cny
    from investment_cashflows
    where period_month = ?1 and currency <> 'CNY'
    ",
  )?;
  let cashflow_rows = cashflow_statement
    .query_map(params![period_month], |row| {
      Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
    })?
    .collect::<Result<Vec<_>, _>>()?;
  drop(cashflow_statement);
  for (rate_date, from_currency, rate) in cashflow_rows {
    lock_fx_rate_row(tx, period_month, &rate_date, &from_currency, "CNY", rate)?;
  }

  let mut cached_statement = tx.prepare(
    "
    select rate_date, from_currency, to_currency, rate
    from fx_rate_cache
    where substr(rate_date, 1, 7) = ?1
    ",
  )?;
  let cached_rows = cached_statement
    .query_map(params![period_month], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, f64>(3)?,
      ))
    })?
    .collect::<Result<Vec<_>, _>>()?;
  drop(cached_statement);
  for (rate_date, from_currency, to_currency, rate) in cached_rows {
    lock_fx_rate_row(tx, period_month, &rate_date, &from_currency, &to_currency, rate)?;
  }
  Ok(())
}

fn copy_query_rows(
  source: &Connection,
  target: &Connection,
  table: &str,
  query: &str,
  bind_values: Vec<Value>,
) -> Result<usize, AppError> {
  let mut source_statement = source.prepare(query)?;
  let column_names: Vec<String> = source_statement
    .column_names()
    .iter()
    .map(|name| name.to_string())
    .collect();
  if column_names.is_empty() {
    return Ok(0);
  }
  let placeholders = std::iter::repeat("?")
    .take(column_names.len())
    .collect::<Vec<_>>()
    .join(", ");
  let insert_sql = format!(
    "insert or replace into {} ({}) values ({})",
    table,
    column_names.join(", "),
    placeholders
  );
  let mut rows = source_statement.query(params_from_iter(bind_values.iter()))?;
  let mut copied_count = 0_usize;
  while let Some(row) = rows.next()? {
    let mut values = Vec::with_capacity(column_names.len());
    for index in 0..column_names.len() {
      values.push(row.get::<_, Value>(index)?);
    }
    target.execute(&insert_sql, params_from_iter(values.iter()))?;
    copied_count += 1;
  }
  Ok(copied_count)
}

fn copy_full_table(source: &Connection, target: &Connection, table: &str) -> Result<usize, AppError> {
  copy_query_rows(source, target, table, &format!("select * from {}", table), Vec::new())
}

fn copy_period_table(
  source: &Connection,
  target: &Connection,
  table: &str,
  period_column: &str,
  period_month: &str,
) -> Result<usize, AppError> {
  target.execute(
    &format!("delete from {} where {} = ?1", table, period_column),
    params![period_month],
  )?;
  copy_query_rows(
    source,
    target,
    table,
    &format!("select * from {} where {} = ?1", table, period_column),
    vec![Value::Text(period_month.to_string())],
  )
}

fn publish_month_to_dashboard(
  work_connection: &Connection,
  dashboard_connection: &Connection,
  period_month: &str,
) -> Result<(), AppError> {
  dashboard_connection.execute_batch("pragma foreign_keys = off;")?;
  for table in [
    "app_settings",
    "categories",
    "category_mappings",
    "asset_categories",
    "tags",
    "assets",
    "asset_tag_links",
    "dca_plans",
    "credit_cards",
    "content_templates",
    "fx_rate_cache",
    "fx_rate_overrides",
  ] {
    copy_full_table(work_connection, dashboard_connection, table)?;
  }

  copy_query_rows(
    work_connection,
    dashboard_connection,
    "import_batches",
    "
    select *
    from import_batches
    where id in (
      select distinct batch_id
      from raw_transactions
      where substr(transaction_date, 1, 7) = ?1
    )
    ",
    vec![Value::Text(period_month.to_string())],
  )?;
  dashboard_connection.execute(
    "delete from raw_transactions where substr(transaction_date, 1, 7) = ?1",
    params![period_month],
  )?;
  copy_query_rows(
    work_connection,
    dashboard_connection,
    "raw_transactions",
    "select * from raw_transactions where substr(transaction_date, 1, 7) = ?1",
    vec![Value::Text(period_month.to_string())],
  )?;

  for (table, column) in [
    ("monthly_step_status", "period_month"),
    ("confirmed_transactions", "period_month"),
    ("monthly_asset_snapshots", "period_month"),
    ("investment_cashflows", "period_month"),
    ("monthly_dca_cashflow_overrides", "period_month"),
    ("monthly_credit_card_entries", "period_month"),
    ("credit_card_adjustments", "period_month"),
    ("monthly_update_runs", "period_month"),
    ("monthly_closes", "period_month"),
    ("monthly_fx_rate_locks", "period_month"),
    ("template_render_logs", "period_month"),
  ] {
    copy_period_table(work_connection, dashboard_connection, table, column, period_month)?;
  }
  dashboard_connection.execute_batch("pragma foreign_keys = on;")?;
  Ok(())
}

#[tauri::command]
fn generate_monthly_analysis(
  period_month: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MonthlyStepStatus, AppError> {
  let mut work_connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&work_connection, &security)?;
  let (year, month) = parse_period(&period_month);
  let close_date = format!("{}-{:02}-{:02}", year, month, days_in_month(year, month));
  let tx = work_connection.transaction()?;
  let close_id = make_id("monthly_close", &period_month);
  tx.execute(
    "
    insert into monthly_closes (
      id, period_month, close_date, status, version_no, confirmed_at, note
    )
    values (?1, ?2, ?3, 'generated', 1, current_timestamp, '本月分析已生成')
    on conflict(period_month) do update set
      close_date = excluded.close_date,
      status = excluded.status,
      confirmed_at = current_timestamp,
      note = excluded.note,
      updated_at = current_timestamp
    ",
    params![close_id, &period_month, close_date],
  )?;
  tx.execute(
    "
    insert into audit_logs (id, entity_type, entity_id, action, old_value_json, new_value_json)
    values (?1, 'monthly_closes', ?2, 'generate_monthly_analysis', null, ?3)
    ",
    params![
      make_unique_id("audit", &format!("monthly_close|{}", period_month)),
      period_month,
      serde_json::json!({ "status": "generated" }).to_string()
    ],
  )?;
  tx.execute(
    "
    insert into monthly_update_runs (period_month, status, completed_at, updated_at)
    values (?1, 'generated', current_timestamp, current_timestamp)
    on conflict(period_month) do update set
      status = excluded.status,
      completed_at = current_timestamp,
      updated_at = current_timestamp
    ",
    params![&period_month],
  )?;
  set_step_status(&tx, &period_month, "final", true)?;
  lock_month_fx_rates(&tx, &period_month)?;
  tx.commit()?;
  let status = build_monthly_step_status(&work_connection, &period_month)?;

  if db.split_databases {
    let dashboard_connection = db.dashboard_connection.lock().expect("database mutex poisoned");
    publish_month_to_dashboard(&work_connection, &dashboard_connection, &period_month)?;
  }

  Ok(status)
}

fn next_period_month(period_month: &str) -> String {
  let (year, month) = parse_period(period_month);
  let date_month = if month >= 12 { 1 } else { month + 1 };
  let date_year = if month >= 12 { year + 1 } else { year };
  format!("{}-{:02}", date_year, date_month)
}

fn asset_entry_items_for_connection(connection: &Connection, period_month: &str) -> Result<Vec<AssetEntryItem>, AppError> {
  let previous_month = latest_monthly_update_run_before(connection, period_month)?
    .unwrap_or_default();
  let mut statement = connection.prepare(
    "
    select
      a.id,
      a.name,
      a.asset_type,
      a.main_asset_category_id,
      a.sub_asset_category_id,
      main.name,
      sub.name,
      coalesce(group_concat(t.name, '、'), ''),
      a.currency,
      a.platform,
      case
        when a.is_dca = 1 then 1
        when exists (select 1 from dca_plans dp where dp.asset_id = a.id and dp.is_active = 1) then 1
        when exists (select 1 from investment_cashflows ic where ic.asset_id = a.id and ic.source_kind = 'dca_auto') then 1
        else 0
      end as effective_is_dca,
      a.status,
      a.note,
      coalesce(mas.original_amount, 0),
      coalesce(mas.status, 'held'),
      ?2,
      coalesce(prev_mas.original_amount, 0),
      coalesce(prev_mas.status, 'missing'),
      case when mas.id is null then 0 else 1 end
    from assets a
    join asset_categories main on main.id = a.main_asset_category_id
    left join asset_categories sub on sub.id = a.sub_asset_category_id
    left join asset_tag_links atl on atl.asset_id = a.id
    left join tags t on t.id = atl.tag_id
    left join monthly_asset_snapshots mas on mas.asset_id = a.id
      and mas.period_month = ?1
      and mas.version_no = 1
    left join monthly_asset_snapshots prev_mas on prev_mas.asset_id = a.id
      and prev_mas.period_month = ?2
      and prev_mas.version_no = 1
    where a.status = 'active'
      and coalesce(a.monthly_update_managed, 0) = 1
    group by a.id
    order by main.sort_order, sub.sort_order, a.name
    ",
  )?;
  let mut rows = statement
    .query_map(params![period_month, previous_month], |row| {
      Ok(AssetEntryItem {
        id: row.get(0)?,
        name: row.get(1)?,
        asset_type: row.get(2)?,
        main_asset_category_id: row.get(3)?,
        sub_asset_category_id: row.get(4)?,
        main_category: row.get(5)?,
        sub_category: row.get(6)?,
        tags: row.get(7)?,
        currency: row.get(8)?,
        platform: row.get(9)?,
        is_dca: row.get::<_, i64>(10)? == 1,
        asset_status: row.get(11)?,
        note: row.get(12)?,
        month_end_amount: row.get(13)?,
        month_status: row.get(14)?,
        previous_snapshot_month: row.get(15)?,
        previous_month_amount: row.get(16)?,
        previous_month_status: row.get(17)?,
        confirmed: row.get::<_, i64>(18)? == 1,
        dca_plans: Vec::new(),
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  drop(statement);
  for item in rows.iter_mut() {
    item.dca_plans = asset_dca_plans(connection, &item.id)?;
    if !item.dca_plans.is_empty() {
      item.is_dca = true;
    }
  }
  Ok(rows)
}

#[tauri::command]
fn get_asset_entry_items(
  period_month: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<Vec<AssetEntryItem>, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  asset_entry_items_for_connection(&connection, &period_month)
}

#[tauri::command]
fn reset_asset_month_entries(
  period_month: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MonthlyStepStatus, AppError> {
  let mut connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let tx = connection.transaction()?;
  tx.execute(
    "delete from monthly_asset_snapshots where period_month = ?1",
    params![&period_month],
  )?;
  tx.execute(
    "
    delete from investment_cashflows
    where period_month = ?1
      and source_kind in ('monthly_asset_entry', 'dca_auto')
    ",
    params![&period_month],
  )?;
  tx.execute(
    "delete from monthly_dca_cashflow_overrides where period_month = ?1",
    params![&period_month],
  )?;
  tx.execute(
    "
    update assets
    set status = 'inactive',
      monthly_update_managed = 0,
      updated_at = current_timestamp
    where coalesce(monthly_update_managed, 0) = 1
      and id not in (
        select distinct mas.asset_id
        from monthly_asset_snapshots mas
        join monthly_update_runs mur on mur.period_month = mas.period_month
      )
    ",
    [],
  )?;
  set_step_status(&tx, &period_month, "assets", false)?;
  set_step_status(&tx, &period_month, "final", false)?;
  tx.commit()?;
  build_monthly_step_status(&connection, &period_month)
}

#[tauri::command]
fn create_asset(
  input: NewAssetInput,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<AssetEntryItem, AppError> {
  let mut connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let tx = connection.transaction()?;
  let normalized_platform = input.platform.clone().unwrap_or_default();
  let existing_asset_id: Option<String> = tx
    .query_row(
      "
      select id
      from assets
      where name = ?1
        and coalesce(platform, '') = ?2
      order by created_at
      limit 1
      ",
      params![input.name, normalized_platform],
      |row| row.get(0),
    )
    .optional()?;
  let asset_id = existing_asset_id.unwrap_or_else(|| {
    make_id(
      "asset",
      &format!(
        "{}|{}|{:?}",
        input.name,
        input.platform.clone().unwrap_or_default(),
        SystemTime::now()
      ),
    )
  });
  tx.execute(
    "
    insert into assets (
      id, name, asset_type, main_asset_category_id, sub_asset_category_id,
      currency, platform, is_dca, status, note, monthly_update_managed
    )
    values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1)
    on conflict(id) do update set
      name = excluded.name,
      asset_type = excluded.asset_type,
      main_asset_category_id = excluded.main_asset_category_id,
      sub_asset_category_id = excluded.sub_asset_category_id,
      currency = excluded.currency,
      platform = excluded.platform,
      is_dca = excluded.is_dca,
      status = excluded.status,
      note = excluded.note,
      monthly_update_managed = 1,
      updated_at = current_timestamp
    ",
    params![
      asset_id,
      input.name,
      input.asset_type,
      input.main_asset_category_id,
      input.sub_asset_category_id,
      input.currency,
      input.platform,
      if input.is_dca { 1 } else { 0 },
      input.status,
      input.note
    ],
  )?;

  tx.execute("delete from asset_tag_links where asset_id = ?1", params![asset_id])?;
  tx.execute(
    "update dca_plans set is_active = 0, updated_at = current_timestamp where asset_id = ?1",
    params![asset_id],
  )?;
  for tag_name in input.tags.iter().filter(|name| !name.trim().is_empty()) {
    let tag_id = make_id("tag", tag_name.trim());
    tx.execute(
      "
      insert into tags (id, name, group_name, is_system)
      values (?1, ?2, '自定义', 0)
      on conflict(name) do nothing
      ",
      params![tag_id, tag_name.trim()],
    )?;
    let actual_tag_id: String = tx.query_row(
      "select id from tags where name = ?1",
      params![tag_name.trim()],
      |row| row.get(0),
    )?;
    tx.execute(
      "insert or ignore into asset_tag_links (asset_id, tag_id) values (?1, ?2)",
      params![asset_id, actual_tag_id],
    )?;
  }

  for (index, plan) in input.dca_plans.iter().enumerate() {
    if input.is_dca {
      let plan_id = make_id("dca", &format!("{}|{}|{}", asset_id, index, plan.start_date));
      tx.execute(
        "
        insert into dca_plans (
          id, asset_id, name, frequency, amount, currency, start_date, end_date,
          weekly_rules_json, monthly_day, is_active
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1)
        ",
        params![
          plan_id,
          asset_id,
          format!("{} 定投 {}", input.name, index + 1),
          plan.frequency,
          plan.amount,
          input.currency,
          plan.start_date,
          plan.end_date,
          plan.weekly_rules_json,
          plan.monthly_day
        ],
      )?;
    }
  }
  tx.commit()?;

  let mut item = connection.query_row(
    "
    select
      a.id,
      a.name,
      a.asset_type,
      a.main_asset_category_id,
      a.sub_asset_category_id,
      main.name,
      sub.name,
      coalesce(group_concat(t.name, '、'), ''),
      a.currency,
      a.platform,
      a.is_dca,
      a.status,
      a.note,
      0.0,
      'held',
      '',
      0.0,
      'missing'
    from assets a
    join asset_categories main on main.id = a.main_asset_category_id
    left join asset_categories sub on sub.id = a.sub_asset_category_id
    left join asset_tag_links atl on atl.asset_id = a.id
    left join tags t on t.id = atl.tag_id
    where a.id = ?1
    group by a.id
    ",
    params![asset_id],
    |row| {
      Ok(AssetEntryItem {
        id: row.get(0)?,
        name: row.get(1)?,
        asset_type: row.get(2)?,
        main_asset_category_id: row.get(3)?,
        sub_asset_category_id: row.get(4)?,
        main_category: row.get(5)?,
        sub_category: row.get(6)?,
        tags: row.get(7)?,
        currency: row.get(8)?,
        platform: row.get(9)?,
        is_dca: row.get::<_, i64>(10)? == 1,
        asset_status: row.get(11)?,
        note: row.get(12)?,
        month_end_amount: row.get(13)?,
        month_status: row.get(14)?,
        previous_snapshot_month: row.get(15)?,
        previous_month_amount: row.get(16)?,
        previous_month_status: row.get(17)?,
        confirmed: false,
        dca_plans: Vec::new(),
      })
    },
  )?;
  item.dca_plans = asset_dca_plans(&connection, &item.id)?;
  Ok(item)
}

#[tauri::command]
fn delete_asset(
  asset_id: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<(), AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  connection.execute(
    "update assets set status = 'inactive', updated_at = current_timestamp where id = ?1",
    params![asset_id],
  )?;
  Ok(())
}

fn save_asset_month_entries_for_connection(
  connection: &mut Connection,
  period_month: &str,
  entries: &[AssetMonthEntryInput],
) -> Result<MonthlyStepStatus, AppError> {
  let tx = connection.transaction()?;
  let snapshot_date = month_end_date(&period_month);

  for entry in entries.iter() {
    if let Some(name) = entry.name.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
      tx.execute(
        "
        update assets
        set name = ?1,
          asset_type = coalesce(?2, asset_type),
          main_asset_category_id = coalesce(?3, main_asset_category_id),
          sub_asset_category_id = ?4,
          currency = ?5,
          platform = ?6,
          is_dca = ?7,
          note = ?8,
          monthly_update_managed = 1,
          updated_at = current_timestamp
        where id = ?9
        ",
        params![
          name,
          entry.asset_type,
          entry.main_asset_category_id,
          entry.sub_asset_category_id,
          entry.currency,
          entry.platform,
          if entry.is_dca { 1 } else { 0 },
          entry.note,
          entry.asset_id
        ],
      )?;
      tx.execute("delete from asset_tag_links where asset_id = ?1", params![entry.asset_id])?;
      for tag_name in entry.tags.iter().filter(|name| !name.trim().is_empty()) {
        let tag_id = make_id("tag", tag_name.trim());
        tx.execute(
          "
          insert into tags (id, name, group_name, is_system)
          values (?1, ?2, '自定义', 0)
          on conflict(name) do nothing
          ",
          params![tag_id, tag_name.trim()],
        )?;
        let actual_tag_id: String = tx.query_row(
          "select id from tags where name = ?1",
          params![tag_name.trim()],
          |row| row.get(0),
        )?;
        tx.execute(
          "insert or ignore into asset_tag_links (asset_id, tag_id) values (?1, ?2)",
          params![entry.asset_id, actual_tag_id],
        )?;
      }
    }

    if entry.is_dca && entry.dca_plans.is_empty() {
      return Err(AppError::InvalidCsvValue(format!(
        "{} 已勾选定投，但没有配置定投计划",
        entry.name.clone().unwrap_or_else(|| entry.asset_id.clone())
      )));
    }
    tx.execute(
      "update dca_plans set is_active = 0, updated_at = current_timestamp where asset_id = ?1",
      params![entry.asset_id],
    )?;
    if entry.is_dca {
      for (index, plan) in entry.dca_plans.iter().enumerate() {
        let plan_id = plan
          .id
          .clone()
          .unwrap_or_else(|| make_id("dca", &format!("{}|{}|{}|{}", entry.asset_id, index, plan.start_date, plan.amount)));
        tx.execute(
          "
          insert into dca_plans (
            id, asset_id, name, frequency, amount, currency, start_date, end_date,
            weekly_rules_json, monthly_day, is_active
          )
          values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1)
          on conflict(id) do update set
            frequency = excluded.frequency,
            amount = excluded.amount,
            currency = excluded.currency,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            weekly_rules_json = excluded.weekly_rules_json,
            monthly_day = excluded.monthly_day,
            is_active = 1,
            updated_at = current_timestamp
          ",
          params![
            plan_id,
            entry.asset_id,
            format!("定投计划 {}", index + 1),
            plan.frequency,
            plan.amount,
            entry.currency,
            plan.start_date,
            plan.end_date,
            plan.weekly_rules_json,
            plan.monthly_day
          ],
        )?;
      }
    }

    let status = match entry.status.trim() {
      "cleared" => "cleared".to_string(),
      "excluded" => "excluded".to_string(),
      "held" | "" => "held".to_string(),
      other => {
        return Err(AppError::InvalidCsvValue(format!(
          "资产 {} 的本月状态无效：{}",
          entry.name.clone().unwrap_or_else(|| entry.asset_id.clone()),
          other
        )));
      }
    };
    let snapshot_id = make_id(
      "asset_snapshot",
      &format!("{}|{}|v1", entry.asset_id, period_month),
    );
    let snapshot_amount_cny = if entry.amount_cny.abs() > 0.000_001 {
      entry.amount_cny
    } else {
      entry.month_end_amount * entry.fx_rate_to_cny
    };
    tx.execute(
      "
      insert into monthly_asset_snapshots (
        id, asset_id, period_month, snapshot_date, original_amount,
        currency, fx_rate_to_cny, amount_cny, status, version_no, note
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, '用户月末录入')
      on conflict(asset_id, period_month, version_no) do update set
        snapshot_date = excluded.snapshot_date,
        original_amount = excluded.original_amount,
        currency = excluded.currency,
        fx_rate_to_cny = excluded.fx_rate_to_cny,
        amount_cny = excluded.amount_cny,
        status = excluded.status,
        note = excluded.note,
        updated_at = current_timestamp
      ",
      params![
        snapshot_id,
        entry.asset_id,
        &period_month,
        snapshot_date,
        entry.month_end_amount,
        entry.currency,
        entry.fx_rate_to_cny,
        snapshot_amount_cny,
        status
      ],
    )?;

    tx.execute(
      "
      delete from investment_cashflows
      where asset_id = ?1
        and period_month = ?2
        and source_kind in ('monthly_asset_entry', 'dca_auto')
      ",
      params![entry.asset_id, period_month],
    )?;

    let flow_date = format!("{}-28", period_month);
    let mut cashflows = entry.cashflows.clone();
    if cashflows.is_empty() {
      for (flow_type, amount, note) in [
        ("buy", entry.extra_buy, "额外买入"),
        ("sell", entry.sell, "卖出"),
        ("dividend", entry.dividend, "分红"),
      ] {
        if amount.abs() > 0.000_001 {
          cashflows.push(AssetCashflowInput {
            id: None,
            asset_id: entry.asset_id.clone(),
            flow_date: flow_date.clone(),
            flow_type: flow_type.to_string(),
            amount,
            currency: entry.currency.clone(),
            fx_rate_to_cny: entry.fx_rate_to_cny,
            amount_cny: amount * entry.fx_rate_to_cny,
            source_kind: "monthly_asset_entry".to_string(),
            dca_plan_id: None,
            note: Some(note.to_string()),
            included: true,
          });
        }
      }
    }

    for cashflow in cashflows.iter().filter(|item| item.source_kind == "dca_auto") {
      let override_id = dca_override_id(
        &cashflow.asset_id,
        &period_month,
        &cashflow.flow_date,
        cashflow.dca_plan_id.as_deref(),
      );
      tx.execute(
        "
        insert into monthly_dca_cashflow_overrides (
          id, asset_id, period_month, flow_date, dca_plan_id,
          amount, currency, included, note, updated_at
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, current_timestamp)
        on conflict(id) do update set
          amount = excluded.amount,
          currency = excluded.currency,
          included = excluded.included,
          note = excluded.note,
          updated_at = current_timestamp
        ",
        params![
          override_id,
          cashflow.asset_id,
          period_month,
          cashflow.flow_date,
          cashflow.dca_plan_id,
          cashflow.amount,
          cashflow.currency,
          if cashflow.included { 1 } else { 0 },
          cashflow.note
        ],
      )?;
    }

    for cashflow in cashflows.iter().filter(|item| item.included && item.amount.abs() > 0.000_001) {
      let cashflow_amount_cny = if cashflow.amount_cny.abs() > 0.000_001 {
        cashflow.amount_cny
      } else {
        cashflow.amount * cashflow.fx_rate_to_cny
      };
      let flow_id = make_id(
        "cashflow",
        &format!(
          "{}|{}|{}|{}|{}|{}",
          cashflow.asset_id,
          period_month,
          cashflow.flow_date,
          cashflow.flow_type,
          cashflow.amount,
          cashflow.source_kind
        ),
      );
      tx.execute(
        "
          insert into investment_cashflows (
            id, asset_id, period_month, flow_date, flow_type, amount,
            currency, fx_rate_to_cny, amount_cny, source_kind, dca_plan_id, note
          )
          values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
          ",
        params![
          flow_id,
          cashflow.asset_id,
          period_month,
          cashflow.flow_date,
          cashflow.flow_type,
          cashflow.amount,
          cashflow.currency,
          cashflow.fx_rate_to_cny,
          cashflow_amount_cny,
          cashflow.source_kind,
          cashflow.dca_plan_id,
          cashflow.note
        ],
      )?;
    }
  }

  let all_confirmed = !entries.is_empty() && entries.iter().all(|entry| entry.confirmed);
  set_step_status(&tx, &period_month, "assets", all_confirmed)?;
  tx.commit()?;

  build_monthly_step_status(connection, period_month)
}

#[tauri::command]
fn save_asset_month_entries(
  period_month: String,
  entries: Vec<AssetMonthEntryInput>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MonthlyStepStatus, AppError> {
  let mut connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  save_asset_month_entries_for_connection(&mut connection, &period_month, &entries)
}

fn generated_dca_cashflows_for_connection(connection: &Connection, period_month: &str) -> Result<Vec<GeneratedDcaCashflow>, AppError> {
  let (year, month) = parse_period(period_month);
  let month_days = days_in_month(year, month);
  let month_start = format!("{}-{:02}-01", year, month);
  let month_end = format!("{}-{:02}-{:02}", year, month, month_days);
  let mut statement = connection.prepare(
    "
    select
      dp.id,
      dp.asset_id,
      a.name,
      dp.name,
      dp.frequency,
      dp.amount,
      dp.currency,
      dp.start_date,
      dp.end_date,
      dp.weekly_rules_json,
      dp.monthly_day
    from dca_plans dp
    join assets a on a.id = dp.asset_id
    where dp.is_active = 1
      and a.status = 'active'
      and coalesce(a.monthly_update_managed, 0) = 1
      and dp.start_date <= ?2
      and (dp.end_date is null or dp.end_date >= ?1)
    order by a.name, dp.start_date
    ",
  )?;
  let rows = statement.query_map(params![month_start, month_end], |row| {
    Ok((
      row.get::<_, String>(0)?,
      row.get::<_, String>(1)?,
      row.get::<_, String>(2)?,
      row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "定投计划".to_string()),
      row.get::<_, String>(4)?,
      row.get::<_, f64>(5)?,
      row.get::<_, String>(6)?,
      row.get::<_, String>(7)?,
      row.get::<_, Option<String>>(8)?,
      row.get::<_, Option<String>>(9)?,
      row.get::<_, Option<i64>>(10)?,
    ))
  })?;

  let mut generated = Vec::new();
  for row in rows {
    let (plan_id, asset_id, asset_name, plan_name, frequency, amount, currency, start_date, end_date, weekly_rules_json, monthly_day) = row?;
    match frequency.as_str() {
      "daily" => {
        for day in 1..=month_days {
          let date = format!("{}-{:02}-{:02}", year, month, day);
          let weekday = iso_weekday(year, month, day);
          if date_in_range(&date, &start_date, end_date.as_deref())
            && weekday <= 5
            && !is_china_public_holiday(&date)
          {
            generated.push(GeneratedDcaCashflow {
              id: make_id("dca_flow", &format!("{}|{}", plan_id, date)),
              asset_id: asset_id.clone(),
              asset_name: asset_name.clone(),
              flow_date: date,
              flow_type: "buy".to_string(),
              amount,
              currency: currency.clone(),
              source_kind: "dca_auto".to_string(),
              dca_plan_id: Some(plan_id.clone()),
              note: Some(plan_name.clone()),
              included: true,
            });
          }
        }
      }
      "weekly" => {
        let mut weekly_rules: Vec<(i64, f64)> = Vec::new();
        if let Some(raw_rules) = weekly_rules_json.as_deref() {
          if let Ok(value) = serde_json::from_str::<serde_json::Value>(raw_rules) {
            if let Some(array) = value.as_array() {
              for item in array {
                if let Some(weekday) = item.get("weekday").and_then(|value| value.as_i64()) {
                  let rule_amount = item.get("amount").and_then(|value| value.as_f64()).unwrap_or(amount);
                  weekly_rules.push((weekday, rule_amount));
                }
              }
            }
          }
        }
        if weekly_rules.is_empty() {
          weekly_rules.push((1, amount));
        }
        for day in 1..=month_days {
          let date = format!("{}-{:02}-{:02}", year, month, day);
          if !date_in_range(&date, &start_date, end_date.as_deref()) {
            continue;
          }
          let weekday = iso_weekday(year, month, day);
          for (rule_weekday, rule_amount) in weekly_rules.iter() {
            if weekday == *rule_weekday {
              generated.push(GeneratedDcaCashflow {
                id: make_id("dca_flow", &format!("{}|{}|{}", plan_id, date, rule_weekday)),
                asset_id: asset_id.clone(),
                asset_name: asset_name.clone(),
                flow_date: date.clone(),
                flow_type: "buy".to_string(),
                amount: *rule_amount,
                currency: currency.clone(),
                source_kind: "dca_auto".to_string(),
                dca_plan_id: Some(plan_id.clone()),
                note: Some(plan_name.clone()),
                included: true,
              });
            }
          }
        }
      }
      _ => {
        let day = monthly_day.unwrap_or(1).max(1).min(month_days);
        let date = format!("{}-{:02}-{:02}", year, month, day);
        if date_in_range(&date, &start_date, end_date.as_deref()) {
          generated.push(GeneratedDcaCashflow {
            id: make_id("dca_flow", &format!("{}|{}", plan_id, date)),
            asset_id,
            asset_name,
            flow_date: date,
            flow_type: "buy".to_string(),
            amount,
            currency,
            source_kind: "dca_auto".to_string(),
            dca_plan_id: Some(plan_id),
            note: Some(plan_name),
            included: true,
          });
        }
      }
    }
  }
  for flow in generated.iter_mut() {
    let override_id = dca_override_id(
      &flow.asset_id,
      period_month,
      &flow.flow_date,
      flow.dca_plan_id.as_deref(),
    );
    if let Some((amount, currency, included, note)) = connection
      .query_row(
        "
        select amount, currency, included, note
        from monthly_dca_cashflow_overrides
        where id = ?1
        ",
        params![override_id],
        |row| {
          Ok((
            row.get::<_, f64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, Option<String>>(3)?,
          ))
        },
      )
      .optional()?
    {
      flow.amount = amount;
      flow.currency = currency;
      flow.included = included == 1;
      flow.note = note;
    }
  }
  Ok(generated)
}

#[tauri::command]
fn get_generated_dca_cashflows(
  period_month: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<Vec<GeneratedDcaCashflow>, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  generated_dca_cashflows_for_connection(&connection, &period_month)
}

#[tauri::command]
fn get_asset_cashflows_for_month(
  period_month: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<Vec<GeneratedDcaCashflow>, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let mut statement = connection.prepare(
    "
    select
      ic.id,
      ic.asset_id,
      a.name,
      ic.flow_date,
      ic.flow_type,
      ic.amount,
      ic.currency,
      ic.source_kind,
      ic.dca_plan_id,
      ic.note
    from investment_cashflows ic
    join assets a on a.id = ic.asset_id
    where ic.period_month = ?1
    order by a.name, ic.flow_date, ic.flow_type
    ",
  )?;
  let rows = statement
    .query_map(params![period_month], |row| {
      Ok(GeneratedDcaCashflow {
        id: row.get(0)?,
        asset_id: row.get(1)?,
        asset_name: row.get(2)?,
        flow_date: row.get(3)?,
        flow_type: row.get(4)?,
        amount: row.get(5)?,
        currency: row.get(6)?,
        source_kind: row.get(7)?,
        dca_plan_id: row.get(8)?,
        note: row.get(9)?,
        included: true,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

#[tauri::command]
fn get_credit_card_entries(
  period_month: String,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<Vec<CreditCardEntry>, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let previous_month = previous_period_month(&period_month);
  let count: i64 = connection.query_row("select count(*) from credit_cards", [], |row| row.get(0))?;
  if count == 0 {
    connection.execute(
      "insert into credit_cards (id, name, institution, note, is_active) values ('cc_default', '信用卡', null, '默认信用卡', 1)",
      [],
    )?;
  } else {
    connection.execute(
      "
      update credit_cards
      set name = '信用卡',
        institution = null,
        note = coalesce(note, '默认信用卡'),
        updated_at = current_timestamp
      where id = 'cc_default'
        or name in ('默认信用卡', '待补充信用卡', '待补充')
      ",
      [],
    )?;
  }
  connection.execute(
    "insert or ignore into credit_cards (id, name, institution, note, is_active) values ('cc_default', '信用卡', null, '默认信用卡', 1)",
    [],
  )?;
  let mut statement = connection.prepare(
    "
    select
      cc.id, cc.name, cc.institution, cc.note, cc.is_active,
      coalesce(e.billed_amount, 0),
      coalesce(e.unbilled_amount, 0),
      case
        when coalesce(e.previous_unbilled_override, 0) = 1 then coalesce(e.previous_unbilled_amount, 0)
        else coalesce(
          prev.unbilled_amount,
          (
            select prev_by_name.unbilled_amount
            from monthly_credit_card_entries prev_by_name
            join credit_cards prev_card on prev_card.id = prev_by_name.credit_card_id
            where prev_by_name.period_month = ?2
              and prev_card.name = cc.name
            limit 1
          ),
          0
        )
      end,
      coalesce(e.previous_unbilled_override, 0),
      e.previous_unbilled_override_reason,
      case
        when prev.credit_card_id is not null then 1
        when exists (
          select 1
          from monthly_credit_card_entries prev_by_name
          join credit_cards prev_card on prev_card.id = prev_by_name.credit_card_id
          where prev_by_name.period_month = ?2
            and prev_card.name = cc.name
        ) then 1
        else 0
      end,
      coalesce(e.net_adjustment, 0),
      coalesce(e.confirmed, 0)
    from credit_cards cc
    left join monthly_credit_card_entries e on e.credit_card_id = cc.id and e.period_month = ?1
    left join monthly_credit_card_entries prev on prev.credit_card_id = cc.id and prev.period_month = ?2
    where cc.is_active = 1
      and (
        cc.id = 'cc_default'
        or e.credit_card_id is not null
        or prev.credit_card_id is not null
        or exists (
          select 1
          from monthly_credit_card_entries history
          where history.credit_card_id = cc.id
        )
      )
    order by cc.is_active desc, cc.name
    ",
  )?;
  let rows = statement
    .query_map(params![period_month, previous_month], |row| {
      Ok(CreditCardEntry {
        id: row.get(0)?,
        name: row.get(1)?,
        institution: row.get(2)?,
        note: row.get(3)?,
        is_active: row.get::<_, i64>(4)? == 1,
        billed_amount: row.get(5)?,
        unbilled_amount: row.get(6)?,
        previous_unbilled_amount: row.get(7)?,
        previous_unbilled_override: row.get::<_, i64>(8)? == 1,
        previous_unbilled_override_reason: row.get(9)?,
        previous_unbilled_source_found: row.get::<_, i64>(10)? == 1,
        net_adjustment: row.get(11)?,
        confirmed: row.get::<_, i64>(12)? == 1,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(rows)
}

#[tauri::command]
fn save_credit_card_entries(
  period_month: String,
  entries: Vec<CreditCardEntry>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<Vec<CreditCardEntry>, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let previous_month = previous_period_month(&period_month);
  let mut saved_entries = Vec::new();
  for entry in entries {
    if entry.previous_unbilled_override
      && entry
        .previous_unbilled_override_reason
        .as_ref()
        .map(|reason| reason.trim().is_empty())
        .unwrap_or(true)
    {
      return Err(AppError::InvalidCsvValue(format!(
        "{} 的上月未出账单手动修正需要填写原因",
        entry.name
      )));
    }
    let card_id = if entry.id.starts_with("new-") {
      make_id("cc", &format!("{}|{:?}", entry.name, SystemTime::now()))
    } else {
      entry.id
    };
    connection.execute(
      "
      insert into credit_cards (id, name, institution, note, is_active)
      values (?1, ?2, ?3, ?4, ?5)
      on conflict(id) do update set
        name = excluded.name,
        institution = excluded.institution,
        note = excluded.note,
        is_active = excluded.is_active,
        updated_at = current_timestamp
      ",
      params![
        card_id,
        entry.name,
        entry.institution,
        entry.note,
        if entry.is_active { 1 } else { 0 }
      ],
    )?;
    let previous_unbilled_amount = if entry.previous_unbilled_override {
      entry.previous_unbilled_amount
    } else {
      connection
        .query_row(
          "
          select e.unbilled_amount
          from monthly_credit_card_entries e
          join credit_cards c on c.id = e.credit_card_id
          where e.period_month = ?2
            and (e.credit_card_id = ?1 or c.name = ?3)
          order by case when e.credit_card_id = ?1 then 0 else 1 end
          limit 1
          ",
          params![card_id, previous_month, entry.name],
          |row| row.get::<_, f64>(0),
        )
        .optional()?
        .unwrap_or(0.0)
    };
    let previous_unbilled_source_found = if entry.previous_unbilled_override {
      entry.previous_unbilled_source_found
    } else {
      connection
        .query_row(
          "
          select count(*)
          from monthly_credit_card_entries e
          join credit_cards c on c.id = e.credit_card_id
          where e.period_month = ?2
            and (e.credit_card_id = ?1 or c.name = ?3)
          ",
          params![card_id, previous_month, entry.name],
          |row| row.get::<_, i64>(0),
        )? > 0
    };
    let net_adjustment = -entry.billed_amount - entry.unbilled_amount + previous_unbilled_amount;
    connection.execute(
      "
      insert into monthly_credit_card_entries (
        id, credit_card_id, period_month, billed_amount, unbilled_amount,
        previous_unbilled_amount, previous_unbilled_override, previous_unbilled_override_reason,
        net_adjustment, note, confirmed
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      on conflict(credit_card_id, period_month) do update set
        billed_amount = excluded.billed_amount,
        unbilled_amount = excluded.unbilled_amount,
        previous_unbilled_amount = excluded.previous_unbilled_amount,
        previous_unbilled_override = excluded.previous_unbilled_override,
        previous_unbilled_override_reason = excluded.previous_unbilled_override_reason,
        net_adjustment = excluded.net_adjustment,
        note = excluded.note,
        confirmed = excluded.confirmed,
        updated_at = current_timestamp
      ",
      params![
        make_id("cc_month", &format!("{}|{}", card_id, period_month)),
        card_id,
        period_month,
        entry.billed_amount,
        entry.unbilled_amount,
        previous_unbilled_amount,
        if entry.previous_unbilled_override { 1 } else { 0 },
        entry.previous_unbilled_override_reason,
        net_adjustment,
        entry.note,
        if entry.confirmed { 1 } else { 0 }
      ],
    )?;
    saved_entries.push(CreditCardEntry {
      id: card_id,
      name: entry.name,
      institution: entry.institution,
      note: entry.note,
      is_active: entry.is_active,
      billed_amount: entry.billed_amount,
      unbilled_amount: entry.unbilled_amount,
      previous_unbilled_amount,
      previous_unbilled_override: entry.previous_unbilled_override,
      previous_unbilled_override_reason: entry.previous_unbilled_override_reason,
      previous_unbilled_source_found,
      net_adjustment,
      confirmed: entry.confirmed,
    });
  }
  set_step_status(&connection, &period_month, "creditCard", true)?;
  Ok(saved_entries)
}

#[tauri::command]
fn get_dashboard_seed_summary(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<DashboardSeedSummary, AppError> {
  let connection = db.dashboard_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let official_start_date = setting_string(&connection, "official_start_date", "2026-04-30")?;
  let target_saving_rate = setting_number(&connection, "target_saving_rate", 0.3)?;
  let snapshot_month = latest_completed_period_month(&connection)?;

  let asset_count: i64 =
    connection.query_row("select count(*) from assets", [], |row| row.get(0))?;

  let asset_gross_value: f64 = connection.query_row(
    "select coalesce(sum(amount_cny), 0) from monthly_asset_snapshots where period_month = ?1 and version_no = 1 and status = 'held'",
    params![snapshot_month],
    |row| row.get(0),
  )?;

  let credit_card_net_adjustment: f64 = connection.query_row(
    "select coalesce(sum(net_adjustment), 0) from monthly_credit_card_entries where period_month = ?1 and confirmed = 1",
    params![snapshot_month],
    |row| row.get(0),
  )?;

  let net_worth = asset_gross_value + credit_card_net_adjustment;
  let confirmed_income: f64 = connection.query_row(
    "
    select coalesce(sum(amount), 0)
    from confirmed_transactions
    where period_month = ?1
      and transaction_type = 'income'
      and include_in_stats = 1
      and confirmation_status = 'confirmed'
    ",
    params![snapshot_month],
    |row| row.get(0),
  )?;
  let confirmed_expense: f64 = connection.query_row(
    "
    select coalesce(sum(amount), 0)
    from confirmed_transactions
    where period_month = ?1
      and transaction_type = 'expense'
      and include_in_stats = 1
      and confirmation_status = 'confirmed'
    ",
    params![snapshot_month],
    |row| row.get(0),
  )?;
  let saving_amount = confirmed_income - confirmed_expense;
  let saving_rate = if confirmed_income > 0.0 {
    saving_amount / confirmed_income
  } else {
    0.0
  };
  let target_saving_amount = confirmed_income * target_saving_rate;

  let (investment_buy, investment_sell, investment_dividend): (f64, f64, f64) = connection.query_row(
    "
    select
      coalesce(sum(case when flow_type = 'buy' then amount_cny else 0 end), 0),
      coalesce(sum(case when flow_type = 'sell' then amount_cny else 0 end), 0),
      coalesce(sum(case when flow_type = 'dividend' then amount_cny else 0 end), 0)
    from investment_cashflows ic
    join assets a on a.id = ic.asset_id
    where ic.period_month = ?1
      and a.main_asset_category_id <> 'asset_cat_cash'
    ",
    params![snapshot_month],
    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
  )?;
  let monthly_trends = dashboard_monthly_trends(&connection)?;
  let investment_return_rate = monthly_trends
    .iter()
    .find(|item| item.period_month == snapshot_month.as_str())
    .and_then(|item| item.investment_return_rate);
  let expense_categories = category_breakdown(&connection, &snapshot_month, "expense")?;
  let expense_category_trends = category_month_amounts(&connection, &snapshot_month, "expense")?;
  let income_categories = category_breakdown(&connection, &snapshot_month, "income")?;
  let expense_year_rank = category_year_rank(&connection, &snapshot_month, "expense")?;
  let income_year_rank = category_year_rank(&connection, &snapshot_month, "income")?;
  let spending_anomalies = spending_anomalies(&connection, &snapshot_month)?;
  let dashboard_custom_settings = setting_dashboard_custom_settings(&connection)?;
  let asset_allocations = asset_allocation_breakdown(&connection, &snapshot_month, None)?;
  let us_equity_allocations = asset_allocation_breakdown(&connection, &snapshot_month, Some("asset_cat_us_equity"))?;
  let custom_allocation_detail_allocations = asset_allocation_breakdown(
    &connection,
    &snapshot_month,
    Some(&dashboard_custom_settings.allocation_detail_parent_id),
  )?;
  let allocation_target_groups = allocation_target_groups(&connection, &snapshot_month)?;
  let asset_allocation_trends = asset_allocation_trends(&connection)?;
  let investment_assets = investment_asset_performance(&connection, &snapshot_month)?;
  let investment_cashflow_calendar = investment_cashflow_calendar(&connection, &snapshot_month)?;
  let mobile_update_month = next_period_month(&snapshot_month);
  let asset_entry_items = asset_entry_items_for_connection(&connection, &mobile_update_month)?;
  let dca_cashflows = generated_dca_cashflows_for_connection(&connection, &mobile_update_month)?;
  let investment_group_performances = investment_group_performances(&connection, &snapshot_month)?;
  let investment_group_trends = investment_group_trends(&connection)?;
  let discretionary_trends = discretionary_trends(&connection)?;
  let privacy_mode = setting_bool(&connection, "security_privacy_mode", false)?;
  let monthly_report_template = default_template_for_type(&connection, "monthly_report")?
    .map(|template| template.content)
    .unwrap_or_else(|| builtin_template_content("monthly_report").to_string());
  let monthly_report_html = wrap_plain_template_html(&render_template_content(
    &connection,
    &monthly_report_template,
    &snapshot_month,
    privacy_mode,
  )?);

  let mut statement = connection.prepare(
    "
    select
      ac.name,
      pti.target_percent,
      coalesce(sum(mas.amount_cny), 0) as current_amount
    from portfolio_target_items pti
    join portfolio_targets pt on pt.id = pti.target_id and pt.is_active = 1
    join asset_categories ac on ac.id = pti.main_asset_category_id
    left join assets a on a.main_asset_category_id = ac.id
	    left join monthly_asset_snapshots mas on mas.asset_id = a.id
	      and mas.period_month = ?1
	      and mas.version_no = 1
	      and mas.status = 'held'
	    group by ac.id, ac.name, pti.target_percent
	    having abs(coalesce(sum(mas.amount_cny), 0)) > 0.000001
	      or pti.target_percent is not null
	    order by ac.sort_order
	    ",
	  )?;

  let mut rows = statement.query(params![snapshot_month])?;
  let mut portfolio_targets = Vec::new();
  while let Some(row) = rows.next()? {
    let category: String = row.get(0)?;
    let target_percent: f64 = row.get(1)?;
    let current_amount: f64 = row.get(2)?;
    let current_percent = if asset_gross_value > 0.0 {
      current_amount / asset_gross_value
    } else {
      0.0
    };

    portfolio_targets.push(PortfolioTargetSummary {
      category,
      target_percent,
      current_amount,
      current_percent,
      deviation_percent: current_percent - target_percent,
    });
  }

  Ok(DashboardSeedSummary {
    official_start_date,
    target_saving_rate,
    asset_count,
    snapshot_month,
    asset_gross_value,
    credit_card_net_adjustment,
    net_worth,
    confirmed_income,
    confirmed_expense,
    saving_amount,
    saving_rate,
    target_saving_amount,
    investment_buy,
    investment_sell,
    investment_dividend,
    investment_return_rate,
    monthly_trends,
    expense_categories,
    expense_category_trends,
    income_categories,
    expense_year_rank,
    income_year_rank,
    spending_anomalies,
    asset_allocations,
    us_equity_allocations,
    custom_allocation_detail_allocations,
    allocation_target_groups,
    asset_allocation_trends,
    investment_assets,
    investment_cashflow_calendar,
    asset_entry_items,
    dca_cashflows,
    investment_group_performances,
    investment_group_trends,
    discretionary_trends,
    monthly_report_html,
    portfolio_targets,
  })
}

#[tauri::command]
fn get_mobile_sync_summary(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MobileSyncSummary, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  read_mobile_sync_summary(&connection, true)
}

#[tauri::command]
fn get_mobile_pairing_info(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MobilePairingInfo, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  let account_id = mobile_account_id(&connection)?;
  let pairing_code = mobile_pairing_code(&connection)?;
  let paired_device_count = connection.query_row(
    "select count(*) from mobile_sync_devices where account_id = ?1",
    params![account_id],
    |row| row.get(0),
  )?;
  let devices = list_mobile_devices(&connection, &account_id)?;
  let pairing_url_path = mobile_pairing_path(&pairing_code);
  Ok(MobilePairingInfo {
    enabled: true,
    mobile_app_version: MOBILE_PWA_VERSION.to_string(),
    account_id,
    pairing_url_path,
    pairing_url: mobile_pairing_url(&pairing_code),
    pairing_code,
    paired_device_count,
    devices,
  })
}

#[tauri::command]
fn reset_mobile_pairing_devices(
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MobilePairingInfo, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  reset_mobile_pairing(&connection)
}

#[tauri::command]
fn mark_mobile_sync_records_reviewed(
  ids: Vec<String>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MobileSyncSummary, AppError> {
  let connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&connection, &security)?;
  for id in ids.iter().map(|value| value.trim()).filter(|value| !value.is_empty()) {
    connection.execute(
      "
      update mobile_sync_inbox
      set sync_status = 'reviewed', reviewed_at = current_timestamp, updated_at = current_timestamp
      where id = ?1
      ",
      params![id],
    )?;
  }
  read_mobile_sync_summary(&connection, true)
}

#[tauri::command]
fn import_cloud_mobile_drafts(
  drafts: Vec<CloudMobileDraftInput>,
  db: State<'_, Database>,
  security: State<'_, SecuritySession>,
) -> Result<MobileSyncPushResult, AppError> {
  let dashboard_drafts = drafts.clone();
  let mut work_connection = db.work_connection.lock().expect("database mutex poisoned");
  ensure_unlocked(&work_connection, &security)?;
  let account_id = mobile_account_id(&work_connection)?;
  let result = import_cloud_mobile_drafts_into_connection(&mut work_connection, drafts)?;
  if db.split_databases {
    let mut dashboard_connection = db.dashboard_connection.lock().expect("database mutex poisoned");
    apply_cloud_drafts_to_connection(&mut dashboard_connection, &account_id, &dashboard_drafts)?;
  }
  Ok(result)
}

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let work_db_path = work_database_path(app)?;
      let dashboard_db_path = dashboard_database_path(&work_db_path)?;
      let split_databases = work_db_path != dashboard_db_path;
      let work_connection = open_database(work_db_path.clone())?;
      let dashboard_connection = open_database(dashboard_db_path.clone())?;
      start_mobile_sync_server(work_db_path, dashboard_db_path);
      app.manage(Database {
        work_connection: Mutex::new(work_connection),
        dashboard_connection: Mutex::new(dashboard_connection),
        split_databases,
      });
      app.manage(SecuritySession {
        unlocked: Mutex::new(false),
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_security_status,
      set_app_password,
      change_app_password,
      reset_account,
      unlock_app,
      lock_app,
      set_privacy_mode,
      get_onboarding_status,
      save_onboarding,
      reset_demo_onboarding,
      list_content_templates,
      save_content_template,
      copy_content_template,
      delete_content_template,
      set_default_content_template,
      render_content_template,
      get_shark_csv_path,
      save_shark_csv_path,
      import_shark_csv,
      get_transaction_review,
      update_duplicate_review_status,
      update_duplicate_review_status_batch,
      create_category,
      confirm_transactions,
      get_monthly_step_status,
      set_monthly_step_status,
      list_fx_rates,
      save_fx_rate_cache,
      save_fx_rate_override,
      get_asset_entry_items,
      create_asset,
      delete_asset,
      reset_asset_month_entries,
      save_asset_month_entries,
      get_generated_dca_cashflows,
      get_asset_cashflows_for_month,
      get_credit_card_entries,
      save_credit_card_entries,
      generate_monthly_analysis,
      get_dashboard_seed_summary,
      get_mobile_sync_summary,
      get_mobile_pairing_info,
      reset_mobile_pairing_devices,
      mark_mobile_sync_records_reviewed,
      import_cloud_mobile_drafts
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  fn mobile_transaction(local_id: &str, operation: &str, date: &str, amount: f64) -> MobileSyncRecordInput {
    MobileSyncRecordInput {
      local_id: local_id.to_string(),
      server_id: None,
      record_kind: Some("transaction".to_string()),
      operation: Some(operation.to_string()),
      sync_status: Some("pending".to_string()),
      transaction_type: Some("expense".to_string()),
      amount: Some(amount),
      currency: Some("CNY".to_string()),
      category: Some("餐饮".to_string()),
      transaction_date: Some(date.to_string()),
      period_month: None,
      note: Some("手机测试".to_string()),
      current_billed_amount: None,
      current_unbilled_amount: None,
      previous_unbilled_amount: None,
      net_adjustment: None,
      payload_json: None,
      created_at: None,
      updated_at: Some(format!("{date}T12:00:00+08:00")),
    }
  }

  #[test]
  fn mobile_transaction_create_update_move_month_and_delete() {
    let mut connection = Connection::open_in_memory().expect("open memory db");
    connection.execute_batch(INITIAL_SCHEMA).expect("initial schema");
    ensure_runtime_schema(&connection).expect("runtime schema");

    apply_mobile_records_to_connection(
      &mut connection,
      "acct_test",
      "device_test",
      &[mobile_transaction("txn_1", "create", "2026-05-12", 20.0)],
    )
    .expect("create mobile transaction");
    let may_total: f64 = connection
      .query_row(
        "select coalesce(sum(amount), 0) from confirmed_transactions where period_month = '2026-05'",
        [],
        |row| row.get(0),
      )
      .expect("read May total");
    assert_eq!(may_total, 20.0);
    let may_dashboard = dashboard_monthly_trends(&connection).expect("read May dashboard");
    assert_eq!(may_dashboard.len(), 1);
    assert_eq!(may_dashboard[0].period_month, "2026-05");
    assert_eq!(may_dashboard[0].expense, 20.0);

    apply_mobile_records_to_connection(
      &mut connection,
      "acct_test",
      "device_test",
      &[mobile_transaction("txn_1", "update", "2026-06-03", 35.0)],
    )
    .expect("update mobile transaction");
    let totals: (f64, f64) = connection
      .query_row(
        "
        select
          coalesce(sum(case when period_month = '2026-05' then amount else 0 end), 0),
          coalesce(sum(case when period_month = '2026-06' then amount else 0 end), 0)
        from confirmed_transactions
        ",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
      )
      .expect("read moved totals");
    assert_eq!(totals, (0.0, 35.0));
    let june_dashboard = dashboard_monthly_trends(&connection).expect("read moved dashboard");
    assert_eq!(june_dashboard.len(), 1);
    assert_eq!(june_dashboard[0].period_month, "2026-06");
    assert_eq!(june_dashboard[0].expense, 35.0);

    apply_mobile_records_to_connection(
      &mut connection,
      "acct_test",
      "device_test",
      &[mobile_transaction("txn_1", "delete", "2026-06-03", 35.0)],
    )
    .expect("delete mobile transaction");
    let remaining: i64 = connection
      .query_row("select count(*) from confirmed_transactions", [], |row| row.get(0))
      .expect("count remaining transactions");
    assert_eq!(remaining, 0);
    assert!(dashboard_monthly_trends(&connection).expect("read deleted dashboard").is_empty());
  }
}
