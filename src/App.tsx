import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  cloudSignIn,
  cloudSignUp,
  cloudSyncConfigured,
  listPendingCloudDrafts,
  markCloudDraftsPulled,
  upsertCloudDashboardSnapshot,
  type CloudDraft,
  type CloudSession
} from "./cloudSync";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  Lock,
  Palette,
  PiggyBank,
  Plus,
  RefreshCcw,
  Save,
  Smartphone,
  Settings,
  Shield,
  Target,
  Trash2,
  Upload,
  WalletCards
} from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type PortfolioTargetSummary = {
  category: string;
  target_percent: number;
  current_amount: number;
  current_percent: number;
  deviation_percent: number;
};

type MonthlyTrend = {
  period_month: string;
  income: number;
  expense: number;
  saving_amount: number;
  saving_rate: number;
  asset_gross_value: number;
  credit_card_net_adjustment: number;
  net_worth: number;
  investment_buy: number;
  investment_sell: number;
  investment_dividend: number;
  investment_gain: number;
  investment_return_rate?: number | null;
  monthly_xirr?: number | null;
};

type CategoryBreakdown = {
  category: string;
  amount: number;
  percent: number;
  rigidity?: string | null;
  month_over_month_delta: number;
};

type AssetAllocationBreakdown = {
  category: string;
  amount: number;
  percent: number;
  target_percent?: number | null;
  deviation_percent?: number | null;
};

type AllocationTargetGroup = {
  parent_category_id: string;
  parent_category: string;
  rows: AssetAllocationBreakdown[];
};

type AssetAllocationTrend = {
  period_month: string;
  category: string;
  amount: number;
  percent: number;
};

type InvestmentAssetPerformance = {
  asset_name: string;
  beginning_value: number;
  ending_value: number;
  buy: number;
  sell: number;
  dividend: number;
  gain: number;
  period_return?: number | null;
  monthly_xirr?: number | null;
};

type SpendingAnomaly = {
  transaction_date: string;
  category: string;
  amount: number;
  note?: string | null;
  reason: string;
};

type InvestmentCashflowCalendarItem = {
  flow_date: string;
  asset_name: string;
  flow_type: string;
  amount: number;
};

type InvestmentGroupPerformance = {
  group_name: string;
  buy: number;
  sell: number;
  dividend: number;
  gain: number;
  ending_value: number;
  return_rate?: number | null;
};

type InvestmentGroupTrend = InvestmentGroupPerformance & {
  period_month: string;
};

type DiscretionaryTrend = {
  period_month: string;
  amount: number;
};

type DashboardTooltipState = {
  x: number;
  y: number;
  title: string;
  body: string;
  pinned: boolean;
} | null;

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
} | null;

type DashboardSeedSummary = {
  official_start_date: string;
  target_saving_rate: number;
  asset_count: number;
  snapshot_month: string;
  asset_gross_value: number;
  credit_card_net_adjustment: number;
  net_worth: number;
  confirmed_income: number;
  confirmed_expense: number;
  saving_amount: number;
  saving_rate: number;
  target_saving_amount: number;
  investment_buy: number;
  investment_sell: number;
  investment_dividend: number;
  investment_return_rate?: number | null;
  monthly_trends: MonthlyTrend[];
  expense_categories: CategoryBreakdown[];
  income_categories: CategoryBreakdown[];
  expense_year_rank: CategoryBreakdown[];
  income_year_rank: CategoryBreakdown[];
  spending_anomalies: SpendingAnomaly[];
  asset_allocations: AssetAllocationBreakdown[];
  us_equity_allocations: AssetAllocationBreakdown[];
  custom_allocation_detail_allocations: AssetAllocationBreakdown[];
  allocation_target_groups: AllocationTargetGroup[];
  asset_allocation_trends: AssetAllocationTrend[];
  investment_assets: InvestmentAssetPerformance[];
  investment_cashflow_calendar: InvestmentCashflowCalendarItem[];
  investment_group_performances: InvestmentGroupPerformance[];
  investment_group_trends: InvestmentGroupTrend[];
  discretionary_trends: DiscretionaryTrend[];
  monthly_report_html: string;
  portfolio_targets: PortfolioTargetSummary[];
};

type OnboardingStatus = {
  completed: boolean;
  target_saving_rate: number;
  dashboard_enabled_sections: string[];
  dashboard_enabled_items?: string[];
  dashboard_custom_settings?: Partial<DashboardCustomSettings>;
  custom_analysis_prompts: string[];
  allocation_targets: OnboardingAllocationTarget[];
  skip_allocation_targets?: boolean;
  asset_category_tree?: AssetCategoryNode[];
  asset_count: number;
  portfolio_target_count: number;
};

type AssetCategoryNode = {
  id: string;
  label: string;
  children: AssetCategoryNode[];
};

type OnboardingAllocationTarget = {
  level: "main" | "sub" | "asset";
  parent_category_id?: string | null;
  category_id?: string | null;
  asset_id?: string | null;
  label: string;
  target_percent: number;
};

type OnboardingDraftStorage = {
  step: number;
  savingRate: string;
  assetDraft: OnboardingAssetDraft;
  assetCategoryTree: AssetCategoryNode[];
  assets: OnboardingAssetDraft[];
  skipAssets: boolean;
  targets: OnboardingAllocationTarget[];
  skipTargets: boolean;
  subTargetDraftParent: string;
  subTargetDraftPercents: Record<string, string>;
  editingSubTargetParentId: string | null;
  sections: string[];
  dashboardItems: string[];
  dashboardCustomSettings: DashboardCustomSettings;
};

type ContentTemplate = {
  id: string;
  name: string;
  template_type: TemplateType;
  content: string;
  is_default: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

type TemplateRenderResult = {
  template_id?: string | null;
  template_name: string;
  template_type: TemplateType;
  period_month: string;
  html: string;
  plain_text: string;
};

type SecurityStatus = {
  password_set: boolean;
  unlocked: boolean;
  privacy_mode: boolean;
  environment_label?: string | null;
};

type MobileSyncInboxRecord = {
  id: string;
  device_id: string;
  local_id: string;
  record_kind: string;
  transaction_type?: string | null;
  transaction_date?: string | null;
  period_month?: string | null;
  amount?: number | null;
  category?: string | null;
  note?: string | null;
  net_adjustment?: number | null;
  sync_status: string;
  received_at: string;
};

type SyncTab = "sync" | "password" | "reset";

function friendlyCloudAuthError(error: unknown, mode: "signin" | "signup") {
  const text = String(error || "").replace(/^Error:\s*/, "").trim();
  const lower = text.toLowerCase();
  if (lower.includes("email rate limit") || lower.includes("rate limit")) {
    return "验证邮件发送太频繁。请先检查邮箱收件箱和垃圾邮件；如果还没有收到，等几分钟后再试。";
  }
  if (lower.includes("already registered") || lower.includes("already exists") || lower.includes("user already")) {
    return "这个邮箱已经注册。请直接登录；如果登录失败，请检查密码大小写，或确认邮箱是否已验证。";
  }
  if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
    return "这个邮箱还没有完成验证。请先打开邮箱里的验证邮件，再回来登录。";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return mode === "signin"
      ? "邮箱或密码不正确。密码区分大小写；如果这是新邮箱，可以创建新账号。"
      : "创建失败。请检查邮箱格式和密码长度。";
  }
  return text || "账号请求失败，请稍后再试。";
}

type MobileSyncSummary = {
  enabled: boolean;
  account_id?: string | null;
  device_id?: string | null;
  app_version?: string | null;
  pending_on_phone: number;
  synced_on_phone: number;
  received_in_desktop: number;
  reviewed_in_desktop: number;
  last_seen_at?: string | null;
  records: MobileSyncInboxRecord[];
};

type MobilePairingInfo = {
  enabled: boolean;
  account_id: string;
  pairing_code: string;
  pairing_url_path: string;
  pairing_url: string;
  paired_device_count: number;
  devices: Array<{
    device_id: string;
    device_name?: string | null;
    app_version?: string | null;
    pending_count: number;
    synced_count: number;
    paired_at?: string | null;
    last_seen_at: string;
  }>;
};

type ImportResult = {
  batch_id: string;
  duplicate_file: boolean;
  overwritten_existing: boolean;
  imported_count: number;
  expense_count: number;
  income_count: number;
  potential_duplicate_count: number;
  period_months: string[];
};

type AnomalyBatchAction =
  | "keep_duplicates"
  | "mark_not_duplicate"
  | "exclude_duplicates"
  | "confirm_large"
  | "exclude_unmapped";

type CategoryOption = {
  id: string;
  name: string;
  category_kind: string;
  is_auto_created?: boolean;
  created_from_raw_category?: string | null;
  rigidity?: string | null;
  is_personal?: boolean;
  note?: string | null;
};

type TransactionReviewRow = {
  id: string;
  transaction_date: string;
  raw_type: string;
  transaction_type: "expense" | "income";
  raw_category: string;
  category_id: string | null;
  category_name: string | null;
  raw_account: string;
  amount: number;
  currency?: CurrencyCode;
  note: string;
  potential_duplicate: boolean;
  duplicate_review_status?: "pending" | "keep_both" | "exclude_current" | "exclude_other" | "merged" | "not_duplicate";
  include_in_stats?: boolean;
  adjustment_reason?: string;
  is_editing?: boolean;
};

type CategorySummary = {
  category_id: string | null;
  category_name: string;
  amount: number;
  count: number;
};

type TransactionReview = {
  period_month: string;
  transaction_type: "expense" | "income";
  rows: TransactionReviewRow[];
  summary: CategorySummary[];
  categories: CategoryOption[];
  auto_created_categories?: CategoryOption[];
};

type ConfirmTransactionInput = {
  raw_transaction_id: string | null;
  transaction_date: string;
  transaction_type: "expense" | "income";
  amount: number;
  currency: CurrencyCode;
  category_id: string | null;
  raw_category_snapshot: string | null;
  include_in_stats: boolean;
  note: string | null;
  adjustment_reason: string | null;
};

type CurrencyCode = "CNY" | "USD" | "JPY" | "OTHER";

type FxRateEntry = {
  status: "loading" | "ready" | "warning" | "missing" | "error";
  rate?: number;
  sourceDate?: string;
  primarySource?: string;
  secondaryRate?: number;
  secondarySource?: string;
  variancePct?: number;
  isOverridden?: boolean;
  overrideReason?: string | null;
  message?: string;
};

type FxRateRecord = {
  rate_date: string;
  source_date?: string | null;
  from_currency: CurrencyCode;
  to_currency: CurrencyCode;
  rate?: number | null;
  primary_source?: string | null;
  secondary_rate?: number | null;
  secondary_source?: string | null;
  variance_pct?: number | null;
  status: FxRateEntry["status"];
  message?: string | null;
  is_overridden: boolean;
  override_reason?: string | null;
};

type ReviewFilters = {
  categoryId: string;
  date: string;
  minAmount: string;
  maxAmount: string;
};

type StepKey = "import" | "expense" | "income" | "assets" | "creditCard" | "final";

type AssetEntryItem = {
  id: string;
  name: string;
  asset_type?: string;
  main_asset_category_id?: string;
  sub_asset_category_id?: string | null;
  main_category: string;
  sub_category: string | null;
  tags: string;
  currency: CurrencyCode;
  platform?: string | null;
  is_dca?: boolean;
  asset_status?: string;
  note?: string | null;
  month_end_amount: number | string;
  previous_snapshot_month?: string;
  previous_month_amount?: number | string;
  previous_month_status?: string;
  extra_buy?: string;
  sell?: string;
  dividend?: string;
  month_status?: string;
  confirmed?: boolean;
  cashflows?: AssetCashflowItem[];
  dca_plans?: DcaPlanItem[];
};

type AssetCashflowItem = {
  id: string;
  asset_id: string;
  asset_name?: string;
  flow_date: string;
  flow_type: "buy" | "sell" | "dividend";
  amount: number | string;
  currency: CurrencyCode;
  source_kind: string;
  dca_plan_id?: string | null;
  note?: string | null;
  included: boolean;
  confirmed?: boolean;
  fx_rate_to_cny?: number;
  amount_cny?: number;
};

type AssetSectionKey = "creator" | "summary" | "assets" | "creditCard" | "expense" | "income";

type DcaPlanDraft = {
  frequency: string;
  amount: string;
  weeklyDay: string;
  monthlyDay: string;
  confirmed?: boolean;
};

type DcaPlanItem = {
  id?: string | null;
  frequency: string;
  amount: number | string;
  start_date: string;
  end_date?: string | null;
  weekly_rules_json?: string | null;
  monthly_day?: number | string | null;
};

type NewCategoryDraft = {
  name: string;
  rigidity: string;
  isPersonal: boolean;
  note: string;
};

type NewAssetForm = {
  name: string;
  topCategory: string;
  fundCategory: string;
  cashCategory: string;
  usEquityCategory: string;
  currency: CurrencyCode;
  platform: string;
  tags: string;
  monthEndAmount: string;
  isDca: boolean;
  status: string;
  note: string;
};

type OnboardingAssetDraft = NewAssetForm & {
  dcaPlans: DcaPlanDraft[];
};

type AssetClassification = {
  assetType: string;
  mainCategoryId: string;
  subCategoryId: string | null;
};

type CreditCardEntry = {
  id: string;
  name: string;
  institution: string | null;
  note: string | null;
  is_active: boolean;
  billed_amount: number | string;
  unbilled_amount: number | string;
  previous_unbilled_amount: number | string;
  previous_unbilled_override?: boolean;
  previous_unbilled_override_reason?: string | null;
  previous_unbilled_source_found?: boolean;
  net_adjustment: number;
  confirmed: boolean;
};

type MonthlyStepStatus = {
  import: boolean;
  expense: boolean;
  income: boolean;
  assets: boolean;
  credit_card: boolean;
  final_done: boolean;
};

type AppView = "home" | "onboarding" | "preferences" | "monthlyUpdate" | "healthDashboard" | "contentTemplates";
type TemplateType =
  | "monthly_report"
  | "cashflow_analysis"
  | "expense_structure_analysis"
  | "income_structure_analysis"
  | "asset_allocation_analysis"
  | "investment_performance_analysis"
  | "next_month_reminder";

const healthSections = ["总览", "收支储蓄", "支出结构", "资产配置", "投资表现", "月报"] as const;
type HealthSection = (typeof healthSections)[number];
const dashboardRanges = ["本月", "3个月", "年初至今", "全部", "整年趋势"] as const;
type DashboardRange = (typeof dashboardRanges)[number];
type DashboardTheme = "champagne" | "sage" | "graphite";
type DashboardItemDefinition = {
  id: string;
  label: string;
  detail: string;
  defaultEnabled: boolean;
  customSync?: boolean;
};
type DashboardCustomSettings = {
  discretionary_category_ids: string[];
  allocation_detail_parent_id: string;
  allocation_detail_depth: "second" | "third";
  custom_item_sections: Record<string, HealthSection>;
};

const defaultOnboardingSections = [...healthSections];

const dashboardModuleDetails: Record<HealthSection, { title: string; detail: string; charts: string[] }> = {
  总览: {
    title: "总览",
    detail: "关键状态、净资产、月度提醒和最近更新。",
    charts: ["关键指标", "净资产趋势", "本月提醒"]
  },
  收支储蓄: {
    title: "收支储蓄",
    detail: "收入、支出、储蓄金额、储蓄率和目标差距。",
    charts: ["收支储蓄趋势", "储蓄目标达成", "年度储蓄质量"]
  },
  支出结构: {
    title: "支出结构",
    detail: "支出分类、累计排行、Top 支出和异常消费。",
    charts: ["支出结构饼图", "分类累计排行", "Top 支出明细"]
  },
  资产配置: {
    title: "资产配置",
    detail: "实际资产比例和资产结构变化。目标差值放在下方自定义项。",
    charts: ["资产配置饼图", "结构演变"]
  },
  投资表现: {
    title: "投资表现",
    detail: "投资现金流、收益、XIRR 和资产组表现。",
    charts: ["买入卖出分红", "月度 XIRR", "资产组收益"]
  },
  月报: {
    title: "月报",
    detail: "按模板生成 HTML 月报和下月提醒。",
    charts: ["月报预览", "模板内容", "下月提醒"]
  }
};

const onboardingChartOptions = healthSections.map((section) => ({
  section,
  ...dashboardModuleDetails[section]
}));

const dashboardModuleItemDefinitions: Record<Exclude<HealthSection, "总览">, DashboardItemDefinition[]> = {
  收支储蓄: [
    { id: "cashflow_range_saving", label: "当前范围累计储蓄", detail: "所选范围内收入减支出后的累计储蓄。", defaultEnabled: true },
    { id: "cashflow_month_saving", label: "本月储蓄", detail: "当前更新月份的储蓄金额。", defaultEnabled: true },
    { id: "cashflow_target_rate", label: "目标储蓄率", detail: "来自储蓄偏好设置。", defaultEnabled: true },
    { id: "cashflow_target_amount", label: "目标储蓄金额", detail: "本月收入乘以目标储蓄率。", defaultEnabled: true },
    { id: "cashflow_gap_chart", label: "收入支出储蓄缺口图表", detail: "收入、支出、储蓄率和目标线。", defaultEnabled: true },
    { id: "saving_goal_chart", label: "储蓄目标达成图表", detail: "实际储蓄、目标储蓄和目标差额。", defaultEnabled: true }
  ],
  支出结构: [
    { id: "expense_category_count", label: "支出分类数", detail: "所选范围内有金额的分类数量。", defaultEnabled: true },
    { id: "expense_largest_category", label: "最大支出分类", detail: "所选范围内金额最高的支出分类。", defaultEnabled: true },
    { id: "expense_category_share_chart", label: "支出分类占比图表", detail: "支出分类占比饼图。", defaultEnabled: true },
    { id: "expense_category_delta_chart", label: "分类环比变化图表", detail: "各分类金额环比变化。", defaultEnabled: true },
    { id: "expense_category_detail", label: "分类金额明细", detail: "默认折叠，可以展开查看。", defaultEnabled: true },
    { id: "expense_range_rank", label: "所选范围内分类累计排行", detail: "按所选范围累计金额排序。", defaultEnabled: true },
    { id: "expense_large_anomaly", label: "大额异常支出", detail: "超过阈值或需确认的大额支出。", defaultEnabled: true }
  ],
  资产配置: [
    { id: "allocation_trend_chart", label: "资产配置轨迹图表", detail: "不同月份的资产配置结构变化。", defaultEnabled: true },
    { id: "allocation_current_chart", label: "当前资产配置图表", detail: "当前资产类别金额占比。", defaultEnabled: true }
  ],
  投资表现: [
    { id: "investment_cashflow_amounts", label: "买入卖出分红金额", detail: "所选范围内投资现金流金额。", defaultEnabled: true },
    { id: "investment_weighted_return", label: "所选范围内资金加权收益", detail: "按现金流日期计算的 XIRR 折算收益。", defaultEnabled: true },
    { id: "investment_non_cash_group_count", label: "非现金资产组数", detail: "有持仓、现金流或收益数据的非现金资产组。", defaultEnabled: true },
    { id: "investment_asset_return_chart", label: "资产所选范围内收益率图表", detail: "不同资产组收益率对比。", defaultEnabled: true },
    { id: "investment_group_perspective_chart", label: "资产组回报透视图表", detail: "资产组收益、买入、卖出和分红。", defaultEnabled: true },
    { id: "investment_return_xirr_chart", label: "所选范围内收益与资金加权收益率图表", detail: "月度收益金额和资金加权收益率同图。", defaultEnabled: true },
    { id: "investment_group_return_table", label: "所选范围内资产组收益率图表", detail: "资产组收益、区间收益率和月末金额。", defaultEnabled: true }
  ],
  月报: [
    { id: "report_template_picker", label: "使用模板", detail: "选择默认或自定义月报模板。", defaultEnabled: true },
    { id: "report_content_preview", label: "预览生成内容", detail: "按模板生成 HTML 月报预览。", defaultEnabled: true },
    { id: "report_export_actions", label: "导出 HTML", detail: "导出当前月报 HTML 内容。", defaultEnabled: true }
  ]
};

const dashboardPreferenceSections = healthSections.filter((section): section is Exclude<HealthSection, "总览"> => section !== "总览");
const defaultDashboardItemIds = dashboardPreferenceSections.flatMap((section) =>
  dashboardModuleItemDefinitions[section].filter((item) => item.defaultEnabled).map((item) => item.id)
);
const dashboardCustomItemDefinitions: DashboardItemDefinition[] = [
  { id: "allocation_discretionary_amount", label: "可支配总额", detail: "选择哪些资产组金额算作可支配总额。", defaultEnabled: false, customSync: true },
  { id: "allocation_target_deviation_value", label: "目标资产配置偏离图表", detail: "展示当前资产配置和目标资产配置之间的差值。", defaultEnabled: false, customSync: true },
  { id: "allocation_sub_detail_ratio", label: "二级 / 三级分类资产明细配比", detail: "选择一级或继续细分到二级，用于看具体下级资产比例。", defaultEnabled: false, customSync: true },
  { id: "allocation_sub_target_gap_chart", label: "二级 / 三级分类目标差距", detail: "填写下级目标配比后，展示具体下级分类的目标差距。", defaultEnabled: false, customSync: true }
];
const targetDependentDashboardItemIds = [
  "allocation_target_deviation_value",
  "allocation_sub_target_gap_chart"
];
const isTargetDependentDashboardItem = (itemId: string) => targetDependentDashboardItemIds.includes(itemId);
const deprecatedDashboardItemAliases: Record<string, string> = {
  allocation_target_gap_chart: "allocation_target_deviation_value"
};
function normalizeDashboardItemIds(items: string[]) {
  return [...new Set(items.map((item) => deprecatedDashboardItemAliases[item] ?? item))];
}
const dashboardCustomItemIds = dashboardCustomItemDefinitions.map((item) => item.id);
const defaultDashboardCustomItemSections = Object.fromEntries(
  dashboardCustomItemIds.map((id) => [id, "资产配置" as HealthSection])
) as Record<string, HealthSection>;
const defaultDashboardCustomSettings: DashboardCustomSettings = {
  discretionary_category_ids: ["asset_cat_cash", "asset_cat_bond"],
  allocation_detail_parent_id: "asset_cat_us_equity",
  allocation_detail_depth: "second",
  custom_item_sections: defaultDashboardCustomItemSections
};

const dashboardThemes: { id: DashboardTheme; label: string; detail: string; swatches: string[] }[] = [
  { id: "champagne", label: "香槟", detail: "Apple Wallet 式暖白金融感", swatches: ["#f7efe1", "#c4a46a", "#232723"] },
  { id: "sage", label: "鼠尾草", detail: "低饱和健康数据感", swatches: ["#edf4ed", "#789883", "#17231e"] },
  { id: "graphite", label: "石墨", detail: "深色隐私工作台", swatches: ["#252622", "#c8a96a", "#f2efe7"] }
];

const themePalettes: Record<DashboardTheme, string[]> = {
  champagne: ["#1d2420", "#b99a60", "#6f927f", "#9cacbf", "#c8775b", "#9a7d5c", "#7d9664", "#b76e79"],
  sage: ["#17231e", "#6f927f", "#a4a46a", "#73899c", "#c28d6b", "#b49b70", "#5d7f70", "#9c7f91"],
  graphite: ["#f2efe7", "#c8a96a", "#88a998", "#9cacbf", "#d48b70", "#b79b7a", "#a4b479", "#c58b98"]
};

const templateTypeOptions: { id: TemplateType; label: string }[] = [
  { id: "monthly_report", label: "月报模板" },
  { id: "cashflow_analysis", label: "收支分析模板" },
  { id: "expense_structure_analysis", label: "支出结构分析模板" },
  { id: "income_structure_analysis", label: "收入结构分析模板" },
  { id: "asset_allocation_analysis", label: "资产配置分析模板" },
  { id: "investment_performance_analysis", label: "投资表现分析模板" },
  { id: "next_month_reminder", label: "下月提醒模板" }
];

const templateVariables = [
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
  "本月提醒"
];

const defaultSharkCsvPath = "";
const onboardingDraftStorageKey = "financial-planning-onboarding-draft-v1";

const currencyOptions: { code: CurrencyCode; label: string }[] = [
  { code: "CNY", label: "CNY 人民币" },
  { code: "USD", label: "USD 美元" },
  { code: "JPY", label: "JPY 日元" },
  { code: "OTHER", label: "其他 开发中" }
];

const stepItems: { key: StepKey; label: string }[] = [
  { key: "import", label: "导入账单" },
  { key: "expense", label: "支出确认" },
  { key: "income", label: "收入确认" },
  { key: "assets", label: "资产录入" },
  { key: "creditCard", label: "信用卡调整" },
  { key: "final", label: "总确认" }
];

const assetTypeOptions = [
  ["fund", "基金"],
  ["stock", "股票"],
  ["bond_fund", "债券基金"],
  ["cash_account", "现金账户"],
  ["gold", "黄金"],
  ["receivable", "应收"],
  ["insurance", "保险/养老金"],
  ["liability", "负债"],
  ["other", "其他"]
];

const assetTopOptions = [
  ["asset_cat_cash", "现金"],
  ["asset_cat_us_equity", "全球资产"],
  ["asset_cat_dividend_low_vol", "红利低波"],
  ["asset_cat_bond", "债券"],
  ["asset_cat_gold", "黄金"],
  ["asset_cat_a_share", "A股权益"],
  ["asset_cat_other", "其他"]
];

const fundCategoryOptions = [
  ["asset_sub_us_market", "美股"],
  ["asset_sub_hk_market", "港股"],
  ["asset_sub_emerging_market", "新兴市场"]
];

const usEquityCategoryOptions = [
  ["asset_sub_sp500", "标普"],
  ["asset_sub_nasdaq", "纳斯达克"]
];

const cashCategoryOptions = [
  ["asset_sub_bank_payment", "银行/支付账户"],
  ["asset_sub_money_market_cash", "货币现金"],
  ["asset_sub_receivable", "应收押金"]
];

const mainAllocationOptions = [
  ["asset_cat_cash", "现金"],
  ["asset_cat_us_equity", "全球资产"],
  ["asset_cat_dividend_low_vol", "红利低波"],
  ["asset_cat_bond", "债券"],
  ["asset_cat_gold", "黄金"],
  ["asset_cat_a_share", "A股权益"],
  ["asset_cat_other", "其他"]
];

const subAllocationOptions: Record<string, string[][]> = {
  asset_cat_us_equity: fundCategoryOptions,
  asset_cat_cash: cashCategoryOptions,
  asset_cat_dividend_low_vol: [
    ["asset_sub_dividend", "红利"],
    ["asset_sub_low_vol", "低波"]
  ],
  asset_cat_bond: [
    ["asset_sub_short_bond", "短债"],
    ["asset_sub_pure_bond", "纯债"],
    ["asset_sub_treasury_bond", "国债"]
  ],
  asset_cat_gold: [
    ["asset_sub_gold_etf", "黄金ETF"]
  ],
  asset_cat_a_share: [
    ["asset_sub_a_share_broad", "宽基"],
    ["asset_sub_a_share_sector_active", "行业/主动"]
  ],
  asset_cat_other: [
    ["asset_sub_insurance_pension", "保险/养老金"],
    ["asset_sub_uncategorized", "未分类"]
  ]
};

const defaultAssetCategoryTree: AssetCategoryNode[] = [
  {
    id: "asset_cat_cash",
    label: "现金",
    children: [
      { id: "asset_sub_bank_payment", label: "银行/支付账户", children: [] },
      { id: "asset_sub_money_market_cash", label: "货币现金", children: [] },
      { id: "asset_sub_receivable", label: "应收押金", children: [] }
    ]
  },
  {
    id: "asset_cat_us_equity",
    label: "全球资产",
    children: [
      {
        id: "asset_sub_us_market",
        label: "美股",
        children: [
          { id: "asset_sub_sp500", label: "标普", children: [] },
          { id: "asset_sub_nasdaq", label: "纳斯达克", children: [] }
        ]
      },
      { id: "asset_sub_hk_market", label: "港股", children: [] },
      { id: "asset_sub_emerging_market", label: "新兴市场", children: [] }
    ]
  },
  {
    id: "asset_cat_dividend_low_vol",
    label: "红利低波",
    children: [
      { id: "asset_sub_dividend", label: "红利", children: [] },
      { id: "asset_sub_low_vol", label: "低波", children: [] }
    ]
  },
  {
    id: "asset_cat_bond",
    label: "债券",
    children: [
      { id: "asset_sub_short_bond", label: "短债", children: [] },
      { id: "asset_sub_pure_bond", label: "纯债", children: [] },
      { id: "asset_sub_treasury_bond", label: "国债", children: [] }
    ]
  },
  {
    id: "asset_cat_gold",
    label: "黄金",
    children: [
      { id: "asset_sub_gold_etf", label: "黄金ETF", children: [] }
    ]
  },
  {
    id: "asset_cat_a_share",
    label: "A股权益",
    children: [
      { id: "asset_sub_a_share_broad", label: "宽基", children: [] },
      { id: "asset_sub_a_share_sector_active", label: "行业/主动", children: [] }
    ]
  },
  {
    id: "asset_cat_other",
    label: "其他",
    children: [
      { id: "asset_sub_insurance_pension", label: "保险/养老金", children: [] },
      { id: "asset_sub_uncategorized", label: "未分类", children: [] }
    ]
  }
];

const assetMonthStatusOptions = [
  ["held", "持有"],
  ["cleared", "已清仓"],
  ["excluded", "暂不统计"]
];

function assetMonthStatus(asset: Pick<AssetEntryItem, "month_status">) {
  return asset.month_status === "cleared" || asset.month_status === "excluded" ? asset.month_status : "held";
}

function assetMonthStatusLabel(asset: Pick<AssetEntryItem, "month_status">) {
  return optionLabel(assetMonthStatusOptions, assetMonthStatus(asset));
}

function isAssetCountedInMonth(asset: Pick<AssetEntryItem, "month_status">) {
  return assetMonthStatus(asset) === "held";
}

function assetSellTotal(asset: Pick<AssetEntryItem, "cashflows">) {
  return (asset.cashflows ?? [])
    .filter((flow) => flow.included !== false && flow.flow_type === "sell")
    .reduce((sum, flow) => sum + (Number(flow.amount) || 0), 0);
}

function assetHasSellRecord(asset: Pick<AssetEntryItem, "cashflows">) {
  return assetSellTotal(asset) > 0;
}

function assetMonthEndAmount(asset: Pick<AssetEntryItem, "month_end_amount">) {
  const rawValue = String(asset.month_end_amount ?? "").trim();
  return { rawValue, amount: Number(asset.month_end_amount) };
}

function assetMonthAmountIssue(asset: Pick<AssetEntryItem, "name" | "month_status" | "month_end_amount">) {
  const status = assetMonthStatus(asset);
  if (status === "excluded") return null;
  const { rawValue, amount } = assetMonthEndAmount(asset);
  if (status === "cleared") {
    if (rawValue === "") return `${asset.name} 已清仓，月末市值需要填 0。`;
    if (!Number.isFinite(amount) || amount !== 0) return `${asset.name} 已清仓，月末市值需要为 0。`;
    return null;
  }
  if (rawValue !== "" && Number.isFinite(amount) && amount === 0) {
    return `${asset.name} 月末市值为 0，请选择“已清仓”或“暂不统计”。`;
  }
  if (rawValue === "" || !Number.isFinite(amount) || amount <= 0) {
    return `${asset.name} 缺少月末市值。`;
  }
  return null;
}

function assetClearedWithoutSellIssue(asset: Pick<AssetEntryItem, "name" | "month_status" | "cashflows">, overrideAllowed: boolean) {
  if (assetMonthStatus(asset) !== "cleared") return null;
  if (assetHasSellRecord(asset) || overrideAllowed) return null;
  return `${asset.name} 已标记清仓，但没有卖出记录。请补充卖出，或确认“仅标记清仓”。`;
}

function assetShouldSuggestCleared(asset: Pick<AssetEntryItem, "month_status" | "month_end_amount" | "cashflows">) {
  const { rawValue, amount } = assetMonthEndAmount(asset);
  return assetMonthStatus(asset) === "held" && assetHasSellRecord(asset) && rawValue !== "" && Number.isFinite(amount) && amount === 0;
}

function resolveAssetClassification(input: {
  topCategory: string;
  fundCategory: string;
  cashCategory: string;
  usEquityCategory: string;
}): AssetClassification {
  const mainCategoryId = input.topCategory || "asset_cat_cash";
  const subCategoryId =
    mainCategoryId === "asset_cat_cash"
      ? input.cashCategory
      : input.fundCategory === "asset_sub_us_market"
        ? input.usEquityCategory || "asset_sub_nasdaq"
        : input.fundCategory;
  return {
    assetType: assetTypeForCategory(mainCategoryId, subCategoryId),
    mainCategoryId,
    subCategoryId: subCategoryId || null
  };
}

function classificationForAsset(asset: AssetEntryItem, tree: AssetCategoryNode[] = defaultAssetCategoryTree) {
  const mainCategoryId = asset.main_asset_category_id || "asset_cat_cash";
  const subCategoryId = asset.sub_asset_category_id ?? "";
  const subParent = subCategoryId ? findAssetCategoryParent(tree, subCategoryId) : null;
  const topParent = subParent ? findAssetCategoryParent(tree, subParent.id) : null;
  const nestedUnderMain = Boolean(subParent?.id.startsWith("asset_sub_") && topParent?.id === mainCategoryId);
  return {
    topCategory: mainCategoryId,
    fundCategory:
      mainCategoryId === "asset_cat_cash"
        ? "asset_sub_us_market"
        : nestedUnderMain
          ? subParent?.id ?? ""
          : subCategoryId || (subOptionsForMain(mainCategoryId)[0]?.[0] ?? ""),
    cashCategory: mainCategoryId === "asset_cat_cash" ? asset.sub_asset_category_id ?? "asset_sub_bank_payment" : "asset_sub_bank_payment",
    usEquityCategory: nestedUnderMain ? subCategoryId : "asset_sub_sp500"
  };
}

function optionLabel(options: string[][], value: string) {
  return options.find(([id]) => id === value)?.[1] ?? value;
}

function targetPercentNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentInputValue(value: number | string | null | undefined) {
  const parsed = targetPercentNumber(value);
  return parsed > 0 ? String(parsed) : "";
}

function parsePercentInput(value: string) {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePercentDraftInput(value: string) {
  const digitsAndDots = value.replace(/[^\d.]/g, "");
  const firstDotIndex = digitsAndDots.indexOf(".");
  if (firstDotIndex === -1) return digitsAndDots;
  return `${digitsAndDots.slice(0, firstDotIndex + 1)}${digitsAndDots.slice(firstDotIndex + 1).replace(/\./g, "")}`;
}

function allocationTargetsForEditor(targets: OnboardingAllocationTarget[]) {
  return targets.map((target) => ({
    ...target,
    target_percent:
      Number.isFinite(Number(target.target_percent)) && Math.abs(Number(target.target_percent)) <= 1
        ? Number(target.target_percent) * 100
        : Number(target.target_percent) || 0
  }));
}

function buildMainTargetsWithSavedValues(
  options: string[][],
  currentTargets: OnboardingAllocationTarget[],
  savedMainTargetByCategory: Map<string, OnboardingAllocationTarget>,
  editedCategoryIds: Set<string> = new Set()
) {
  const currentByCategory = new Map<string, OnboardingAllocationTarget>();
  currentTargets
    .filter((target) => target.level === "main" && target.category_id)
    .forEach((target) => currentByCategory.set(target.category_id as string, target));

  return options.map(([categoryId, label]) => {
    const currentTarget = currentByCategory.get(categoryId);
    const savedTarget = savedMainTargetByCategory.get(categoryId);
    const currentValue = targetPercentNumber(currentTarget?.target_percent);
    const savedValue = targetPercentNumber(savedTarget?.target_percent);
    const isBeingEdited = editedCategoryIds.has(categoryId);
    const baseTarget = currentTarget ?? savedTarget ?? {
      level: "main" as const,
      category_id: categoryId,
      label,
      target_percent: 0
    };

    return {
      ...baseTarget,
      level: "main" as const,
      category_id: categoryId,
      label: baseTarget.label || label,
      target_percent: isBeingEdited || currentValue > 0 || savedValue === 0 ? currentValue : savedValue
    };
  });
}

function percentTotalValidationMessage(label: string, total: number) {
  if (total > 100.0001) return `${label}合计 ${total.toFixed(1)}%，不能超过 100%。`;
  if (total < 99.9999) return `${label}合计 ${total.toFixed(1)}%，需要等于 100%。`;
  return null;
}

function cloneAssetCategoryTree(tree: AssetCategoryNode[] = defaultAssetCategoryTree): AssetCategoryNode[] {
  return tree.map((node) => ({
    ...node,
    children: cloneAssetCategoryTree(node.children ?? [])
  }));
}

function hasCustomAssetCategoryNode(nodes: AssetCategoryNode[]): boolean {
  return nodes.some((node) => node.id.includes("_custom_") || hasCustomAssetCategoryNode(node.children ?? []));
}

function defaultGlobalAssetNode() {
  return cloneAssetCategoryTree(defaultAssetCategoryTree).find((node) => node.id === "asset_cat_us_equity");
}

function normalizeAssetCategoryTreeDefaults(tree: AssetCategoryNode[] = defaultAssetCategoryTree): AssetCategoryNode[] {
  if (!tree.length) return cloneAssetCategoryTree();
  const cloned = cloneAssetCategoryTree(tree);
  const cash = findAssetCategoryNode(tree, "asset_cat_cash");
  const global = findAssetCategoryNode(tree, "asset_cat_us_equity");
  const hasCustom = hasCustomAssetCategoryNode(tree);
  const isLegacyDefault =
    !hasCustom &&
    global?.label === "美股" &&
    global.children.some((child) => child.label === "标普") &&
    global.children.some((child) => child.label === "纳斯达克") &&
    cash?.children.some((child) => child.label === "短期存款");
  if (isLegacyDefault) return cloneAssetCategoryTree();
  const clonedGlobal = findAssetCategoryNode(cloned, "asset_cat_us_equity");
  const defaultGlobal = defaultGlobalAssetNode();
  const isFlatGlobal =
    !hasCustom &&
    clonedGlobal &&
    defaultGlobal &&
    !clonedGlobal.children.some((child) => child.id === "asset_sub_us_market") &&
    clonedGlobal.children.some((child) => child.id === "asset_sub_sp500") &&
    clonedGlobal.children.some((child) => child.id === "asset_sub_nasdaq");
  if (isFlatGlobal && clonedGlobal && defaultGlobal) {
    clonedGlobal.label = "全球资产";
    clonedGlobal.children = defaultGlobal.children;
  }
  return cloned;
}

function categoryOptions(nodes: AssetCategoryNode[]): string[][] {
  return nodes.map((node) => [node.id, node.label]);
}

function findAssetCategoryNode(nodes: AssetCategoryNode[], id: string): AssetCategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findAssetCategoryNode(node.children ?? [], id);
    if (child) return child;
  }
  return null;
}

function findAssetCategoryParent(nodes: AssetCategoryNode[], id: string, parent: AssetCategoryNode | null = null): AssetCategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return parent;
    const found = findAssetCategoryParent(node.children ?? [], id, node);
    if (found) return found;
  }
  return null;
}

function assetCategoryPathLabel(nodes: AssetCategoryNode[], id: string): string {
  const visit = (items: AssetCategoryNode[], path: string[]): string | null => {
    for (const item of items) {
      const nextPath = [...path, item.label];
      if (item.id === id) return nextPath.join(" / ");
      const found = visit(item.children ?? [], nextPath);
      if (found) return found;
    }
    return null;
  };
  return visit(nodes, []) ?? id;
}

function assetCategoryPathIds(nodes: AssetCategoryNode[], id: string): string[] {
  const visit = (items: AssetCategoryNode[], path: string[]): string[] | null => {
    for (const item of items) {
      const nextPath = [...path, item.id];
      if (item.id === id) return nextPath;
      const found = visit(item.children ?? [], nextPath);
      if (found) return found;
    }
    return null;
  };
  return visit(nodes, []) ?? [];
}

function assetCategoryPathOptions(nodes: AssetCategoryNode[]) {
  const rows: { id: string; label: string; hasChildren: boolean }[] = [];
  const visit = (items: AssetCategoryNode[]) => {
    items.forEach((item) => {
      rows.push({ id: item.id, label: assetCategoryPathLabel(nodes, item.id), hasChildren: (item.children ?? []).length > 0 });
      visit(item.children ?? []);
    });
  };
  visit(nodes);
  return rows;
}

function normalizeDashboardCustomSettings(
  input: Partial<DashboardCustomSettings> | null | undefined,
  tree: AssetCategoryNode[] = defaultAssetCategoryTree
): DashboardCustomSettings {
  const pathOptions = assetCategoryPathOptions(tree);
  const allIds = new Set(pathOptions.map((item) => item.id));
  const fallbackDiscretionaryIds = defaultDashboardCustomSettings.discretionary_category_ids.filter((id) => allIds.has(id));
  const fallbackParentId = allIds.has(defaultDashboardCustomSettings.allocation_detail_parent_id)
    ? defaultDashboardCustomSettings.allocation_detail_parent_id
    : pathOptions.find((item) => item.hasChildren)?.id ?? pathOptions[0]?.id ?? defaultDashboardCustomSettings.allocation_detail_parent_id;
  const discretionaryIds = (input?.discretionary_category_ids ?? fallbackDiscretionaryIds)
    .filter((id) => allIds.has(id));
  const parentId = input?.allocation_detail_parent_id && allIds.has(input.allocation_detail_parent_id)
    ? input.allocation_detail_parent_id
    : fallbackParentId;
  const depth = input?.allocation_detail_depth === "third" ? "third" : "second";
  const rawCustomItemSections = input?.custom_item_sections ?? {};
  const customItemSections = Object.fromEntries(
    dashboardCustomItemIds.map((id) => {
      const rawSection = rawCustomItemSections[id];
      const section = healthSections.includes(rawSection as HealthSection) ? (rawSection as HealthSection) : defaultDashboardCustomItemSections[id] ?? "资产配置";
      return [id, section];
    })
  ) as Record<string, HealthSection>;
  return {
    discretionary_category_ids: discretionaryIds.length ? discretionaryIds : fallbackDiscretionaryIds.length ? fallbackDiscretionaryIds : pathOptions[0] ? [pathOptions[0].id] : [],
    allocation_detail_parent_id: parentId,
    allocation_detail_depth: depth,
    custom_item_sections: customItemSections
  };
}

function updateAssetCategoryNode(nodes: AssetCategoryNode[], id: string, patch: Partial<AssetCategoryNode>): AssetCategoryNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, ...patch, children: patch.children ?? node.children };
    }
    return { ...node, children: updateAssetCategoryNode(node.children ?? [], id, patch) };
  });
}

function removeAssetCategoryNode(nodes: AssetCategoryNode[], id: string): AssetCategoryNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeAssetCategoryNode(node.children ?? [], id) }));
}

function appendAssetCategoryNode(nodes: AssetCategoryNode[], parentId: string | null, child: AssetCategoryNode): AssetCategoryNode[] {
  if (!parentId) return [...nodes, child];
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...(node.children ?? []), child] };
    }
    return { ...node, children: appendAssetCategoryNode(node.children ?? [], parentId, child) };
  });
}

function makeAssetCategoryId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function subOptionsForMain(mainCategoryId: string) {
  return subAllocationOptions[mainCategoryId] ?? [];
}

function defaultSubCategoryForMain(mainCategoryId: string) {
  return subOptionsForMain(mainCategoryId)[0]?.[0] ?? "";
}

function isCashCategoryId(categoryId: string) {
  return categoryId === "asset_cat_cash";
}

function assetTypeForCategory(mainCategoryId: string, subCategoryId?: string | null, mainLabel = "", subLabel = "") {
  const combined = `${mainCategoryId} ${subCategoryId ?? ""} ${mainLabel} ${subLabel}`;
  if (subCategoryId === "asset_sub_receivable" || combined.includes("应收")) return "receivable";
  if (mainCategoryId === "asset_cat_cash") return "cash_account";
  if (mainCategoryId === "asset_cat_gold") return "gold";
  if (mainCategoryId === "asset_cat_bond") return "bond_fund";
  if (subCategoryId === "asset_sub_insurance_pension" || combined.includes("保险") || combined.includes("养老金")) return "insurance";
  if (subCategoryId === "asset_sub_liability" || combined.includes("负债") || combined.includes("贷款")) return "liability";
  if (combined.includes("股票")) return "stock";
  if (mainCategoryId === "asset_cat_other") return "other";
  return "fund";
}

function normalizeOnboardingAssetDraft(asset: OnboardingAssetDraft, tree: AssetCategoryNode[]): OnboardingAssetDraft {
  const topOptions = categoryOptions(tree);
  const nextTop = topOptions.some(([id]) => id === asset.topCategory) ? asset.topCategory : topOptions[0]?.[0] ?? "asset_cat_cash";
  const topNode = findAssetCategoryNode(tree, nextTop);
  const secondOptions = categoryOptions(topNode?.children ?? []);
  const currentSecond = isCashCategoryId(nextTop) ? asset.cashCategory : asset.fundCategory;
  const nextSecond = secondOptions.some(([id]) => id === currentSecond) ? currentSecond : secondOptions[0]?.[0] ?? "";
  const secondNode = findAssetCategoryNode(tree, nextSecond);
  const thirdOptions = categoryOptions(secondNode?.children ?? []);
  const nextThird = thirdOptions.some(([id]) => id === asset.usEquityCategory) ? asset.usEquityCategory : thirdOptions[0]?.[0] ?? "";
  return {
    ...asset,
    topCategory: nextTop,
    cashCategory: isCashCategoryId(nextTop) ? nextSecond : asset.cashCategory,
    fundCategory: isCashCategoryId(nextTop) ? asset.fundCategory : nextSecond,
    usEquityCategory: nextThird || asset.usEquityCategory
  };
}

function blankOnboardingAsset(): OnboardingAssetDraft {
  return {
    name: "",
    topCategory: "asset_cat_cash",
    fundCategory: "asset_sub_us_market",
    cashCategory: "asset_sub_bank_payment",
    usEquityCategory: "asset_sub_sp500",
    currency: "CNY",
    platform: "",
    tags: "",
    monthEndAmount: "",
    isDca: false,
    status: "active",
    note: "",
    dcaPlans: [{ frequency: "monthly", amount: "", weeklyDay: "1", monthlyDay: "1", confirmed: false }]
  };
}

function resolveOnboardingAssetClassification(input: OnboardingAssetDraft, tree: AssetCategoryNode[]): AssetClassification {
  const topNode = findAssetCategoryNode(tree, input.topCategory);
  const topId = topNode?.id ?? input.topCategory;
  const topLabel = topNode?.label ?? "";
  if (topId === "asset_cat_cash") {
    const subId = input.cashCategory || topNode?.children?.[0]?.id || "asset_sub_bank_payment";
    const subLabel = findAssetCategoryNode(tree, subId)?.label ?? "";
    return {
      assetType: assetTypeForCategory(topId, subId, topLabel, subLabel),
      mainCategoryId: "asset_cat_cash",
      subCategoryId: subId
    };
  }
  const secondId = input.fundCategory || topNode?.children?.[0]?.id || "";
  const secondNode = findAssetCategoryNode(tree, secondId);
  const thirdId = input.usEquityCategory || secondNode?.children?.[0]?.id || null;
  if (topId.startsWith("asset_cat_")) {
    const shouldUseThird = Boolean(secondNode?.children?.length && thirdId);
    const subId = shouldUseThird ? thirdId : secondId.startsWith("asset_sub_") ? secondId : thirdId;
    const subLabel = subId ? findAssetCategoryNode(tree, subId)?.label ?? "" : "";
    return {
      assetType: assetTypeForCategory(topId, subId, topLabel, subLabel),
      mainCategoryId: topId,
      subCategoryId: subId || null
    };
  }
  return resolveAssetClassification(input);
}

function assetPayloadFromDraft(asset: OnboardingAssetDraft, selectedMonth: string, tree: AssetCategoryNode[]) {
  const classification = resolveOnboardingAssetClassification(asset, tree);
  return {
    name: asset.name.trim(),
    asset_type: classification.assetType,
    main_asset_category_id: classification.mainCategoryId,
    sub_asset_category_id: classification.subCategoryId,
    currency: asset.currency,
    platform: asset.platform || null,
    tags: parseTagsFromText(asset.tags),
    month_end_amount: Number(asset.monthEndAmount) || 0,
    is_dca: asset.isDca,
    status: "active",
    note: asset.note || null,
    dca_plans: asset.isDca
      ? asset.dcaPlans
          .filter((plan) => Number(plan.amount) > 0)
          .map((plan) => ({
            frequency: plan.frequency,
            amount: Number(plan.amount),
            start_date: `${selectedMonth}-01`,
            end_date: null,
            weekly_rules_json:
              plan.frequency === "weekly"
                ? JSON.stringify([{ weekday: Number(plan.weeklyDay) || 1, amount: Number(plan.amount) || 0 }])
                : null,
            monthly_day: plan.frequency === "monthly" ? Number(plan.monthlyDay) || 1 : null
          }))
      : []
  };
}

function parseTagsFromText(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

function assetClassificationText(asset: AssetEntryItem, tree: AssetCategoryNode[] = defaultAssetCategoryTree) {
  const parent = asset.sub_asset_category_id ? findAssetCategoryParent(tree, asset.sub_asset_category_id) : null;
  const topParent = parent ? findAssetCategoryParent(tree, parent.id) : null;
  const middleLabel = parent?.id.startsWith("asset_sub_") && topParent?.id === asset.main_asset_category_id ? parent.label : "";
  return [asset.main_category, middleLabel, asset.sub_category].filter(Boolean).join(" / ") || "未分类";
}

function normalizeAssetEntryItems(assets: AssetEntryItem[]) {
  return assets.map((asset) => ({
    ...asset,
    currency: (asset.currency || "CNY") as CurrencyCode,
    month_status: asset.month_status ?? "held",
    cashflows: asset.cashflows ?? [],
    confirmed: asset.confirmed ?? false
  }));
}

const fallbackSummary: DashboardSeedSummary = {
  official_start_date: "",
  target_saving_rate: 0.3,
  asset_count: 0,
  snapshot_month: "",
  asset_gross_value: 0,
  credit_card_net_adjustment: 0,
  net_worth: 0,
  confirmed_income: 0,
  confirmed_expense: 0,
  saving_amount: 0,
  saving_rate: 0,
  target_saving_amount: 0,
  investment_buy: 0,
  investment_sell: 0,
  investment_dividend: 0,
  investment_return_rate: null,
  monthly_trends: [],
  expense_categories: [],
  income_categories: [],
  expense_year_rank: [],
  income_year_rank: [],
  spending_anomalies: [],
  asset_allocations: [],
  us_equity_allocations: [],
  custom_allocation_detail_allocations: [],
  allocation_target_groups: [],
  asset_allocation_trends: [],
  investment_assets: [],
  investment_cashflow_calendar: [],
  investment_group_performances: [],
  investment_group_trends: [],
  discretionary_trends: [],
  monthly_report_html: "",
  portfolio_targets: []
};

function formatMoney(value: number, privacyMode: boolean): string {
  if (privacyMode) return "••••••";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

function formatCurrency(value: number, privacyMode: boolean, currency: CurrencyCode = "CNY"): string {
  if (privacyMode) return "••••••";
  return `${currency} ${formatMoney(value, false)}`;
}

let percentPrivacyMode = false;

function formatPercent(value: number): string {
  if (percentPrivacyMode) return "••••••";
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }).format(value);
}

const chinaPublicHolidays = new Set([
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-02-15",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-21",
  "2026-02-22",
  "2026-02-23",
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07"
]);

function daysInMonth(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function previousPeriodMonth(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextPeriodMonth(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateInPlanRange(date: string, plan: DcaPlanItem) {
  return date >= plan.start_date && (!plan.end_date || date <= plan.end_date);
}

function isoWeekday(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 ? 7 : day;
}

function weeklyRules(plan: DcaPlanItem) {
  if (!plan.weekly_rules_json) return [{ weekday: 1, amount: Number(plan.amount) || 0 }];
  try {
    const parsed = JSON.parse(plan.weekly_rules_json);
    if (!Array.isArray(parsed)) return [{ weekday: 1, amount: Number(plan.amount) || 0 }];
    return parsed
      .map((item) => ({
        weekday: Number(item.weekday) || 1,
        amount: Number(item.amount) || Number(plan.amount) || 0
      }))
      .filter((item) => item.weekday >= 1 && item.weekday <= 7);
  } catch {
    return [{ weekday: 1, amount: Number(plan.amount) || 0 }];
  }
}

  function generateDcaCashflowsForAssets(
  assets: AssetEntryItem[],
  periodMonth: string,
  existing: AssetCashflowItem[]
) {
  const [year, month] = periodMonth.split("-").map(Number);
  const existingByCore = new Map(
    existing.map((flow) => [
      `${flow.asset_id}|${flow.dca_plan_id ?? ""}|${flow.flow_date}|${flow.flow_type}`,
      flow
    ])
  );
  const generated: AssetCashflowItem[] = [];

  for (const asset of assets) {
    if (!asset.is_dca) continue;
    for (const [planIndex, plan] of (asset.dca_plans ?? []).entries()) {
      const planId = plan.id ?? `draft-${asset.id}-${planIndex}`;
      const matchPlanId = plan.id ?? "";
      const amount = Number(plan.amount) || 0;
      if (amount <= 0) continue;
      const pushFlow = (date: string, flowAmount = amount) => {
        const key = `${asset.id}|${matchPlanId}|${date}|buy`;
        const existingFlow = existingByCore.get(key);
        generated.push({
          id: existingFlow?.id ?? `dca-preview-${asset.id}-${planId}-${date}`,
          asset_id: asset.id,
          asset_name: asset.name,
          flow_date: existingFlow?.flow_date ?? date,
          flow_type: "buy",
          amount: existingFlow?.amount ?? flowAmount,
          currency: existingFlow?.currency ?? asset.currency,
          source_kind: "dca_auto",
          dca_plan_id: plan.id ?? null,
          note: existingFlow?.note ?? "自动定投",
          included: existingFlow?.included ?? true
        });
      };

      if (plan.frequency === "daily") {
        for (let day = 1; day <= daysInMonth(periodMonth); day += 1) {
          const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const weekday = isoWeekday(date);
          if (dateInPlanRange(date, plan) && weekday <= 5 && !chinaPublicHolidays.has(date)) {
            pushFlow(date);
          }
        }
      } else if (plan.frequency === "weekly") {
        const rules = weeklyRules(plan);
        for (let day = 1; day <= daysInMonth(periodMonth); day += 1) {
          const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          if (!dateInPlanRange(date, plan)) continue;
          const weekday = isoWeekday(date);
          for (const rule of rules) {
            if (weekday === rule.weekday) pushFlow(date, rule.amount);
          }
        }
      } else {
        if (plan.monthly_day === null || plan.monthly_day === "") continue;
        const day = Math.min(Math.max(Number(plan.monthly_day) || 1, 1), daysInMonth(periodMonth));
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (dateInPlanRange(date, plan)) pushFlow(date);
      }
    }
  }

  return generated.sort(
    (a, b) => a.flow_date.localeCompare(b.flow_date) || (a.asset_name ?? "").localeCompare(b.asset_name ?? "")
  );
}

function draftDcaDays(plans: DcaPlanDraft[], periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  const days = new Set<number>();
  for (const plan of plans) {
    const amount = Number(plan.amount) || 0;
    if (amount <= 0) continue;
    if (plan.frequency === "daily") {
      for (let day = 1; day <= daysInMonth(periodMonth); day += 1) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const weekday = isoWeekday(date);
        if (weekday <= 5 && !chinaPublicHolidays.has(date)) days.add(day);
      }
    } else if (plan.frequency === "weekly") {
      const targetWeekday = Number(plan.weeklyDay) || 1;
      for (let day = 1; day <= daysInMonth(periodMonth); day += 1) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (isoWeekday(date) === targetWeekday) days.add(day);
      }
    } else {
      days.add(Math.min(Math.max(Number(plan.monthlyDay) || 1, 1), daysInMonth(periodMonth)));
    }
  }
  return days;
}

export function App() {
  const isTauriRuntime =
    typeof window !== "undefined" &&
    Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const browserPreviewSummary = (() => {
    if (isTauriRuntime || typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") !== "dashboard") return null;
    try {
      const raw = window.localStorage.getItem("financial-dashboard-preview-summary");
      return raw ? (JSON.parse(raw) as DashboardSeedSummary) : fallbackSummary;
    } catch {
      return fallbackSummary;
    }
  })();

  if (!isTauriRuntime && !browserPreviewSummary) {
    return (
      <main className="shell">
        <section className="panel browser-fallback">
          <p className="eyebrow">Preview</p>
          <h1>请查看已打开的桌面预览窗口</h1>
          <p>
            这个页面需要在 Tauri App 里运行。普通浏览器没有本地数据库接口，所以不能直接使用。
          </p>
        </section>
      </main>
    );
  }

  const [summary, setSummary] = useState<DashboardSeedSummary>(browserPreviewSummary ?? fallbackSummary);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const [error, setError] = useState<string | null>(null);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [initialPasswordSetupSkipped, setInitialPasswordSetupSkipped] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SyncTab>("sync");
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [settingsResetPassword, setSettingsResetPassword] = useState("");
  const [settingsResetConfirmText, setSettingsResetConfirmText] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(() => {
    try {
      const raw = window.localStorage.getItem("worthtrace-cloud-session");
      return raw ? (JSON.parse(raw) as CloudSession) : null;
    } catch {
      return null;
    }
  });
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const [cloudSignupSuggested, setCloudSignupSuggested] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudDrafts, setCloudDrafts] = useState<CloudDraft[]>([]);
  const [view, setView] = useState<AppView>(browserPreviewSummary ? "healthDashboard" : "home");
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingSavingRate, setOnboardingSavingRate] = useState("30");
  const [onboardingAssetDraft, setOnboardingAssetDraft] = useState<OnboardingAssetDraft>(() => blankOnboardingAsset());
  const [assetCategoryTree, setAssetCategoryTree] = useState<AssetCategoryNode[]>(() => cloneAssetCategoryTree());
  const [onboardingAssets, setOnboardingAssets] = useState<OnboardingAssetDraft[]>([]);
  const [onboardingSkipAssets, setOnboardingSkipAssets] = useState(false);
  const [onboardingTargets, setOnboardingTargets] = useState<OnboardingAllocationTarget[]>([]);
  const [editedMainTargetIds, setEditedMainTargetIds] = useState<Set<string>>(() => new Set());
  const [onboardingMainTargetDraftPercents, setOnboardingMainTargetDraftPercents] = useState<Record<string, string>>({});
  const [onboardingSkipTargets, setOnboardingSkipTargets] = useState(false);
  const [onboardingSubTargetDraftParent, setOnboardingSubTargetDraftParent] = useState("asset_cat_cash");
  const [onboardingSubTargetDraftPercents, setOnboardingSubTargetDraftPercents] = useState<Record<string, string>>({});
  const [editingSubTargetParentId, setEditingSubTargetParentId] = useState<string | null>(null);
  const [onboardingSections, setOnboardingSections] = useState<string[]>(defaultOnboardingSections);
  const [onboardingDashboardItems, setOnboardingDashboardItems] = useState<string[]>(defaultDashboardItemIds);
  const [dashboardCustomSettings, setDashboardCustomSettings] = useState<DashboardCustomSettings>(defaultDashboardCustomSettings);
  const [discretionaryDraftTopId, setDiscretionaryDraftTopId] = useState(defaultDashboardCustomSettings.discretionary_category_ids[0] ?? "asset_cat_cash");
  const [discretionaryDraftSecondId, setDiscretionaryDraftSecondId] = useState("");
  const [discretionaryDraftThirdId, setDiscretionaryDraftThirdId] = useState("");
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
  const [preferenceSaveFeedback, setPreferenceSaveFeedback] = useState<string | null>(null);
  const [onboardingDraftHydrated, setOnboardingDraftHydrated] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("2026-04");
  const [activeHealthSection, setActiveHealthSection] = useState<HealthSection>("总览");
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("年初至今");
  const [kpisExpanded, setKpisExpanded] = useState(false);
  const [expandedDashboardLists, setExpandedDashboardLists] = useState<Record<string, boolean>>({});
  const [dashboardDetail, setDashboardDetail] = useState<string | null>(null);
  const [dashboardTooltip, setDashboardTooltip] = useState<DashboardTooltipState>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [selectedReturnGroup, setSelectedReturnGroup] = useState("全球资产");
  const effectiveOnboardingStep = view === "preferences" ? ([0, 2, 3][onboardingStep] ?? 0) : onboardingStep;
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(() => {
    const savedTheme = window.localStorage.getItem("financial-planning-dashboard-theme");
    return savedTheme === "sage" || savedTheme === "graphite" || savedTheme === "champagne" ? savedTheme : "champagne";
  });
  const [csvPath, setCsvPath] = useState(defaultSharkCsvPath);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [pendingOverwriteImport, setPendingOverwriteImport] = useState<{ filePath: string; expectedMonth: string } | null>(null);
  const [monthlyMessage, setMonthlyMessage] = useState<string | null>(null);
  const [expenseReview, setExpenseReview] = useState<TransactionReview | null>(null);
  const [incomeReview, setIncomeReview] = useState<TransactionReview | null>(null);
  const [manualExpense, setManualExpense] = useState({ date: "2026-04-30", amount: "", currency: "CNY" as CurrencyCode, categoryId: "", note: "" });
  const [manualIncome, setManualIncome] = useState({ date: "2026-04-30", amount: "", currency: "CNY" as CurrencyCode, categoryId: "", note: "" });
  const [detailExpanded, setDetailExpanded] = useState({ expense: false, income: false });
  const [reviewFilters, setReviewFilters] = useState<Record<"expense" | "income", ReviewFilters>>({
    expense: { categoryId: "", date: "", minAmount: "", maxAmount: "" },
    income: { categoryId: "", date: "", minAmount: "", maxAmount: "" }
  });
  const [duplicatePanelRowId, setDuplicatePanelRowId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<StepKey, boolean>>({
    import: false,
    expense: false,
    income: false,
    assets: false,
    creditCard: false,
    final: false
  });
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState({ expense: false, income: false });
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>("CNY");
  const [autoRates, setAutoRates] = useState<Record<string, FxRateEntry>>({});
  const [confirmingReview, setConfirmingReview] = useState<"expense" | "income" | null>(null);
  const [batchingAnomalyAction, setBatchingAnomalyAction] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState<Record<"expense" | "income", string>>({ expense: "", income: "" });
  const [addingCategoryRowId, setAddingCategoryRowId] = useState<string | null>(null);
  const [newCategoryDraft, setNewCategoryDraft] = useState<NewCategoryDraft>({ name: "", rigidity: "flexible", isPersonal: true, note: "" });
  const [assetItems, setAssetItems] = useState<AssetEntryItem[]>([]);
  const [clearedWithoutSellOverrides, setClearedWithoutSellOverrides] = useState<Record<string, boolean>>({});
  const [savingAssets, setSavingAssets] = useState(false);
  const [showAssetCreator, setShowAssetCreator] = useState(false);
  const [newAsset, setNewAsset] = useState<NewAssetForm>({
    name: "",
    topCategory: "asset_cat_cash",
    fundCategory: "asset_sub_us_market",
    cashCategory: "asset_sub_bank_payment",
    usEquityCategory: "asset_sub_sp500",
    currency: "CNY",
    platform: "支付宝",
    tags: "",
    monthEndAmount: "",
    isDca: false,
    status: "active",
    note: ""
  });
  const [newAssetDcaPlans, setNewAssetDcaPlans] = useState<DcaPlanDraft[]>([
    { frequency: "monthly", amount: "", weeklyDay: "1", monthlyDay: "1" }
  ]);
  const [newAssetCashflows, setNewAssetCashflows] = useState<AssetCashflowItem[]>([]);
  const [dcaCashflows, setDcaCashflows] = useState<AssetCashflowItem[]>([]);
  const [assetSummaryExpanded, setAssetSummaryExpanded] = useState({ buy: false, sell: false });
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({});
  const [assetValidationIssue, setAssetValidationIssue] = useState<{ message: string; assetId?: string } | null>(null);
  const [creditCards, setCreditCards] = useState<CreditCardEntry[]>([]);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<AssetSectionKey, boolean>>({
    creator: true,
    summary: true,
    assets: true,
    creditCard: true,
    expense: true,
    income: true
  });
  const [selectedDcaFlowId, setSelectedDcaFlowId] = useState<string | null>(null);
  const [confirmedDcaAdjustments, setConfirmedDcaAdjustments] = useState<Record<string, boolean>>({});
  const [contentTemplates, setContentTemplates] = useState<ContentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState({
    id: null as string | null,
    name: "",
    template_type: "monthly_report" as TemplateType,
    content: "",
    is_default: false,
    note: ""
  });
  const [templatePreviewMonth, setTemplatePreviewMonth] = useState("2026-04");
  const [templatePreview, setTemplatePreview] = useState<TemplateRenderResult | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [reportTemplateId, setReportTemplateId] = useState<string>("");
  const [reportPreview, setReportPreview] = useState<TemplateRenderResult | null>(null);
  const [mobileSyncSummary, setMobileSyncSummary] = useState<MobileSyncSummary | null>(null);
  const [mobilePairingInfo, setMobilePairingInfo] = useState<MobilePairingInfo | null>(null);
  const [mobileSyncMessage, setMobileSyncMessage] = useState<string | null>(null);
  const [mobileSyncExpanded, setMobileSyncExpanded] = useState(false);
  const [mobilePairingDialogOpen, setMobilePairingDialogOpen] = useState(false);
  const environmentLabel = security?.environment_label || (browserPreviewSummary ? "Demo" : "");
  const isDemoEnvironment = environmentLabel.toLowerCase() === "demo";
  const isTestEnvironment = environmentLabel.toLowerCase() === "test";
  const shouldShowInitialPasswordSetup = Boolean(
    security &&
      !security.password_set &&
      !initialPasswordSetupSkipped &&
      onboardingStatus &&
      !onboardingStatus.completed
  );

  useEffect(() => {
    if (browserPreviewSummary) {
      setSummary(browserPreviewSummary);
      if (browserPreviewSummary.snapshot_month) {
        const updateMonth = nextPeriodMonth(browserPreviewSummary.snapshot_month);
        applySelectedUpdateMonth(updateMonth);
        setTemplatePreviewMonth(browserPreviewSummary.snapshot_month);
      }
	      setSecurity({ password_set: true, unlocked: true, privacy_mode: false });
	      setOnboardingStatus({
	        completed: true,
		        target_saving_rate: browserPreviewSummary.target_saving_rate,
			        dashboard_enabled_sections: defaultOnboardingSections,
			        dashboard_enabled_items: defaultDashboardItemIds,
			        dashboard_custom_settings: defaultDashboardCustomSettings,
			        custom_analysis_prompts: [],
			        allocation_targets: [],
			        skip_allocation_targets: true,
			        asset_category_tree: cloneAssetCategoryTree(),
	        asset_count: browserPreviewSummary.asset_count,
	        portfolio_target_count: browserPreviewSummary.portfolio_targets.length
	      });
	      setDashboardCustomSettings(defaultDashboardCustomSettings);
	      setLoadState("ready");
	      return;
	    }
	    invoke<SecurityStatus>("get_security_status")
	      .then((result) => {
	        setSecurity(result);
	        if (result.unlocked) {
	          return Promise.all([
	            invoke<DashboardSeedSummary>("get_dashboard_seed_summary"),
	            invoke<string>("get_shark_csv_path"),
	            invoke<OnboardingStatus>("get_onboarding_status")
	          ]);
	        }
	        setLoadState("ready");
	        return null;
	      })
	      .then((result) => {
	        if (result) {
	          setSummary(result[0]);
          if (result[0].snapshot_month) {
            const updateMonth = nextPeriodMonth(result[0].snapshot_month);
            applySelectedUpdateMonth(updateMonth);
            setTemplatePreviewMonth(result[0].snapshot_month);
	          }
	          setCsvPath(result[1]);
	          setOnboardingStatus(result[2]);
	          setOnboardingSavingRate(String(Math.round((result[2].target_saving_rate || 0.3) * 100)));
	          setOnboardingSections(result[2].dashboard_enabled_sections?.length ? result[2].dashboard_enabled_sections : defaultOnboardingSections);
	          setOnboardingDashboardItems(normalizeDashboardItemIds(result[2].dashboard_enabled_items?.length ? result[2].dashboard_enabled_items : defaultDashboardItemIds));
	          const cleanTree = result[2].asset_category_tree?.length ? normalizeAssetCategoryTreeDefaults(result[2].asset_category_tree) : cloneAssetCategoryTree();
		          setDashboardCustomSettings(normalizeDashboardCustomSettings(result[2].dashboard_custom_settings, cleanTree));
	          setAssetCategoryTree(cleanTree);
	          if (!result[2].completed) {
	            setView("onboarding");
	          }
	          setLoadState("ready");
	          void loadContentTemplates();
	        }
	      })
      .catch((err: unknown) => {
        setError(String(err));
        setLoadState("fallback");
      });
  }, []);

  useEffect(() => {
    setDcaCashflows((current) => generateDcaCashflowsForAssets(assetItems, selectedMonth, current));
  }, [assetItems, selectedMonth]);

  useEffect(() => {
    window.localStorage.setItem("financial-planning-dashboard-theme", dashboardTheme);
  }, [dashboardTheme]);

  useEffect(() => {
    if (browserPreviewSummary || !security?.unlocked) {
      setMobileSyncSummary(null);
      setMobilePairingInfo(null);
      return;
    }
    void refreshMobileSyncSummary();
    void refreshMobilePairingInfo();
    const timer = window.setInterval(() => {
      void refreshMobileSyncSummary();
      void refreshMobilePairingInfo();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [browserPreviewSummary, security?.unlocked]);

  useEffect(() => {
    if (browserPreviewSummary || !onboardingStatus || onboardingDraftHydrated) return;
    if (onboardingStatus.completed) {
      setOnboardingDraftHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(onboardingDraftStorageKey);
      if (!raw) {
        setOnboardingDraftHydrated(true);
        return;
      }
      const draft = JSON.parse(raw) as Partial<OnboardingDraftStorage>;
      const draftTree = draft.assetCategoryTree?.length
        ? normalizeAssetCategoryTreeDefaults(draft.assetCategoryTree)
        : onboardingStatus.asset_category_tree?.length
          ? normalizeAssetCategoryTreeDefaults(onboardingStatus.asset_category_tree)
          : cloneAssetCategoryTree();
      setOnboardingStep(Math.max(0, Math.min(Number(draft.step) || 0, 3)));
      setOnboardingSavingRate(typeof draft.savingRate === "string" ? draft.savingRate : "30");
      setAssetCategoryTree(draftTree);
      setOnboardingAssetDraft(normalizeOnboardingAssetDraft(draft.assetDraft ?? blankOnboardingAsset(), draftTree));
      setOnboardingAssets((draft.assets ?? []).map((asset) => normalizeOnboardingAssetDraft(asset, draftTree)));
      setOnboardingSkipAssets(Boolean(draft.skipAssets));
      setOnboardingTargets(draft.targets ?? []);
      setOnboardingSkipTargets(Boolean(draft.skipTargets));
      setOnboardingSubTargetDraftParent(draft.subTargetDraftParent ?? "asset_cat_cash");
      setOnboardingSubTargetDraftPercents(draft.subTargetDraftPercents ?? {});
	      setEditingSubTargetParentId(draft.editingSubTargetParentId ?? null);
	      setOnboardingSections(draft.sections?.length ? draft.sections : defaultOnboardingSections);
		      setOnboardingDashboardItems(normalizeDashboardItemIds(draft.dashboardItems?.length ? draft.dashboardItems : defaultDashboardItemIds));
		      setDashboardCustomSettings(normalizeDashboardCustomSettings(draft.dashboardCustomSettings, draftTree));
    } catch {
      window.localStorage.removeItem(onboardingDraftStorageKey);
    } finally {
      setOnboardingDraftHydrated(true);
    }
  }, [browserPreviewSummary, onboardingDraftHydrated, onboardingStatus]);

  useEffect(() => {
    if (browserPreviewSummary || !onboardingDraftHydrated || onboardingStatus?.completed) return;
    const draft: OnboardingDraftStorage = {
      step: onboardingStep,
      savingRate: onboardingSavingRate,
      assetDraft: onboardingAssetDraft,
      assetCategoryTree,
      assets: onboardingAssets,
      skipAssets: onboardingSkipAssets,
      targets: onboardingTargets,
      skipTargets: onboardingSkipTargets,
      subTargetDraftParent: onboardingSubTargetDraftParent,
      subTargetDraftPercents: onboardingSubTargetDraftPercents,
	      editingSubTargetParentId,
	      sections: onboardingSections,
		      dashboardItems: onboardingDashboardItems,
		      dashboardCustomSettings
		    };
    window.localStorage.setItem(onboardingDraftStorageKey, JSON.stringify(draft));
  }, [
	    assetCategoryTree,
	    browserPreviewSummary,
		    dashboardCustomSettings,
	    onboardingDashboardItems,
    onboardingAssetDraft,
    onboardingAssets,
    onboardingDraftHydrated,
    onboardingSavingRate,
    onboardingSections,
    onboardingSkipAssets,
    onboardingSkipTargets,
    onboardingSubTargetDraftParent,
    onboardingSubTargetDraftPercents,
    onboardingStatus?.completed,
    onboardingStep,
    onboardingTargets,
    editingSubTargetParentId
  ]);

  useEffect(() => {
    void syncNeededRates(false);
  }, [expenseReview, incomeReview, assetItems, dcaCashflows, displayCurrency, selectedMonth]);

  const privacyMode = Boolean(security?.privacy_mode);
  percentPrivacyMode = privacyMode;
  const effectiveDashboardItems = normalizeDashboardItemIds(onboardingStatus?.dashboard_enabled_items?.length
    ? onboardingStatus.dashboard_enabled_items
    : defaultDashboardItemIds);
  const enabledDashboardItemSet = useMemo(() => new Set(effectiveDashboardItems), [effectiveDashboardItems]);
  const visibleHealthSections = useMemo(() => {
    const enabled = onboardingStatus?.dashboard_enabled_sections?.length
      ? onboardingStatus.dashboard_enabled_sections
      : defaultOnboardingSections;
    const allowed = new Set(enabled);
    const visible = healthSections.filter((section) => allowed.has(section));
    return visible.length > 0 ? visible : healthSections;
  }, [onboardingStatus?.dashboard_enabled_sections]);

  const onboardingTopOptions = useMemo(() => categoryOptions(assetCategoryTree), [assetCategoryTree]);
  const onboardingSecondOptions = useMemo(() => {
    const topNode = findAssetCategoryNode(assetCategoryTree, onboardingAssetDraft.topCategory);
    return categoryOptions(topNode?.children ?? []);
  }, [assetCategoryTree, onboardingAssetDraft.topCategory]);
  const onboardingSecondValue = isCashCategoryId(onboardingAssetDraft.topCategory) ? onboardingAssetDraft.cashCategory : onboardingAssetDraft.fundCategory;
  const onboardingThirdOptions = useMemo(() => {
    const secondNode = findAssetCategoryNode(assetCategoryTree, onboardingSecondValue);
    return categoryOptions(secondNode?.children ?? []);
  }, [assetCategoryTree, onboardingSecondValue]);
  const onboardingMainAllocationOptions = useMemo(() => {
    const seen = new Set<string>();
    const rows: string[][] = [];
    const push = (id: string, label: string) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      rows.push([id, label]);
    };
    assetCategoryTree.forEach((top) => {
      if (top.id.startsWith("asset_cat_")) push(top.id, top.label);
    });
    return rows.length ? rows : mainAllocationOptions;
  }, [assetCategoryTree]);
  const currentAssetMainAllocationOptions = useMemo(() => {
    const seen = new Set<string>();
    const rows: string[][] = [];
    assetItems
      .filter((asset) => isAssetCountedInMonth(asset))
      .forEach((asset) => {
        const categoryId = asset.main_asset_category_id || "asset_cat_cash";
        if (seen.has(categoryId)) return;
        seen.add(categoryId);
        rows.push([categoryId, optionLabel(onboardingMainAllocationOptions, categoryId) || asset.main_category || categoryId]);
      });
    return rows;
  }, [assetItems, onboardingMainAllocationOptions]);
  const savedStatusAllocationTargets = useMemo(
    () => allocationTargetsForEditor(onboardingStatus?.allocation_targets ?? []),
    [onboardingStatus?.allocation_targets]
  );
  const savedMainTargetByCategory = useMemo(() => {
    const rows = new Map<string, OnboardingAllocationTarget>();
    savedStatusAllocationTargets
      .filter((target) => target.level === "main" && target.category_id)
      .forEach((target) => rows.set(target.category_id as string, target));
    return rows;
  }, [savedStatusAllocationTargets]);
  const savedMainAllocationOptions = useMemo(() => {
    const seen = new Set<string>();
    const rows: string[][] = [];
    savedStatusAllocationTargets
      .filter((target) => target.level === "main" && target.category_id)
      .forEach((target) => {
        const categoryId = target.category_id as string;
        if (seen.has(categoryId)) return;
        seen.add(categoryId);
        rows.push([categoryId, target.label || optionLabel(onboardingMainAllocationOptions, categoryId)]);
      });
    return rows;
  }, [onboardingMainAllocationOptions, savedStatusAllocationTargets]);
  const onboardingSubAllocationOptions = useMemo(() => {
    const rows: Record<string, string[][]> = {};
    const visit = (node: AssetCategoryNode) => {
      if ((node.children ?? []).length > 0) rows[node.id] = categoryOptions(node.children);
      node.children.forEach(visit);
    };
    assetCategoryTree.forEach(visit);
    return Object.keys(rows).length ? rows : subAllocationOptions;
  }, [assetCategoryTree]);
  const onboardingTargetParentOptions = useMemo(() => {
    const rows: string[][] = [];
    const visit = (node: AssetCategoryNode) => {
      if ((node.children ?? []).length > 0) rows.push([node.id, assetCategoryPathLabel(assetCategoryTree, node.id)]);
      node.children.forEach(visit);
    };
    assetCategoryTree.forEach(visit);
    return rows.length ? rows : onboardingMainAllocationOptions;
  }, [assetCategoryTree, onboardingMainAllocationOptions]);
  const onboardingSelectedMainAllocationOptions = useMemo(() => {
    if (view === "preferences") {
      const seen = new Set<string>();
      const rows: string[][] = [];
      [...currentAssetMainAllocationOptions, ...savedMainAllocationOptions].forEach(([id, label]) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        rows.push([id, label]);
      });
      if (rows.length > 0) return rows;
    }
    if (onboardingSkipAssets || onboardingAssets.length === 0) return onboardingMainAllocationOptions;
    const seen = new Set<string>();
    const rows: string[][] = [];
    onboardingAssets.forEach((asset) => {
      const classification = resolveOnboardingAssetClassification(asset, assetCategoryTree);
      if (!classification.mainCategoryId || seen.has(classification.mainCategoryId)) return;
      seen.add(classification.mainCategoryId);
      rows.push([classification.mainCategoryId, optionLabel(onboardingMainAllocationOptions, classification.mainCategoryId)]);
    });
    return rows.length ? rows : onboardingMainAllocationOptions;
  }, [assetCategoryTree, currentAssetMainAllocationOptions, onboardingAssets, onboardingMainAllocationOptions, onboardingSkipAssets, savedMainAllocationOptions, view]);
  const assetAllocationPreferenceIssue = useMemo(() => {
    const targetRows = onboardingTargets.filter((target) => target.level === "main" && target.category_id);
    const targetSubRows = onboardingTargets.filter((target) => target.level === "sub" && target.parent_category_id && target.category_id);
    if (targetRows.length === 0 || currentAssetMainAllocationOptions.length === 0) return null;
    const currentIds = new Set(currentAssetMainAllocationOptions.map(([id]) => id));
    const targetIds = new Set(targetRows.map((target) => target.category_id as string));
    const missingRows = currentAssetMainAllocationOptions.filter(([id]) => !targetIds.has(id));
    const staleRows = targetRows.filter((target) => !currentIds.has(target.category_id as string));
    const currentSubRowsByKey = new Map<string, { parentId: string; categoryId: string; label: string }>();
    assetItems
      .filter((asset) => isAssetCountedInMonth(asset))
      .forEach((asset) => {
        const parentId = asset.main_asset_category_id || "asset_cat_cash";
        const categoryId = asset.sub_asset_category_id || "";
        if (!categoryId) return;
        const categoryParent = findAssetCategoryParent(assetCategoryTree, categoryId);
        const parentLabel = optionLabel(onboardingMainAllocationOptions, parentId) || assetCategoryPathLabel(assetCategoryTree, parentId) || asset.main_category || parentId;
        if (categoryParent && categoryParent.id !== parentId) {
          const middleId = categoryParent.id;
          const middleLabel = assetCategoryPathLabel(assetCategoryTree, middleId);
          currentSubRowsByKey.set(`${parentId}|${middleId}`, { parentId, categoryId: middleId, label: middleLabel });
          currentSubRowsByKey.set(`${middleId}|${categoryId}`, { parentId: middleId, categoryId, label: assetCategoryPathLabel(assetCategoryTree, categoryId) });
          return;
        }
        const subLabel = (onboardingSubAllocationOptions[parentId] ?? []).find(([id]) => id === categoryId)?.[1] ?? assetCategoryPathLabel(assetCategoryTree, categoryId) ?? asset.sub_category ?? categoryId;
        currentSubRowsByKey.set(`${parentId}|${categoryId}`, { parentId, categoryId, label: `${parentLabel} / ${subLabel}` });
      });
    const currentSubRows = [...currentSubRowsByKey.values()];
    const currentSubKeys = new Set(currentSubRows.map((row) => `${row.parentId}|${row.categoryId}`));
    const targetSubKeys = new Set(targetSubRows.map((target) => `${target.parent_category_id}|${target.category_id}`));
    const targetSubParents = new Set(targetSubRows.map((target) => target.parent_category_id as string));
    const missingSubRows = currentSubRows.filter((row) => targetSubParents.has(row.parentId) && !targetSubKeys.has(`${row.parentId}|${row.categoryId}`));
    const staleSubRows = targetSubRows.filter((target) => !currentSubKeys.has(`${target.parent_category_id}|${target.category_id}`));
    if (missingRows.length === 0 && staleRows.length === 0 && missingSubRows.length === 0 && staleSubRows.length === 0) return null;
    const missingText = missingRows.map(([, label]) => label).join("、");
    const staleText = staleRows.map((target) => target.label || optionLabel(onboardingMainAllocationOptions, target.category_id ?? "")).join("、");
    const missingSubText = missingSubRows.map((row) => row.label).join("、");
    const staleSubText = staleSubRows.map((target) => {
      const parentId = target.parent_category_id ?? "";
      const categoryId = target.category_id ?? "";
      return target.label || `${optionLabel(onboardingTargetParentOptions, parentId)} / ${optionLabel(onboardingSubAllocationOptions[parentId] ?? [], categoryId)}`;
    }).join("、");
    return [
      "资产类别和目标配比不一致。",
      missingText ? `未纳入目标配比：${missingText}。` : "",
      staleText ? `目标配比里暂无当月资产：${staleText}。` : "",
      missingSubText ? `未纳入下级配比：${missingSubText}。` : "",
      staleSubText ? `下级配比里暂无当月资产：${staleSubText}。` : "",
      "建议重新设置配比偏好，否则看板里的资产配置差值图可能不完整。"
    ].filter(Boolean).join("");
  }, [assetCategoryTree, assetItems, currentAssetMainAllocationOptions, onboardingMainAllocationOptions, onboardingSubAllocationOptions, onboardingTargetParentOptions, onboardingTargets]);

  useEffect(() => {
    if (!visibleHealthSections.includes(activeHealthSection)) {
      setActiveHealthSection(visibleHealthSections[0] ?? "总览");
    }
  }, [activeHealthSection, visibleHealthSections]);

  useEffect(() => {
    setOnboardingAssetDraft((current) => {
      const normalized = normalizeOnboardingAssetDraft(current, assetCategoryTree);
      return JSON.stringify(normalized) === JSON.stringify(current) ? current : normalized;
    });
    setDashboardCustomSettings((current) => normalizeDashboardCustomSettings(current, assetCategoryTree));
  }, [assetCategoryTree]);

  useEffect(() => {
    const firstTopId = categoryOptions(assetCategoryTree)[0]?.[0] ?? "asset_cat_cash";
    if (!findAssetCategoryNode(assetCategoryTree, discretionaryDraftTopId)) {
      setDiscretionaryDraftTopId(firstTopId);
      setDiscretionaryDraftSecondId("");
      setDiscretionaryDraftThirdId("");
      return;
    }
    if (discretionaryDraftSecondId && !findAssetCategoryNode(assetCategoryTree, discretionaryDraftSecondId)) {
      setDiscretionaryDraftSecondId("");
      setDiscretionaryDraftThirdId("");
      return;
    }
    if (discretionaryDraftThirdId && !findAssetCategoryNode(assetCategoryTree, discretionaryDraftThirdId)) {
      setDiscretionaryDraftThirdId("");
    }
  }, [assetCategoryTree, discretionaryDraftSecondId, discretionaryDraftThirdId, discretionaryDraftTopId]);

			  useEffect(() => {
			    if (effectiveOnboardingStep !== 2 || onboardingSkipTargets) return;
			    setOnboardingTargets((current) => {
	      const nextMainTargets = buildMainTargetsWithSavedValues(
	        onboardingSelectedMainAllocationOptions,
	        current,
	        savedMainTargetByCategory,
	        editedMainTargetIds
	      );
	      const otherTargets = current.filter((target) => target.level !== "main");
		      const nextTargets = [...nextMainTargets, ...otherTargets];
		      return JSON.stringify(nextTargets) === JSON.stringify(current) ? current : nextTargets;
		    });
			  }, [editedMainTargetIds, effectiveOnboardingStep, onboardingSelectedMainAllocationOptions, onboardingSkipTargets, savedMainTargetByCategory]);

  useEffect(() => {
    const firstParent = onboardingTargetParentOptions[0]?.[0] ?? "asset_cat_cash";
    if (!onboardingTargetParentOptions.some(([id]) => id === onboardingSubTargetDraftParent)) {
      setOnboardingSubTargetDraftParent(firstParent);
      setOnboardingSubTargetDraftPercents({});
      setEditingSubTargetParentId(null);
    }
  }, [onboardingSubTargetDraftParent, onboardingTargetParentOptions]);

  const maxAmount = useMemo(
    () => Math.max(...summary.portfolio_targets.map((item) => item.current_amount), 1),
    [summary.portfolio_targets]
  );

  const dashboardTrends = useMemo(() => {
    const trends = [...summary.monthly_trends]
      .filter((item) => !summary.snapshot_month || item.period_month <= summary.snapshot_month)
      .sort((a, b) => a.period_month.localeCompare(b.period_month));
    if (dashboardRange === "本月") return trends.filter((item) => item.period_month === summary.snapshot_month);
    if (dashboardRange === "3个月") return trends.slice(-3);
    if (dashboardRange === "年初至今") return trends.filter((item) => item.period_month.startsWith(summary.snapshot_month.slice(0, 4)));
    if (dashboardRange === "整年趋势") return trends.filter((item) => item.period_month.startsWith(summary.snapshot_month.slice(0, 4)));
    return trends;
  }, [dashboardRange, summary.monthly_trends, summary.snapshot_month]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const isMonthUpdated = summary.snapshot_month === currentMonth;
  const primaryActionLabel = isMonthUpdated ? "查看财务健康" : "开始月底更新";
  const primaryActionView: AppView = isMonthUpdated ? "healthDashboard" : "monthlyUpdate";

  function rateKey(date: string, from: CurrencyCode, to: CurrencyCode) {
    return `${date}|${from}|${to}`;
  }

  function monthEndDate(periodMonth = selectedMonth) {
    const [year, month] = periodMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${periodMonth}-${String(lastDay).padStart(2, "0")}`;
  }

  function nextMonthlyUpdateMonth(snapshotMonth = summary.snapshot_month, seed: DashboardSeedSummary = summary) {
    if (!snapshotMonth) return currentMonth;
    const snapshotTrend = seed.monthly_trends.find((item) => item.period_month === snapshotMonth);
    const isOnlyInitialSnapshot =
      snapshotMonth === currentMonth &&
      Boolean(snapshotTrend) &&
      Math.abs(snapshotTrend?.income ?? 0) < 0.000_001 &&
      Math.abs(snapshotTrend?.expense ?? 0) < 0.000_001 &&
      Math.abs(snapshotTrend?.credit_card_net_adjustment ?? 0) < 0.000_001;
    return isOnlyInitialSnapshot ? snapshotMonth : nextPeriodMonth(snapshotMonth);
  }

  function applySelectedUpdateMonth(month: string) {
    setSelectedMonth(month);
    const endDate = monthEndDate(month);
    setManualExpense((current) => ({ ...current, date: endDate }));
    setManualIncome((current) => ({ ...current, date: endDate }));
  }

  function collectNeededRateKeys() {
    const keys = new Set<string>();
    const addNeed = (date: string, from: CurrencyCode, to: CurrencyCode) => {
      if (!date || from === to || from === "OTHER" || to === "OTHER") return;
      keys.add(rateKey(date, from, to));
    };
    [...(expenseReview?.rows ?? []), ...(incomeReview?.rows ?? [])].forEach((row) => {
      const currency = row.currency ?? "CNY";
      addNeed(row.transaction_date, currency, displayCurrency);
      addNeed(row.transaction_date, currency, "CNY");
    });
    assetItems.forEach((asset) => {
      const assetCurrency = asset.currency || "CNY";
      if (isAssetCountedInMonth(asset)) {
        addNeed(monthEndDate(), assetCurrency, displayCurrency);
        addNeed(monthEndDate(), assetCurrency, "CNY");
      }
      (asset.cashflows ?? []).forEach((flow) => {
        const currency = flow.currency || assetCurrency;
        addNeed(flow.flow_date, currency, displayCurrency);
        addNeed(flow.flow_date, currency, "CNY");
      });
    });
    dcaCashflows.forEach((flow) => {
      const currency = flow.currency ?? "CNY";
      addNeed(flow.flow_date, currency, displayCurrency);
      addNeed(flow.flow_date, currency, "CNY");
    });
    return Array.from(keys);
  }

  function parseRateKey(key: string) {
    const [date, from, to] = key.split("|") as [string, CurrencyCode, CurrencyCode];
    return { date, from, to };
  }

  function rateEntryFromRecord(record: FxRateRecord): FxRateEntry {
    return {
      status: record.status,
      rate: record.rate ?? undefined,
      sourceDate: record.source_date ?? record.rate_date,
      primarySource: record.primary_source ?? undefined,
      secondaryRate: record.secondary_rate ?? undefined,
      secondarySource: record.secondary_source ?? undefined,
      variancePct: record.variance_pct ?? undefined,
      isOverridden: record.is_overridden,
      overrideReason: record.override_reason ?? null,
      message: record.message ?? undefined
    };
  }

  async function loadCachedRates(keys: string[]) {
    if (keys.length === 0) return {};
    const records = await invoke<FxRateRecord[]>("list_fx_rates", {
      keys: keys.map((key) => {
        const { date, from, to } = parseRateKey(key);
        return { rate_date: date, from_currency: from, to_currency: to };
      })
    });
    return records.reduce<Record<string, FxRateEntry>>((map, record) => {
      map[rateKey(record.rate_date, record.from_currency, record.to_currency)] = rateEntryFromRecord(record);
      return map;
    }, {});
  }

  async function fetchPrimaryRate(date: string, from: CurrencyCode, to: CurrencyCode) {
    const response = await fetch(
      `https://api.frankfurter.app/${encodeURIComponent(date)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    if (!response.ok) throw new Error(`Frankfurter HTTP ${response.status}`);
    const data = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const rate = data.rates?.[to];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("Frankfurter 未返回有效汇率");
    }
    return { rate, sourceDate: data.date ?? date, source: "Frankfurter" };
  }

  async function fetchSecondaryRate(date: string, from: CurrencyCode, to: CurrencyCode) {
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    const response = await fetch(
      `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/${encodeURIComponent(date)}/currencies/${encodeURIComponent(fromLower)}/${encodeURIComponent(toLower)}.json`
    );
    if (!response.ok) throw new Error(`Currency API HTTP ${response.status}`);
    const data = (await response.json()) as Record<string, number | string>;
    const rate = data[toLower];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("第二来源未返回有效汇率");
    }
    return { rate, sourceDate: String(data.date ?? date), source: "Currency API" };
  }

  async function syncNeededRates(force = false) {
    const keys = collectNeededRateKeys();
    const cachedRates = await loadCachedRates(keys);
    setAutoRates((current) => ({ ...current, ...cachedRates }));
    const keysToFetch = keys.filter((key) => {
      const entry = cachedRates[key] ?? autoRates[key];
      if (entry?.isOverridden) return false;
      if (force) return true;
      return !entry || entry.status === "missing" || entry.status === "error";
    });
    keysToFetch.forEach((key) => {
      setAutoRates((current) => ({ ...current, [key]: { ...current[key], status: "loading" } }));
      void fetchAutoRate(key);
    });
  }

  async function fetchAutoRate(key: string) {
    const { date, from, to } = parseRateKey(key);
    if (from === to) {
      setAutoRates((current) => ({ ...current, [key]: { status: "ready", rate: 1, sourceDate: date } }));
      return;
    }
    if (from === "OTHER" || to === "OTHER") {
      setAutoRates((current) => ({ ...current, [key]: { status: "missing", message: "其他币种开发中" } }));
      return;
    }
    try {
      const primaryResult = await fetchPrimaryRate(date, from, to)
        .then((value) => ({ value, error: null as string | null }))
        .catch((err) => ({ value: null, error: String(err) }));
      const secondaryResult = await fetchSecondaryRate(date, from, to)
        .then((value) => ({ value, error: null as string | null }))
        .catch((err) => ({ value: null, error: String(err) }));
      const primary = primaryResult.value;
      const secondary = secondaryResult.value;
      const active = primary ?? secondary;
      if (!active) {
        throw new Error(`主来源失败：${primaryResult.error ?? "未知错误"}；第二来源失败：${secondaryResult.error ?? "未知错误"}`);
      }
      const secondaryRate = primary && secondary ? secondary.rate : undefined;
      const variancePct = primary && secondary ? Math.abs(primary.rate - secondary.rate) / primary.rate : undefined;
      const status: FxRateEntry["status"] = !primary || !secondary || (variancePct !== undefined && variancePct > 0.005) ? "warning" : "ready";
      const message = primary && secondary
        ? status === "warning"
          ? `双来源差异 ${formatPercent(variancePct ?? 0)}，请检查。`
          : `双来源差异 ${formatPercent(variancePct ?? 0)}。`
        : primary
          ? `已用主来源换算；第二来源校验失败：${secondaryResult.error ?? "未知错误"}`
          : `主来源失败，已用第二来源兜底：${primaryResult.error ?? "未知错误"}`;
      const saved = await invoke<FxRateRecord>("save_fx_rate_cache", {
        input: {
          rate_date: date,
          source_date: active.sourceDate,
          from_currency: from,
          to_currency: to,
          rate: active.rate,
          primary_source: active.source,
          secondary_rate: secondaryRate ?? null,
          secondary_source: primary && secondary ? secondary.source : null,
          variance_pct: variancePct ?? null,
          status,
          message
        }
      });
      setAutoRates((current) => ({
        ...current,
        [key]: rateEntryFromRecord(saved)
      }));
    } catch (err) {
      setAutoRates((current) => ({
        ...current,
        [key]: { status: "error", message: String(err) }
      }));
    }
  }

  async function refreshAutoRates(force = true) {
    collectNeededRateKeys().forEach((key) => {
      setAutoRates((current) => ({ ...current, [key]: { status: "loading" } }));
    });
    await syncNeededRates(force);
    setMonthlyMessage("汇率已重新获取，本页金额已按最新汇率重算。已确认过的模块如需写入新汇率，请重新点击对应确认按钮。");
  }

  async function overrideFxRate(key: string) {
    const { date, from, to } = parseRateKey(key);
    const rawRate = window.prompt(`输入 ${date} ${from} → ${to} 的单次覆盖汇率`);
    if (!rawRate) return;
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setMonthlyMessage("汇率必须是大于 0 的数字。");
      return;
    }
    const reason = window.prompt("覆盖原因，可空") ?? "";
    const saved = await invoke<FxRateRecord>("save_fx_rate_override", {
      input: {
        rate_date: date,
        from_currency: from,
        to_currency: to,
        rate,
        reason: reason || null
      }
    });
    setAutoRates((current) => ({ ...current, [key]: rateEntryFromRecord(saved) }));
    setMonthlyMessage(`${date} ${from} → ${to} 已手动单次覆盖。`);
  }

  function getRate(date: string, from: CurrencyCode, to: CurrencyCode) {
    if (from === to) return 1;
    if (from === "OTHER" || to === "OTHER") return null;
    const direct = autoRates[rateKey(date, from, to)];
    if ((direct?.status === "ready" || direct?.status === "warning") && direct.rate) return direct.rate;
    const reverse = autoRates[rateKey(date, to, from)];
    if ((reverse?.status === "ready" || reverse?.status === "warning") && reverse.rate) return 1 / reverse.rate;
    return null;
  }

  function convertAmount(amount: number, date: string, from: CurrencyCode = "CNY", to = displayCurrency) {
    const rate = getRate(date, from, to);
    if (rate === null || Number.isNaN(rate)) return null;
    return amount * rate;
  }

  function formatRowAmount(row: TransactionReviewRow) {
    const converted = convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY");
    if (converted === null) return `缺少汇率`;
    return formatCurrency(converted, privacyMode, displayCurrency);
  }

  function queueRatesForTransaction(row: TransactionReviewRow) {
    const currency = row.currency ?? "CNY";
    const keys = Array.from(
      new Set([
        rateKey(row.transaction_date, currency, displayCurrency),
        rateKey(row.transaction_date, currency, "CNY")
      ])
    );
    keys.forEach((key) => {
      const { from, to } = parseRateKey(key);
      if (from === to || from === "OTHER" || to === "OTHER") return;
      const current = autoRates[key];
      if (current?.isOverridden || current?.status === "ready" || current?.status === "warning" || current?.status === "loading") return;
      setAutoRates((rates) => ({ ...rates, [key]: { ...rates[key], status: "loading" } }));
      void fetchAutoRate(key);
    });
  }

	  function parseTags(raw: string) {
	    return parseTagsFromText(raw);
	  }

  function applyMonthlyStatus(status: MonthlyStepStatus) {
    setCompletedSteps({
      import: status.import,
      expense: status.expense,
      income: status.income,
      assets: status.assets,
      creditCard: status.credit_card,
      final: status.final_done
    });
  }

  async function loadMonthlyStatus(month = selectedMonth) {
    const status = await invoke<MonthlyStepStatus>("get_monthly_step_status", { periodMonth: month });
    applyMonthlyStatus(status);
  }

  async function markStep(stepKey: StepKey, completed = true) {
    const status = await invoke<MonthlyStepStatus>("set_monthly_step_status", {
      periodMonth: selectedMonth,
      stepKey,
      completed
    });
    applyMonthlyStatus(status);
  }

  async function markImportOnly(month: string) {
    await Promise.all([
      invoke<MonthlyStepStatus>("set_monthly_step_status", { periodMonth: month, stepKey: "import", completed: true }),
      invoke<MonthlyStepStatus>("set_monthly_step_status", { periodMonth: month, stepKey: "expense", completed: false }),
      invoke<MonthlyStepStatus>("set_monthly_step_status", { periodMonth: month, stepKey: "income", completed: false }),
      invoke<MonthlyStepStatus>("set_monthly_step_status", { periodMonth: month, stepKey: "assets", completed: false }),
      invoke<MonthlyStepStatus>("set_monthly_step_status", { periodMonth: month, stepKey: "creditCard", completed: false }),
      invoke<MonthlyStepStatus>("set_monthly_step_status", { periodMonth: month, stepKey: "final", completed: false })
    ]);
    setCompletedSteps({ import: true, expense: false, income: false, assets: false, creditCard: false, final: false });
  }

	  async function loadDashboard() {
	    setSuccessBanner("财务健康看板读取已发布看板库；月底更新未生成月报前，不会同步到这里。");
	    const result = await invoke<DashboardSeedSummary>("get_dashboard_seed_summary");
	    setSummary(result);
    if (result.snapshot_month) {
      applySelectedUpdateMonth(nextMonthlyUpdateMonth(result.snapshot_month, result));
      setTemplatePreviewMonth(result.snapshot_month);
    }
	    setLoadState("ready");
	  }

  function applyOnboardingStatus(status: OnboardingStatus) {
	    const cleanTree = status.asset_category_tree?.length ? normalizeAssetCategoryTreeDefaults(status.asset_category_tree) : cloneAssetCategoryTree();
		    setOnboardingStatus(status);
		    setOnboardingSavingRate(String(Math.round((status.target_saving_rate || 0.3) * 100)));
		    setOnboardingSections(status.dashboard_enabled_sections?.length ? status.dashboard_enabled_sections : defaultOnboardingSections);
			    setOnboardingDashboardItems(normalizeDashboardItemIds(status.dashboard_enabled_items?.length ? status.dashboard_enabled_items : defaultDashboardItemIds));
		    setDashboardCustomSettings(normalizeDashboardCustomSettings(status.dashboard_custom_settings, cleanTree));
				    setOnboardingTargets(allocationTargetsForEditor(status.allocation_targets ?? []));
			    setEditedMainTargetIds(new Set());
			    setOnboardingMainTargetDraftPercents({});
			    setOnboardingSkipTargets(Boolean(status.skip_allocation_targets ?? (status.allocation_targets ?? []).length === 0));
		    setAssetCategoryTree(cleanTree);
	    if (!status.completed) {
	      setView("onboarding");
	    }
	  }

	  async function refreshOnboardingStatus() {
	    const status = await invoke<OnboardingStatus>("get_onboarding_status");
	    applyOnboardingStatus(status);
	    return status;
	  }

	  async function openMonthlyUpdate() {
	    const updateMonth = nextMonthlyUpdateMonth();
	    applySelectedUpdateMonth(updateMonth);
	    setSuccessBanner(null);
	    setView("monthlyUpdate");
	    try {
	      await loadReview(updateMonth);
	    } catch (err) {
	      setMonthlyMessage(String(err));
	    }
	  }

		  async function openPreferences() {
		    setSuccessBanner(null);
		    setOnboardingMessage(null);
		    setOnboardingStep(0);
		    setOnboardingSkipAssets(true);
		    setOnboardingAssets([]);
		    try {
		      const status = await refreshOnboardingStatus();
			      const editorTargets = allocationTargetsForEditor(status.allocation_targets ?? []);
			      setOnboardingTargets(editorTargets);
			      setEditedMainTargetIds(new Set());
			      setOnboardingMainTargetDraftPercents({});
			      setOnboardingSkipTargets(Boolean(status.skip_allocation_targets ?? editorTargets.length === 0));
		      const preferenceAssets = await invoke<AssetEntryItem[]>("get_asset_entry_items", { periodMonth: selectedMonth || nextMonthlyUpdateMonth() });
			      setAssetItems(normalizeAssetEntryItems(preferenceAssets));
			      setOnboardingTargets(editorTargets);
			      setEditedMainTargetIds(new Set());
			      setOnboardingMainTargetDraftPercents({});
		    } catch (err) {
		      setOnboardingMessage(String(err));
		    }
		    setView("preferences");
		  }

	  async function openAllocationPreferences() {
	    await openPreferences();
	    setOnboardingStep(1);
	  }

  function applyTemplateToDraft(template: ContentTemplate) {
    setSelectedTemplateId(template.id);
    setTemplateDraft({
      id: template.id,
      name: template.name,
      template_type: template.template_type,
      content: template.content,
      is_default: template.is_default,
      note: template.note ?? ""
    });
    setTemplatePreview(null);
  }

  async function loadContentTemplates(preferredId?: string) {
    if (!isTauriRuntime) return;
    const templates = await invoke<ContentTemplate[]>("list_content_templates");
    setContentTemplates(templates);
    const selected = preferredId
      ? templates.find((item) => item.id === preferredId)
      : templates.find((item) => item.template_type === "monthly_report" && item.is_default) ?? templates[0];
    if (selected) {
      applyTemplateToDraft(selected);
      if (!reportTemplateId && selected.template_type === "monthly_report") setReportTemplateId(selected.id);
    }
  }

  function createBlankTemplate(templateType: TemplateType = "monthly_report") {
    setSelectedTemplateId(null);
    setTemplateDraft({
      id: null,
      name: `新的${templateTypeOptions.find((item) => item.id === templateType)?.label ?? "模板"}`,
      template_type: templateType,
      content: "{{月份}} 月收入 {{总收入}}，支出 {{总支出}}，储蓄率 {{储蓄率}}。",
      is_default: false,
      note: ""
    });
    setTemplatePreview(null);
    setTemplateMessage("正在新建模板。");
  }

  function insertTemplateVariable(variable: string) {
    setTemplateDraft((current) => ({
      ...current,
      content: `${current.content}${current.content.endsWith(" ") || current.content.length === 0 ? "" : " "}{{${variable}}}`
    }));
  }

  async function saveTemplateDraft() {
    setTemplateMessage(null);
    const saved = await invoke<ContentTemplate>("save_content_template", {
      input: {
        id: templateDraft.id,
        name: templateDraft.name,
        template_type: templateDraft.template_type,
        content: templateDraft.content,
        is_default: templateDraft.is_default,
        note: templateDraft.note || null
      }
    });
    setTemplateMessage("模板已保存。");
    await loadContentTemplates(saved.id);
    await loadDashboard();
  }

  async function copyTemplateDraft() {
    if (!templateDraft.id) {
      setTemplateMessage("请先保存当前模板，再复制。");
      return;
    }
    const copied = await invoke<ContentTemplate>("copy_content_template", { id: templateDraft.id });
    setTemplateMessage("模板副本已创建。");
    await loadContentTemplates(copied.id);
  }

  async function deleteTemplateDraft() {
    if (!templateDraft.id) {
      createBlankTemplate(templateDraft.template_type);
      return;
    }
    const templateId = templateDraft.id;
    setConfirmDialog({
      title: "删除模板",
      message: "这个模板会从内容模板设置里删除。已生成的历史月报不受影响。",
      confirmLabel: "删除",
      danger: true,
      onConfirm: async () => {
        await invoke("delete_content_template", { id: templateId });
        setTemplateMessage("模板已删除。");
        await loadContentTemplates();
        await loadDashboard();
      }
    });
  }

  async function setTemplateAsDefault() {
    if (!templateDraft.id) {
      setTemplateMessage("请先保存模板，再设为默认。");
      return;
    }
    const updated = await invoke<ContentTemplate>("set_default_content_template", { id: templateDraft.id });
    setTemplateMessage("已设为默认模板。");
    await loadContentTemplates(updated.id);
    await loadDashboard();
  }

  async function previewTemplateDraft() {
    setTemplateMessage(null);
    const result = await invoke<TemplateRenderResult>("render_content_template", {
      input: {
        template_id: templateDraft.id,
        template_type: templateDraft.template_type,
        period_month: templatePreviewMonth,
        privacy_mode: privacyMode,
        content_override: templateDraft.content
      }
    });
    setTemplatePreview(result);
  }

  async function renderMonthlyReportWithTemplate(templateId = reportTemplateId) {
    const result = await invoke<TemplateRenderResult>("render_content_template", {
      input: {
        template_id: templateId || null,
        template_type: "monthly_report",
        period_month: summary.snapshot_month,
        privacy_mode: privacyMode,
        content_override: null
      }
    });
    setReportPreview(result);
    setSummary((current) => ({ ...current, monthly_report_html: result.html }));
    setDashboardDetail(`月报已使用模板：${result.template_name}`);
  }

  async function rememberCsvPath(path: string) {
    try {
      const saved = await invoke<string>("save_shark_csv_path", { filePath: path });
      setCsvPath(saved);
    } catch (err) {
      setMonthlyMessage(String(err));
    }
  }

  async function chooseBillFilePath() {
    if (!isTauriRuntime) {
      setMonthlyMessage("本地文件选择只在桌面 App 中可用。");
      return null;
    }
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          { name: "账单文件", extensions: ["csv", "xlsx"] }
        ]
      });
      if (!selected || Array.isArray(selected)) return null;
      setCsvPath(selected);
      await rememberCsvPath(selected);
      return selected;
    } catch (err) {
      setMonthlyMessage(`打开文件选择失败：${String(err)}`);
      return null;
    }
  }

  async function handleSetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityMessage(null);
    if (password !== confirmPassword) {
      setSecurityMessage("两次密码不一致");
      return;
    }

    try {
      const result = await invoke<SecurityStatus>("set_app_password", { password });
      setSecurity(result);
	      setPassword("");
	      setConfirmPassword("");
	      await loadDashboard();
	      await refreshOnboardingStatus();
	      await loadContentTemplates();
	    } catch (err) {
      setSecurityMessage(String(err));
    }
  }

  function skipInitialPasswordSetup() {
    setInitialPasswordSetupSkipped(true);
    setSecurityMessage(null);
    setPassword("");
    setConfirmPassword("");
    if (!onboardingStatus?.completed) {
      setView("onboarding");
    }
  }

  function openSettings(tab: SyncTab = "sync") {
    setSettingsTab(tab);
    setSettingsOpen(true);
    setSettingsMessage(null);
    setCloudMessage(null);
    setSettingsCurrentPassword("");
    setSettingsNewPassword("");
    setSettingsConfirmPassword("");
    setSettingsResetPassword("");
    setSettingsResetConfirmText("");
  }

  function rememberCloudSession(session: CloudSession | null) {
    setCloudSession(session);
    if (session) {
      window.localStorage.setItem("worthtrace-cloud-session", JSON.stringify(session));
    } else {
      window.localStorage.removeItem("worthtrace-cloud-session");
      setCloudDrafts([]);
    }
  }

  async function refreshCloudDrafts(session = cloudSession) {
    if (!session) return;
    setCloudBusy(true);
    try {
      const drafts = await listPendingCloudDrafts(session);
      setCloudDrafts(drafts);
      setCloudMessage(drafts.length ? `云端有 ${drafts.length} 条手机草稿待处理。` : "云端暂无待处理草稿。");
    } catch (err) {
      setCloudMessage(`云同步读取失败：${String(err)}`);
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleCloudAuth(mode: "signin" | "signup") {
    setCloudMessage(null);
    if (mode === "signin") setCloudSignupSuggested(false);
    if (!cloudSyncConfigured()) {
      setCloudMessage("云同步还没有配置完成。");
      return;
    }
    if (!cloudEmail.trim() || cloudPassword.length < 6) {
      setCloudMessage("请输入邮箱和至少 6 位密码。");
      return;
    }
    setCloudBusy(true);
    try {
      const session = mode === "signup"
        ? await cloudSignUp(cloudEmail.trim(), cloudPassword)
        : await cloudSignIn(cloudEmail.trim(), cloudPassword);
      rememberCloudSession(session);
      setCloudPassword("");
      setCloudSignupSuggested(false);
      setCloudMessage(mode === "signup" ? "账号已创建并登录。" : "已登录账号同步。");
      await refreshCloudDrafts(session);
    } catch (err) {
      const message = friendlyCloudAuthError(err, mode);
      if (mode === "signin") {
        setCloudSignupSuggested(message.includes("新邮箱"));
        setCloudMessage(message);
      } else {
        setCloudSignupSuggested(false);
        setCloudMessage(message);
      }
    } finally {
      setCloudBusy(false);
    }
  }

  async function pullCloudDraftsToInbox() {
    if (!cloudSession) {
      setCloudMessage("请先登录账号。");
      return;
    }
    setCloudBusy(true);
    try {
      const drafts = cloudDrafts.length ? cloudDrafts : await listPendingCloudDrafts(cloudSession);
      if (!drafts.length) {
        setCloudMessage("云端暂无待处理草稿。");
        return;
      }
      await invoke("import_cloud_mobile_drafts", { drafts });
      await markCloudDraftsPulled(cloudSession, drafts.map((draft) => draft.id));
      await refreshMobileSyncSummary();
      setCloudDrafts([]);
      setCloudMessage(`已拉取 ${drafts.length} 条云端草稿到电脑收件箱。`);
    } catch (err) {
      setCloudMessage(`拉取失败：${String(err)}`);
    } finally {
      setCloudBusy(false);
    }
  }

  function cloudDashboardPayload(): Record<string, unknown> {
    return {
      snapshot_month: summary.snapshot_month,
      target_saving_rate: summary.target_saving_rate,
      asset_gross_value: summary.asset_gross_value,
      credit_card_net_adjustment: summary.credit_card_net_adjustment,
      net_worth: summary.net_worth,
      monthly_trends: summary.monthly_trends,
      expense_categories: summary.expense_categories,
      asset_allocations: summary.asset_allocations,
      portfolio_targets: summary.portfolio_targets,
      spending_anomalies: summary.spending_anomalies
    };
  }

  async function pushDashboardSnapshotToCloud() {
    if (!cloudSession) {
      setCloudMessage("请先登录账号。");
      return;
    }
    setCloudBusy(true);
    try {
      await upsertCloudDashboardSnapshot(cloudSession, summary.snapshot_month, cloudDashboardPayload());
      setCloudMessage(`已同步 ${summary.snapshot_month} 已发布月报看板到云端。手机端登录同一账号后会显示。`);
    } catch (err) {
      setCloudMessage(`看板同步失败：${String(err)}`);
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsMessage(null);
    if (security?.password_set && !settingsCurrentPassword.trim()) {
      setSettingsMessage("请输入当前密码。");
      return;
    }
    if (settingsNewPassword.length < 6) {
      setSettingsMessage("新密码至少 6 位。");
      return;
    }
    if (settingsNewPassword !== settingsConfirmPassword) {
      setSettingsMessage("两次新密码不一致。");
      return;
    }
    setSettingsBusy(true);
    try {
      const result = await invoke<SecurityStatus>("change_app_password", {
        currentPassword: security?.password_set ? settingsCurrentPassword : null,
        newPassword: settingsNewPassword
      });
      setSecurity(result);
      setInitialPasswordSetupSkipped(true);
      setSettingsCurrentPassword("");
      setSettingsNewPassword("");
      setSettingsConfirmPassword("");
      setSettingsMessage(security?.password_set ? "密码已修改。" : "密码已设置。");
    } catch (err) {
      setSettingsMessage(String(err).includes("invalid password") ? "当前密码不正确。" : String(err));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleResetAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsMessage(null);
    if (security?.password_set && !settingsResetPassword.trim()) {
      setSettingsMessage("请输入当前密码。");
      return;
    }
    if (settingsResetConfirmText !== "清空当前账号") {
      setSettingsMessage("请输入“清空当前账号”后才能继续。");
      return;
    }
    setSettingsBusy(true);
    try {
      window.localStorage.removeItem(onboardingDraftStorageKey);
      await invoke("reset_account", {
        currentPassword: security?.password_set ? settingsResetPassword : null
      });
      setSettingsMessage("账号已重置，App 即将退出。");
    } catch (err) {
      setSettingsMessage(String(err).includes("invalid password") ? "当前密码不正确。" : String(err));
      setSettingsBusy(false);
    }
  }

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityMessage(null);
    try {
      const result = await invoke<SecurityStatus>("unlock_app", { password });
      setSecurity(result);
      setPassword("");
	      const rememberedPath = await invoke<string>("get_shark_csv_path");
	      setCsvPath(rememberedPath);
	      await loadDashboard();
	      await refreshOnboardingStatus();
	      await loadContentTemplates();
	    } catch (err) {
      setSecurityMessage("密码不正确");
    }
  }

  async function handleLock() {
    if (browserPreviewSummary) {
      setSecurity((current) => ({ password_set: true, unlocked: false, privacy_mode: Boolean(current?.privacy_mode) }));
      return;
    }
    const result = await invoke<SecurityStatus>("lock_app");
    setSecurity(result);
  }

  async function handlePrivacyMode(enabled: boolean) {
    if (browserPreviewSummary) {
      setSecurity({ password_set: true, unlocked: true, privacy_mode: enabled });
      return;
    }
    const result = await invoke<SecurityStatus>("set_privacy_mode", { enabled });
    setSecurity(result);
  }

  async function loadReview(month = selectedMonth, applyStatus = true) {
    const [expense, income, assets, dcaFlows, cards, status] = await Promise.all([
      invoke<TransactionReview>("get_transaction_review", { periodMonth: month, transactionType: "expense" }),
      invoke<TransactionReview>("get_transaction_review", { periodMonth: month, transactionType: "income" }),
      invoke<AssetEntryItem[]>("get_asset_entry_items", { periodMonth: month }),
      invoke<AssetCashflowItem[]>("get_generated_dca_cashflows", { periodMonth: month }),
      invoke<CreditCardEntry[]>("get_credit_card_entries", { periodMonth: month }),
      invoke<MonthlyStepStatus>("get_monthly_step_status", { periodMonth: month })
    ]);
    const expenseRows = expense.rows.map((row) => ({ ...row, include_in_stats: row.include_in_stats ?? true }));
    const incomeRows = income.rows.map((row) => ({ ...row, include_in_stats: row.include_in_stats ?? true }));
    setExpenseReview({
      ...expense,
      rows: expenseRows.map((row) => ({ ...row, currency: row.currency ?? "CNY" }))
    });
    setIncomeReview({
      ...income,
      rows: incomeRows.map((row) => ({ ...row, currency: row.currency ?? "CNY" }))
    });
    setDetailExpanded({
      expense: hasReviewAnomaly(expenseRows),
      income: hasReviewAnomaly(incomeRows)
    });
    setAssetItems(normalizeAssetEntryItems(assets));
    setDcaCashflows(dcaFlows.map((flow) => ({ ...flow, currency: (flow.currency || "CNY") as CurrencyCode })));
    setCreditCards(cards);
    if (applyStatus) {
      applyMonthlyStatus(status);
    }
  }

  async function readConfirmationData() {
    const updateMonth = nextMonthlyUpdateMonth();
    applySelectedUpdateMonth(updateMonth);
    await loadReview(updateMonth, false);
    await markImportOnly(updateMonth);
    setSuccessBanner(`已读取 ${updateMonth} 确认数据。当前只标记导入账单完成。`);
  }

  function hasReviewAnomaly(rows: TransactionReviewRow[]) {
    return rows.some((row) => isPendingDuplicate(row) || isUnmappedCategoryAnomaly(row) || isLargeAmountAnomaly(row));
  }

  async function runSharkImport(overwriteExisting = false, importFilePath = csvPath, expectedMonthOverride?: string) {
    if (!importFilePath.trim()) {
      setMonthlyMessage("上传失败：请先选择或填写账单文件路径。");
      return;
    }
    setMonthlyMessage(overwriteExisting ? "正在覆盖上次导入..." : "正在导入鲨鱼账单...");
    try {
      const expectedMonth = expectedMonthOverride ?? nextMonthlyUpdateMonth();
      if (selectedMonth !== expectedMonth) {
        applySelectedUpdateMonth(expectedMonth);
      }
      const result = await invoke<ImportResult>("import_shark_csv", {
        filePath: importFilePath,
        expectedPeriodMonth: expectedMonth,
        overwriteExisting
      });
      setImportResult(result);
      const nextMonth = result.period_months[0] ?? expectedMonth;
      applySelectedUpdateMonth(nextMonth);
      await loadReview(nextMonth, false);
      await markImportOnly(nextMonth);
      if (result.duplicate_file) {
        setPendingOverwriteImport({ filePath: importFilePath, expectedMonth: nextMonth });
      } else {
        setPendingOverwriteImport(null);
      }
      setSuccessBanner(
        result.duplicate_file
          ? "检测到重复账单。请决定是否覆盖上次导入。"
          : result.overwritten_existing
            ? "账单已覆盖导入。"
            : "鲨鱼账单导入成功。"
      );
      const incomeNote =
        result.income_count === 0
          ? "收入 0 条。本文件没有收入记录，收入需要手动新增，或导入含收入的账单。"
          : `收入 ${result.income_count} 条`;
      const importBreakdown = `支出 ${result.expense_count} 条，${incomeNote}`;
      setMonthlyMessage(
        result.duplicate_file
          ? `这个文件已导入过。本次没有重复写入。已有 ${result.imported_count} 条（${importBreakdown}）。如需重来，请点击“覆盖上次导入”。`
          : result.overwritten_existing
            ? `覆盖完成：旧导入已删除，只保留最新导入的 ${result.imported_count} 条（${importBreakdown}），疑似重复 ${result.potential_duplicate_count} 条。`
          : `导入完成：${result.imported_count} 条（${importBreakdown}），疑似重复 ${result.potential_duplicate_count} 条。`
      );
    } catch (err) {
      const message = String(err).replace(/^invalid csv value: /, "");
      setSuccessBanner(null);
      setMonthlyMessage(message.startsWith("上传失败") ? message : `上传失败：${message}`);
    }
  }

  async function handleImportSharkCsv() {
    const selectedPath = await chooseBillFilePath();
    if (selectedPath) {
      await runSharkImport(false, selectedPath);
    }
  }

  async function overwritePreviousImport() {
    if (!pendingOverwriteImport) return;
    await runSharkImport(true, pendingOverwriteImport.filePath, pendingOverwriteImport.expectedMonth);
  }

  async function handleMonthChange(month: string) {
    setSelectedMonth(month);
    const endDate = monthEndDate(month);
    setManualExpense((current) => ({ ...current, date: endDate }));
    setManualIncome((current) => ({ ...current, date: endDate }));
    try {
      await loadReview(month);
    } catch (err) {
      setMonthlyMessage(String(err));
    }
  }

  function updateReviewRow(
    transactionType: "expense" | "income",
    rowId: string,
    patch: Partial<TransactionReviewRow>
  ) {
    const setter = transactionType === "expense" ? setExpenseReview : setIncomeReview;
    setter((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
          }
        : current
    );
  }

  function deleteReviewRow(row: TransactionReviewRow) {
    setConfirmDialog({
      title: "删除明细",
      message: "这只会从当前确认清单删除；如果重新读取原始账单，原始条目可能再次出现。",
      confirmLabel: "删除",
      danger: true,
      onConfirm: () => {
        const setter = row.transaction_type === "expense" ? setExpenseReview : setIncomeReview;
        setter((current) =>
          current
            ? {
                ...current,
                rows: current.rows.filter((item) => item.id !== row.id)
              }
            : current
        );
        if (duplicatePanelRowId === row.id) setDuplicatePanelRowId(null);
        setMonthlyMessage("明细已从当前确认清单删除。请重新点击确认按钮，让本月确认结果按最新清单写入。");
      }
    });
  }

  function updateReviewRows(
    transactionType: "expense" | "income",
    shouldUpdate: (row: TransactionReviewRow) => boolean,
    patchRow: (row: TransactionReviewRow) => Partial<TransactionReviewRow>
  ) {
    const setter = transactionType === "expense" ? setExpenseReview : setIncomeReview;
    setter((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) => (shouldUpdate(row) ? { ...row, ...patchRow(row) } : row))
          }
        : current
    );
  }

  function moveReviewRow(row: TransactionReviewRow, nextType: "expense" | "income") {
    if (row.transaction_type === nextType) return;
    const fromSetter = row.transaction_type === "expense" ? setExpenseReview : setIncomeReview;
    const toSetter = nextType === "expense" ? setExpenseReview : setIncomeReview;
    const movedRow: TransactionReviewRow = {
      ...row,
      transaction_type: nextType,
      raw_type: nextType === "expense" ? "支出" : "收入",
      category_id: null,
      category_name: null,
      adjustment_reason: row.adjustment_reason || "修改收支类型"
    };
    fromSetter((current) => (current ? { ...current, rows: current.rows.filter((item) => item.id !== row.id) } : current));
    toSetter((current) => (current ? { ...current, rows: [...current.rows, movedRow] } : current));
  }

  function setFilter(transactionType: "expense" | "income", patch: Partial<ReviewFilters>) {
    setReviewFilters((current) => ({
      ...current,
      [transactionType]: { ...current[transactionType], ...patch }
    }));
  }

  function locateRow(row?: TransactionReviewRow) {
    if (!row) return;
    setDetailExpanded((current) => ({ ...current, [row.transaction_type]: true }));
    setFilter(row.transaction_type, { date: row.transaction_date });
    window.setTimeout(() => {
      const element = document.querySelector(`[data-row-id="${row.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - 180, behavior: "smooth" });
      }
    }, 80);
  }

  function scrollToSelector(selector: string) {
    const element = document.querySelector(selector);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - 160, behavior: "smooth" });
  }

  function getFilteredRows(transactionType: "expense" | "income", rows: TransactionReviewRow[]) {
    const filters = reviewFilters[transactionType];
    const minAmount = filters.minAmount ? Number(filters.minAmount) : null;
    const maxAmount = filters.maxAmount ? Number(filters.maxAmount) : null;
    return rows.filter((row) => {
      if (filters.categoryId && row.category_id !== filters.categoryId) return false;
      if (filters.date && row.transaction_date !== filters.date) return false;
      if (minAmount !== null && row.amount < minAmount) return false;
      if (maxAmount !== null && row.amount > maxAmount) return false;
      return true;
    });
  }

  function noteSimilar(left: string, right: string) {
    const a = left.trim();
    const b = right.trim();
    if (!a || !b) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    return a.slice(0, 4) === b.slice(0, 4);
  }

  function duplicateReason(row: TransactionReviewRow, candidate: TransactionReviewRow) {
    const sameCore =
      row.transaction_date === candidate.transaction_date &&
      row.amount === candidate.amount &&
      (row.category_id ?? row.raw_category) === (candidate.category_id ?? candidate.raw_category) &&
      row.note.trim() === candidate.note.trim();
    if (sameCore) return "同日期 + 同金额 + 同分类 + 同备注";
    const sameDateAmount = row.transaction_date === candidate.transaction_date && row.amount === candidate.amount;
    if (sameDateAmount && noteSimilar(row.note, candidate.note)) return "同日期 + 同金额 + 备注相似";
    return null;
  }

  function getDuplicateCandidates(row: TransactionReviewRow) {
    const allRows = [...(expenseReview?.rows ?? []), ...(incomeReview?.rows ?? [])];
    return allRows
      .filter((candidate) => candidate.id !== row.id)
      .map((candidate) => ({ row: candidate, reason: duplicateReason(row, candidate) }))
      .filter((item): item is { row: TransactionReviewRow; reason: string } => Boolean(item.reason));
  }

  function isPendingDuplicate(row: TransactionReviewRow) {
    return row.potential_duplicate && (row.duplicate_review_status ?? "pending") === "pending";
  }

  function isLargeAmountAnomaly(row: TransactionReviewRow) {
    return row.amount >= 5000 && (row.include_in_stats ?? true) && !row.adjustment_reason?.includes("大额异常已确认");
  }

  function isUnmappedCategoryAnomaly(row: TransactionReviewRow) {
    return !row.category_id && (row.include_in_stats ?? true);
  }

  function appendAdjustmentReason(current: string | undefined, marker: string) {
    const value = current?.trim();
    if (!value) return marker;
    if (value.includes(marker)) return value;
    return `${value}；${marker}`;
  }

  async function markDuplicateReviewed(row: TransactionReviewRow, status: NonNullable<TransactionReviewRow["duplicate_review_status"]>) {
    updateReviewRow(row.transaction_type, row.id, { duplicate_review_status: status });
    if (!row.id.startsWith("manual-")) {
      try {
        await invoke("update_duplicate_review_status", {
          rawTransactionId: row.id,
          status
        });
      } catch (err) {
        setMonthlyMessage(`重复状态保存失败：${String(err)}`);
      }
    }
  }

  function excludeDuplicateRow(row: TransactionReviewRow) {
    updateReviewRow(row.transaction_type, row.id, {
      include_in_stats: false,
      adjustment_reason: row.adjustment_reason || "疑似重复，用户排除"
    });
  }

  function keepBothDuplicateRows(current: TransactionReviewRow, other?: TransactionReviewRow) {
    markDuplicateReviewed(current, "keep_both");
    if (other) markDuplicateReviewed(other, "keep_both");
    setDuplicatePanelRowId(null);
  }

  function excludeCurrentDuplicateRow(row: TransactionReviewRow) {
    excludeDuplicateRow(row);
    markDuplicateReviewed(row, "exclude_current");
    setDuplicatePanelRowId(null);
  }

  function excludeOtherDuplicateRow(row: TransactionReviewRow) {
    excludeDuplicateRow(row);
    markDuplicateReviewed(row, "exclude_other");
    setDuplicatePanelRowId(null);
  }

  function markNotDuplicate(row: TransactionReviewRow) {
    markDuplicateReviewed(row, "not_duplicate");
    setDuplicatePanelRowId(null);
  }

  function mergeDuplicateNotes(current: TransactionReviewRow, other: TransactionReviewRow) {
    const mergedNote = Array.from(new Set([current.note, other.note].filter(Boolean))).join(" / ");
    updateReviewRow(current.transaction_type, current.id, {
      note: mergedNote,
      include_in_stats: true,
      adjustment_reason: "疑似重复，合并备注后保留"
    });
    excludeDuplicateRow(other);
    markDuplicateReviewed(current, "merged");
    markDuplicateReviewed(other, "merged");
    setDuplicatePanelRowId(null);
  }

  async function applyBatchAnomalyAction(transactionType: "expense" | "income", action: AnomalyBatchAction) {
    const review = transactionType === "expense" ? expenseReview : incomeReview;
    if (!review) return;
    const actionKey = `${transactionType}:${action}`;
    const pendingDuplicateRows = review.rows.filter(isPendingDuplicate);
    const largeRows = review.rows.filter(isLargeAmountAnomaly);
    const unmappedRows = review.rows.filter(isUnmappedCategoryAnomaly);
    const duplicateStatusByAction: Partial<Record<AnomalyBatchAction, NonNullable<TransactionReviewRow["duplicate_review_status"]>>> = {
      keep_duplicates: "keep_both",
      mark_not_duplicate: "not_duplicate",
      exclude_duplicates: "exclude_current"
    };
    const duplicateStatus = duplicateStatusByAction[action];
    const targetRows =
      duplicateStatus
        ? pendingDuplicateRows
        : action === "confirm_large"
          ? largeRows
          : action === "exclude_unmapped"
            ? unmappedRows
            : [];
    if (targetRows.length === 0) {
      setMonthlyMessage("当前没有可批量处理的异常。");
      return;
    }

    setBatchingAnomalyAction(actionKey);
    setSuccessBanner(null);
    try {
      if (duplicateStatus) {
        const targetIds = new Set(targetRows.map((row) => row.id));
        updateReviewRows(transactionType, (row) => targetIds.has(row.id), (row) => ({
          duplicate_review_status: duplicateStatus,
          include_in_stats: action === "exclude_duplicates" ? false : row.include_in_stats,
          adjustment_reason:
            action === "exclude_duplicates"
              ? row.adjustment_reason || "批量处理疑似重复，用户排除"
              : row.adjustment_reason || "批量处理疑似重复"
        }));
        const rawIds = targetRows.filter((row) => !row.id.startsWith("manual-")).map((row) => row.id);
        if (rawIds.length > 0) {
          await invoke<number>("update_duplicate_review_status_batch", {
            rawTransactionIds: rawIds,
            status: duplicateStatus
          });
        }
      } else if (action === "confirm_large") {
        const targetIds = new Set(targetRows.map((row) => row.id));
        updateReviewRows(transactionType, (row) => targetIds.has(row.id), (row) => ({
          adjustment_reason: appendAdjustmentReason(row.adjustment_reason, "大额异常已确认")
        }));
      } else if (action === "exclude_unmapped") {
        const targetIds = new Set(targetRows.map((row) => row.id));
        updateReviewRows(transactionType, (row) => targetIds.has(row.id), (row) => ({
          include_in_stats: false,
          adjustment_reason: row.adjustment_reason || "批量排除未映射分类"
        }));
      }
      setDuplicatePanelRowId(null);
      setSuccessBanner(`已批量处理 ${targetRows.length} 条异常。`);
      setMonthlyMessage("批量处理后，请点击确认按钮写入本月确认结果。");
    } catch (err) {
      setSuccessBanner(null);
      setMonthlyMessage(`批量处理失败：${String(err)}`);
    } finally {
      setBatchingAnomalyAction(null);
    }
  }

  function addManualTransaction(transactionType: "expense" | "income") {
    const review = transactionType === "expense" ? expenseReview : incomeReview;
    const manual = transactionType === "expense" ? manualExpense : manualIncome;
    const amount = Number(manual.amount);
    if (!review || !manual.date || !amount || !manual.categoryId) {
      setMonthlyMessage("请填写日期、金额和分类。");
      return;
    }
    const category = review.categories.find((item) => item.id === manual.categoryId);
    const row: TransactionReviewRow = {
      id: `manual-${transactionType}-${Date.now()}`,
      transaction_date: manual.date,
      raw_type: transactionType === "expense" ? "支出" : "收入",
      transaction_type: transactionType,
      raw_category: category?.name ?? "手动补录",
      category_id: manual.categoryId,
      category_name: category?.name ?? null,
      raw_account: "手动",
      amount: Math.abs(amount),
      currency: manual.currency,
      note: manual.note,
      potential_duplicate: false,
      include_in_stats: true,
      adjustment_reason: "手动新增"
    };
    if (transactionType === "expense") {
      setExpenseReview((current) => (current ? { ...current, rows: [...current.rows, row] } : current));
      setManualExpense({ date: monthEndDate(selectedMonth), amount: "", currency: "CNY", categoryId: "", note: "" });
    } else {
      setIncomeReview((current) => (current ? { ...current, rows: [...current.rows, row] } : current));
      setManualIncome({ date: monthEndDate(selectedMonth), amount: "", currency: "CNY", categoryId: "", note: "" });
    }
    queueRatesForTransaction(row);
  }

	  async function createNewAsset() {
	    if (!newAsset.name.trim()) {
	      setMonthlyMessage("请填写资产名称。");
	      return;
    }
    const classification = resolveAssetClassification(newAsset);
    try {
      const created = await invoke<AssetEntryItem>("create_asset", {
        input: {
          name: newAsset.name.trim(),
          asset_type: classification.assetType,
          main_asset_category_id: classification.mainCategoryId,
          sub_asset_category_id: classification.subCategoryId,
          currency: newAsset.currency,
          platform: newAsset.platform || null,
          tags: parseTags(newAsset.tags),
          is_dca: newAsset.isDca,
          status: newAsset.status,
          note: newAsset.note || null,
          dca_plans:
            newAsset.isDca
              ? newAssetDcaPlans
                  .filter((plan) => Number(plan.amount) > 0)
                  .map((plan) => ({
                    frequency: plan.frequency,
                    amount: Number(plan.amount),
                    start_date: `${selectedMonth}-01`,
                    end_date: null,
                    weekly_rules_json:
                      plan.frequency === "weekly"
                        ? JSON.stringify([{ weekday: Number(plan.weeklyDay) || 1, amount: Number(plan.amount) || 0 }])
                        : null,
                    monthly_day: plan.frequency === "monthly" ? Number(plan.monthlyDay) || 1 : null
                  }))
              : []
        }
      });
      const createdAsset: AssetEntryItem = {
        ...created,
        currency: created.currency as CurrencyCode,
        month_status: newAsset.status === "inactive" ? "excluded" : "held",
        month_end_amount: newAsset.monthEndAmount,
        cashflows: newAssetCashflows.map((flow, index) => ({
          ...flow,
          id: `manual-flow-${created.id}-${Date.now()}-${index}`,
          asset_id: created.id,
          asset_name: created.name,
          currency: flow.currency || created.currency,
          confirmed: flow.confirmed ?? false,
          included: true
        })),
        confirmed: false
      };
      setAssetItems((current) => [createdAsset, ...current]);
      setExpandedAssetIds((current) => ({ ...current, [created.id]: false }));
      const nextDcaFlows = await invoke<AssetCashflowItem[]>("get_generated_dca_cashflows", { periodMonth: selectedMonth });
      setDcaCashflows(nextDcaFlows.map((flow) => ({ ...flow, currency: (flow.currency || "CNY") as CurrencyCode })));
      setNewAsset({
        name: "",
        topCategory: "asset_cat_cash",
        fundCategory: "asset_sub_us_market",
        cashCategory: "asset_sub_bank_payment",
        usEquityCategory: "asset_sub_sp500",
        currency: "CNY",
        platform: "支付宝",
        tags: "",
        monthEndAmount: "",
        isDca: false,
        status: "active",
        note: ""
      });
      setNewAssetCashflows([]);
      setNewAssetDcaPlans([{ frequency: "monthly", amount: "", weeklyDay: "1", monthlyDay: "1" }]);
      setShowAssetCreator(false);
      setSuccessBanner("资产已创建。月末市值、买入、卖出、分红已进入下方资产卡，可继续修改。");
    } catch (err) {
	      setMonthlyMessage(String(err));
	    }
	  }

  function firstRuntimeSubCategory(mainCategoryId: string) {
    return onboardingSubAllocationOptions[mainCategoryId]?.[0]?.[0] ?? defaultSubCategoryForMain(mainCategoryId);
  }

  function firstRuntimeChildCategory(categoryId: string) {
    return categoryOptions(findAssetCategoryNode(assetCategoryTree, categoryId)?.children ?? [])[0]?.[0] ?? "";
  }

  function updateNewAssetTopCategory(mainCategoryId: string) {
    const firstSub = firstRuntimeSubCategory(mainCategoryId);
    const firstChild = firstRuntimeChildCategory(firstSub);
    setNewAsset((current) => ({
      ...current,
      topCategory: mainCategoryId,
      cashCategory: isCashCategoryId(mainCategoryId) ? firstSub : current.cashCategory,
      fundCategory: isCashCategoryId(mainCategoryId) ? current.fundCategory : firstSub,
      usEquityCategory: firstChild || firstSub || current.usEquityCategory
    }));
  }

  function updateNewAssetSubCategory(subCategoryId: string) {
    const firstChild = firstRuntimeChildCategory(subCategoryId);
    setNewAsset((current) => ({
      ...current,
      cashCategory: isCashCategoryId(current.topCategory) ? subCategoryId : current.cashCategory,
      fundCategory: isCashCategoryId(current.topCategory) ? current.fundCategory : subCategoryId,
      usEquityCategory: firstChild || subCategoryId || current.usEquityCategory
    }));
  }

	  function updateOnboardingAssetDraft(patch: Partial<OnboardingAssetDraft>) {
	    setOnboardingAssetDraft((current) => normalizeOnboardingAssetDraft({ ...current, ...patch }, assetCategoryTree));
	  }

	  function updateOnboardingAssetTopCategory(topCategory: string) {
	    setOnboardingAssetDraft((current) => normalizeOnboardingAssetDraft({ ...current, topCategory }, assetCategoryTree));
	  }

	  function updateOnboardingAssetSecondCategory(categoryId: string) {
	    setOnboardingAssetDraft((current) =>
	      normalizeOnboardingAssetDraft(
	        isCashCategoryId(current.topCategory)
	          ? { ...current, cashCategory: categoryId }
	          : { ...current, fundCategory: categoryId },
	        assetCategoryTree
	      )
	    );
	  }

	  function updateOnboardingAssetThirdCategory(categoryId: string) {
	    setOnboardingAssetDraft((current) => normalizeOnboardingAssetDraft({ ...current, usEquityCategory: categoryId }, assetCategoryTree));
	  }

	  function addAssetCategory(parentId: string | null) {
	    const parent = parentId ? findAssetCategoryNode(assetCategoryTree, parentId) : null;
	    const prefix = !parent
	      ? "asset_cat_custom"
	      : parent.id === "fund" || parent.id.startsWith("group_")
	        ? "asset_cat_custom"
	        : "asset_sub_custom";
	    const nextNode: AssetCategoryNode = {
	      id: makeAssetCategoryId(prefix),
	      label: parent ? "新增分类" : "新增类型",
	      children: []
	    };
	    setAssetCategoryTree((current) => appendAssetCategoryNode(current, parentId, nextNode));
	    setOnboardingMessage("分类已新增，可以直接改名字。");
	  }

	  function renameAssetCategory(id: string, label: string) {
	    setAssetCategoryTree((current) => updateAssetCategoryNode(current, id, { label }));
	  }

	  function deleteAssetCategory(id: string) {
	    setAssetCategoryTree((current) => {
	      const nextTree = removeAssetCategoryNode(current, id);
	      return nextTree.length ? nextTree : cloneAssetCategoryTree();
	    });
	    setOnboardingTargets((current) => current.filter((target) => target.category_id !== id && target.parent_category_id !== id));
	    setOnboardingMessage("分类已删除；如果资产正在使用这个分类，请重新选择。");
	  }

	  function updateOnboardingAssetDcaPlan(index: number, patch: Partial<DcaPlanDraft>) {
	    setOnboardingAssetDraft((current) => ({
	      ...current,
	      dcaPlans: current.dcaPlans.map((plan, planIndex) =>
	        planIndex === index ? { ...plan, ...patch, confirmed: patch.confirmed ?? false } : plan
	      )
	    }));
	  }

	  function addOnboardingAssetDcaPlan() {
	    setOnboardingAssetDraft((current) => ({
	      ...current,
	      dcaPlans: [...current.dcaPlans, { frequency: "monthly", amount: "", weeklyDay: "1", monthlyDay: "1", confirmed: false }]
	    }));
	  }

	  function confirmOnboardingAssetDcaPlan(index: number) {
	    const plan = onboardingAssetDraft.dcaPlans[index];
	    if (!plan) return;
	    const amount = Number(plan.amount);
	    if (!Number.isFinite(amount) || amount <= 0) {
	      setOnboardingMessage(`第 ${index + 1} 个定投计划需要填写每次金额。`);
	      return;
	    }
	    if (plan.frequency === "monthly") {
	      const day = Number(plan.monthlyDay);
	      if (!Number.isFinite(day) || day < 1 || day > 31) {
	        setOnboardingMessage(`第 ${index + 1} 个定投计划的每月日期需要在 1 到 31 之间。`);
	        return;
	      }
	    }
	    updateOnboardingAssetDcaPlan(index, { confirmed: true });
	    setOnboardingMessage(`第 ${index + 1} 个定投计划已确认。`);
	  }

	  function removeOnboardingAssetDcaPlan(index: number) {
	    setOnboardingAssetDraft((current) => ({
	      ...current,
	      dcaPlans: current.dcaPlans.filter((_, planIndex) => planIndex !== index)
	    }));
	  }

	  function addOnboardingAsset() {
	    if (!onboardingAssetDraft.name.trim()) {
	      setOnboardingMessage("请先填写资产名称。");
	      return;
	    }
	    const classification = resolveOnboardingAssetClassification(onboardingAssetDraft, assetCategoryTree);
	    if (!classification.mainCategoryId) {
	      setOnboardingMessage("请先选择有效分类；如果是新增类型，请至少补一个可用子类。");
	      return;
	    }
	    if (onboardingAssetDraft.isDca && onboardingAssetDraft.dcaPlans.every((plan) => Number(plan.amount) <= 0)) {
	      setOnboardingMessage("已选择定投，需要至少填写一个定投金额。");
	      return;
	    }
	    setOnboardingAssets((current) => [{ ...onboardingAssetDraft }, ...current]);
	    setOnboardingAssetDraft(normalizeOnboardingAssetDraft(blankOnboardingAsset(), assetCategoryTree));
	    setOnboardingSkipAssets(false);
	    setOnboardingMessage("资产已加入初始化清单。");
	  }

	  function updateOnboardingAsset(index: number, patch: Partial<OnboardingAssetDraft>) {
	    setOnboardingAssets((current) => current.map((asset, assetIndex) => (assetIndex === index ? { ...asset, ...patch } : asset)));
	  }

	  function removeOnboardingAsset(index: number) {
	    setOnboardingAssets((current) => current.filter((_, assetIndex) => assetIndex !== index));
	  }

	  function targetLabel(target: OnboardingAllocationTarget) {
	    if (target.level === "asset") {
	      return onboardingAssets[Number(target.asset_id)]?.name || target.label || "具体资产";
	    }
	    if (target.level === "sub") {
	      const parent = target.parent_category_id ?? onboardingTargetParentOptions[0]?.[0] ?? "asset_cat_us_equity";
	      const category = target.category_id ?? "";
	      return `${optionLabel(onboardingTargetParentOptions, parent)} / ${optionLabel(onboardingSubAllocationOptions[parent] ?? [], category)}`;
	    }
	    return optionLabel(onboardingMainAllocationOptions, target.category_id ?? "");
	  }

	  function addOnboardingTarget(level: OnboardingAllocationTarget["level"]) {
	    const parent = level === "sub"
	      ? onboardingTargetParentOptions[0]?.[0] ?? onboardingMainAllocationOptions[0]?.[0] ?? "asset_cat_cash"
	      : onboardingSelectedMainAllocationOptions[0]?.[0] ?? onboardingMainAllocationOptions[0]?.[0] ?? "asset_cat_cash";
	    const nextTarget: OnboardingAllocationTarget =
	      level === "asset"
	        ? {
	            level,
	            asset_id: onboardingAssets.length > 0 ? "0" : null,
	            label: onboardingAssets[0]?.name ?? "具体资产",
	            target_percent: 0
	          }
	        : level === "sub"
	          ? {
	              level,
	              parent_category_id: parent,
	              category_id: onboardingSubAllocationOptions[parent]?.[0]?.[0] ?? null,
	              label: "",
	              target_percent: 0
	            }
	          : {
	              level,
	              category_id: parent,
	              label: "",
	              target_percent: 0
	            };
	    setOnboardingTargets((current) => [...current, nextTarget]);
	    setOnboardingSkipTargets(false);
	  }

	  function subTargetDraftFromExisting(parentId: string) {
	    const existing = new Map(
	      onboardingTargets
	        .filter((target) => target.level === "sub" && target.parent_category_id === parentId && target.category_id)
	        .map((target) => [target.category_id as string, percentInputValue(target.target_percent)])
	    );
	    return Object.fromEntries((onboardingSubAllocationOptions[parentId] ?? []).map(([id]) => [id, existing.get(id) ?? ""]));
	  }

	  function startSubTargetEditor(parentId?: string) {
	    const fallbackParent = onboardingTargetParentOptions[0]?.[0] ?? onboardingMainAllocationOptions[0]?.[0] ?? "asset_cat_cash";
	    const nextParent = parentId ?? onboardingTargetParentOptions.find(([id]) => !onboardingTargets.some((target) => target.level === "sub" && target.parent_category_id === id))?.[0] ?? fallbackParent;
	    changeSubTargetDraftParent(nextParent);
	    setOnboardingSkipTargets(false);
	  }

	  function changeSubTargetDraftParent(parentId: string) {
	    setOnboardingSubTargetDraftParent(parentId);
	    setOnboardingSubTargetDraftPercents(subTargetDraftFromExisting(parentId));
	    setEditingSubTargetParentId(parentId);
	  }

	  function changeSubTargetDraftTopCategory(topCategoryId: string) {
	    changeSubTargetDraftParent(topCategoryId);
	  }

	  function changeSubTargetDraftDepth(shouldUseDeeperLevel: boolean) {
	    const path = assetCategoryPathIds(assetCategoryTree, onboardingSubTargetDraftParent);
	    const topCategoryId = path[0] ?? onboardingTargetParentOptions[0]?.[0] ?? "asset_cat_cash";
	    if (!shouldUseDeeperLevel) {
	      changeSubTargetDraftParent(topCategoryId);
	      return;
	    }
	    const topNode = findAssetCategoryNode(assetCategoryTree, topCategoryId);
	    const deeperParentOptions = categoryOptions((topNode?.children ?? []).filter((child) => (child.children ?? []).length > 0));
	    changeSubTargetDraftParent(path[1] && deeperParentOptions.some(([id]) => id === path[1]) ? path[1] : deeperParentOptions[0]?.[0] ?? topCategoryId);
	  }

	  function changeSubTargetDraftSecondCategory(categoryId: string) {
	    changeSubTargetDraftParent(categoryId);
	  }

	  function confirmSubTargetGroup() {
	    const parentId = onboardingSubTargetDraftParent;
	    const subOptions = onboardingSubAllocationOptions[parentId] ?? [];
	    if (subOptions.length === 0) {
	      setOnboardingMessage("这个分类下面没有可填写的下级分类。");
	      return;
	    }
	    const rows = subOptions.map(([categoryId, label]) => ({
	      categoryId,
	      label,
	      value: parsePercentInput(onboardingSubTargetDraftPercents[categoryId] ?? "")
	    }));
	    const invalid = rows.find((row) => row.value < 0 || row.value > 100);
	    if (invalid) {
	      setOnboardingMessage(`${invalid.label} 的目标比例需要在 0% 到 100% 之间。`);
	      return;
	    }
	    const total = rows.reduce((sum, row) => sum + row.value, 0);
	    const parentLabel = optionLabel(onboardingTargetParentOptions, parentId);
	    const totalMessage = percentTotalValidationMessage(`${parentLabel} 的下级配比`, total);
	    if (totalMessage) {
	      setOnboardingMessage(totalMessage);
	      return;
	    }
	    setOnboardingTargets((current) => [
	      ...current.filter((target) => !(target.level === "sub" && target.parent_category_id === parentId)),
	      ...rows
	        .filter((row) => row.value > 0)
	        .map((row) => ({
	          level: "sub" as const,
	          parent_category_id: parentId,
	          category_id: row.categoryId,
	          label: `${parentLabel} / ${row.label}`,
	          target_percent: row.value
	        }))
	    ]);
	    setEditingSubTargetParentId(null);
	    setOnboardingSubTargetDraftPercents({});
	    setOnboardingMessage("下级分类配比已确认。");
	  }

	  function deleteSubTargetGroup(parentId: string) {
	    setOnboardingTargets((current) => current.filter((target) => !(target.level === "sub" && target.parent_category_id === parentId)));
	    if (editingSubTargetParentId === parentId) {
	      setEditingSubTargetParentId(null);
	      setOnboardingSubTargetDraftPercents({});
	    }
	    setOnboardingMessage("下级分类配比已删除。");
	  }

		  function updateOnboardingTarget(index: number, patch: Partial<OnboardingAllocationTarget>) {
		    setOnboardingTargets((current) =>
		      current.map((target, targetIndex) => (targetIndex === index ? { ...target, ...patch } : target))
		    );
		  }

			  function updateMainOnboardingTarget(categoryId: string, label: string, rawTargetPercent: string) {
			    const draftValue = normalizePercentDraftInput(rawTargetPercent);
			    const targetPercent = parsePercentInput(draftValue);
			    setOnboardingMainTargetDraftPercents((current) => ({ ...current, [categoryId]: draftValue }));
			    setEditedMainTargetIds((current) => {
		      const next = new Set(current);
		      next.add(categoryId);
		      return next;
		    });
		    setOnboardingTargets((current) => {
		      const hasTarget = current.some((target) => target.level === "main" && target.category_id === categoryId);
		      if (hasTarget) {
		        return current.map((target) =>
		          target.level === "main" && target.category_id === categoryId
		            ? { ...target, label: target.label || label, target_percent: targetPercent }
		            : target
		        );
		      }
		      return [
		        ...current,
		        {
		          level: "main",
		          category_id: categoryId,
		          label,
		          target_percent: targetPercent
		        }
		      ];
		    });
		  }

		  function removeOnboardingTarget(index: number) {
		    setOnboardingTargets((current) => current.filter((_, targetIndex) => targetIndex !== index));
		  }

		  function effectiveOnboardingTargetsForEditor() {
		    const mainTargets = buildMainTargetsWithSavedValues(
		      onboardingSelectedMainAllocationOptions,
		      onboardingTargets,
		      savedMainTargetByCategory,
		      editedMainTargetIds
		    );
		    return [...mainTargets, ...onboardingTargets.filter((target) => target.level !== "main")];
		  }

		  function onboardingTargetValidationMessage() {
		    if (onboardingSkipTargets) return null;
		    const effectiveTargets = effectiveOnboardingTargetsForEditor();
		    const mainTotal = effectiveTargets
		      .filter((target) => target.level === "main")
		      .reduce((sum, target) => sum + targetPercentNumber(target.target_percent), 0);
		    const mainTotalMessage = percentTotalValidationMessage("一级分类配比", mainTotal);
		    if (mainTotalMessage) return mainTotalMessage;
		    const parents = new Set(effectiveTargets.filter((target) => target.level === "sub").map((target) => target.parent_category_id).filter(Boolean));
		    for (const parentId of parents) {
		      const subTotal = effectiveTargets
		        .filter((target) => target.level === "sub" && target.parent_category_id === parentId)
		        .reduce((sum, target) => sum + targetPercentNumber(target.target_percent), 0);
		      const subTotalMessage = percentTotalValidationMessage(`${optionLabel(onboardingTargetParentOptions, parentId as string)} 的下级配比`, subTotal);
		      if (subTotalMessage) return subTotalMessage;
		    }
		    return null;
		  }

	  function goToNextOnboardingStep() {
	    if (effectiveOnboardingStep === 2) {
	      const validationMessage = onboardingTargetValidationMessage();
	      if (validationMessage) {
	        setOnboardingMessage(validationMessage);
	        return;
	      }
	    }
	    setOnboardingMessage(null);
	    setOnboardingStep((step) => Math.min(step + 1, view === "preferences" ? 2 : 3));
	  }

	  function toggleOnboardingSection(section: HealthSection) {
	    if (section === "总览") return;
	    const itemIds = dashboardModuleItemDefinitions[section as Exclude<HealthSection, "总览">]?.map((item) => item.id) ?? [];
	    const defaultItemIds = dashboardModuleItemDefinitions[section as Exclude<HealthSection, "总览">]?.filter((item) => item.defaultEnabled).map((item) => item.id) ?? [];
	    setOnboardingSections((current) =>
	      current.includes(section)
	        ? current.filter((item) => item !== section)
	        : [...new Set(["总览", ...current, section])]
	    );
	    setOnboardingDashboardItems((current) =>
	      onboardingSections.includes(section)
	        ? current.filter((item) => !itemIds.includes(item))
	        : [...new Set([...current, ...defaultItemIds])]
	    );
	  }

		  function toggleDashboardPreferenceItem(section: Exclude<HealthSection, "总览">, itemId: string) {
	    const sectionItemIds = dashboardModuleItemDefinitions[section].map((item) => item.id);
	    setOnboardingDashboardItems((current) => {
	      const next = current.includes(itemId)
	        ? current.filter((item) => item !== itemId)
	        : [...current, itemId];
	      const hasSectionItem = next.some((item) => sectionItemIds.includes(item));
	      setOnboardingSections((sections) => {
	        if (hasSectionItem) return [...new Set(["总览", ...sections, section])];
	        return sections.filter((item) => item !== section);
	      });
		      return [...new Set(next)];
		    });
		  }

		  function editorHasAllocationTargets() {
		    return !onboardingSkipTargets && effectiveOnboardingTargetsForEditor().length > 0;
		  }

		  function dashboardItemsForSave() {
		    const hasTargets = editorHasAllocationTargets();
		    return normalizeDashboardItemIds(onboardingDashboardItems).filter((item) => hasTargets || !isTargetDependentDashboardItem(item));
		  }

		  function toggleCustomDashboardItem(itemId: string) {
	    if (isTargetDependentDashboardItem(itemId) && !editorHasAllocationTargets()) {
	      setOnboardingMessage("请先在上一步填写目标资产配比，再开启目标偏离类分析。");
	      return;
	    }
	    setOnboardingDashboardItems((current) => {
	      const next = current.includes(itemId)
	        ? current.filter((item) => item !== itemId)
	        : [...current, itemId];
	      const targetSection = dashboardCustomSettings.custom_item_sections[itemId] ?? "资产配置";
	      if (next.includes(itemId)) {
	        setOnboardingSections((sections) => [...new Set(["总览", ...sections, targetSection])]);
	      }
	      return [...new Set(next)];
	    });
	  }

	  function updateDashboardCustomSettings(patch: Partial<DashboardCustomSettings>) {
	    setDashboardCustomSettings((current) => normalizeDashboardCustomSettings({ ...current, ...patch }, assetCategoryTree));
	  }

	  function customItemSection(itemId: string): HealthSection {
	    return dashboardCustomSettings.custom_item_sections[itemId] ?? "资产配置";
	  }

	  function changeCustomDashboardItemSection(itemId: string, section: HealthSection) {
	    setDashboardCustomSettings((current) =>
	      normalizeDashboardCustomSettings(
	        {
	          ...current,
	          custom_item_sections: {
	            ...current.custom_item_sections,
	            [itemId]: section
	          }
	        },
	        assetCategoryTree
	      )
	    );
	    if (onboardingDashboardItems.includes(itemId)) {
	      setOnboardingSections((sections) => [...new Set(["总览", ...sections, section])]);
	    }
	  }

	  function changeDiscretionaryDraftTopCategory(categoryId: string) {
	    setDiscretionaryDraftTopId(categoryId);
	    setDiscretionaryDraftSecondId("");
	    setDiscretionaryDraftThirdId("");
	  }

	  function changeDiscretionaryDraftSecondCategory(categoryId: string) {
	    setDiscretionaryDraftSecondId(categoryId);
	    setDiscretionaryDraftThirdId("");
	  }

	  function addDiscretionaryCategorySelection() {
	    const selectedId = discretionaryDraftThirdId || discretionaryDraftSecondId || discretionaryDraftTopId;
	    if (!selectedId || !findAssetCategoryNode(assetCategoryTree, selectedId)) {
	      setOnboardingMessage("请先选择一个有效资产范围。");
	      return;
	    }
	    const selectedPath = assetCategoryPathIds(assetCategoryTree, selectedId);
	    setDashboardCustomSettings((current) => {
	      const nextIds = current.discretionary_category_ids.filter((id) => {
	        const path = assetCategoryPathIds(assetCategoryTree, id);
	        return id !== selectedId && !path.includes(selectedId) && !selectedPath.includes(id);
	      });
	      return normalizeDashboardCustomSettings({ ...current, discretionary_category_ids: [...nextIds, selectedId] }, assetCategoryTree);
	    });
	    setOnboardingDashboardItems((current) => [...new Set([...current, "allocation_discretionary_amount"])]);
	    setOnboardingSections((sections) => [...new Set(["总览", ...sections, "资产配置"])]);
	    setOnboardingMessage(`已加入可支配总额范围：${assetCategoryPathLabel(assetCategoryTree, selectedId)}。记得保存看板偏好。`);
	  }

	  function removeDiscretionaryCategorySelection(categoryId: string) {
	    if (dashboardCustomSettings.discretionary_category_ids.length <= 1) {
	      setOnboardingMessage("可支配总额至少保留一个资产范围。");
	      return;
	    }
	    setDashboardCustomSettings((current) =>
	      normalizeDashboardCustomSettings(
	        { ...current, discretionary_category_ids: current.discretionary_category_ids.filter((id) => id !== categoryId) },
	        assetCategoryTree
	      )
	    );
	  }

	  function changeCustomAllocationDetailTop(topCategoryId: string) {
	    updateDashboardCustomSettings({
	      allocation_detail_parent_id: topCategoryId,
	      allocation_detail_depth: "second"
	    });
	  }

	  function changeCustomAllocationDetailDepth(shouldUseDeeperLevel: boolean) {
	    const path = assetCategoryPathIds(assetCategoryTree, dashboardCustomSettings.allocation_detail_parent_id);
	    const topCategoryId = path[0] ?? categoryOptions(assetCategoryTree)[0]?.[0] ?? "asset_cat_cash";
	    if (!shouldUseDeeperLevel) {
	      updateDashboardCustomSettings({
	        allocation_detail_parent_id: topCategoryId,
	        allocation_detail_depth: "second"
	      });
	      return;
	    }
	    const topNode = findAssetCategoryNode(assetCategoryTree, topCategoryId);
	    const secondParentOptions = categoryOptions((topNode?.children ?? []).filter((child) => (child.children ?? []).length > 0));
	    updateDashboardCustomSettings({
	      allocation_detail_parent_id: path[1] && secondParentOptions.some(([id]) => id === path[1]) ? path[1] : secondParentOptions[0]?.[0] ?? topCategoryId,
	      allocation_detail_depth: "third"
	    });
	  }

	  function changeCustomAllocationDetailSecond(categoryId: string) {
	    updateDashboardCustomSettings({
	      allocation_detail_parent_id: categoryId,
	      allocation_detail_depth: "third"
	    });
	  }

			  function dashboardSectionsForSave() {
			    const savedItems = dashboardItemsForSave();
			    const customSections = savedItems
			      .filter((item) => dashboardCustomItemIds.includes(item))
			      .map((item) => customItemSection(item));
		    return [
		      "总览",
		      ...dashboardPreferenceSections.filter((section) => {
		        if (customSections.includes(section)) return true;
			        if (!onboardingSections.includes(section)) return false;
			        const itemIds = dashboardModuleItemDefinitions[section].map((item) => item.id);
			        return savedItems.some((item) => itemIds.includes(item));
			      })
			    ];
			  }

	  async function resetDemoOnboarding() {
	    if (!isDemoEnvironment) {
	      setOnboardingMessage("重置初始化只在 Demo 环境开放，避免误清空正式数据。");
	      return;
	    }
	    const confirmed = window.confirm("确认重置初始化？当前 Demo 初始化录入会清空，下一次打开会回到新的欢迎页面。");
	    if (!confirmed) return;
	    setSavingOnboarding(true);
	    setOnboardingMessage(null);
	    try {
	      window.localStorage.removeItem(onboardingDraftStorageKey);
	      const status = await invoke<OnboardingStatus>("reset_demo_onboarding");
	      const cleanTree = status.asset_category_tree?.length ? normalizeAssetCategoryTreeDefaults(status.asset_category_tree) : cloneAssetCategoryTree();
	      setOnboardingDraftHydrated(true);
	      setOnboardingStep(0);
	      setOnboardingSavingRate(String(Math.round((status.target_saving_rate || 0.3) * 100)));
	      setAssetCategoryTree(cleanTree);
	      setOnboardingAssetDraft(normalizeOnboardingAssetDraft(blankOnboardingAsset(), cleanTree));
	      setOnboardingAssets([]);
	      setOnboardingSkipAssets(false);
			      setOnboardingTargets([]);
			      setEditedMainTargetIds(new Set());
			      setOnboardingMainTargetDraftPercents({});
			      setOnboardingSkipTargets(false);
	      setOnboardingSubTargetDraftParent("asset_cat_cash");
	      setOnboardingSubTargetDraftPercents({});
	      setEditingSubTargetParentId(null);
	      setOnboardingSections(status.dashboard_enabled_sections?.length ? status.dashboard_enabled_sections : defaultOnboardingSections);
		      setOnboardingDashboardItems(normalizeDashboardItemIds(status.dashboard_enabled_items?.length ? status.dashboard_enabled_items : defaultDashboardItemIds));
		      setDashboardCustomSettings(normalizeDashboardCustomSettings(status.dashboard_custom_settings, cleanTree));
	      setOnboardingStatus(status);
	      setView("onboarding");
	      setSuccessBanner(null);
	      setOnboardingMessage("初始化已重置。你可以重新开始填写。");
	      const latestSummary = await invoke<DashboardSeedSummary>("get_dashboard_seed_summary");
	      setSummary(latestSummary);
	    } catch (err) {
	      setOnboardingMessage(String(err));
	    } finally {
	      setSavingOnboarding(false);
	    }
	  }

	  async function saveOnboardingSetup() {
	    setOnboardingMessage(null);
	    const rate = Number(onboardingSavingRate) / 100;
	    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
	      setOnboardingMessage("期望储蓄率需要在 0% 到 100% 之间。");
	      setOnboardingStep(0);
	      return;
	    }
	    if (dashboardSectionsForSave().length <= 1) {
	      setOnboardingMessage("至少保留一个看板模块。");
	      setOnboardingStep(3);
	      return;
	    }
	    const targetValidationMessage = onboardingTargetValidationMessage();
	    if (targetValidationMessage) {
	      setOnboardingMessage(targetValidationMessage);
	      setOnboardingStep(2);
	      return;
	    }
	    setSavingOnboarding(true);
	    try {
	      const payloadTargets = onboardingSkipTargets
	        ? []
	        : onboardingTargets.map((target) => ({
	            ...target,
	            label: targetLabel(target),
	            target_percent: Number(target.target_percent) / 100
	          }));
	      const status = await invoke<OnboardingStatus>("save_onboarding", {
	        input: {
	          target_saving_rate: rate,
	          assets: onboardingSkipAssets ? [] : onboardingAssets.map((asset) => assetPayloadFromDraft(asset, selectedMonth, assetCategoryTree)),
	          asset_category_tree: assetCategoryTree,
	          allocation_targets: payloadTargets,
	          dashboard_sections: dashboardSectionsForSave(),
		          dashboard_items: dashboardItemsForSave(),
	          dashboard_custom_settings: dashboardCustomSettings,
		          custom_analysis_prompts: [],
	          skip_asset_entry: onboardingSkipAssets,
	          skip_allocation_targets: onboardingSkipTargets
	        }
	      });
	      window.localStorage.removeItem(onboardingDraftStorageKey);
	      applyOnboardingStatus(status);
	      await loadDashboard();
	      setActiveHealthSection("总览");
	      setView("healthDashboard");
	      setSuccessBanner("初始化已完成。看板已读取你刚刚填写的资产和偏好。");
	    } catch (err) {
	      setOnboardingMessage(String(err));
	    } finally {
	      setSavingOnboarding(false);
	    }
	  }

	  function allocationTargetsPayloadFromEditor(targets: OnboardingAllocationTarget[]) {
	    return targets.map((target) => ({
	      ...target,
	      label: targetLabel(target),
	      target_percent:
		        (target.level === "main" && target.category_id && !editedMainTargetIds.has(target.category_id) && (Number(target.target_percent) || 0) === 0 && (Number(savedMainTargetByCategory.get(target.category_id)?.target_percent) || 0) > 0
	          ? Number(savedMainTargetByCategory.get(target.category_id)?.target_percent) || 0
	          : Number(target.target_percent) || 0) / 100
	    }));
	  }

		  function editorAllocationTargetsPayload() {
		    return onboardingSkipTargets ? [] : allocationTargetsPayloadFromEditor(effectiveOnboardingTargetsForEditor());
		  }

	  function savedAllocationTargetsPayload() {
	    return allocationTargetsPayloadFromEditor(onboardingStatus?.allocation_targets ?? []);
	  }

	  async function savePreferencePayload(options: {
	    allocationTargets: OnboardingAllocationTarget[];
	    skipAllocationTargets: boolean;
	    returnHome?: boolean;
	    successMessage: string;
	    targetErrorStep?: number;
	    editorTargetsAfterSave?: OnboardingAllocationTarget[];
	  }) {
	    setOnboardingMessage(null);
	    setPreferenceSaveFeedback(null);
	    const rate = Number(onboardingSavingRate) / 100;
	    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
	      setOnboardingMessage("期望储蓄率需要在 0% 到 100% 之间。");
	      setOnboardingStep(0);
	      return;
	    }
	    if (dashboardSectionsForSave().length <= 1) {
	      setOnboardingMessage("至少保留一个看板模块。");
	      setOnboardingStep(2);
	      return;
	    }
	    setSavingOnboarding(true);
	    try {
	      const status = await invoke<OnboardingStatus>("save_onboarding", {
	        input: {
	          target_saving_rate: rate,
	          assets: [],
	          asset_category_tree: assetCategoryTree,
	          allocation_targets: options.allocationTargets,
	          dashboard_sections: dashboardSectionsForSave(),
		          dashboard_items: dashboardItemsForSave(),
	          dashboard_custom_settings: dashboardCustomSettings,
		          custom_analysis_prompts: [],
	          skip_asset_entry: true,
	          skip_allocation_targets: options.skipAllocationTargets
	        }
	      });
	      applyOnboardingStatus(status);
	      if (options.editorTargetsAfterSave) {
	        setOnboardingTargets(options.editorTargetsAfterSave);
	      }
	      setOnboardingSkipTargets(options.skipAllocationTargets);
	      await loadDashboard();
	      if (options.returnHome) setView("home");
	      setOnboardingMessage(options.successMessage);
	      setPreferenceSaveFeedback(options.successMessage);
	      setSuccessBanner(options.successMessage);
	      window.setTimeout(() => {
	        setPreferenceSaveFeedback((current) => (current === options.successMessage ? null : current));
	      }, 2500);
	    } catch (err) {
	      setOnboardingMessage(String(err));
	    } finally {
	      setSavingOnboarding(false);
	    }
	  }

	  async function saveSavingPreference(returnHome = false) {
	    await savePreferencePayload({
	      allocationTargets: savedAllocationTargetsPayload(),
	      skipAllocationTargets: savedAllocationTargetsPayload().length === 0,
	      returnHome,
	      successMessage: "储蓄偏好已保存。看板目标储蓄率已同步。"
	    });
	  }

	  async function saveAllocationPreference(returnHome = false) {
	    const targetValidationMessage = onboardingTargetValidationMessage();
	    if (targetValidationMessage) {
	      setOnboardingMessage(targetValidationMessage);
	      setOnboardingStep(1);
	      return;
	    }
		    await savePreferencePayload({
		      allocationTargets: editorAllocationTargetsPayload(),
		      skipAllocationTargets: onboardingSkipTargets,
		      returnHome,
		      successMessage: "目标配比已保存。看板资产配置差值已同步。",
		      editorTargetsAfterSave: effectiveOnboardingTargetsForEditor()
		    });
		  }

	  async function saveDashboardPreference(returnHome = false) {
	    await savePreferencePayload({
	      allocationTargets: savedAllocationTargetsPayload(),
	      skipAllocationTargets: savedAllocationTargetsPayload().length === 0,
	      returnHome,
	      successMessage: "看板偏好已保存。看板模块已同步。"
	    });
	  }

	  async function saveCurrentPreferenceStep(returnHome = false) {
	    if (effectiveOnboardingStep === 0) {
	      await saveSavingPreference(returnHome);
	      return;
	    }
	    if (effectiveOnboardingStep === 2) {
	      await saveAllocationPreference(returnHome);
	      return;
	    }
	    await saveDashboardPreference(returnHome);
	  }

	  async function saveAssetEntries(allowAllocationPreferenceMismatch = false) {
    setSuccessBanner(null);
    if (assetItems.length === 0) {
      setMonthlyMessage("还没有资产清单，请先创建资产。");
      return;
    }
    const monthAmountIssues = assetItems
      .map((asset) => ({ asset, issue: assetMonthAmountIssue(asset) }))
      .filter((item): item is { asset: AssetEntryItem; issue: string } => Boolean(item.issue));
    if (monthAmountIssues.length > 0) {
      const message = `还有 ${monthAmountIssues.length} 个资产月末状态需要处理：${monthAmountIssues.map((item) => item.issue).join("、")}。`;
      setAssetValidationIssue({ message, assetId: monthAmountIssues[0]?.asset.id });
      setMonthlyMessage(message);
      return;
    }
    const clearedWithoutSellIssues = assetItems
      .map((asset) => ({ asset, issue: assetClearedWithoutSellIssue(asset, Boolean(clearedWithoutSellOverrides[asset.id])) }))
      .filter((item): item is { asset: AssetEntryItem; issue: string } => Boolean(item.issue));
    if (clearedWithoutSellIssues.length > 0) {
      const message = clearedWithoutSellIssues[0].issue;
      setAssetValidationIssue({ message, assetId: clearedWithoutSellIssues[0].asset.id });
      setMonthlyMessage(message);
      setExpandedAssetIds((current) => ({ ...current, [clearedWithoutSellIssues[0].asset.id]: true }));
      return;
    }
    const missingDcaPlans = assetItems.filter((asset) => Boolean(asset.is_dca) && (asset.dca_plans ?? []).length === 0);
    if (missingDcaPlans.length > 0) {
      const message = `还有 ${missingDcaPlans.length} 个定投资产缺少定投计划：${missingDcaPlans.map((asset) => asset.name).join("、")}。`;
      setAssetValidationIssue({ message, assetId: missingDcaPlans[0]?.id });
      setMonthlyMessage(message);
      return;
    }
    const unconfirmedFlows = assetItems.flatMap((asset) =>
      (asset.cashflows ?? [])
        .filter((flow) => !flow.confirmed)
        .map((flow) => `${asset.name} ${flow.flow_date}`)
    );
    if (unconfirmedFlows.length > 0) {
      const message = `还有 ${unconfirmedFlows.length} 条买入/卖出/分红明细未确认：${unconfirmedFlows.slice(0, 6).join("、")}。`;
      setAssetValidationIssue({ message, assetId: assetItems.find((asset) => (asset.cashflows ?? []).some((flow) => !flow.confirmed))?.id });
      setMonthlyMessage(message);
      return;
    }
    const latestDcaCashflows = generateDcaCashflowsForAssets(assetItems, selectedMonth, dcaCashflows);
    const missingAssetRates = [
      ...assetItems
        .filter((asset) => isAssetCountedInMonth(asset))
        .filter((asset) => convertAmount(Number(asset.month_end_amount) || 0, monthEndDate(), asset.currency ?? "CNY", "CNY") === null)
        .map((asset) => `${asset.name} 月末市值`),
      ...assetItems.flatMap((asset) =>
        [...(asset.cashflows ?? []), ...latestDcaCashflows.filter((flow) => flow.asset_id === asset.id)]
          .filter((flow) => convertAmount(Number(flow.amount) || 0, flow.flow_date, flow.currency ?? asset.currency ?? "CNY", "CNY") === null)
          .map((flow) => `${asset.name} ${flow.flow_date} ${flow.flow_type}`)
      )
    ];
    if (missingAssetRates.length > 0) {
      const message = `还有 ${missingAssetRates.length} 条资产汇率缺失：${missingAssetRates.slice(0, 6).join("、")}。`;
      setAssetValidationIssue({ message });
      setMonthlyMessage(message);
      return;
    }
    if (!allowAllocationPreferenceMismatch && assetAllocationPreferenceIssue) {
      setConfirmDialog({
        title: "目标配比可能需要更新",
        message: assetAllocationPreferenceIssue,
        confirmLabel: "先保存资产",
        onConfirm: () => saveAssetEntries(true)
      });
      return;
    }
    setSavingAssets(true);
    setMonthlyMessage("资产录入正在保存...");
    try {
      const status = await invoke<MonthlyStepStatus>("save_asset_month_entries", {
        periodMonth: selectedMonth,
        entries: assetItems.map((asset) => ({
          ...(() => {
            const monthStatus = assetMonthStatus(asset);
            const monthAmount = monthStatus === "held" ? Number(asset.month_end_amount) || 0 : 0;
            const convertedAmount = monthStatus === "held"
              ? convertAmount(monthAmount, monthEndDate(), asset.currency || "CNY", "CNY") ?? 0
              : 0;
            return {
              month_end_amount: monthAmount,
              amount_cny: convertedAmount,
              status: monthStatus
            };
          })(),
          asset_id: asset.id,
          name: asset.name,
          asset_type: asset.asset_type ?? null,
          main_asset_category_id: asset.main_asset_category_id ?? null,
          sub_asset_category_id: asset.sub_asset_category_id ?? null,
          tags: parseTags(asset.tags || ""),
          platform: asset.platform || null,
          is_dca: Boolean(asset.is_dca),
          note: asset.note || null,
          dca_plans: (asset.dca_plans ?? []).map((plan) => ({
            id: plan.id ?? null,
            frequency: plan.frequency,
            amount: Number(plan.amount) || 0,
            start_date: plan.start_date,
            end_date: plan.end_date || null,
            weekly_rules_json:
              plan.frequency === "weekly"
                ? JSON.stringify([{ weekday: Number(dcaWeeklyDay(plan)) || 1, amount: Number(plan.amount) || 0 }])
                : null,
            monthly_day: plan.frequency === "monthly" ? Number(plan.monthly_day) || 1 : null
          })),
          currency: asset.currency || "CNY",
          fx_rate_to_cny: getRate(monthEndDate(), asset.currency || "CNY", "CNY") ?? 1,
          extra_buy: Number(asset.extra_buy) || 0,
          sell: Number(asset.sell) || 0,
          dividend: Number(asset.dividend) || 0,
          confirmed: true,
          cashflows: [
            ...(asset.cashflows ?? []),
            ...latestDcaCashflows.filter((flow) => flow.asset_id === asset.id)
          ].map((flow) => ({
            id: flow.id,
            asset_id: flow.asset_id,
            flow_date: flow.flow_date,
            flow_type: flow.flow_type,
            amount: Number(flow.amount) || 0,
            currency: flow.currency || asset.currency || "CNY",
            fx_rate_to_cny: getRate(flow.flow_date, flow.currency || asset.currency || "CNY", "CNY") ?? 1,
            amount_cny:
              convertAmount(Number(flow.amount) || 0, flow.flow_date, flow.currency || asset.currency || "CNY", "CNY") ?? 0,
            source_kind: flow.source_kind,
            dca_plan_id: flow.dca_plan_id ?? null,
            note: flow.note ?? null,
            included: flow.included
          }))
        }))
      });
      applyMonthlyStatus(status);
      setAssetValidationIssue(null);
      setCompletedSteps((current) => ({ ...current, assets: true }));
      setAssetItems((current) => current.map((asset) => ({ ...asset, confirmed: true })));
      const nextDcaFlows = await invoke<AssetCashflowItem[]>("get_generated_dca_cashflows", { periodMonth: selectedMonth });
      setDcaCashflows(nextDcaFlows.map((flow) => ({ ...flow, currency: (flow.currency || "CNY") as CurrencyCode })));
      await loadDashboard();
      setSuccessBanner("资产录入已确认，月末市值和投资现金流已保存。");
      setMonthlyMessage("资产录入已确认。");
    } catch (err) {
      setSuccessBanner(null);
      setMonthlyMessage(`资产保存失败：${String(err)}`);
    } finally {
      setSavingAssets(false);
    }
  }

  async function saveCreditCards() {
    try {
      const saved = await invoke<CreditCardEntry[]>("save_credit_card_entries", {
        periodMonth: selectedMonth,
        entries: creditCards
          .filter((card) => card.name.trim())
          .map((card) => ({
          ...card,
          billed_amount: Number(card.billed_amount) || 0,
          unbilled_amount: Number(card.unbilled_amount) || 0,
          previous_unbilled_amount: Number(card.previous_unbilled_amount) || 0,
          previous_unbilled_override: Boolean(card.previous_unbilled_override),
          previous_unbilled_override_reason: card.previous_unbilled_override_reason || null,
          net_adjustment: -(Number(card.billed_amount) || 0) - (Number(card.unbilled_amount) || 0) + (Number(card.previous_unbilled_amount) || 0),
          confirmed: true
        }))
      });
      setCreditCards(saved);
      await loadMonthlyStatus(selectedMonth);
      setSuccessBanner("信用卡明细已确认。");
    } catch (err) {
      setMonthlyMessage(String(err));
    }
  }

  function updateCreditCard(cardId: string, patch: Partial<CreditCardEntry>) {
    setCreditCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, ...patch, confirmed: patch.confirmed ?? false } : card))
    );
  }

  async function deleteAssetItem(assetId: string) {
    try {
      await invoke("delete_asset", { assetId });
      setAssetItems((current) => current.filter((asset) => asset.id !== assetId));
      setDcaCashflows((current) => current.filter((flow) => flow.asset_id !== assetId));
      setSuccessBanner("资产已删除，历史记录保留。");
    } catch (err) {
      setMonthlyMessage(`资产删除失败：${String(err)}`);
    }
  }

  function updateAssetClassification(assetId: string, input: ReturnType<typeof classificationForAsset>) {
    const classification = resolveAssetClassification(input);
    setAssetItems((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              asset_type: classification.assetType,
              main_asset_category_id: classification.mainCategoryId,
              sub_asset_category_id: classification.subCategoryId,
              confirmed: false
            }
          : asset
      )
    );
  }

  function addAssetCashflow(asset: AssetEntryItem, flowType: AssetCashflowItem["flow_type"], flowDate = `${selectedMonth}-28`) {
    const nextFlow: AssetCashflowItem = {
      id: `manual-flow-${asset.id}-${Date.now()}`,
      asset_id: asset.id,
      asset_name: asset.name,
      flow_date: flowDate,
      flow_type: flowType,
      amount: "",
      currency: asset.currency,
      source_kind: "monthly_asset_entry",
      dca_plan_id: null,
      note: "",
      included: true,
      confirmed: false
    };
    setAssetItems((current) =>
      current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, cashflows: [...(item.cashflows ?? []), nextFlow] } : item))
    );
    if (flowType === "sell") {
      setClearedWithoutSellOverrides((current) => ({ ...current, [asset.id]: false }));
    }
  }

  function updateAssetCashflow(assetId: string, flowId: string, patch: Partial<AssetCashflowItem>) {
    setAssetItems((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              confirmed: false,
              cashflows: (asset.cashflows ?? []).map((flow) =>
                flow.id === flowId
                  ? {
                      ...flow,
                      ...patch,
                      confirmed: patch.confirmed ?? false
                    }
                  : flow
              )
            }
          : asset
      )
    );
    if (patch.flow_type === "sell" || patch.amount !== undefined || patch.included !== undefined) {
      setClearedWithoutSellOverrides((current) => ({ ...current, [assetId]: false }));
    }
  }

  function removeAssetCashflow(assetId: string, flowId: string) {
    setAssetItems((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              confirmed: false,
              cashflows: (asset.cashflows ?? []).filter((flow) => flow.id !== flowId)
            }
          : asset
      )
    );
    setClearedWithoutSellOverrides((current) => ({ ...current, [assetId]: false }));
  }

  function addNewAssetDraftCashflow(flowType: AssetCashflowItem["flow_type"]) {
    setNewAssetCashflows((current) => [
      ...current,
      {
        id: `new-asset-flow-${Date.now()}-${flowType}`,
        asset_id: "draft",
        asset_name: newAsset.name || "新资产",
        flow_date: `${selectedMonth}-28`,
        flow_type: flowType,
        amount: "",
        currency: newAsset.currency,
        source_kind: "monthly_asset_entry",
        dca_plan_id: null,
        note: "",
        included: true,
        confirmed: false
      }
    ]);
  }

  function updateNewAssetDraftCashflow(flowId: string, patch: Partial<AssetCashflowItem>) {
    setNewAssetCashflows((current) =>
      current.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              ...patch,
              confirmed: patch.confirmed ?? false
            }
          : flow
      )
    );
  }

  function removeNewAssetDraftCashflow(flowId: string) {
    setNewAssetCashflows((current) => current.filter((flow) => flow.id !== flowId));
  }

  function saveAssetDetail(asset: AssetEntryItem) {
    const amountIssue = assetMonthAmountIssue(asset);
    if (amountIssue) {
      setAssetValidationIssue({ assetId: asset.id, message: amountIssue });
      setMonthlyMessage(amountIssue);
      setExpandedAssetIds((current) => ({ ...current, [asset.id]: true }));
      return;
    }
    const clearedIssue = assetClearedWithoutSellIssue(asset, Boolean(clearedWithoutSellOverrides[asset.id]));
    if (clearedIssue) {
      setAssetValidationIssue({ assetId: asset.id, message: clearedIssue });
      setMonthlyMessage(clearedIssue);
      setExpandedAssetIds((current) => ({ ...current, [asset.id]: true }));
      return;
    }
    const unconfirmedFlows = (asset.cashflows ?? []).filter((flow) => !flow.confirmed);
    if (unconfirmedFlows.length > 0) {
      setAssetValidationIssue({ assetId: asset.id, message: `${asset.name} 还有 ${unconfirmedFlows.length} 条买入/卖出/分红未确认。` });
      setMonthlyMessage(`${asset.name} 还有 ${unconfirmedFlows.length} 条买入/卖出/分红未确认。`);
      setExpandedAssetIds((current) => ({ ...current, [asset.id]: true }));
      return;
    }
    setAssetValidationIssue(null);
    setAssetItems((current) => {
      const saved = current.find((item) => item.id === asset.id);
      if (!saved) return current;
      return [{ ...saved, confirmed: true }, ...current.filter((item) => item.id !== asset.id)];
    });
    setExpandedAssetIds((current) => ({ ...current, [asset.id]: false }));
    setSuccessBanner(`${asset.name} 明细已保存。最后仍需点击“确认资产录入”写入月更数据。`);
  }

  function locateAsset(assetId?: string) {
    if (!assetId) return;
    setExpandedSections((current) => ({ ...current, assets: true }));
    setExpandedAssetIds((current) => ({ ...current, [assetId]: true }));
    window.setTimeout(() => {
      const element = document.querySelector(`[data-asset-id="${assetId}"]`);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top - 160, behavior: "smooth" });
    }, 80);
  }

  async function resetAssetEntryDraft() {
    try {
      const status = await invoke<MonthlyStepStatus>("reset_asset_month_entries", { periodMonth: selectedMonth });
      applyMonthlyStatus(status);
    } catch (err) {
      setMonthlyMessage(`资产录入重置失败：${String(err)}`);
      return;
    }
    setAssetItems([]);
    setDcaCashflows([]);
    setSelectedDcaFlowId(null);
    setExpandedAssetIds({});
    setShowAssetCreator(true);
    setAssetValidationIssue(null);
    setSuccessBanner("本月资产录入已重置。当前月份资产快照、投资现金流和定投调整已清空。");
  }

  function updateDcaCashflow(flowId: string, patch: Partial<AssetCashflowItem>) {
    setDcaCashflows((current) => {
      if (current.some((flow) => flow.id === flowId)) {
        return current.map((flow) => (flow.id === flowId ? { ...flow, ...patch } : flow));
      }
      const generated = assetItems.flatMap((asset) => generateDcaCashflowsForAssets([asset], selectedMonth, current));
      const fallback = generated.find((flow) => flow.id === flowId);
      return fallback ? [...current, { ...fallback, ...patch }] : current;
    });
    setConfirmedDcaAdjustments((current) => ({ ...current, [flowId]: false }));
  }

  function clearAutoDcaPreview(assetId: string) {
    setDcaCashflows((current) => current.filter((flow) => flow.asset_id !== assetId || flow.source_kind !== "dca_auto"));
    setSelectedDcaFlowId(null);
  }

  function setAssetMonthStatus(assetId: string, nextStatus: string) {
    setAssetItems((current) =>
      current.map((item) =>
        item.id === assetId
          ? {
              ...item,
              confirmed: false,
              month_status: nextStatus,
              month_end_amount: nextStatus === "cleared" ? "0" : item.month_end_amount
            }
          : item
      )
    );
    setClearedWithoutSellOverrides((current) => ({ ...current, [assetId]: false }));
  }

  function allowClearedWithoutSell(assetId: string) {
    setClearedWithoutSellOverrides((current) => ({ ...current, [assetId]: true }));
    setAssetValidationIssue(null);
    setMonthlyMessage("已确认仅标记清仓。建议后续补充卖出记录，投资收益和 XIRR 才会更准确。");
  }

  function confirmDcaAdjustment(flowId: string) {
    setConfirmedDcaAdjustments((current) => ({ ...current, [flowId]: true }));
    setSuccessBanner("定投单次调整已确认，点击资产录入确认后会写入数据库。");
  }

  function toggleSection(key: AssetSectionKey) {
    setExpandedSections((current) => ({ ...current, [key]: !current[key] }));
  }

  function dcaWeeklyDay(plan: DcaPlanItem) {
    if (!plan.weekly_rules_json) return "1";
    try {
      const parsed = JSON.parse(plan.weekly_rules_json);
      if (Array.isArray(parsed)) return String(parsed[0]?.weekday ?? 1);
    } catch {
      return "1";
    }
    return "1";
  }

  function weekdayLabel(weekday: number) {
    return ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][Math.min(Math.max(weekday, 1), 7) - 1];
  }

  function dcaPlanDetail(plan: DcaPlanItem, currency: CurrencyCode) {
    const amount = Number(plan.amount) || 0;
    const range = `${plan.start_date || `${selectedMonth}-01`}${plan.end_date ? ` 至 ${plan.end_date}` : ""}`;
    if (plan.frequency === "daily") {
      return `每日 · ${formatCurrency(amount, privacyMode, currency)} · ${range}`;
    }
    if (plan.frequency === "weekly") {
      const rules = weeklyRules(plan);
      const ruleText = rules
        .map((rule) => `${weekdayLabel(rule.weekday)} ${formatCurrency(rule.amount || amount, privacyMode, currency)}`)
        .join(" / ");
      return `每周 · ${ruleText || formatCurrency(amount, privacyMode, currency)} · ${range}`;
    }
    return `每月 ${Number(plan.monthly_day) || 1} 号 · ${formatCurrency(amount, privacyMode, currency)} · ${range}`;
  }

  function updateAssetDcaPlan(assetId: string, index: number, patch: Partial<DcaPlanItem>) {
    clearAutoDcaPreview(assetId);
    setAssetItems((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              confirmed: false,
              dca_plans: (asset.dca_plans ?? []).map((plan, planIndex) => {
                if (planIndex !== index) return plan;
                const nextPlan = { ...plan, ...patch };
                if (nextPlan.frequency === "weekly") {
                  nextPlan.weekly_rules_json = JSON.stringify([
                    { weekday: Number(dcaWeeklyDay(nextPlan)) || 1, amount: Number(nextPlan.amount) || 0 }
                  ]);
                }
                if (patch.frequency === "daily" || patch.frequency === "monthly") {
                  nextPlan.weekly_rules_json = null;
                }
                return nextPlan;
              })
            }
          : asset
      )
    );
  }

  function addAssetDcaPlan(asset: AssetEntryItem) {
    clearAutoDcaPreview(asset.id);
    const nextPlan: DcaPlanItem = {
      id: null,
      frequency: "monthly",
      amount: "",
      start_date: `${selectedMonth}-01`,
      end_date: null,
      weekly_rules_json: null,
      monthly_day: 1
    };
    setAssetItems((current) =>
      current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, is_dca: true, dca_plans: [...(item.dca_plans ?? []), nextPlan] } : item))
    );
  }

  function removeAssetDcaPlan(assetId: string, index: number) {
    clearAutoDcaPreview(assetId);
    setAssetItems((current) =>
      current.map((asset) =>
        asset.id === assetId ? { ...asset, confirmed: false, dca_plans: (asset.dca_plans ?? []).filter((_, planIndex) => planIndex !== index) } : asset
      )
    );
  }

  function renderMonthlyDcaCalendar(
    markedDays: Set<number>,
    title = "本月定投日历",
    pausedDays = new Set<number>(),
    onSelectDay?: (day: number) => void,
    selectedDay?: number
  ) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const totalDays = daysInMonth(selectedMonth);
    const firstWeekday = isoWeekday(`${year}-${String(month).padStart(2, "0")}-01`);
    const cells: Array<number | null> = [
      ...Array.from({ length: firstWeekday - 1 }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => index + 1)
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="dca-calendar" aria-label={title}>
        <div className="dca-calendar-header">
          <strong>{title}</strong>
          <span>{selectedMonth} · {markedDays.size} 天 · 点红圈修改</span>
        </div>
        <div className="dca-calendar-grid week-head">
          {["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="dca-calendar-grid">
          {cells.map((day, index) => {
            const isMarked = Boolean(day && markedDays.has(day));
            const isPaused = Boolean(day && pausedDays.has(day));
            const isSelected = Boolean(day && selectedDay === day);
            return (
              <button
                className={[isMarked ? "buy-day" : "", isPaused ? "paused-day" : "", isSelected ? "selected-day" : ""].filter(Boolean).join(" ")}
                disabled={!day || (!isMarked && !isPaused)}
                key={`${selectedMonth}-${index}`}
                onClick={() => day && onSelectDay?.(day)}
                aria-label={isMarked ? "点击编辑这笔定投" : isPaused ? "已暂停，可点击恢复" : undefined}
                type="button"
              >
                {day ?? ""}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function dcaFlowsForAsset(asset: AssetEntryItem) {
    return generateDcaCashflowsForAssets(
      [asset],
      selectedMonth,
      dcaCashflows.filter((flow) => flow.asset_id === asset.id)
    );
  }

  function dcaDaysForAsset(asset: AssetEntryItem) {
    return new Set(
      dcaFlowsForAsset(asset)
        .filter((flow) => flow.included)
        .map((flow) => Number(flow.flow_date.slice(8, 10)))
    );
  }

  function pausedDcaDaysForAsset(asset: AssetEntryItem) {
    return new Set(
      dcaFlowsForAsset(asset)
        .filter((flow) => !flow.included)
        .map((flow) => Number(flow.flow_date.slice(8, 10)))
    );
  }

  function dcaFlowForDay(asset: AssetEntryItem, day: number) {
    const computedFlow = dcaFlowsForAsset(asset).find((flow) => Number(flow.flow_date.slice(8, 10)) === day);
    if (!computedFlow) return null;
    setDcaCashflows((current) => {
      const withoutSameFlow = current.filter(
        (flow) =>
          !(
            flow.asset_id === asset.id &&
            flow.flow_date === computedFlow.flow_date &&
            flow.flow_type === computedFlow.flow_type &&
            (flow.dca_plan_id ?? "") === (computedFlow.dca_plan_id ?? "")
          )
      );
      return [...withoutSameFlow, computedFlow];
    });
    return computedFlow;
  }

  function selectedDcaFlowForAsset(asset: AssetEntryItem) {
    if (!selectedDcaFlowId) return null;
    return (
      dcaCashflows.find((flow) => flow.id === selectedDcaFlowId && flow.asset_id === asset.id) ??
      dcaFlowsForAsset(asset).find((flow) => flow.id === selectedDcaFlowId) ??
      null
    );
  }

  function visibleRows<T>(key: string, rows: T[]) {
    return expandedDashboardLists[key] ? rows : rows.slice(0, 4);
  }

  function toggleDashboardList(key: string) {
    setExpandedDashboardLists((current) => ({ ...current, [key]: !current[key] }));
  }

  async function createCategoryForRow(row: TransactionReviewRow) {
    if (!newCategoryDraft.name.trim()) {
      setMonthlyMessage("请填写分类名称。");
      return;
    }
    try {
      const category = await invoke<CategoryOption>("create_category", {
        input: {
          name: newCategoryDraft.name.trim(),
          category_kind: row.transaction_type,
          rigidity: null,
          is_personal: newCategoryDraft.isPersonal,
          note: newCategoryDraft.note || null
        }
      });
      const applyCategory = (review: TransactionReview | null) =>
        review
          ? {
              ...review,
              categories: [...review.categories.filter((item) => item.id !== category.id), category],
              rows: review.rows.map((item) =>
                item.id === row.id
                  ? {
                      ...item,
                      category_id: category.id,
                      category_name: category.name,
                      adjustment_reason: item.adjustment_reason || "新增并选择分类"
                    }
                  : item
              )
            }
          : review;
      if (row.transaction_type === "expense") {
        setExpenseReview((current) => applyCategory(current));
      } else {
        setIncomeReview((current) => applyCategory(current));
      }
      setAddingCategoryRowId(null);
      setNewCategoryDraft({ name: "", rigidity: "flexible", isPersonal: true, note: "" });
      setSuccessBanner(`分类“${category.name}”已新增，并已选中当前明细。`);
    } catch (err) {
      setMonthlyMessage(`新增分类失败：${String(err)}`);
    }
  }

  async function createCategoryForManual(transactionType: "expense" | "income") {
    if (!newCategoryDraft.name.trim()) {
      setMonthlyMessage("请填写分类名称。");
      return;
    }
    try {
      const category = await invoke<CategoryOption>("create_category", {
        input: {
          name: newCategoryDraft.name.trim(),
          category_kind: transactionType,
          rigidity: null,
          is_personal: newCategoryDraft.isPersonal,
          note: newCategoryDraft.note || null
        }
      });
      if (transactionType === "expense") {
        setExpenseReview((current) =>
          current ? { ...current, categories: [...current.categories, category] } : current
        );
        setManualExpense((current) => ({ ...current, categoryId: category.id }));
      } else {
        setIncomeReview((current) =>
          current ? { ...current, categories: [...current.categories, category] } : current
        );
        setManualIncome((current) => ({ ...current, categoryId: category.id }));
      }
      setAddingCategoryRowId(null);
      setNewCategoryDraft({ name: "", rigidity: "flexible", isPersonal: true, note: "" });
      setSuccessBanner(`分类“${category.name}”已新增，并已选中。`);
    } catch (err) {
      setMonthlyMessage(`新增分类失败：${String(err)}`);
    }
  }

  async function confirmReview(transactionType: "expense" | "income") {
    const review = transactionType === "expense" ? expenseReview : incomeReview;
    if (!review) return;
    setConfirmingReview(transactionType);
    setSuccessBanner(null);
    setMonthlyMessage(`${transactionType === "expense" ? "支出" : "收入"}正在保存...`);
    const missingRateRows = review.rows.filter((row) => convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY", "CNY") === null);
    if (missingRateRows.length > 0) {
      setConfirmingReview(null);
      setDetailExpanded((current) => ({ ...current, [transactionType]: true }));
      setSuccessBanner(null);
      setMonthlyMessage(`缺少 ${missingRateRows.length} 条汇率，请补充后再确认。`);
      return;
    }
    const items: ConfirmTransactionInput[] = review.rows.map((row) => ({
      raw_transaction_id: row.id.startsWith("manual-") ? null : row.id,
      transaction_date: row.transaction_date,
      transaction_type: transactionType,
      amount: convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY", "CNY") ?? 0,
      currency: "CNY",
      category_id: row.category_id,
      raw_category_snapshot: row.raw_category,
      include_in_stats: row.include_in_stats ?? true,
      note: row.note,
      adjustment_reason: row.adjustment_reason ?? null
    }));
    try {
      const result = await invoke<{ confirmed_count: number; included_amount: number }>("confirm_transactions", {
        periodMonth: selectedMonth,
        transactionType,
        items
      });
      await loadDashboard();
      setCompletedSteps((current) => ({ ...current, [transactionType]: true }));
      await loadMonthlyStatus(selectedMonth);
      setSuccessBanner(`${transactionType === "expense" ? "支出" : "收入"}确认成功，已写入本月数据。`);
      setMonthlyMessage(
        `${transactionType === "expense" ? "支出" : "收入"}已确认：${result.confirmed_count} 条，计入 ${formatCurrency(
          result.included_amount,
          false
        )}。`
      );
    } catch (err) {
      setSuccessBanner(null);
      setMonthlyMessage(`${transactionType === "expense" ? "支出" : "收入"}保存失败：${String(err)}`);
    } finally {
      setConfirmingReview(null);
    }
  }

  const renderConfirmDialog = () => {
    if (!confirmDialog) return null;
    return (
      <div className="confirm-dialog-backdrop" role="presentation">
        <section aria-modal="true" className="confirm-dialog" role="dialog">
          <p className="eyebrow">Confirm</p>
          <h2>{confirmDialog.title}</h2>
          <p>{confirmDialog.message}</p>
          <div className="row-actions">
            <button className="secondary-button compact" onClick={() => setConfirmDialog(null)} type="button">
              取消
            </button>
            <button
              className={`primary-button compact ${confirmDialog.danger ? "danger-action" : ""}`}
              onClick={async () => {
                const action = confirmDialog.onConfirm;
                setConfirmDialog(null);
                try {
                  await action();
                } catch (err) {
                  setMonthlyMessage(String(err));
                  setTemplateMessage(String(err));
                }
              }}
              type="button"
            >
              {confirmDialog.confirmLabel}
            </button>
          </div>
        </section>
      </div>
    );
  };

  const renderSettingsDialog = () => {
    if (!settingsOpen) return null;
    const passwordMode = security?.password_set ? "modify" : "create";
    return (
      <div className="settings-dialog-backdrop" role="presentation">
        <section aria-modal="true" className="settings-dialog" role="dialog">
          <div className="settings-dialog-header">
            <div>
              <p className="eyebrow">Settings</p>
              <h2>设置</h2>
            </div>
            <button className="icon-only-button" onClick={() => setSettingsOpen(false)} type="button" aria-label="关闭设置">
              ×
            </button>
          </div>

          <div className="settings-tabs" role="tablist">
            <button className={settingsTab === "sync" ? "active" : ""} onClick={() => setSettingsTab("sync")} type="button">
              账号与同步
            </button>
            <button className={settingsTab === "password" ? "active" : ""} onClick={() => setSettingsTab("password")} type="button">
              {passwordMode === "modify" ? "修改密码" : "设置密码"}
            </button>
            <button className={settingsTab === "reset" ? "active danger-tab" : "danger-tab"} onClick={() => setSettingsTab("reset")} type="button">
              初始化重置账号
            </button>
          </div>

          {settingsTab === "sync" ? (
            <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
              <p className="settings-copy">
                同步后，手机草稿会进入云端草稿箱；电脑可把已发布月报看板同步到手机。
              </p>
              {!cloudSyncConfigured() ? (
                <div className="settings-warning">
                  当前安装包还没有启用账号同步。请更新到最新版本，或检查云同步配置。
                </div>
              ) : null}
              {cloudSession ? (
                <>
                  <div className="settings-warning">
                    当前账号：{cloudSession.user.email || cloudSession.user.id}
                  </div>
                  <div className="mobile-sync-metrics">
                    <article><span>云端待处理</span><strong>{cloudDrafts.length} 条</strong></article>
                    <article><span>本地收件箱</span><strong>{mobileSyncSummary?.received_in_desktop ?? 0} 条</strong></article>
                    <article><span>看板月份</span><strong>{summary.snapshot_month || "待同步"}</strong></article>
                  </div>
                  {cloudMessage ? <p className="settings-message">{cloudMessage}</p> : null}
                  <div className="row-actions">
                    <button className="secondary-button compact" disabled={cloudBusy} onClick={() => void refreshCloudDrafts()} type="button">
                      刷新云草稿
                    </button>
                    <button className="primary-button compact" disabled={cloudBusy} onClick={() => void pullCloudDraftsToInbox()} type="button">
                      拉取到电脑收件箱
                    </button>
                    <button className="secondary-button compact" disabled={cloudBusy} onClick={() => void pushDashboardSnapshotToCloud()} type="button">
                      同步看板到手机
                    </button>
                    <button className="secondary-button compact" disabled={cloudBusy} onClick={() => rememberCloudSession(null)} type="button">
                      退出账号
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label>
                    邮箱
                    <input
                      autoComplete="email"
                      onChange={(event) => {
                        setCloudEmail(event.target.value);
                        setCloudSignupSuggested(false);
                      }}
                      placeholder="输入邮箱"
                      type="email"
                      value={cloudEmail}
                    />
                  </label>
                  <label>
                    账号密码
                    <input
                      autoComplete="current-password"
                      minLength={6}
                      onChange={(event) => {
                        setCloudPassword(event.target.value);
                        setCloudSignupSuggested(false);
                      }}
                      placeholder="至少 6 位"
                      type="password"
                      value={cloudPassword}
                    />
                  </label>
                  {cloudMessage ? <p className="settings-message">{cloudMessage}</p> : null}
                  <div className="row-actions">
                    <button className="primary-button compact" disabled={cloudBusy || !cloudSyncConfigured()} onClick={() => void handleCloudAuth("signin")} type="button">
                      登录
                    </button>
                    {cloudSignupSuggested ? (
                      <button className="secondary-button compact" disabled={cloudBusy || !cloudSyncConfigured()} onClick={() => void handleCloudAuth("signup")} type="button">
                        用此邮箱创建新账号
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </form>
          ) : settingsTab === "password" ? (
            <form className="settings-form" onSubmit={handleChangePassword}>
              <p className="settings-copy">
                {passwordMode === "modify"
                  ? "输入当前密码验证后，可以保存新密码。"
                  : "当前没有设置密码。设置后，下次打开 App 需要先输入密码。"}
              </p>
              {passwordMode === "modify" ? (
                <label>
                  当前密码
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setSettingsCurrentPassword(event.target.value)}
                    type="password"
                    value={settingsCurrentPassword}
                  />
                </label>
              ) : null}
              <label>
                新密码
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => setSettingsNewPassword(event.target.value)}
                  placeholder="至少 6 位"
                  type="password"
                  value={settingsNewPassword}
                />
              </label>
              <label>
                再输入一次新密码
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => setSettingsConfirmPassword(event.target.value)}
                  placeholder="两次完全一致后才能保存"
                  type="password"
                  value={settingsConfirmPassword}
                />
              </label>
              {settingsMessage ? <p className="settings-message">{settingsMessage}</p> : null}
              <div className="row-actions">
                <button className="secondary-button compact" onClick={() => setSettingsOpen(false)} type="button">
                  取消
                </button>
                <button
                  className="primary-button compact"
                  disabled={settingsBusy || settingsNewPassword.length < 6 || settingsNewPassword !== settingsConfirmPassword}
                  type="submit"
                >
                  {settingsBusy ? "保存中..." : "确认保存"}
                </button>
              </div>
            </form>
          ) : (
            <form className="settings-form reset-account-form" onSubmit={handleResetAccount}>
              <p className="settings-copy">
                这会清空当前 App 环境里的收入、支出、资产、月报、模板、偏好和密码。完成后 App 会自动退出；再次打开会回到新用户流程。
              </p>
              <div className="settings-warning">
                当前环境：{environmentLabel || "正式版"}。只会重置当前环境数据库，不会同时清空其他版本。
              </div>
              {security?.password_set ? (
                <label>
                  当前密码
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setSettingsResetPassword(event.target.value)}
                    type="password"
                    value={settingsResetPassword}
                  />
                </label>
              ) : null}
              <label>
                确认文字
                <input
                  onChange={(event) => setSettingsResetConfirmText(event.target.value)}
                  placeholder="输入：清空当前账号"
                  value={settingsResetConfirmText}
                />
              </label>
              {settingsMessage ? <p className="settings-message">{settingsMessage}</p> : null}
              <div className="row-actions">
                <button className="secondary-button compact" onClick={() => setSettingsOpen(false)} type="button">
                  取消
                </button>
                <button
                  className="primary-button compact danger-action"
                  disabled={settingsBusy || settingsResetConfirmText !== "清空当前账号"}
                  type="submit"
                >
                  {settingsBusy ? "重置中..." : "清空并退出"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    );
  };

  const renderMobilePairingDialog = () => {
    if (!mobilePairingDialogOpen || !mobilePairingInfo?.enabled) return null;
    return (
      <div className="settings-dialog-backdrop" role="presentation">
        <section aria-modal="true" className="settings-dialog mobile-pairing-dialog" role="dialog">
          <div className="settings-dialog-header">
            <div>
              <p className="eyebrow">Legacy Local Sync</p>
              <h2>本地手机同步</h2>
            </div>
            <button className="icon-only-button" onClick={() => setMobilePairingDialogOpen(false)} type="button" aria-label="关闭本地手机同步">
              ×
            </button>
          </div>
          <div className="mobile-pairing-dialog-body">
            <p className="mobile-sync-copy">这是旧版同网络同步入口，仅用于兼容历史测试。正式使用请在“账号与同步”里登录同一个账号。</p>
            <section className="mobile-pairing-detail-card">
              <span>添加设备</span>
              <strong>{mobilePairingInfo.pairing_code}</strong>
              <code>{mobilePairingInfo.pairing_url || mobilePairingInfo.pairing_url_path}</code>
              <small>手机打开上面的链接即可，不需要再下载或双击 .command。手机和电脑需要能互相访问同一局域网地址；手机开热点、电脑连接该热点也可以。</small>
            </section>
            <section className="mobile-device-list">
              <div className="mobile-device-list-head">
                <b>已绑定设备</b>
                <em>{mobilePairingInfo.paired_device_count} 台</em>
              </div>
              {mobilePairingInfo.devices.length ? (
                mobilePairingInfo.devices.map((device) => (
                  <article key={device.device_id}>
                    <span>
                      <b>{device.device_name || "手机浏览器"}</b>
                      <small>{device.app_version || "未知版本"} · 最近连接 {device.last_seen_at}</small>
                    </span>
                    <em>{device.pending_count} 条待同步</em>
                  </article>
                ))
              ) : (
                <p className="mobile-sync-copy">还没有手机完成绑定。</p>
              )}
            </section>
            <div className="row-actions">
              <button className="secondary-button compact" onClick={() => void refreshMobilePairingInfo()} type="button">
                刷新
              </button>
              <button
                className="primary-button compact danger-action"
                onClick={() => {
                  setConfirmDialog({
                    title: "清空旧版本地同步设备？",
                    message: "清空后，旧版同网络手机入口需要重新生成连接。已进入电脑收件箱或已入库的数据不会删除。",
                    confirmLabel: "清空设备",
                    danger: true,
                    onConfirm: async () => {
                      await resetMobilePairingDevices();
                      setMobilePairingDialogOpen(false);
                    }
                  });
                }}
                type="button"
              >
                解除绑定
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  };

  if (shouldShowInitialPasswordSetup) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-icon">
            <Shield size={28} />
          </div>
          {isDemoEnvironment ? <div className="environment-badge demo-badge">Demo 演示版</div> : null}
          <p className="eyebrow">Security</p>
          <h1>设置文档密码</h1>
          <p className="auth-copy">密码用于保护本地财务数据。系统只保存加盐哈希，不保存明文。也可以先跳过，之后从右上角“设置”里补设。</p>
          <form className="auth-form" onSubmit={handleSetPassword}>
            <label>
              密码
              <input
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
                type="password"
                value={password}
              />
            </label>
            <label>
              确认密码
              <input
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次输入"
                type="password"
                value={confirmPassword}
              />
            </label>
            {securityMessage ? <p className="auth-error">{securityMessage}</p> : null}
            <div className="auth-actions">
              <button className="secondary-button compact" onClick={skipInitialPasswordSetup} type="button">
                先跳过
              </button>
              <button type="submit">启用密码保护</button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  if (security && !security.unlocked) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-icon">
            <Lock size={28} />
          </div>
          {isDemoEnvironment ? <div className="environment-badge demo-badge">Demo 演示版</div> : null}
          <p className="eyebrow">Locked</p>
          <h1>输入密码</h1>
          <p className="auth-copy">
            解锁后才会读取财务看板和资产金额。{isDemoEnvironment ? "当前为脱敏演示数据，密码 demo123456。" : ""}
          </p>
          <form className="auth-form" onSubmit={handleUnlock}>
            <label>
              密码
              <input
                autoFocus
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入 App 密码"
                type="password"
                value={password}
              />
            </label>
            {securityMessage ? <p className="auth-error">{securityMessage}</p> : null}
            <button type="submit">解锁</button>
          </form>
        </section>
      </main>
    );
  }

  async function refreshMobileSyncSummary() {
    try {
      const result = await invoke<MobileSyncSummary>("get_mobile_sync_summary");
      setMobileSyncSummary(result);
      setMobileSyncMessage(null);
    } catch (err) {
      setMobileSyncMessage(String(err));
    }
  }

  async function refreshMobilePairingInfo() {
    try {
      const result = await invoke<MobilePairingInfo>("get_mobile_pairing_info");
      setMobilePairingInfo(result);
    } catch {
      setMobilePairingInfo(null);
    }
  }

  async function resetMobilePairingDevices() {
    try {
      const result = await invoke<MobilePairingInfo>("reset_mobile_pairing_devices");
      setMobilePairingInfo(result);
      setMobileSyncMessage("已清空旧版本地同步设备。");
      await refreshMobileSyncSummary();
    } catch (err) {
      setMobileSyncMessage(String(err));
    }
  }

  async function markMobileSyncReviewed(ids: string[]) {
    if (!ids.length) return;
    try {
      const result = await invoke<MobileSyncSummary>("mark_mobile_sync_records_reviewed", { ids });
      setMobileSyncSummary(result);
      setMobileSyncMessage("已标记为电脑端已处理。");
    } catch (err) {
      setMobileSyncMessage(String(err));
    }
  }

  const mobileRecordLabel = (record: MobileSyncInboxRecord) => {
    if (record.record_kind === "credit_card_adjustment") {
      return `信用卡调整｜${record.period_month || selectedMonth}`;
    }
    return `${record.transaction_type === "income" ? "收入" : "支出"}｜${record.transaction_date || ""}｜${record.category || "未分类"}`;
  };

  const mobileRecordAmount = (record: MobileSyncInboxRecord) => {
    if (record.record_kind === "credit_card_adjustment") {
      return formatCurrency(Number(record.net_adjustment) || 0, privacyMode);
    }
    return formatCurrency(Number(record.amount) || 0, privacyMode);
  };

  const renderMobileSyncNotice = () => {
    const receivedRecords = mobileSyncSummary?.records.filter((record) => record.sync_status === "received") ?? [];
    const allReceivedIds = receivedRecords.map((record) => record.id);
    return (
      <section className="mobile-sync-panel">
        <div className="mobile-sync-head">
          <div>
            <p className="eyebrow">Mobile Sync</p>
            <h2>手机同步收件箱</h2>
          </div>
          <div className="mobile-sync-actions">
            <button className="secondary-button compact" onClick={() => void refreshMobileSyncSummary()} type="button">
              刷新
            </button>
            <button className="primary-button compact" onClick={() => void openMonthlyUpdate()} type="button">
              去月更确认
            </button>
          </div>
        </div>
        <div className="mobile-sync-metrics">
          <article><span>手机端未同步</span><strong>{mobileSyncSummary?.pending_on_phone ?? 0} 条</strong></article>
          <article><span>电脑已收到</span><strong>{mobileSyncSummary?.received_in_desktop ?? 0} 条</strong></article>
          <article><span>已处理</span><strong>{mobileSyncSummary?.reviewed_in_desktop ?? 0} 条</strong></article>
        </div>
        <p className="mobile-sync-copy">
          {mobileSyncSummary?.last_seen_at ? `最近连接：${mobileSyncSummary.last_seen_at}。` : "手机还没有连接过。"}
        </p>
        {mobileSyncMessage ? <p className="mobile-sync-message">{mobileSyncMessage}</p> : null}
        {mobileSyncSummary?.records.length ? (
          <>
            <button className="mobile-sync-toggle" onClick={() => setMobileSyncExpanded((current) => !current)} type="button">
              <span>{mobileSyncExpanded ? "收起明细" : "查看明细"}</span>
              <small>{mobileSyncSummary.records.length} 条最近记录</small>
            </button>
            {mobileSyncExpanded ? (
              <div className="mobile-sync-list">
                {mobileSyncSummary.records.map((record) => (
                  <div className="mobile-sync-row" key={record.id}>
                    <span>
                      <b>{mobileRecordLabel(record)}</b>
                      <small>{record.note || record.local_id}</small>
                    </span>
                    <em>{mobileRecordAmount(record)}</em>
                    <i>{record.sync_status === "reviewed" ? "已处理" : "已收到"}</i>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {mobileSyncExpanded && allReceivedIds.length ? (
          <button className="secondary-button compact" onClick={() => void markMobileSyncReviewed(allReceivedIds)} type="button">
            标记这些已处理
          </button>
        ) : null}
      </section>
    );
  };

  const renderThemeSwitcher = (label: string) => (
    <div className="dashboard-preferences app-theme-switcher" aria-label={label}>
      <Palette size={15} aria-hidden="true" />
      {dashboardThemes.map((item) => (
        <button
          className={dashboardTheme === item.id ? "active" : ""}
          data-tooltip={`${item.label}｜${item.detail}`}
          key={item.id}
          onClick={() => setDashboardTheme(item.id)}
          type="button"
          aria-label={`切换到${item.label}主题：${item.detail}`}
        >
          {item.swatches.map((color) => (
            <i key={`${item.id}-${color}`} style={{ background: color }} />
          ))}
        </button>
      ))}
    </div>
  );

  const renderHeader = () => (
    <>
      <section className="topbar">
        <button className="brand-button" onClick={() => setView("home")} type="button">
          <span className="brand-mark" />
          <span>
            <p className="eyebrow">钱迹WorthTrace</p>
            <strong>财务工作台</strong>
          </span>
        </button>
        <div className={`status-pill status-${loadState}`}>
          <Database size={16} />
          <span>{loadState === "ready" ? "本地资料已连接" : loadState === "loading" ? "读取中" : "预览数据"}</span>
        </div>
        {isDemoEnvironment ? <div className="status-pill demo-status">Demo 演示版</div> : null}
      </section>

      <section className="security-bar">
        <div>
          <Shield size={18} />
          <span>{security?.password_set ? "密码保护已启用" : "未设置文档密码"}</span>
        </div>
        <div className="security-actions">
          {renderThemeSwitcher("全局主题")}
          <button className="icon-button" onClick={() => openSettings("sync")} type="button">
            <Settings size={17} />
            <span>账号与同步</span>
          </button>
          <button className="icon-button" onClick={() => void openPreferences()} type="button">
            <Target size={17} />
            <span>偏好设置</span>
          </button>
          <button
            className={`icon-button ${privacyMode ? "active" : ""}`}
            onClick={() => handlePrivacyMode(!privacyMode)}
            type="button"
          >
            {privacyMode ? <EyeOff size={17} /> : <Eye size={17} />}
            <span>{privacyMode ? "显示金额" : "隐藏金额"}</span>
          </button>
          {security?.password_set ? (
            <button className="icon-button" onClick={handleLock} type="button">
              <Lock size={17} />
              <span>锁定</span>
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="notice">
          <AlertCircle size={18} />
          <span>当前为预览数据。桌面 App 会读取你的本地资料。</span>
        </section>
      ) : null}
      {renderMobileSyncNotice()}
    </>
  );

	  const renderHome = () => (
	    (() => {
      const trendMonths = [...summary.monthly_trends.map((item) => item.period_month), summary.snapshot_month]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const recordStartMonth = trendMonths[0] ?? summary.snapshot_month;
      const nextUpdateMonth = nextPeriodMonth(summary.snapshot_month || currentMonth);
      const nextUpdateDate = monthEndDate(nextUpdateMonth);
      const monthLabel = (month: string) => month ? `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月` : "暂无";
      const dateLabel = (date: string) => `${date.slice(0, 4)} 年 ${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日`;

      return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Personal Finance Space</p>
          <h1>个人财务记录与分析空间</h1>
          <p>
            把每月收支、资产和投资记录整理成清晰的长期趋势。
          </p>
          <p className="hero-subcopy">
            更新一次，看清一次变化。
          </p>
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => {
                if (primaryActionView === "monthlyUpdate") {
                  void openMonthlyUpdate();
                  return;
                }
                setView(primaryActionView);
              }}
              type="button"
            >
              <span>{primaryActionLabel}</span>
              <ArrowRight size={18} />
            </button>
            <button className="secondary-button" onClick={() => setView("healthDashboard")} type="button">
              查看健康看板
            </button>
          </div>
        </div>
      </section>

      <section className="entry-grid">
        <button className="entry-card" onClick={() => void openMonthlyUpdate()} type="button">
          <div className="entry-icon">
            <RefreshCcw size={22} />
          </div>
          <span>月底财务信息更新</span>
          <p>导入账单，确认收支，补齐资产和信用卡口径。</p>
          <ArrowRight size={18} />
        </button>
	        <button className="entry-card" onClick={() => setView("healthDashboard")} type="button">
	          <div className="entry-icon">
	            <BarChart3 size={22} />
	          </div>
	          <span>财务健康看板</span>
	          <p>查看收支储蓄、资产配置、投资表现和月报。</p>
	          <ArrowRight size={18} />
	        </button>
	        <button className="entry-card" onClick={() => setView("contentTemplates")} type="button">
	          <div className="entry-icon">
	            <Edit3 size={22} />
          </div>
          <span>内容模板设置</span>
          <p>管理分析说明和导出 HTML 的文案模板。</p>
          <ArrowRight size={18} />
        </button>
        <article className="entry-card reminder-card">
          <div className="entry-icon">
            <AlertCircle size={22} />
          </div>
          <span>本月提醒</span>
          <ul className="reminder-list">
            <li>当前已经更新到 {monthLabel(summary.snapshot_month)}。</li>
            <li>已录入 {monthLabel(recordStartMonth)} 到 {monthLabel(summary.snapshot_month)} 的数据。</li>
            <li>{dateLabel(nextUpdateDate)} 需要更新当月内容。</li>
            <li>确认鲨鱼账单后再进入资产录入。</li>
            <li>隐私模式可隐藏所有金额。</li>
          </ul>
        </article>
      </section>
    </>
      );
	    })()
	  );

		  const renderOnboarding = (mode: "setup" | "preferences" = "setup") => {
		    const isPreferenceMode = mode === "preferences";
		    const setupSteps = [
		      { title: "储蓄偏好", detail: "先确定每月想留下多少钱。" },
		      { title: "资产清单", detail: "可以现在录入，也可以之后在月底更新里补齐。" },
		      { title: "目标配比", detail: "可跳过；跳过后看板不显示目标差值。" },
		      { title: "关注看板", detail: "默认模块可单击取消，自定义分析点按模块和方面选择。" }
		    ];
		    const preferenceSteps = [
		      setupSteps[0],
		      setupSteps[2],
		      setupSteps[3]
		    ];
		    const steps = isPreferenceMode ? preferenceSteps : setupSteps;
		    const activeStep = isPreferenceMode ? ([0, 2, 3][onboardingStep] ?? 0) : onboardingStep;
		    const currentStep = steps[onboardingStep] ?? steps[0];
		    const mainTargets = buildMainTargetsWithSavedValues(
		      onboardingSelectedMainAllocationOptions,
		      onboardingTargets,
		      savedMainTargetByCategory,
		      editedMainTargetIds
		    );
		    const subTargets = onboardingTargets.filter((target) => target.level === "sub");
		    const mainTargetTotal = mainTargets.reduce((sum, target) => sum + targetPercentNumber(target.target_percent), 0);
	    const configuredSubParentIds = [...new Set(subTargets.map((target) => target.parent_category_id).filter(Boolean) as string[])];
	    const subTargetGroupParentOptions = [
	      ...onboardingTargetParentOptions,
	      ...configuredSubParentIds
	        .filter((parentId) => !onboardingTargetParentOptions.some(([id]) => id === parentId))
	        .map((parentId) => [parentId, assetCategoryPathLabel(assetCategoryTree, parentId)])
	    ];
	    const subTargetGroups = subTargetGroupParentOptions
	      .map(([parentId, parentLabel]) => ({
	        parentId,
	        parentLabel,
	        rows: subTargets.filter((target) => target.parent_category_id === parentId)
	      }))
	      .filter((group) => group.rows.length > 0);
	    const subTargetDraftOptions = onboardingSubAllocationOptions[onboardingSubTargetDraftParent] ?? [];
	    const subTargetDraftPath = assetCategoryPathIds(assetCategoryTree, onboardingSubTargetDraftParent);
	    const subTargetDraftTopId = subTargetDraftPath[0] ?? categoryOptions(assetCategoryTree)[0]?.[0] ?? "asset_cat_cash";
	    const subTargetDraftTopNode = findAssetCategoryNode(assetCategoryTree, subTargetDraftTopId);
	    const subTargetDraftTopOptions = categoryOptions(assetCategoryTree.filter((node) => (node.children ?? []).length > 0));
	    const subTargetDraftSecondParentOptions = categoryOptions((subTargetDraftTopNode?.children ?? []).filter((node) => (node.children ?? []).length > 0));
	    const subTargetDraftCanGoDeeper = subTargetDraftSecondParentOptions.length > 0;
	    const subTargetDraftUsesDeeperLevel = subTargetDraftPath.length > 1;
	    const subTargetDraftSecondParentId = subTargetDraftPath[1] ?? subTargetDraftSecondParentOptions[0]?.[0] ?? "";
	    const subTargetDraftParentLabel = assetCategoryPathLabel(assetCategoryTree, onboardingSubTargetDraftParent);
	    const mainTargetTotalClass = mainTargetTotal > 100.0001 ? "target-total over" : mainTargetTotal < 99.9999 ? "target-total incomplete" : "target-total";
			    const selectedDashboardItemSet = new Set(normalizeDashboardItemIds(onboardingDashboardItems));
		    const effectiveEditorTargets = effectiveOnboardingTargetsForEditor();
		    const hasAllocationTargetsForCustom = !onboardingSkipTargets && effectiveEditorTargets.length > 0;
		    const visibleDashboardCustomItemDefinitions = dashboardCustomItemDefinitions.filter(
		      (item) => hasAllocationTargetsForCustom || !isTargetDependentDashboardItem(item.id)
		    );
		    const selectedDiscretionaryLabels = dashboardCustomSettings.discretionary_category_ids
	      .map((id) => assetCategoryPathLabel(assetCategoryTree, id))
	      .filter(Boolean);
	    const discretionaryTopOptions = categoryOptions(assetCategoryTree);
	    const discretionaryTopNode = findAssetCategoryNode(assetCategoryTree, discretionaryDraftTopId);
	    const discretionarySecondOptions = categoryOptions(discretionaryTopNode?.children ?? []);
	    const discretionarySecondNode = discretionaryDraftSecondId ? findAssetCategoryNode(assetCategoryTree, discretionaryDraftSecondId) : null;
	    const discretionaryThirdOptions = discretionaryDraftSecondId ? categoryOptions(discretionarySecondNode?.children ?? []) : [];
	    const discretionaryDraftSelectionId = discretionaryDraftThirdId || discretionaryDraftSecondId || discretionaryDraftTopId;
	    const discretionaryDraftSelectionLabel = assetCategoryPathLabel(assetCategoryTree, discretionaryDraftSelectionId);
	    const customDetailPath = assetCategoryPathIds(assetCategoryTree, dashboardCustomSettings.allocation_detail_parent_id);
	    const customDetailTopId = customDetailPath[0] ?? categoryOptions(assetCategoryTree)[0]?.[0] ?? "asset_cat_cash";
	    const customDetailTopNode = findAssetCategoryNode(assetCategoryTree, customDetailTopId);
	    const customDetailTopOptions = categoryOptions(assetCategoryTree.filter((node) => (node.children ?? []).length > 0));
	    const customDetailSecondParentOptions = categoryOptions((customDetailTopNode?.children ?? []).filter((node) => (node.children ?? []).length > 0));
	    const customDetailCanGoDeeper = customDetailSecondParentOptions.length > 0;
	    const customDetailUsesDeeperLevel = dashboardCustomSettings.allocation_detail_depth === "third" && customDetailCanGoDeeper;
	    const customDetailSecondParentId = customDetailPath[1] && customDetailSecondParentOptions.some(([id]) => id === customDetailPath[1])
	      ? customDetailPath[1]
	      : customDetailSecondParentOptions[0]?.[0] ?? "";
	    const customDetailParentLabel = assetCategoryPathLabel(assetCategoryTree, dashboardCustomSettings.allocation_detail_parent_id);

	    return (
	      <section
	        className="onboarding-shell"
	        onKeyDownCapture={(event) => {
	          if (event.key === "Shift") event.stopPropagation();
	        }}
	      >
			        <div className="onboarding-hero">
			          <p className="eyebrow">{isPreferenceMode ? "Preferences" : "Welcome"}</p>
			          <h1>{isPreferenceMode ? "调整你的财务偏好" : "先把财务系统调成你的样子"}</h1>
			          <p>{isPreferenceMode ? "这里只调整长期偏好、目标配比和看板模块；资产明细仍在月底更新里维护。" : "初始化只设置长期偏好和资产框架。真实月度数据，仍然在每月月底更新时录入。"}</p>
				          {isPreferenceMode ? (
				            <button className="secondary-button compact onboarding-reset-button" onClick={() => setView("home")} type="button">
				              <ChevronLeft size={15} />
				              返回首页
				            </button>
				          ) : null}
			          {isDemoEnvironment && !isPreferenceMode ? (
			            <button className="secondary-button compact onboarding-reset-button" disabled={savingOnboarding} onClick={() => void resetDemoOnboarding()} type="button">
			              <RefreshCcw size={15} />
			              重置初始化
		            </button>
		          ) : null}
		        </div>

	        <div className="onboarding-layout">
	          <aside className="onboarding-rail">
	            {steps.map((step, index) => (
	              <button
	                className={onboardingStep === index ? "active" : ""}
	                key={step.title}
	                onClick={() => setOnboardingStep(index)}
	                type="button"
	              >
	                <strong>{String(index + 1).padStart(2, "0")}</strong>
	                <span>{step.title}</span>
	              </button>
	            ))}
	          </aside>

	          <article className="onboarding-panel">
	            <div className="panel-header">
	              <div>
	                <p className="eyebrow">{currentStep.title}</p>
	                <h2>{currentStep.detail}</h2>
	              </div>
	              <span className="onboarding-step-pill">{onboardingStep + 1} / {steps.length}</span>
	            </div>

	            {onboardingMessage ? <div className="notice onboarding-notice">{onboardingMessage}</div> : null}

		            {activeStep === 0 ? (
	              <div className="onboarding-step">
	                <div className="saving-rate-editor">
	                  <label>
	                    期望储蓄率
	                    <div>
	                      <input
	                        min="0"
	                        max="100"
	                        onChange={(event) => setOnboardingSavingRate(event.target.value)}
	                        type="number"
	                        value={onboardingSavingRate}
	                      />
	                      <span>%</span>
	                    </div>
	                  </label>
	                  <aside>
	                    <strong>推荐 30%</strong>
	                    <span>适合作为第一版默认线。后面可以随时改。</span>
	                  </aside>
	                </div>
		                <div className="onboarding-preview-card">
		                  <span>看板会使用这个比例计算目标储蓄金额和储蓄缺口。</span>
		                  <strong>{Number(onboardingSavingRate || 0).toFixed(0)}%</strong>
		                </div>
		                {isPreferenceMode ? (
		                  <div className="onboarding-row-actions">
		                    <button className="primary-button compact" disabled={savingOnboarding} onClick={() => void saveSavingPreference()} type="button">
		                      {savingOnboarding ? "保存中..." : "保存储蓄偏好"}
		                    </button>
		                    {preferenceSaveFeedback?.includes("储蓄") ? <span className="preference-save-feedback"><CheckCircle2 size={15} />已保存</span> : null}
		                  </div>
		                ) : null}
		              </div>
		            ) : null}

		            {!isPreferenceMode && activeStep === 1 ? (
	              <div className="onboarding-step">
	                <div className="onboarding-inline-choice">
	                  <label>
	                    <input
	                      checked={onboardingSkipAssets}
	                      onChange={(event) => setOnboardingSkipAssets(event.target.checked)}
	                      type="checkbox"
	                    />
	                    之后再录入具体资产
	                  </label>
	                  <span>跳过后，第一次月底更新会从空资产清单开始。</span>
	                </div>
	                {!onboardingSkipAssets ? (
	                  <div className="onboarding-asset-builder">
	                    <details className="onboarding-category-manager">
	                      <summary className="category-manager-header">
	                        <div>
	                          <strong>资产分类设置</strong>
	                          <span>{assetCategoryTree.length} 个主类；需要自定义时再展开。</span>
	                        </div>
	                        <span className="category-manager-caret">展开</span>
	                      </summary>
	                      <div className="category-manager-toolbar">
	                        <span>可以改名、新增或删除默认分类。新增后下方立刻可选。</span>
	                        <button className="secondary-button compact" onClick={() => addAssetCategory(null)} type="button">
	                          <Plus size={14} />
	                          新增一级
	                        </button>
	                      </div>
	                      <div className="category-tree-editor">
	                        {assetCategoryTree.map((top) => (
	                          <div className="category-tree-node top" key={top.id}>
	                            <div className="category-tree-row">
	                              <span>一级</span>
	                              <input
	                                lang="zh-CN"
	                                spellCheck={false}
	                                value={top.label}
	                                onChange={(event) => renameAssetCategory(top.id, event.target.value)}
	                              />
	                              <button className="link-button" onClick={() => addAssetCategory(top.id)} type="button">新增一级</button>
	                              <button className="link-button danger-link" onClick={() => deleteAssetCategory(top.id)} type="button">删除</button>
	                            </div>
	                            {top.children.map((child) => (
	                              <div className="category-tree-node child" key={child.id}>
	                                <div className="category-tree-row">
	                                  <span>子类</span>
	                                  <input
	                                    lang="zh-CN"
	                                    spellCheck={false}
	                                    value={child.label}
	                                    onChange={(event) => renameAssetCategory(child.id, event.target.value)}
	                                  />
	                                  <button className="link-button" onClick={() => addAssetCategory(child.id)} type="button">新增子类</button>
	                                  <button className="link-button danger-link" onClick={() => deleteAssetCategory(child.id)} type="button">删除</button>
	                                </div>
	                                {child.children.map((grandchild) => (
	                                  <div className="category-tree-row grandchild" key={grandchild.id}>
	                                    <span>子子类</span>
	                                    <input
	                                      lang="zh-CN"
	                                      spellCheck={false}
	                                      value={grandchild.label}
	                                      onChange={(event) => renameAssetCategory(grandchild.id, event.target.value)}
	                                    />
	                                    <button className="link-button danger-link" onClick={() => deleteAssetCategory(grandchild.id)} type="button">删除</button>
	                                  </div>
	                                ))}
	                              </div>
	                            ))}
	                          </div>
	                        ))}
	                      </div>
	                    </details>
	                    <div className="onboarding-form-grid">
	                      <label>
	                        资产名称
	                        <input lang="zh-CN" spellCheck={false} value={onboardingAssetDraft.name} onChange={(event) => updateOnboardingAssetDraft({ name: event.target.value })} placeholder="例如：全球资产基金 A" />
	                      </label>
	                      <label>
	                        一级类型
	                        <select value={onboardingAssetDraft.topCategory} onChange={(event) => updateOnboardingAssetTopCategory(event.target.value)}>
	                          {onboardingTopOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
	                        </select>
	                      </label>
	                      {onboardingSecondOptions.length > 0 ? (
	                        <label>
	                          子类
	                          <select value={onboardingSecondValue} onChange={(event) => updateOnboardingAssetSecondCategory(event.target.value)}>
	                            {onboardingSecondOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
	                          </select>
	                        </label>
	                      ) : null}
	                      {onboardingThirdOptions.length > 0 ? (
	                        <label>
	                          子子类
	                          <select value={onboardingAssetDraft.usEquityCategory} onChange={(event) => updateOnboardingAssetThirdCategory(event.target.value)}>
	                            {onboardingThirdOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
	                          </select>
	                        </label>
	                      ) : null}
	                      <label>
	                        币种
	                        <select value={onboardingAssetDraft.currency} onChange={(event) => updateOnboardingAssetDraft({ currency: event.target.value as CurrencyCode })}>
	                          {currencyOptions.slice(0, 3).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
	                        </select>
	                      </label>
	                      <label>
	                        平台
	                        <input lang="zh-CN" spellCheck={false} value={onboardingAssetDraft.platform} onChange={(event) => updateOnboardingAssetDraft({ platform: event.target.value })} placeholder="支付宝 / 证券账户 / 银行" />
	                      </label>
	                      <label>
	                        当前金额
	                        <input value={onboardingAssetDraft.monthEndAmount} onChange={(event) => updateOnboardingAssetDraft({ monthEndAmount: event.target.value })} placeholder="当前市值 / 余额" type="number" />
	                      </label>
	                      <label>
	                        标签
	                        <input lang="zh-CN" spellCheck={false} value={onboardingAssetDraft.tags} onChange={(event) => updateOnboardingAssetDraft({ tags: event.target.value })} placeholder="中文或英文逗号分隔" />
	                      </label>
	                      <label>
	                        备注
	                        <input lang="zh-CN" spellCheck={false} value={onboardingAssetDraft.note} onChange={(event) => updateOnboardingAssetDraft({ note: event.target.value })} placeholder="可空" />
	                      </label>
	                    </div>
	                    <div className="onboarding-inline-choice">
	                      <label>
	                        <input checked={onboardingAssetDraft.isDca} onChange={(event) => updateOnboardingAssetDraft({ isDca: event.target.checked })} type="checkbox" />
	                        这是定投资产
	                      </label>
	                    </div>
	                    {onboardingAssetDraft.isDca ? (
	                      <div className="onboarding-dca-list">
	                        {onboardingAssetDraft.dcaPlans.map((plan, index) => (
	                          <div className="onboarding-dca-row" key={`onboarding-dca-${index}`}>
	                            <select value={plan.frequency} onChange={(event) => updateOnboardingAssetDcaPlan(index, { frequency: event.target.value })}>
	                              <option value="daily">每日</option>
	                              <option value="weekly">每周</option>
	                              <option value="monthly">每月</option>
	                            </select>
	                            {plan.frequency === "weekly" ? (
	                              <select value={plan.weeklyDay} onChange={(event) => updateOnboardingAssetDcaPlan(index, { weeklyDay: event.target.value })}>
	                                {[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>周{["一", "二", "三", "四", "五", "六", "日"][day - 1]}</option>)}
	                              </select>
	                            ) : null}
		                            {plan.frequency === "monthly" ? (
		                              <input value={plan.monthlyDay} onChange={(event) => updateOnboardingAssetDcaPlan(index, { monthlyDay: event.target.value })} placeholder="每月几号" type="number" />
		                            ) : null}
		                            <input value={plan.amount} onChange={(event) => updateOnboardingAssetDcaPlan(index, { amount: event.target.value })} placeholder="每次金额" type="number" />
		                            <div className="onboarding-row-actions">
		                              <button className="link-button" onClick={() => confirmOnboardingAssetDcaPlan(index)} type="button">
			                                {plan.confirmed ? "已确认" : "确认"}
		                              </button>
		                              <button className="link-button danger-link" onClick={() => removeOnboardingAssetDcaPlan(index)} type="button">删除</button>
		                            </div>
		                          </div>
	                        ))}
	                        <button className="secondary-button compact" onClick={addOnboardingAssetDcaPlan} type="button">
	                          <Plus size={15} />
	                          新增定投计划
	                        </button>
	                      </div>
	                    ) : null}
	                    <button className="primary-button compact" onClick={addOnboardingAsset} type="button">
	                      <Plus size={15} />
	                      加入资产清单
	                    </button>
	                  </div>
	                ) : null}
	                <div className="onboarding-list">
	                  {onboardingAssets.length === 0 ? <div className="dashboard-empty-state compact">当前还没有初始化资产。</div> : onboardingAssets.map((asset, index) => (
	                    <div className="onboarding-list-row" key={`${asset.name}-${index}`}>
	                      <strong>{asset.name}</strong>
	                      <span>{asset.currency}｜{asset.platform || "未填平台"}｜{asset.isDca ? "定投" : "非定投"}</span>
	                      <button className="link-button" onClick={() => removeOnboardingAsset(index)} type="button">删除</button>
	                    </div>
	                  ))}
	                </div>
	              </div>
	            ) : null}

		            {activeStep === 2 ? (
	              <div className="onboarding-step">
	                <div className="notice onboarding-notice">这里不提供理财或投资建议。目标配比只按你的个人计划手动填写，可跳过。</div>
	                <div className="onboarding-inline-choice">
		                  <label>
		                    <input checked={onboardingSkipTargets} onChange={(event) => setOnboardingSkipTargets(event.target.checked)} type="checkbox" />
		                    跳过目标资产配比
		                  </label>
			                  <span>跳过后只显示实际比例。</span>
		                </div>
		                {!onboardingSkipTargets ? (
		                  <>
			                    <div className="target-section-header">
			                      <div>
			                        <strong>一级分类配比</strong>
			                        <span>自动读取初始化/月度更新里的资产类别，合计需要等于 100%。</span>
			                      </div>
			                      <span className={mainTargetTotalClass}>合计 {mainTargetTotal.toFixed(1)}%</span>
			                    </div>
			                    <div className="onboarding-target-list">
					                      {mainTargets.length === 0 ? <div className="dashboard-empty-state compact">还没有可用一级分类。可以返回上一步录入资产，或直接跳过。</div> : mainTargets.map((target) => {
					                        const categoryId = target.category_id ?? onboardingSelectedMainAllocationOptions[0]?.[0] ?? "asset_cat_cash";
					                        const categoryLabel = optionLabel(onboardingSelectedMainAllocationOptions, categoryId);
					                        const draftValue = onboardingMainTargetDraftPercents[categoryId];
					                        return (
					                          <div className="onboarding-target-row main-target-row" key={`main-target-${categoryId}`}>
				                            <strong>{categoryLabel}</strong>
				                            <label className="percentage-input">
				                              <input
				                                inputMode="decimal"
				                                max="100"
				                                min="0"
					                                onChange={(event) => updateMainOnboardingTarget(categoryId, categoryLabel, event.target.value)}
				                                placeholder="目标比例"
				                                type="text"
				                                value={draftValue ?? percentInputValue(target.target_percent)}
				                              />
		                              <span>%</span>
		                            </label>
		                          </div>
		                        );
		                      })}
		                    </div>
			                    {mainTargetTotal > 100.0001 ? <div className="notice onboarding-notice">一级分类配比合计超过 100%，请调整后再继续。</div> : null}
			                    {mainTargetTotal < 99.9999 ? <div className="notice onboarding-notice">一级分类配比合计需要等于 100%。</div> : null}
		                    <div className="target-subsection">
		                      <div className="target-section-header">
		                        <div>
		                          <strong>二级 / 三级分类配比（可选）</strong>
		                          <span>选择一个有下级的分类，填写它下面各子类比例，确认后生成明细。</span>
		                        </div>
		                        <button className="secondary-button compact" onClick={() => startSubTargetEditor()} type="button">新增分类配比</button>
		                      </div>
		                      {editingSubTargetParentId ? (
		                        <div className="sub-target-editor">
		                          <div className="sub-target-path-picker">
		                            <label>
		                              先选择一级分类
		                              <select value={subTargetDraftTopId} onChange={(event) => changeSubTargetDraftTopCategory(event.target.value)}>
		                                {subTargetDraftTopOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
		                              </select>
		                            </label>
		                            {subTargetDraftCanGoDeeper ? (
		                              <div className="onboarding-inline-choice sub-target-depth-choice">
		                                <label>
		                                  <input
		                                    checked={subTargetDraftUsesDeeperLevel}
		                                    onChange={(event) => changeSubTargetDraftDepth(event.target.checked)}
		                                    type="checkbox"
		                                  />
		                                  继续选择二级分类，配置三级目标
		                                </label>
		                                <span>不勾选时，直接配置 {assetCategoryPathLabel(assetCategoryTree, subTargetDraftTopId)} 下面的二级比例。</span>
		                              </div>
		                            ) : (
		                              <div className="notice onboarding-notice compact">这个一级分类当前只能配置二级比例。</div>
		                            )}
		                            {subTargetDraftUsesDeeperLevel ? (
		                              <label>
		                                再选择二级分类
		                                <select value={subTargetDraftSecondParentId} onChange={(event) => changeSubTargetDraftSecondCategory(event.target.value)}>
		                                  {subTargetDraftSecondParentOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
		                                </select>
		                              </label>
		                            ) : null}
		                            <div className="target-path-summary">
		                              当前配置：{subTargetDraftParentLabel} 的下级分类
		                            </div>
		                          </div>
		                          <div className="sub-target-draft-list">
		                            {subTargetDraftOptions.length === 0 ? (
		                              <div className="dashboard-empty-state compact">这个分类下没有下级分类。</div>
		                            ) : subTargetDraftOptions.map(([categoryId, label]) => (
		                              <div className="sub-target-draft-row" key={`sub-target-draft-${categoryId}`}>
		                                <strong>{label}</strong>
		                                <label className="percentage-input">
			                                  <input
			                                    inputMode="decimal"
			                                    max="100"
			                                    min="0"
			                                    onChange={(event) => setOnboardingSubTargetDraftPercents((current) => ({ ...current, [categoryId]: normalizePercentDraftInput(event.target.value) }))}
			                                    placeholder="目标比例"
			                                    type="text"
			                                    value={onboardingSubTargetDraftPercents[categoryId] ?? ""}
		                                  />
		                                  <span>%</span>
		                                </label>
		                              </div>
		                            ))}
			                          </div>
			                          <div className="sub-target-editor-footer">
			                            <div className="onboarding-row-actions">
			                              <button className="secondary-button compact" onClick={() => { setEditingSubTargetParentId(null); setOnboardingSubTargetDraftPercents({}); }} type="button">取消</button>
			                              <button className="primary-button compact" onClick={confirmSubTargetGroup} type="button">确认分类配比</button>
		                            </div>
		                          </div>
		                        </div>
		                      ) : null}
		                      <div className="onboarding-target-list">
			                        {subTargetGroups.length === 0 ? <div className="dashboard-empty-state compact">暂未填写下级分类目标。</div> : subTargetGroups.map((group) => {
			                          return (
			                            <div className="sub-target-group" key={`sub-target-group-${group.parentId}`}>
			                              <div className="sub-target-group-header">
			                                <div>
			                                  <strong>{group.parentLabel}</strong>
			                                </div>
		                                <div className="onboarding-row-actions">
		                                  <button className="link-button" onClick={() => startSubTargetEditor(group.parentId)} type="button">编辑</button>
		                                  <button className="link-button danger-link" onClick={() => deleteSubTargetGroup(group.parentId)} type="button">删除</button>
		                                </div>
		                              </div>
		                              <div className="sub-target-chip-list">
		                                {group.rows.map((target) => (
		                                  <span key={`sub-target-chip-${group.parentId}-${target.category_id}`}>
		                                    {optionLabel(onboardingSubAllocationOptions[group.parentId] ?? [], target.category_id ?? "")} {Number(target.target_percent || 0).toFixed(1)}%
		                                  </span>
		                                ))}
		                              </div>
		                            </div>
		                          );
		                        })}
		                      </div>
		                    </div>
			                  </>
			                ) : null}
			                {isPreferenceMode ? (
			                  <div className="onboarding-row-actions">
			                    <button className="primary-button compact" disabled={savingOnboarding} onClick={() => void saveAllocationPreference()} type="button">
			                      {savingOnboarding ? "保存中..." : "保存目标配比"}
			                    </button>
			                    {preferenceSaveFeedback?.includes("目标配比") ? <span className="preference-save-feedback"><CheckCircle2 size={15} />已保存</span> : null}
			                  </div>
			                ) : null}
		              </div>
		            ) : null}

		            {activeStep === 3 ? (
		              <div className="onboarding-step">
		                <div className="notice onboarding-notice">以下是默认会出现在财务健康看板里的模块和明细。总览不单独设置，会从已启用模块里自动汇总。</div>
		                <div className="onboarding-chart-grid">
		                  {dashboardPreferenceSections.map((section) => {
		                    const option = dashboardModuleDetails[section];
		                    const isSelected = onboardingSections.includes(section);
		                    return (
		                      <article className={`dashboard-module-preference-card ${isSelected ? "selected" : ""}`} key={section}>
		                        <div className="dashboard-module-preference-header">
		                          <label>
		                            <input
		                              checked={isSelected}
		                              onChange={() => toggleOnboardingSection(section)}
		                              type="checkbox"
		                            />
		                            <CheckCircle2 size={18} />
		                            <strong>{option.title}</strong>
		                          </label>
		                          <span>{option.detail}</span>
		                        </div>
		                        <div className="dashboard-preference-item-list">
		                          {dashboardModuleItemDefinitions[section].map((item) => {
		                            const itemSelected = selectedDashboardItemSet.has(item.id);
		                            return (
		                              <label className={item.customSync ? "custom-sync-item" : ""} key={`${section}-${item.id}`}>
		                                <input
		                                  checked={itemSelected}
		                                  onChange={() => toggleDashboardPreferenceItem(section, item.id)}
		                                  type="checkbox"
		                                />
		                                <span>
		                                  <strong>{item.label}</strong>
		                                  <small>{item.detail}</small>
		                                </span>
		                              </label>
		                            );
		                          })}
		                        </div>
		                      </article>
		                    );
		                  })}
		                </div>
		                <div className="custom-analysis-box">
		                  <div className="target-section-header">
		                    <div>
		                      <strong>自定义分析点</strong>
		                      <span>系统联动项会从储蓄偏好、目标配比和看板明细开关反向同步；手动项可继续新增。</span>
		                    </div>
		                  </div>
		                  <div className="custom-dashboard-row-list">
			                    {visibleDashboardCustomItemDefinitions.map((item) => {
		                      const itemSelected = selectedDashboardItemSet.has(item.id);
		                      return (
		                        <div className={`custom-dashboard-row ${itemSelected ? "selected" : ""}`} key={item.id}>
		                          <label className="custom-dashboard-row-main">
		                            <input checked={itemSelected} onChange={() => toggleCustomDashboardItem(item.id)} type="checkbox" />
		                            <span>
		                              <strong>{item.label}</strong>
		                              <small>{item.detail}</small>
		                            </span>
		                          </label>
		                          <div className="custom-dashboard-row-board">
		                            <label>
		                              放在哪个板块
		                              <select
		                                value={customItemSection(item.id)}
		                                onChange={(event) => changeCustomDashboardItemSection(item.id, event.target.value as HealthSection)}
		                              >
		                                {healthSections.map((section) => <option key={`${item.id}-${section}`} value={section}>{section}</option>)}
		                              </select>
		                            </label>
		                          </div>
		                          {item.id === "allocation_discretionary_amount" && itemSelected ? (
		                            <div className="custom-dashboard-row-controls custom-path-picker">
		                              <div className="custom-path-picker-grid">
		                                <label>
		                                  一级
		                                  <select value={discretionaryDraftTopId} onChange={(event) => changeDiscretionaryDraftTopCategory(event.target.value)}>
		                                    {discretionaryTopOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
		                                  </select>
		                                </label>
		                                {discretionarySecondOptions.length > 0 ? (
		                                  <label>
		                                    二级
		                                    <select value={discretionaryDraftSecondId} onChange={(event) => changeDiscretionaryDraftSecondCategory(event.target.value)}>
		                                      <option value="">全部 {optionLabel(discretionaryTopOptions, discretionaryDraftTopId)}</option>
		                                      {discretionarySecondOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
		                                    </select>
		                                  </label>
		                                ) : null}
		                                {discretionaryThirdOptions.length > 0 ? (
		                                  <label>
		                                    三级
		                                    <select value={discretionaryDraftThirdId} onChange={(event) => setDiscretionaryDraftThirdId(event.target.value)}>
		                                      <option value="">全部 {optionLabel(discretionarySecondOptions, discretionaryDraftSecondId)}</option>
		                                      {discretionaryThirdOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
		                                    </select>
		                                  </label>
		                                ) : null}
		                                <button className="secondary-button compact" onClick={addDiscretionaryCategorySelection} type="button">
		                                  <Plus size={15} />
		                                  加入范围
		                                </button>
		                              </div>
		                              <div className="target-path-summary">当前将加入：{discretionaryDraftSelectionLabel}</div>
		                              <div className="custom-selected-paths">
		                                {selectedDiscretionaryLabels.length === 0 ? (
		                                  <div className="dashboard-empty-state compact">还没有选择可支配范围。</div>
		                                ) : dashboardCustomSettings.discretionary_category_ids.map((id) => (
		                                  <span key={`discretionary-selected-${id}`}>
		                                    {assetCategoryPathLabel(assetCategoryTree, id)}
		                                    <button aria-label={`删除 ${assetCategoryPathLabel(assetCategoryTree, id)}`} onClick={() => removeDiscretionaryCategorySelection(id)} type="button">×</button>
		                                  </span>
		                                ))}
		                              </div>
		                              <div className="custom-dashboard-row-note">保存看板偏好后，财务健康看板里的可支配总额会按这些范围重新计算。</div>
		                            </div>
		                          ) : null}
		                          {item.id === "allocation_sub_detail_ratio" && itemSelected ? (
		                            <div className="custom-dashboard-row-controls custom-allocation-picker">
		                              <label>
		                                先选择一级分类
		                                <select value={customDetailTopId} onChange={(event) => changeCustomAllocationDetailTop(event.target.value)}>
		                                  {customDetailTopOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
		                                </select>
		                              </label>
		                              {customDetailCanGoDeeper ? (
		                                <div className="onboarding-inline-choice sub-target-depth-choice">
		                                  <label>
		                                    <input
		                                      checked={customDetailUsesDeeperLevel}
		                                      onChange={(event) => changeCustomAllocationDetailDepth(event.target.checked)}
		                                      type="checkbox"
		                                    />
		                                    继续选择二级分类，查看三级明细
		                                  </label>
		                                  <span>不勾选时，展示 {assetCategoryPathLabel(assetCategoryTree, customDetailTopId)} 下面的二级比例。</span>
		                                </div>
		                              ) : (
		                                <div className="notice onboarding-notice compact">这个一级分类当前只能展示二级比例。</div>
		                              )}
		                              {customDetailUsesDeeperLevel ? (
		                                <label>
		                                  再选择二级分类
		                                  <select value={customDetailSecondParentId} onChange={(event) => changeCustomAllocationDetailSecond(event.target.value)}>
		                                    {customDetailSecondParentOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
		                                  </select>
		                                </label>
		                              ) : null}
		                              <div className="target-path-summary">当前明细：{customDetailParentLabel} 的下级资产比例</div>
		                            </div>
		                          ) : null}
		                          {item.id === "allocation_target_deviation_value" && itemSelected ? (
		                            <div className="custom-dashboard-row-note">{hasAllocationTargetsForCustom ? "已读取目标配比设置。" : "还没有目标配比；保存后看板会等目标配比存在时显示。"}</div>
		                          ) : null}
		                          {item.id === "allocation_sub_target_gap_chart" && itemSelected ? (
		                            <div className="custom-dashboard-row-note">{hasAllocationTargetsForCustom ? "下级目标差距会按二级或三级目标配比同步。" : "未填写下级目标配比时，这里不会显示差距。"}</div>
		                          ) : null}
			                    </div>
			                  );
		                })}
			                  </div>
			                </div>
		                {isPreferenceMode ? (
		                  <div className="onboarding-row-actions">
		                    <button className="primary-button compact" disabled={savingOnboarding} onClick={() => void saveDashboardPreference()} type="button">
		                      {savingOnboarding ? "保存中..." : "保存看板偏好"}
		                    </button>
		                    {preferenceSaveFeedback?.includes("看板") ? <span className="preference-save-feedback"><CheckCircle2 size={15} />已保存</span> : null}
		                  </div>
		                ) : null}
		              </div>
		            ) : null}

	            <div className="onboarding-actions">
	              <button className="secondary-button compact" disabled={onboardingStep === 0} onClick={() => setOnboardingStep((step) => Math.max(step - 1, 0))} type="button">
	                上一步
	              </button>
		              {onboardingStep < steps.length - 1 ? (
			                <button className="primary-button compact" onClick={goToNextOnboardingStep} type="button">
			                  下一步
			                </button>
		              ) : (
			                <button className="primary-button compact" disabled={savingOnboarding} onClick={() => void (isPreferenceMode ? saveCurrentPreferenceStep() : saveOnboardingSetup())} type="button">
		                  {savingOnboarding ? "保存中..." : isPreferenceMode ? "保存偏好" : "完成初始化"}
		                </button>
		              )}
	            </div>
	          </article>
	        </div>
	      </section>
	    );
	  };

	  const renderContentTemplateSettings = () => {
    const months = Array.from(new Set([
      summary.snapshot_month,
      ...summary.monthly_trends.map((item) => item.period_month),
      "2026-04"
    ])).filter(Boolean).sort((a, b) => b.localeCompare(a));
    const currentTypeLabel = templateTypeOptions.find((item) => item.id === templateDraft.template_type)?.label ?? "模板";
    return (
      <section className="workspace-view template-workspace">
        <button className="back-button" onClick={() => setView("home")} type="button">
          <ChevronLeft size={18} />
          返回首页
        </button>
        <div className="view-heading">
          <div>
            <p className="eyebrow">Templates</p>
            <h1>内容模板设置</h1>
            <span>管理月报、分析看板说明和导出 HTML 的内容格式。变量缺数据时显示“暂无数据”。</span>
          </div>
          <button className="primary-button compact" onClick={() => createBlankTemplate()} type="button">
            <Plus size={16} />
            新增模板
          </button>
        </div>

        {templateMessage ? <div className="notice">{templateMessage}</div> : null}

        <div className="template-layout">
          <aside className="panel template-list-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Library</p>
                <h2>模板列表</h2>
              </div>
            </div>
            <div className="template-type-stack">
              {templateTypeOptions.map((type) => {
                const rows = contentTemplates.filter((item) => item.template_type === type.id);
                return (
                  <section key={type.id}>
                    <button className="template-type-new" onClick={() => createBlankTemplate(type.id)} type="button">
                      <span>{type.label}</span>
                      <Plus size={14} />
                    </button>
                    <div className="template-list">
                      {rows.length === 0 ? (
                        <div className="dashboard-empty-state compact">暂无模板。</div>
                      ) : rows.map((template) => (
                        <button
                          className={selectedTemplateId === template.id ? "active" : ""}
                          key={template.id}
                          onClick={() => applyTemplateToDraft(template)}
                          type="button"
                        >
                          <strong>{template.name}</strong>
                          <span>{template.is_default ? "默认" : type.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </aside>

          <article className="panel template-editor-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Editor</p>
                <h2>{templateDraft.id ? templateDraft.name : `新建${currentTypeLabel}`}</h2>
              </div>
              <div className="template-actions">
                <button className="secondary-button compact" onClick={copyTemplateDraft} type="button"><Copy size={15} />复制</button>
                <button className="secondary-button compact" onClick={deleteTemplateDraft} type="button"><Trash2 size={15} />删除</button>
                <button className="secondary-button compact" onClick={setTemplateAsDefault} type="button">设为默认</button>
                <button className="primary-button compact" onClick={saveTemplateDraft} type="button"><Save size={15} />保存</button>
              </div>
            </div>

            <div className="template-form-grid">
              <label>
                模板名称
                <input value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                模板类型
                <select
                  value={templateDraft.template_type}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, template_type: event.target.value as TemplateType }))}
                >
                  {templateTypeOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="template-default-toggle">
                <input
                  checked={templateDraft.is_default}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, is_default: event.target.checked }))}
                  type="checkbox"
                />
                是否默认模板
              </label>
              <label>
                备注
                <input value={templateDraft.note} onChange={(event) => setTemplateDraft((current) => ({ ...current, note: event.target.value }))} placeholder="备注" />
              </label>
            </div>

            <div className="variable-bank">
              {templateVariables.map((variable) => (
                <button key={variable} onClick={() => insertTemplateVariable(variable)} type="button">
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>

            <label className="template-content-field">
              模板内容
              <textarea
                value={templateDraft.content}
                onChange={(event) => setTemplateDraft((current) => ({ ...current, content: event.target.value }))}
                placeholder="{{月份}} 月收入 {{总收入}}，支出 {{总支出}}，储蓄率 {{储蓄率}}。"
              />
            </label>

            <div className="template-preview-toolbar">
              <label>
                预览月份
                <select value={templatePreviewMonth} onChange={(event) => setTemplatePreviewMonth(event.target.value)}>
                  {months.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </label>
              <button className="primary-button compact" onClick={previewTemplateDraft} type="button">
                <Eye size={15} />
                预览生成内容
              </button>
            </div>

            <div className="template-preview-box">
              {templatePreview ? (
                <>
                  <p className="eyebrow">{templatePreview.period_month} Preview</p>
                  <div className="report-preview" dangerouslySetInnerHTML={{ __html: templatePreview.html }} />
                </>
              ) : (
                <div className="dashboard-empty-state compact">选择月份后点击预览。</div>
              )}
            </div>
          </article>
        </div>
      </section>
    );
  };

  const renderReviewSection = (transactionType: "expense" | "income") => {
    const review = transactionType === "expense" ? expenseReview : incomeReview;
    const manual = transactionType === "expense" ? manualExpense : manualIncome;
    const setManual = transactionType === "expense" ? setManualExpense : setManualIncome;
    const title = transactionType === "expense" ? "支出确认" : "收入确认";
    const total = review?.rows
      .filter((row) => row.include_in_stats ?? true)
      .reduce((sum, row) => sum + (convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY") ?? 0), 0) ?? 0;
    const liveSummary = Array.from(
      (review?.rows ?? [])
        .filter((row) => row.include_in_stats ?? true)
        .reduce((map, row) => {
          const key = row.category_id ?? row.raw_category ?? "未分类";
          const convertedAmount = convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY") ?? 0;
          const current = map.get(key) ?? {
            category_id: row.category_id,
            category_name: row.category_name ?? row.raw_category ?? "未分类",
            amount: 0,
            count: 0
          };
          current.amount += convertedAmount;
          current.count += 1;
          map.set(key, current);
          return map;
        }, new Map<string, CategorySummary>())
        .values()
    ).sort((a, b) => b.amount - a.amount);
    const rows = review?.rows ?? [];
    const filteredRows = getFilteredRows(transactionType, rows);
    const pendingDuplicateRows = rows.filter(isPendingDuplicate);
    const anomalies = rows.filter((row) => isPendingDuplicate(row) || isUnmappedCategoryAnomaly(row) || isLargeAmountAnomaly(row));
    const largeRows = rows.filter(isLargeAmountAnomaly);
    const unmappedRows = rows.filter(isUnmappedCategoryAnomaly);
    const missingRateRows = rows.filter((row) => convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY") === null);
    const autoCreatedCategories = (review?.auto_created_categories ?? []).filter((category) =>
      rows.some((row) => row.category_id === category.id || row.raw_category === category.created_from_raw_category)
    );
    const isExpanded = detailExpanded[transactionType];
    const sectionExpanded = expandedSections[transactionType];
    const visibleSummary = summaryExpanded[transactionType] ? liveSummary : liveSummary.slice(0, 4);

    return (
      <article className="panel confirm-panel" data-monthly-section={transactionType}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">{transactionType === "expense" ? "Expense" : "Income"}</p>
            <h2>{title}</h2>
          </div>
          <div className="row-actions">
            <button className="primary-button compact" disabled={confirmingReview === transactionType} onClick={() => confirmReview(transactionType)} type="button">
              {confirmingReview === transactionType
                ? "保存中..."
                : completedSteps[transactionType]
                  ? "已确认，可修改"
                  : `确认${transactionType === "expense" ? "支出" : "收入"}`}
            </button>
            <button className="secondary-button compact" onClick={() => toggleSection(transactionType)} type="button">
              {sectionExpanded ? "收起" : "展开"}
            </button>
          </div>
        </div>

        {!sectionExpanded ? <p className="form-message">{title}已收起。</p> : null}
        {sectionExpanded ? (
          <>
        <div className="confirm-total">
          <strong>{formatCurrency(total, privacyMode, displayCurrency)}</strong>
          <span>
            {rows.length} 条，异常提醒 {anomalies.length} 条
          </span>
        </div>

        {transactionType === "income" && rows.length === 0 ? (
          <p className="form-message">
            当前导入账单没有收入记录。可以在这里手动新增收入，或导入包含“收入”行的账单文件。
          </p>
        ) : null}

        {anomalies.length > 0 || missingRateRows.length > 0 || autoCreatedCategories.length > 0 ? (
          <div className="anomaly-box">
            <div>
              <strong>异常提醒</strong>
              <span>
                待处理疑似重复 {pendingDuplicateRows.length} 条，未映射分类 {unmappedRows.length} 条，未确认大额异常{" "}
                {largeRows.length} 条，缺少汇率 {missingRateRows.length} 条，自动新增分类 {autoCreatedCategories.length} 个。
              </span>
            </div>
            {pendingDuplicateRows.length > 0 || largeRows.length > 0 || unmappedRows.length > 0 ? (
              <div className="anomaly-batch-actions">
                {pendingDuplicateRows.length > 0 ? (
                  <>
                    <button
                      className="secondary-button compact"
                      disabled={batchingAnomalyAction === `${transactionType}:keep_duplicates`}
                      onClick={() => applyBatchAnomalyAction(transactionType, "keep_duplicates")}
                      type="button"
                    >
                      保留全部疑似重复
                    </button>
                    <button
                      className="secondary-button compact"
                      disabled={batchingAnomalyAction === `${transactionType}:mark_not_duplicate`}
                      onClick={() => applyBatchAnomalyAction(transactionType, "mark_not_duplicate")}
                      type="button"
                    >
                      标记为非重复
                    </button>
                    <button
                      className="secondary-button compact"
                      disabled={batchingAnomalyAction === `${transactionType}:exclude_duplicates`}
                      onClick={() => applyBatchAnomalyAction(transactionType, "exclude_duplicates")}
                      type="button"
                    >
                      排除疑似重复
                    </button>
                  </>
                ) : null}
                {largeRows.length > 0 ? (
                  <button
                    className="secondary-button compact"
                    disabled={batchingAnomalyAction === `${transactionType}:confirm_large`}
                    onClick={() => applyBatchAnomalyAction(transactionType, "confirm_large")}
                    type="button"
                  >
                    确认大额异常
                  </button>
                ) : null}
                {unmappedRows.length > 0 ? (
                  <button
                    className="secondary-button compact"
                    disabled={batchingAnomalyAction === `${transactionType}:exclude_unmapped`}
                    onClick={() => applyBatchAnomalyAction(transactionType, "exclude_unmapped")}
                    type="button"
                  >
                    排除未映射分类
                  </button>
                ) : null}
              </div>
            ) : null}
            {autoCreatedCategories.length > 0 ? (
              <div className="anomaly-row">
                <span>自动新增分类：{autoCreatedCategories.map((category) => category.name).join("、")}。请后续确认名称、合并或调整归类。</span>
              </div>
            ) : null}
            <div className="anomaly-list">
              {[...largeRows, ...unmappedRows, ...missingRateRows]
                .filter((row, index, list) => list.findIndex((item) => item.id === row.id) === index)
                .slice(0, 8)
                .map((row) => (
                  <div className="anomaly-row" key={`${transactionType}-anomaly-${row.id}`}>
                    <span>
                      {row.transaction_date} · {row.transaction_type === "expense" ? "支出" : "收入"} · {formatRowAmount(row)} · 原始：
                      {row.raw_category || "无"} · 当前：{row.category_name ?? "未映射"} · {row.note || "无备注"}
                    </span>
                    <button className="link-button" onClick={() => locateRow(row)} type="button">
                      定位到明细
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        <div className="summary-grid">
          {visibleSummary.map((item) => (
            <div className="summary-chip" key={`${transactionType}-${item.category_name}`}>
              <span>{item.category_name}</span>
              <strong>{formatCurrency(item.amount, privacyMode, displayCurrency)}</strong>
              <small>{total > 0 ? formatPercent(item.amount / total) : "0.0%"}</small>
            </div>
          ))}
        </div>
        {liveSummary.length > 4 ? (
          <button
            className="link-button summary-toggle"
            onClick={() => setSummaryExpanded((current) => ({ ...current, [transactionType]: !current[transactionType] }))}
            type="button"
          >
            {summaryExpanded[transactionType] ? "收起分类" : "展开全部分类"}
          </button>
        ) : null}

        <div className="manual-row">
          <input
            onChange={(event) => setManual((current) => ({ ...current, date: event.target.value }))}
            type="date"
            value={manual.date}
          />
          <input
            inputMode="decimal"
            onChange={(event) => setManual((current) => ({ ...current, amount: event.target.value }))}
            placeholder="金额"
            step="0.01"
            type="number"
            value={manual.amount}
          />
          <select
            onChange={(event) => setManual((current) => ({ ...current, currency: event.target.value as CurrencyCode }))}
            value={manual.currency}
          >
            {currencyOptions.map((option) => (
              <option disabled={option.code === "OTHER"} key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            onChange={(event) => setManual((current) => ({ ...current, categoryId: event.target.value }))}
            value={manual.categoryId}
          >
            <option value="">选择分类</option>
            {(review?.categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            className="secondary-button compact"
            onClick={() => setAddingCategoryRowId(addingCategoryRowId === `manual-${transactionType}` ? null : `manual-${transactionType}`)}
            type="button"
          >
            新增分类
          </button>
          <input
            onChange={(event) => setManual((current) => ({ ...current, note: event.target.value }))}
            placeholder={transactionType === "expense" ? "支出备注" : "工资、生活费、其它收入备注"}
            value={manual.note}
          />
          <button className="secondary-button compact" onClick={() => addManualTransaction(transactionType)} type="button">
            新增
          </button>
        </div>
        {addingCategoryRowId === `manual-${transactionType}` ? (
          <div className="category-create-box">
            <input
              onChange={(event) => setNewCategoryDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="分类名称"
              value={newCategoryDraft.name}
            />
            <label className="include-toggle">
              <input
                checked={newCategoryDraft.isPersonal}
                onChange={(event) => setNewCategoryDraft((current) => ({ ...current, isPersonal: event.target.checked }))}
                type="checkbox"
              />
              <span>个人分类</span>
            </label>
            <input
              onChange={(event) => setNewCategoryDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="备注，可空"
              value={newCategoryDraft.note}
            />
            <button className="primary-button compact" onClick={() => createCategoryForManual(transactionType)} type="button">
              保存并选中
            </button>
          </div>
        ) : null}

        <div className="detail-toolbar">
          <button
            className="secondary-button compact"
            onClick={() => setDetailExpanded((current) => ({ ...current, [transactionType]: !isExpanded }))}
            type="button"
          >
            {isExpanded ? "收起明细" : "展开明细"}
          </button>
          <span>
            当前显示 {isExpanded ? filteredRows.length : 0} / {rows.length} 条
          </span>
        </div>

        {isExpanded ? (
          <>
            <div className="filter-row">
              <select
                onChange={(event) => setFilter(transactionType, { categoryId: event.target.value })}
                value={reviewFilters[transactionType].categoryId}
              >
                <option value="">全部分类</option>
                {(review?.categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                onChange={(event) => setFilter(transactionType, { date: event.target.value })}
                type="date"
                value={reviewFilters[transactionType].date}
              />
              <input
                inputMode="decimal"
                onChange={(event) => setFilter(transactionType, { minAmount: event.target.value })}
                placeholder="最低金额"
                step="0.01"
                type="number"
                value={reviewFilters[transactionType].minAmount}
              />
              <input
                inputMode="decimal"
                onChange={(event) => setFilter(transactionType, { maxAmount: event.target.value })}
                placeholder="最高金额"
                step="0.01"
                type="number"
                value={reviewFilters[transactionType].maxAmount}
              />
              <button
                className="secondary-button compact"
                onClick={() => setFilter(transactionType, { categoryId: "", date: "", minAmount: "", maxAmount: "" })}
                type="button"
              >
                清除筛选
              </button>
            </div>

            <div className="transaction-table">
              <div className="transaction-row transaction-head">
                <span>日期</span>
                <span>类型</span>
                <span>类别</span>
                <span>金额</span>
                <span>备注</span>
                <span>操作</span>
              </div>
              {filteredRows.map((row) => {
                const duplicateCandidates = getDuplicateCandidates(row);
                const duplicateStatus = row.duplicate_review_status ?? "pending";
                return (
                  <div className={`transaction-item ${isPendingDuplicate(row) ? "duplicate" : ""}`} data-row-id={row.id} key={row.id}>
                    <div className="transaction-row">
                      <span>{row.transaction_date}</span>
                      <span>{row.transaction_type === "expense" ? "支出" : "收入"}</span>
                      <span>{row.category_name ?? row.raw_category ?? "未分类"}</span>
                      <strong>{formatRowAmount(row)}</strong>
                      <span>
                        {row.note || row.raw_category}
                        {isPendingDuplicate(row) || duplicateCandidates.length > 0 ? <b>{duplicateStatus === "pending" ? "疑似重复" : "重复已处理"}</b> : null}
                      </span>
                      <span className="row-actions">
                        <button
                          className="link-button"
                          onClick={() => updateReviewRow(row.transaction_type, row.id, { is_editing: !row.is_editing })}
                          type="button"
                        >
                          {row.is_editing ? "完成" : "编辑"}
                        </button>
                        {row.potential_duplicate || duplicateCandidates.length > 0 ? (
                          <button
                            className="link-button"
                            onClick={() => setDuplicatePanelRowId(duplicatePanelRowId === row.id ? null : row.id)}
                            type="button"
                          >
                            查看重复项
                          </button>
                        ) : null}
                      </span>
                    </div>

                    {row.is_editing ? (
                      <div className="edit-row">
                        <label>
                          日期
                          <input
                            onChange={(event) =>
                              updateReviewRow(row.transaction_type, row.id, {
                                transaction_date: event.target.value,
                                adjustment_reason: row.adjustment_reason || "编辑日期"
                              })
                            }
                            type="date"
                            value={row.transaction_date}
                          />
                        </label>
                        <label>
                          收支类型
                          <select
                            onChange={(event) => moveReviewRow(row, event.target.value as "expense" | "income")}
                            value={row.transaction_type}
                          >
                            <option value="expense">支出</option>
                            <option value="income">收入</option>
                          </select>
                        </label>
                        <label>
                          金额
                          <input
                            inputMode="decimal"
                            onChange={(event) =>
                              updateReviewRow(row.transaction_type, row.id, {
                                amount: Math.round(Math.abs(Number(event.target.value) || 0) * 100) / 100,
                                adjustment_reason: row.adjustment_reason || "编辑金额"
                              })
                            }
                            step="0.01"
                            type="number"
                            value={String(row.amount)}
                          />
                        </label>
                        <label>
                          币种
                          <select
                            onChange={(event) =>
                              updateReviewRow(row.transaction_type, row.id, {
                                currency: event.target.value as CurrencyCode,
                                adjustment_reason: row.adjustment_reason || "编辑币种"
                              })
                            }
                            value={row.currency ?? "CNY"}
                          >
                            {currencyOptions.map((option) => (
                              <option disabled={option.code === "OTHER"} key={option.code} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="wide-field">
                          标准分类
                          <input
                            onChange={(event) => setCategorySearch((current) => ({ ...current, [row.transaction_type]: event.target.value }))}
                            placeholder="搜索分类"
                            value={categorySearch[row.transaction_type]}
                          />
                          <select
                            onChange={(event) => {
                              const category = review?.categories.find((item) => item.id === event.target.value);
                              updateReviewRow(row.transaction_type, row.id, {
                                category_id: event.target.value || null,
                                category_name: category?.name ?? null,
                                adjustment_reason: row.adjustment_reason || "编辑分类"
                              });
                            }}
                            value={row.category_id ?? ""}
                          >
                            <option value="">未分类</option>
                            {(review?.categories ?? [])
                              .filter((category) => !categorySearch[row.transaction_type] || category.name.includes(categorySearch[row.transaction_type]))
                              .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                                {category.is_auto_created ? "（新增，待处理）" : ""}
                              </option>
                            ))}
                          </select>
                          <button className="secondary-button compact" onClick={() => setAddingCategoryRowId(addingCategoryRowId === row.id ? null : row.id)} type="button">
                            新增分类
                          </button>
                          {addingCategoryRowId === row.id ? (
                            <div className="category-create-box">
                              <input
                                onChange={(event) => setNewCategoryDraft((current) => ({ ...current, name: event.target.value }))}
                                placeholder="分类名称"
                                value={newCategoryDraft.name}
                              />
                              <label className="include-toggle">
                                <input
                                  checked={newCategoryDraft.isPersonal}
                                  onChange={(event) => setNewCategoryDraft((current) => ({ ...current, isPersonal: event.target.checked }))}
                                  type="checkbox"
                                />
                                <span>个人分类</span>
                              </label>
                              <input
                                onChange={(event) => setNewCategoryDraft((current) => ({ ...current, note: event.target.value }))}
                                placeholder="备注，可空"
                                value={newCategoryDraft.note}
                              />
                              <button className="primary-button compact" onClick={() => createCategoryForRow(row)} type="button">
                                保存并选中
                              </button>
                            </div>
                          ) : null}
                        </label>
                        <label>
                          备注
                          <input
                            onChange={(event) =>
                              updateReviewRow(row.transaction_type, row.id, {
                                note: event.target.value,
                                adjustment_reason: row.adjustment_reason || "编辑备注"
                              })
                            }
                            value={row.note}
                          />
                        </label>
                        <label>
                          是否计入统计
                          <select
                            onChange={(event) =>
                              updateReviewRow(row.transaction_type, row.id, {
                                include_in_stats: event.target.value === "yes",
                                adjustment_reason: row.adjustment_reason || "编辑是否计入"
                              })
                            }
                            value={row.include_in_stats ?? true ? "yes" : "no"}
                          >
                            <option value="yes">计入</option>
                            <option value="no">排除</option>
                          </select>
                        </label>
                        <label className="wide-field">
                          调整原因
                          <input
                            onChange={(event) => updateReviewRow(row.transaction_type, row.id, { adjustment_reason: event.target.value })}
                            placeholder="例如：分类修正、重复排除、金额修正"
                            value={row.adjustment_reason ?? ""}
                          />
                        </label>
                        <div className="edit-row-actions">
                          <button className="link-button danger-link" onClick={() => deleteReviewRow(row)} type="button">
                            删除这条明细
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {duplicatePanelRowId === row.id ? (
                      <div className="duplicate-panel">
                        <div className="duplicate-title">
                          <strong>可能重复的记录</strong>
                          <span>不自动删除，由你决定。</span>
                        </div>
                        {duplicateCandidates.length === 0 ? <p>当前月份里没有找到可展示的重复候选。</p> : null}
                        {duplicateCandidates.map((candidate) => (
                          <div className="duplicate-card" key={candidate.row.id}>
                            <div>
                              <strong>{formatRowAmount(candidate.row)}</strong>
                              <span>
                                {candidate.row.transaction_date} · {candidate.row.transaction_type === "expense" ? "支出" : "收入"} ·{" "}
                                {candidate.row.raw_category} / {candidate.row.category_name ?? "未分类"}
                              </span>
                              <span>
                                {candidate.row.note || "无备注"} · 来源：
                                {candidate.row.id.startsWith("manual-") ? "手动新增" : "导入"} · 当前状态：
                                {candidate.row.include_in_stats ?? true ? "计入" : "排除"}
                              </span>
                              <em>{candidate.reason}</em>
                            </div>
                            <div className="duplicate-actions">
                              <button className="secondary-button compact" onClick={() => keepBothDuplicateRows(row, candidate.row)} type="button">
                                保留两条
                              </button>
                              <button className="secondary-button compact" onClick={() => excludeCurrentDuplicateRow(row)} type="button">
                                排除当前条
                              </button>
                              <button className="secondary-button compact" onClick={() => excludeOtherDuplicateRow(candidate.row)} type="button">
                                排除另一条
                              </button>
                              <button className="secondary-button compact" onClick={() => mergeDuplicateNotes(row, candidate.row)} type="button">
                                合并备注后保留一条
                              </button>
                              <button className="secondary-button compact" onClick={() => markNotDuplicate(row)} type="button">
                                标记非异常
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
          </>
        ) : null}
      </article>
    );
  };

  const renderMonthlyUpdate = () => {
    const neededRateKeys = collectNeededRateKeys();
    const loadingRateCount = neededRateKeys.filter((key) => autoRates[key]?.status === "loading").length;
    const missingRateEntries = neededRateKeys.filter((key) => {
      const entry = autoRates[key];
      return !entry || entry.status === "missing" || entry.status === "error";
    });
    const warningRateEntries = neededRateKeys.filter((key) => autoRates[key]?.status === "warning");
    const readyRateCount = neededRateKeys.filter((key) => autoRates[key]?.status === "ready" || autoRates[key]?.status === "warning").length;
    const monthlyQuickNavItems = [
      { label: "导入账单", selector: ".import-panel", done: completedSteps.import, icon: <Upload size={18} /> },
      { label: "支出确认", selector: "[data-monthly-section='expense']", done: completedSteps.expense, icon: <WalletCards size={18} /> },
      { label: "收入确认", selector: "[data-monthly-section='income']", done: completedSteps.income, icon: <PiggyBank size={18} /> },
      { label: "资产录入", selector: "[data-monthly-section='assets']", done: completedSteps.assets, icon: <Landmark size={18} /> },
      { label: "信用卡调整", selector: "[data-monthly-section='creditCard']", done: completedSteps.creditCard, icon: <WalletCards size={18} /> },
      { label: "总确认", selector: "[data-monthly-section='final']", done: completedSteps.final, icon: <FileText size={18} /> }
    ];

    return (
    <section className="workspace-view monthly-workspace">
      <button className="back-button" onClick={() => setView("home")} type="button">
        <ChevronLeft size={18} />
        返回首页
      </button>
      <div className="view-heading">
        <p className="eyebrow">Monthly Close</p>
        <h1>月底财务信息更新</h1>
        <span>{isMonthUpdated ? "本月已完成，可重新检查。" : "本月待更新，建议按顺序完成。"}</span>
      </div>
      <nav className="monthly-quick-nav" aria-label="月度更新快速导航">
        {monthlyQuickNavItems.map((item) => (
          <button
            className={item.done ? "done" : ""}
            key={item.label}
            onClick={() => scrollToSelector(item.selector)}
            aria-label={item.label}
            type="button"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {successBanner ? (
        <div className="success-banner">
          <CheckCircle2 size={20} />
          <strong>{successBanner}</strong>
        </div>
      ) : null}
      <div className="step-progress">
        {stepItems.map((step, index) => (
          <div className={`step-progress-item ${completedSteps[step.key] ? "done" : ""}`} key={step.key}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.label}</strong>
            <small>{completedSteps[step.key] ? "已完成" : "待完成"}</small>
          </div>
        ))}
      </div>
      <article className="panel import-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Import</p>
            <h2>导入鲨鱼账单</h2>
          </div>
          <Upload size={20} />
        </div>
        <div className="import-controls">
          <input
            onBlur={() => rememberCsvPath(csvPath)}
            onChange={(event) => setCsvPath(event.target.value)}
            placeholder="请选择或填写本月账单路径，支持 CSV / XLSX"
            value={csvPath}
          />
          <button className="primary-button compact" onClick={handleImportSharkCsv} type="button">
            选择文件并识别
          </button>
        </div>
        <div className="month-controls">
          <label>
            月份
            <input onChange={(event) => handleMonthChange(event.target.value)} type="month" value={selectedMonth} />
          </label>
          <label>
            展示币种
            <select onChange={(event) => setDisplayCurrency(event.target.value as CurrencyCode)} value={displayCurrency}>
              {currencyOptions.map((option) => (
                <option disabled={option.code === "OTHER"} key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button compact" onClick={readConfirmationData} type="button">
            读取确认数据
          </button>
        </div>
        <div className="rate-panel auto-rate-panel">
          <div>
            <span>自动汇率</span>
            <small>联网自动获取历史汇率；缺失时会提示，不会静默换算。</small>
          </div>
          <div className="rate-status-grid">
            <span>已就绪 {readyRateCount}</span>
            <span>加载中 {loadingRateCount}</span>
            <span>提醒 {warningRateEntries.length}</span>
            <span>缺少 {missingRateEntries.length}</span>
          </div>
          <button className="secondary-button compact" onClick={() => void refreshAutoRates(true)} type="button">
            重新获取并重算
          </button>
          {warningRateEntries.length > 0 ? (
            <div className="rate-error-list">
              {warningRateEntries.slice(0, 4).map((key) => {
                const [date, from, to] = key.split("|");
                const entry = autoRates[key];
                return (
                  <span key={key}>
                    {date} {from} → {to}：{entry?.message ?? "双来源存在差异"}
                    <button className="link-button" onClick={() => void overrideFxRate(key)} type="button">单次覆盖</button>
                  </span>
                );
              })}
            </div>
          ) : null}
          {missingRateEntries.length > 0 ? (
            <div className="rate-error-list">
              {missingRateEntries.slice(0, 4).map((key) => {
                const [date, from, to] = key.split("|");
                return (
                  <span key={key}>
                    {date} {from} → {to}：{autoRates[key]?.message ?? "等待获取"}
                    <button className="link-button" onClick={() => void overrideFxRate(key)} type="button">单次覆盖</button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        {monthlyMessage ? <p className="form-message">{monthlyMessage}</p> : null}
        {importResult ? (
          <p className="form-message">
            {importResult.duplicate_file ? "重复文件未导入。" : importResult.overwritten_existing ? "文件已覆盖导入。" : "文件已导入。"} 覆盖月份：
            {importResult.period_months.join("、") || "无"}；支出 {importResult.expense_count} 条，收入 {importResult.income_count} 条。
          </p>
        ) : null}
        {pendingOverwriteImport ? (
          <div className="import-overwrite-actions">
            <span>同一个账单文件已经导入过。覆盖会删除上次导入的原始明细和对应确认结果。</span>
            <button className="primary-button compact" onClick={overwritePreviousImport} type="button">
              覆盖上次导入
            </button>
            <button className="secondary-button compact" onClick={() => setPendingOverwriteImport(null)} type="button">
              暂不覆盖
            </button>
          </div>
        ) : null}
      </article>

      {renderReviewSection("expense")}
      {renderReviewSection("income")}

      {renderAssetEntry()}
      {renderCreditCardAdjustment()}
      {renderFinalConfirmation()}
    </section>
    );
  };

  const renderAssetEntry = () => {
    const manualFlows = assetItems.flatMap((asset) => asset.cashflows ?? []);
    const includedDcaFlows = dcaCashflows.filter((flow) => flow.included);
    const allAssetFlows = [...manualFlows, ...includedDcaFlows];
    const flowDisplayAmount = (flow: AssetCashflowItem) =>
      convertAmount(Number(flow.amount) || 0, flow.flow_date, flow.currency ?? "CNY", displayCurrency) ?? 0;
    const flowTotal = (type: AssetCashflowItem["flow_type"], sourceKind?: AssetCashflowItem["source_kind"]) =>
      allAssetFlows
        .filter((flow) => flow.flow_type === type && (!sourceKind || flow.source_kind === sourceKind))
        .reduce((sum, flow) => sum + flowDisplayAmount(flow), 0);
    const totalBuy = flowTotal("buy");
    const totalExtraBuy = flowTotal("buy", "monthly_asset_entry");
    const totalSell = flowTotal("sell");
    const totalDividend = flowTotal("dividend");
    const assetGrossValue = assetItems
      .reduce(
        (sum, asset) =>
          isAssetCountedInMonth(asset)
            ? sum + (convertAmount(Number(asset.month_end_amount) || 0, monthEndDate(), asset.currency ?? "CNY", displayCurrency) ?? 0)
            : sum,
        0
      );
    const missingMonthEnd = assetItems.filter((asset) => assetMonthAmountIssue(asset)).length;
    const topFlows = (type: AssetCashflowItem["flow_type"]) =>
      Array.from(
        allAssetFlows
          .filter((flow) => flow.flow_type === type)
          .reduce((map, flow) => {
            const assetName = flow.asset_name ?? assetItems.find((asset) => asset.id === flow.asset_id)?.name ?? "未命名资产";
            map.set(assetName, (map.get(assetName) ?? 0) + flowDisplayAmount(flow));
            return map;
          }, new Map<string, number>())
          .entries()
      ).sort((a, b) => b[1] - a[1]);
    const topBuy = assetSummaryExpanded.buy ? topFlows("buy") : topFlows("buy").slice(0, 4);
    const topSell = assetSummaryExpanded.sell ? topFlows("sell") : topFlows("sell").slice(0, 4);
    const previousSnapshotAssets = assetItems.filter((asset) => Number(asset.previous_month_amount) > 0);
    const dcaAssetCount = assetItems.filter((asset) => asset.is_dca).length;
    const savedAssetCards = assetItems.filter((asset) => asset.confirmed).length;
    const previousSnapshotMonth = previousPeriodMonth(selectedMonth);
    const hasInheritedAssets = previousSnapshotAssets.length > 0;
    return (
      <article className="panel confirm-panel" data-monthly-section="assets">
        <div className="panel-header">
          <div>
            <p className="eyebrow">04</p>
            <h2>资产录入</h2>
          </div>
          <div className="row-actions">
            <button
              className="primary-button compact"
              disabled={savingAssets}
              onClick={() => void saveAssetEntries()}
              type="button"
            >
              {savingAssets ? "保存中..." : completedSteps.assets ? "已确认，可修改" : "确认资产录入"}
            </button>
            <button className="secondary-button compact" onClick={() => toggleSection("assets")} type="button">
              {expandedSections.assets ? "收起" : "展开"}
            </button>
          </div>
        </div>
        {!expandedSections.assets ? <p className="form-message">资产录入已收起。</p> : null}
        {expandedSections.assets ? (
          <>
        <div className="confirm-total">
          <strong>{completedSteps.assets ? "已确认" : "待整页确认"}</strong>
          <span>{completedSteps.assets ? "本月资产录入已确认。" : "填写完后整页确认一次。"}</span>
        </div>
        {monthlyMessage?.includes("资产") || monthlyMessage?.includes("月末市值") || monthlyMessage?.includes("定投") ? (
          <p className="form-message">{monthlyMessage}</p>
        ) : null}
        {assetValidationIssue ? (
          <div className="form-message asset-validation-message">
            <span>{assetValidationIssue.message}</span>
            {assetValidationIssue.assetId ? (
              <button className="link-button" onClick={() => locateAsset(assetValidationIssue.assetId)} type="button">
                去修改
              </button>
            ) : null}
          </div>
        ) : null}
        {assetAllocationPreferenceIssue ? (
          <div className="form-message asset-validation-message asset-allocation-preference-message">
            <span>{assetAllocationPreferenceIssue}</span>
            <button className="link-button" onClick={() => void openAllocationPreferences()} type="button">
              重新设置配比偏好
            </button>
          </div>
        ) : null}
        <div className="final-grid asset-summary-grid">
          <div><span>本月买入总额</span><strong>{formatCurrency(totalBuy, privacyMode, displayCurrency)}</strong></div>
          <div><span>本月额外买入</span><strong>{formatCurrency(totalExtraBuy, privacyMode, displayCurrency)}</strong></div>
          <div><span>本月卖出</span><strong>{formatCurrency(totalSell, privacyMode, displayCurrency)}</strong></div>
          <div><span>本月分红</span><strong>{formatCurrency(totalDividend, privacyMode, displayCurrency)}</strong></div>
          <div><span>月末资产原值</span><strong>{formatCurrency(assetGrossValue, privacyMode, displayCurrency)}</strong></div>
          <div><span>未填月末市值</span><strong>{missingMonthEnd}</strong></div>
          <div><span>已保存资产卡</span><strong>{savedAssetCards}/{assetItems.length}</strong></div>
        </div>
        <div className="summary-grid">
          {topBuy.map(([name, amount]) => (
            <div className="summary-chip" key={`top-buy-${name}`}>
              <span>买入 · {name}</span>
              <strong>{formatCurrency(amount, privacyMode, displayCurrency)}</strong>
            </div>
          ))}
          {topSell.map(([name, amount]) => (
            <div className="summary-chip" key={`top-sell-${name}`}>
              <span>卖出 · {name}</span>
              <strong>{formatCurrency(amount, privacyMode, displayCurrency)}</strong>
            </div>
          ))}
          {topFlows("buy").length > 4 ? (
            <button className="link-button summary-toggle" onClick={() => setAssetSummaryExpanded((current) => ({ ...current, buy: !current.buy }))} type="button">
              {assetSummaryExpanded.buy ? "收起买入资产" : "展开全部买入资产"}
            </button>
          ) : null}
          {topFlows("sell").length > 4 ? (
            <button className="link-button summary-toggle" onClick={() => setAssetSummaryExpanded((current) => ({ ...current, sell: !current.sell }))} type="button">
              {assetSummaryExpanded.sell ? "收起卖出资产" : "展开全部卖出资产"}
            </button>
          ) : null}
        </div>
        {!hasInheritedAssets && assetItems.length === 0 ? (
        <div className="asset-sync-overview">
          <div>
            <span>首次资产初始化</span>
            <strong>请手动创建资产清单</strong>
            <small>没有完成过月报时，不读取旧数据库资产；资产名称、分类、币种、平台和定投计划都由你手动录入。</small>
          </div>
        </div>
        ) : null}
        <div className="asset-sync-overview secondary">
          <div>
            <span>本月定投日历</span>
            <strong>{dcaAssetCount} 个定投资产 · {includedDcaFlows.length} 笔红标记录</strong>
            <small>按频率和金额自动关联日期，点击红标可编辑</small>
          </div>
          <button className="secondary-button compact" onClick={resetAssetEntryDraft} type="button">
            重置本月资产录入
          </button>
        </div>
        {assetItems.length === 0 ? <p className="form-message">还没有资产清单。请先创建我的资产清单。</p> : null}
        <button className="secondary-button compact summary-toggle" onClick={() => setShowAssetCreator((value) => !value)} type="button">
          {showAssetCreator || assetItems.length === 0 ? "收起资产创建" : "创建 / 新增资产"}
        </button>
        {showAssetCreator || assetItems.length === 0 ? (
          <div className="asset-creator">
            <input placeholder="资产名称" value={newAsset.name} onChange={(event) => setNewAsset((current) => ({ ...current, name: event.target.value }))} />
            <select value={newAsset.topCategory} onChange={(event) => updateNewAssetTopCategory(event.target.value)}>
              {onboardingMainAllocationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {(onboardingSubAllocationOptions[newAsset.topCategory] ?? []).length > 0 ? (
              <select
                value={isCashCategoryId(newAsset.topCategory) ? newAsset.cashCategory : newAsset.fundCategory}
                onChange={(event) => updateNewAssetSubCategory(event.target.value)}
              >
                {(onboardingSubAllocationOptions[newAsset.topCategory] ?? []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ) : null}
            {!isCashCategoryId(newAsset.topCategory) && categoryOptions(findAssetCategoryNode(assetCategoryTree, newAsset.fundCategory)?.children ?? []).length > 0 ? (
              <select value={newAsset.usEquityCategory} onChange={(event) => setNewAsset((current) => ({ ...current, usEquityCategory: event.target.value }))}>
                {categoryOptions(findAssetCategoryNode(assetCategoryTree, newAsset.fundCategory)?.children ?? []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ) : null}
            <select value={newAsset.currency} onChange={(event) => setNewAsset((current) => ({ ...current, currency: event.target.value as CurrencyCode }))}>
              {currencyOptions.filter((item) => item.code !== "OTHER").map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
            <input placeholder="平台：支付宝 / 证券账户 / 银行 / 其他" value={newAsset.platform} onChange={(event) => setNewAsset((current) => ({ ...current, platform: event.target.value }))} />
            <input className="tag-input wide-field" placeholder="多个标签请用逗号分隔，例如：债券，定投中" value={newAsset.tags} onChange={(event) => setNewAsset((current) => ({ ...current, tags: event.target.value }))} />
            <label>
              月末市值
              <input
                inputMode="decimal"
                placeholder="填写本月最后一天金额"
                step="0.01"
                type="number"
                value={newAsset.monthEndAmount}
                onChange={(event) => setNewAsset((current) => ({ ...current, monthEndAmount: event.target.value }))}
              />
            </label>
            <select value={newAsset.status} onChange={(event) => setNewAsset((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">当前持有</option>
              <option value="inactive">暂不统计</option>
            </select>
            <label className="include-toggle">
              <input checked={newAsset.isDca} onChange={(event) => setNewAsset((current) => ({ ...current, isDca: event.target.checked }))} type="checkbox" />
              <span>启用定投</span>
            </label>
            {newAsset.isDca ? (
              <div className="dca-planner-layout wide-field">
                <div className="asset-flow-editor">
                  <strong>定投计划</strong>
                  {newAssetDcaPlans.map((plan, index) => (
                    <div className="asset-flow-row" key={`new-dca-${index}`}>
                      <select
                        value={plan.frequency}
                        onChange={(event) =>
                          setNewAssetDcaPlans((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, frequency: event.target.value } : item)))
                        }
                      >
                        <option value="daily">每日</option>
                        <option value="weekly">每周</option>
                        <option value="monthly">每月</option>
                      </select>
                      <input
                        placeholder="每次金额"
                        step="0.01"
                        type="number"
                        value={plan.amount}
                        onChange={(event) => setNewAssetDcaPlans((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, amount: event.target.value } : item)))}
                      />
                      {plan.frequency === "daily" ? <span className="muted-note">每个工作日，跳过国家节假日</span> : null}
                      {plan.frequency === "weekly" ? (
                        <select
                          value={plan.weeklyDay}
                          onChange={(event) => setNewAssetDcaPlans((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, weeklyDay: event.target.value } : item)))}
                        >
                          <option value="1">周一</option>
                          <option value="2">周二</option>
                          <option value="3">周三</option>
                          <option value="4">周四</option>
                          <option value="5">周五</option>
                          <option value="6">周六</option>
                          <option value="7">周日</option>
                        </select>
                      ) : null}
                      {plan.frequency === "monthly" ? (
                        <input
                          placeholder="每月几号"
                          type="number"
                          value={plan.monthlyDay}
                          onChange={(event) => setNewAssetDcaPlans((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, monthlyDay: event.target.value } : item)))}
                        />
                      ) : null}
                      <button className="link-button" onClick={() => setNewAssetDcaPlans((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">
                        删除
                      </button>
                    </div>
                  ))}
                  <button
                    className="secondary-button compact"
                    onClick={() =>
                      setNewAssetDcaPlans((current) => [
                        ...current,
                        { frequency: "monthly", amount: "", weeklyDay: "1", monthlyDay: "1" }
                      ])
                    }
                    type="button"
                  >
                    新增定投计划
                  </button>
                </div>
                {renderMonthlyDcaCalendar(draftDcaDays(newAssetDcaPlans, selectedMonth))}
              </div>
            ) : null}
            <div className="asset-flow-editor wide-field">
              <div className="row-actions">
                <strong>本月买入 / 卖出 / 分红</strong>
                <button className="secondary-button compact" onClick={() => addNewAssetDraftCashflow("buy")} type="button">新增买入</button>
                <button className="secondary-button compact" onClick={() => addNewAssetDraftCashflow("sell")} type="button">新增卖出</button>
                <button className="secondary-button compact" onClick={() => addNewAssetDraftCashflow("dividend")} type="button">新增分红</button>
              </div>
              {newAssetCashflows.length === 0 ? <span className="muted-note">如本月没有额外买入、卖出或分红，可不填。</span> : null}
              {newAssetCashflows.map((flow) => (
                <div className="asset-flow-row" key={flow.id}>
                  <input type="date" value={flow.flow_date} onChange={(event) => updateNewAssetDraftCashflow(flow.id, { flow_date: event.target.value })} />
                  <select value={flow.flow_type} onChange={(event) => updateNewAssetDraftCashflow(flow.id, { flow_type: event.target.value as AssetCashflowItem["flow_type"] })}>
                    <option value="buy">买入</option>
                    <option value="sell">卖出</option>
                    <option value="dividend">分红</option>
                  </select>
                  <input step="0.01" type="number" placeholder="金额" value={flow.amount} onChange={(event) => updateNewAssetDraftCashflow(flow.id, { amount: event.target.value })} />
                  <select value={flow.currency} onChange={(event) => updateNewAssetDraftCashflow(flow.id, { currency: event.target.value as CurrencyCode })}>
                    {currencyOptions.filter((item) => item.code !== "OTHER").map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}
                  </select>
                  <input value={flow.note ?? ""} onChange={(event) => updateNewAssetDraftCashflow(flow.id, { note: event.target.value })} placeholder="备注" />
                  <button
                    className={flow.confirmed ? "link-button done-button" : "link-button attention-button"}
                    onClick={() => updateNewAssetDraftCashflow(flow.id, { confirmed: true, included: true })}
                    type="button"
                  >
                    {flow.confirmed ? "已确认，可修改" : "确认"}
                  </button>
                  <button className="link-button" onClick={() => removeNewAssetDraftCashflow(flow.id)} type="button">
                    删除
                  </button>
                </div>
              ))}
            </div>
            <input className="wide-field" placeholder="备注" value={newAsset.note} onChange={(event) => setNewAsset((current) => ({ ...current, note: event.target.value }))} />
            <button className="primary-button compact" onClick={createNewAsset} type="button">保存资产</button>
          </div>
        ) : null}
        <div className="asset-table">
          {assetItems.map((asset) => {
            const currentDcaFlows = dcaFlowsForAsset(asset);
            const selectedDcaFlow = selectedDcaFlowForAsset(asset);
            const assetExpanded = expandedAssetIds[asset.id] ?? !asset.confirmed;
            const assetClassification = classificationForAsset(asset, assetCategoryTree);
            const sellTotal = assetSellTotal(asset);
            const shouldSuggestCleared = assetShouldSuggestCleared(asset);
            const clearedWithoutSellIssue = assetClearedWithoutSellIssue(asset, Boolean(clearedWithoutSellOverrides[asset.id]));
            const clearedWithDcaOn = assetMonthStatus(asset) === "cleared" && Boolean(asset.is_dca);
            return (
            <div className={`asset-row ${asset.confirmed ? "done" : ""} ${assetExpanded ? "" : "collapsed"}`} data-asset-id={asset.id} key={asset.id}>
              <div>
                <div className="asset-compact-header">
                  <div className="asset-title-stack">
                    <input
                      value={asset.name}
                      onChange={(event) => setAssetItems((current) => current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, name: event.target.value } : item)))}
                      aria-label="资产名称"
                    />
                    <span>
                      {assetClassificationText(asset, assetCategoryTree)} · {assetMonthStatusLabel(asset)} · {asset.tags || "无标签"} · {asset.currency}
                      {asset.platform ? <em className="muted-note"> · 平台：{asset.platform}</em> : null}
                      <em className={asset.confirmed ? "asset-save-state saved" : "asset-save-state unsaved"}>
                        · {asset.confirmed ? "已保存本卡" : "未保存本卡"}
                      </em>
                    </span>
                  </div>
                  <button className={asset.confirmed ? "secondary-button compact done-button" : "secondary-button compact"} onClick={() => saveAssetDetail(asset)} type="button">
                    {asset.confirmed ? "已保存，可修改" : "保存该资产明细"}
                  </button>
                  <button
                    className="secondary-button compact"
                    onClick={() => setExpandedAssetIds((current) => ({ ...current, [asset.id]: !assetExpanded }))}
                    type="button"
                  >
                    {assetExpanded ? "折叠" : "展开"}
                  </button>
                  <button className="link-button danger-link" onClick={() => deleteAssetItem(asset.id)} type="button">
                    删除
                  </button>
                </div>
                <div className="asset-classification-grid wide-field">
                  <label>
                    一级分类
                    <select
                      value={assetClassification.topCategory}
                      onChange={(event) =>
                        {
                          const firstSub = firstRuntimeSubCategory(event.target.value);
                          const firstChild = firstRuntimeChildCategory(firstSub);
                        updateAssetClassification(asset.id, {
                          ...assetClassification,
                          topCategory: event.target.value,
                          cashCategory: isCashCategoryId(event.target.value) ? firstSub : assetClassification.cashCategory,
                          fundCategory: isCashCategoryId(event.target.value) ? assetClassification.fundCategory : firstSub,
                          usEquityCategory: firstChild || firstSub || assetClassification.usEquityCategory
                        });
                        }
                      }
                    >
                      {onboardingMainAllocationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  {(onboardingSubAllocationOptions[assetClassification.topCategory] ?? []).length > 0 ? (
                    <label>
                      子资产类别
                      <select
                        value={isCashCategoryId(assetClassification.topCategory) ? assetClassification.cashCategory : assetClassification.fundCategory}
                        onChange={(event) =>
                          {
                          const firstChild = firstRuntimeChildCategory(event.target.value);
                          updateAssetClassification(asset.id, {
                            ...assetClassification,
                            cashCategory: isCashCategoryId(assetClassification.topCategory) ? event.target.value : assetClassification.cashCategory,
                            fundCategory: isCashCategoryId(assetClassification.topCategory) ? assetClassification.fundCategory : event.target.value,
                            usEquityCategory: firstChild || event.target.value || assetClassification.usEquityCategory
                          });
                          }
                        }
                      >
                        {(onboardingSubAllocationOptions[assetClassification.topCategory] ?? []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {!isCashCategoryId(assetClassification.topCategory) && categoryOptions(findAssetCategoryNode(assetCategoryTree, assetClassification.fundCategory)?.children ?? []).length > 0 ? (
                    <label>
                      细分类
                      <select
                        value={assetClassification.usEquityCategory}
                        onChange={(event) =>
                          updateAssetClassification(asset.id, {
                            ...assetClassification,
                            usEquityCategory: event.target.value
                          })
                        }
                      >
                        {categoryOptions(findAssetCategoryNode(assetCategoryTree, assetClassification.fundCategory)?.children ?? []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
                <input
                  className="tag-input wide-field"
                  placeholder="多个标签请用逗号分隔，例如：债券，定投中"
                  value={asset.tags}
                  onChange={(event) => setAssetItems((current) => current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, tags: event.target.value } : item)))}
                />
                <select
                  value={asset.currency}
                  onChange={(event) => setAssetItems((current) => current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, currency: event.target.value as CurrencyCode } : item)))}
                >
                  {currencyOptions.filter((item) => item.code !== "OTHER").map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                </select>
                <input
                  placeholder="平台"
                  value={asset.platform ?? ""}
                  onChange={(event) => setAssetItems((current) => current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, platform: event.target.value } : item)))}
                />
                <div className="asset-history-card wide-field">
                  <div>
                    <strong>{Number(asset.previous_month_amount) > 0 ? "沿用上次月报资产明细" : "本月新增资产"}</strong>
                    <span>
                      {Number(asset.previous_month_amount) > 0
                        ? `${asset.previous_snapshot_month ?? previousSnapshotMonth} · 上次月报月末 ${formatCurrency(Number(asset.previous_month_amount) || 0, privacyMode, asset.currency)}，本月需重新填写`
                        : "没有上次月报资产快照，需手动填写本月月末市值"}
                    </span>
                  </div>
                  {asset.is_dca ? (
                    <div className="asset-history-dca">
                      <span>本月定投预览</span>
                      <strong>{currentDcaFlows.filter((flow) => flow.included).length} 笔</strong>
                      <small>{formatCurrency(currentDcaFlows.filter((flow) => flow.included).reduce((sum, flow) => sum + (convertAmount(Number(flow.amount) || 0, flow.flow_date, flow.currency ?? asset.currency, displayCurrency) ?? 0), 0), privacyMode, displayCurrency)}</small>
                    </div>
                  ) : null}
                </div>
                <label>
                  本月状态
                  <select
                    value={assetMonthStatus(asset)}
                    onChange={(event) => setAssetMonthStatus(asset.id, event.target.value)}
                  >
                    {assetMonthStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {shouldSuggestCleared ? (
                  <div className="asset-logic-note wide-field warning">
                    <div>
                      <strong>检测到卖出后月末市值为 0</strong>
                      <span>这通常代表本月已清仓。卖出记录会用于收益 / XIRR，清仓状态会让它退出当前资产配置。</span>
                    </div>
                    <button className="secondary-button compact" onClick={() => setAssetMonthStatus(asset.id, "cleared")} type="button">
                      标记已清仓
                    </button>
                  </div>
                ) : null}
                {clearedWithoutSellIssue ? (
                  <div className="asset-logic-note wide-field warning">
                    <div>
                      <strong>已清仓，但没有卖出记录</strong>
                      <span>当前资产会退出配置；但没有卖出现金流，投资收益和 XIRR 可能不准。</span>
                    </div>
                    <button className="secondary-button compact" onClick={() => addAssetCashflow(asset, "sell")} type="button">
                      补充卖出
                    </button>
                    <button className="link-button" onClick={() => allowClearedWithoutSell(asset.id)} type="button">
                      仅标记清仓
                    </button>
                  </div>
                ) : null}
                {assetMonthStatus(asset) === "cleared" && sellTotal > 0 ? (
                  <div className="asset-logic-note wide-field success">
                    <div>
                      <strong>清仓记录完整</strong>
                      <span>本月卖出 {formatCurrency(sellTotal, privacyMode, asset.currency)}；该资产不进入当前配置，卖出现金流保留用于投资表现。</span>
                    </div>
                  </div>
                ) : null}
                {clearedWithDcaOn ? (
                  <div className="asset-logic-note wide-field">
                    <div>
                      <strong>定投仍在开启</strong>
                      <span>如果清仓后不再继续买入，请关闭定投；如果本月先定投后清仓，可以保留。</span>
                    </div>
                  </div>
                ) : null}
                <label className="include-toggle">
                  <input
                    checked={Boolean(asset.is_dca)}
                    onChange={(event) => {
                      clearAutoDcaPreview(asset.id);
                      setAssetItems((current) =>
                        current.map((item) =>
                          item.id === asset.id
                            ? {
                                ...item,
                                confirmed: false,
                                is_dca: event.target.checked,
                                dca_plans:
                                  event.target.checked && (item.dca_plans ?? []).length === 0
                                    ? [
                                        {
                                          id: null,
                                          frequency: "monthly",
                                          amount: "",
                                          start_date: `${selectedMonth}-01`,
                                          end_date: null,
                                          weekly_rules_json: null,
                                          monthly_day: 1
                                        }
                                      ]
                                    : item.dca_plans
                              }
                            : item
                        )
                      );
                    }}
                    type="checkbox"
                  />
                  <span>启用定投</span>
                </label>
                {asset.is_dca ? (
                  <div className="dca-planner-layout wide-field">
                    <div className="asset-flow-editor">
                      <strong>定投计划</strong>
                      {(asset.dca_plans ?? []).length > 0 ? (
                        <div className="dca-plan-summary">
                          {(asset.dca_plans ?? []).map((plan, index) => (
                            <span key={`${asset.id}-dca-summary-${index}`}>
                              {dcaPlanDetail(plan, asset.currency)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {(asset.dca_plans ?? []).map((plan, index) => (
                        <div className="asset-flow-row" key={`${asset.id}-dca-plan-${index}`}>
                          <select value={plan.frequency} onChange={(event) => updateAssetDcaPlan(asset.id, index, { frequency: event.target.value })}>
                            <option value="daily">每日</option>
                            <option value="weekly">每周</option>
                            <option value="monthly">每月</option>
                          </select>
                          <input step="0.01" type="number" placeholder="每次金额" value={plan.amount} onChange={(event) => updateAssetDcaPlan(asset.id, index, { amount: event.target.value })} />
                          {plan.frequency === "daily" ? <span className="muted-note">每个工作日，跳过国家节假日</span> : null}
                          {plan.frequency === "weekly" ? (
                            <select
                              value={dcaWeeklyDay(plan)}
                              onChange={(event) =>
                                updateAssetDcaPlan(asset.id, index, {
                                  weekly_rules_json: JSON.stringify([{ weekday: Number(event.target.value) || 1, amount: Number(plan.amount) || 0 }])
                                })
                              }
                            >
                              <option value="1">周一</option>
                              <option value="2">周二</option>
                              <option value="3">周三</option>
                              <option value="4">周四</option>
                              <option value="5">周五</option>
                              <option value="6">周六</option>
                              <option value="7">周日</option>
                            </select>
                          ) : null}
                          {plan.frequency === "monthly" ? (
                            <input
                              type="number"
                              placeholder="每月几号"
                              value={plan.monthly_day ?? ""}
                              onChange={(event) =>
                                updateAssetDcaPlan(asset.id, index, {
                                  monthly_day: event.target.value === "" ? null : Number(event.target.value)
                                })
                              }
                            />
                          ) : null}
                          <button className="link-button" onClick={() => removeAssetDcaPlan(asset.id, index)} type="button">删除计划</button>
                        </div>
                      ))}
                      <button className="secondary-button compact" onClick={() => addAssetDcaPlan(asset)} type="button">新增定投计划</button>
                    </div>
                    <div className="asset-flow-editor">
                      {renderMonthlyDcaCalendar(
                        dcaDaysForAsset(asset),
                        `${asset.name} 定投日历`,
                        pausedDcaDaysForAsset(asset),
                        (day) => {
                          const flow = dcaFlowForDay(asset, day);
                          if (flow) {
                            setSelectedDcaFlowId(flow.id);
                            setSuccessBanner(`${asset.name} ${flow.flow_date.slice(5)} 定投记录已打开，可修改金额、币种和备注。`);
                          }
                        },
                        selectedDcaFlow ? Number(selectedDcaFlow.flow_date.slice(8, 10)) : undefined
                      )}
                      {selectedDcaFlow ? (
                        (() => {
                          const flow = selectedDcaFlow;
                          const isDcaAdjustmentConfirmed = Boolean(confirmedDcaAdjustments[flow.id]);
                          return (
                            <div className="dca-day-editor">
                              <strong className="dca-editor-title">正在编辑 {flow.flow_date.slice(5)} 定投记录</strong>
                              <label>
                                日期
                                <span>{flow.flow_date}</span>
                              </label>
                              <label>
                                金额
                                <input step="0.01" type="number" value={flow.amount} onChange={(event) => updateDcaCashflow(flow.id, { amount: event.target.value })} />
                              </label>
                              <label>
                                币种
                                <select value={flow.currency} onChange={(event) => updateDcaCashflow(flow.id, { currency: event.target.value as CurrencyCode })}>
                                  {currencyOptions.filter((item) => item.code !== "OTHER").map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}
                                </select>
                              </label>
                              <label>
                                备注
                                <input value={flow.note ?? ""} onChange={(event) => updateDcaCashflow(flow.id, { note: event.target.value })} placeholder="暂停原因或金额调整原因" />
                              </label>
                              <button className="link-button" onClick={() => updateDcaCashflow(flow.id, { included: !flow.included })} type="button">
                                {flow.included ? "暂停本次" : "恢复本次"}
                              </button>
                              <div className="row-actions dca-extra-actions">
                                <button className="secondary-button compact" onClick={() => addAssetCashflow(asset, "buy", flow.flow_date)} type="button">
                                  同日新增买入
                                </button>
                                <button className="secondary-button compact" onClick={() => addAssetCashflow(asset, "sell", flow.flow_date)} type="button">
                                  同日新增卖出
                                </button>
                                <button className="secondary-button compact" onClick={() => addAssetCashflow(asset, "dividend", flow.flow_date)} type="button">
                                  同日新增分红
                                </button>
                              </div>
                              <button
                                className={isDcaAdjustmentConfirmed ? "link-button done-button" : "link-button attention-button"}
                                onClick={() => confirmDcaAdjustment(flow.id)}
                                type="button"
                              >
                                {isDcaAdjustmentConfirmed ? "调整已确认" : "确认调整"}
                              </button>
                              <button className="link-button" onClick={() => setSelectedDcaFlowId(null)} type="button">
                                关闭编辑
                              </button>
                            </div>
                          );
                        })()
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <input
                  placeholder="备注"
                  value={asset.note ?? ""}
                  onChange={(event) => setAssetItems((current) => current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, note: event.target.value } : item)))}
                />
              </div>
              <label>
                月末市值
                <input
                  onChange={(event) =>
                    setAssetItems((current) =>
                      current.map((item) => (item.id === asset.id ? { ...item, confirmed: false, month_end_amount: event.target.value } : item))
                    )
                  }
                  step="0.01"
                  type="number"
                  value={asset.month_end_amount}
                />
              </label>
              <div className="asset-flow-editor">
                <div className="row-actions">
                  <button className="secondary-button compact" onClick={() => addAssetCashflow(asset, "buy")} type="button">新增买入</button>
                  <button className="secondary-button compact" onClick={() => addAssetCashflow(asset, "sell")} type="button">新增卖出</button>
                  <button className="secondary-button compact" onClick={() => addAssetCashflow(asset, "dividend")} type="button">新增分红</button>
                </div>
                {(asset.cashflows ?? []).map((flow) => (
                  <div className="asset-flow-row" key={flow.id}>
                    <input type="date" value={flow.flow_date} onChange={(event) => updateAssetCashflow(asset.id, flow.id, { flow_date: event.target.value })} />
                    <select value={flow.flow_type} onChange={(event) => updateAssetCashflow(asset.id, flow.id, { flow_type: event.target.value as AssetCashflowItem["flow_type"] })}>
                      <option value="buy">买入</option>
                      <option value="sell">卖出</option>
                      <option value="dividend">分红</option>
                    </select>
                    <input step="0.01" type="number" value={flow.amount} onChange={(event) => updateAssetCashflow(asset.id, flow.id, { amount: event.target.value })} />
                    <select value={flow.currency} onChange={(event) => updateAssetCashflow(asset.id, flow.id, { currency: event.target.value as CurrencyCode })}>
                      {currencyOptions.filter((item) => item.code !== "OTHER").map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}
                    </select>
                    <input value={flow.note ?? ""} onChange={(event) => updateAssetCashflow(asset.id, flow.id, { note: event.target.value })} placeholder="备注" />
                    <button
                      className={flow.confirmed ? "link-button done-button" : "link-button"}
                      onClick={() => updateAssetCashflow(asset.id, flow.id, { confirmed: true, included: true })}
                      type="button"
                    >
                      {flow.confirmed ? "已确认，可修改" : "确认"}
                    </button>
                    <button className="link-button" onClick={() => removeAssetCashflow(asset.id, flow.id)} type="button">
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
          </>
        ) : null}
      </article>
    );
  };

  const renderCreditCardAdjustment = () => {
    const totalNetAdjustment = creditCards.reduce(
      (sum, card) => sum + (-(Number(card.billed_amount) || 0) - (Number(card.unbilled_amount) || 0) + (Number(card.previous_unbilled_amount) || 0)),
      0
    );
    const hasUnconfirmedCards = creditCards.some((card) => !card.confirmed);
    return (
      <article className="panel confirm-panel" data-monthly-section="creditCard">
        <div className="panel-header">
          <div>
            <p className="eyebrow">05</p>
            <h2>信用卡调整</h2>
          </div>
          <div className="row-actions">
            <button className={`primary-button compact ${hasUnconfirmedCards ? "attention-button" : ""}`} onClick={saveCreditCards} type="button">
              {completedSteps.creditCard && !hasUnconfirmedCards ? "已确认，可修改" : "确认信用卡调整"}
            </button>
            <button className="secondary-button compact" onClick={() => toggleSection("creditCard")} type="button">
              {expandedSections.creditCard ? "收起" : "展开"}
            </button>
          </div>
        </div>
        {!expandedSections.creditCard ? <p className="form-message">信用卡调整已收起。</p> : null}
        {expandedSections.creditCard ? (
          <>
        <button
          className="secondary-button compact summary-toggle"
          onClick={() =>
            setCreditCards((current) => [
              ...current,
              {
                id: `new-${Date.now()}`,
                name: "新信用卡",
                institution: "",
                note: "",
                is_active: true,
                billed_amount: 0,
                unbilled_amount: 0,
                previous_unbilled_amount: 0,
                previous_unbilled_override: false,
                previous_unbilled_override_reason: "",
                previous_unbilled_source_found: false,
                net_adjustment: 0,
                confirmed: false
              }
            ])
          }
          type="button"
        >
          新增信用卡
        </button>
        <div className="credit-card-list">
          {creditCards.map((card) => {
            const netAdjustment = -(Number(card.billed_amount) || 0) - (Number(card.unbilled_amount) || 0) + (Number(card.previous_unbilled_amount) || 0);
            return (
              <div className={`credit-card-row ${card.is_active ? "" : "inactive"}`} key={card.id}>
                <label>
                  信用卡名称
                  <input
                    onChange={(event) => updateCreditCard(card.id, { name: event.target.value })}
                    value={card.name}
                  />
                </label>
                <label>
                  银行/机构
                  <input
                    onChange={(event) => updateCreditCard(card.id, { institution: event.target.value })}
                    placeholder="可空"
                    value={card.institution ?? ""}
                  />
                </label>
                <label>
                  本月已出账单
                  <input
                    onChange={(event) => updateCreditCard(card.id, { billed_amount: event.target.value })}
                    step="0.01"
                    type="number"
                    value={card.billed_amount}
                  />
                </label>
                <label>
                  本月未出账单
                  <input
                    onChange={(event) => updateCreditCard(card.id, { unbilled_amount: event.target.value })}
                    step="0.01"
                    type="number"
                    value={card.unbilled_amount}
                  />
                </label>
                <label>
                  上月未出账单
                  <input
                    onChange={(event) =>
                      updateCreditCard(card.id, {
                        previous_unbilled_amount: event.target.value,
                        previous_unbilled_override: true
                      })
                    }
                    step="0.01"
                    type="number"
                    value={card.previous_unbilled_amount}
                  />
                  <small>{card.previous_unbilled_source_found ? "已从上月本月未出账单带出。" : "未找到上月记录，已按 0 处理。"}</small>
                </label>
                <label className="include-toggle">
                  <input
                    checked={Boolean(card.previous_unbilled_override)}
                    onChange={(event) =>
                      updateCreditCard(card.id, {
                        previous_unbilled_override: event.target.checked,
                        previous_unbilled_override_reason: event.target.checked ? card.previous_unbilled_override_reason ?? "" : ""
                      })
                    }
                    type="checkbox"
                  />
                  <span>手动修正</span>
                </label>
                {card.previous_unbilled_override ? (
                  <label>
                    修正原因
                    <input
                      onChange={(event) =>
                        updateCreditCard(card.id, { previous_unbilled_override_reason: event.target.value })
                      }
                      placeholder="必须填写"
                      value={card.previous_unbilled_override_reason ?? ""}
                    />
                  </label>
                ) : null}
                <label>
                  备注
                  <input
                    onChange={(event) => updateCreditCard(card.id, { note: event.target.value })}
                    placeholder="可空"
                    value={card.note ?? ""}
                  />
                </label>
                <label className="include-toggle">
                  <input
                    checked={card.is_active}
                    onChange={(event) => updateCreditCard(card.id, { is_active: event.target.checked })}
                    type="checkbox"
                  />
                  <span>启用</span>
                </label>
                <div className="computed-card inline">
                  <span>信用卡净调整</span>
                  <strong>{formatCurrency(netAdjustment, privacyMode)}</strong>
                </div>
                <button
                  className="link-button"
                  onClick={() => setCreditCards((current) => current.filter((item) => item.id !== card.id))}
                  type="button"
                >
                  删除信用卡
                </button>
              </div>
            );
          })}
          <div className="computed-card">
            <span>总信用卡净调整</span>
            <strong>{formatCurrency(totalNetAdjustment, privacyMode)}</strong>
          </div>
        </div>
          </>
        ) : null}
      </article>
    );
  };

  const renderFinalConfirmation = () => {
    const confirmedIncome = incomeReview?.rows.filter((row) => row.include_in_stats ?? true).reduce((sum, row) => sum + (convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY", "CNY") ?? 0), 0) ?? 0;
    const confirmedExpense = expenseReview?.rows.filter((row) => row.include_in_stats ?? true).reduce((sum, row) => sum + (convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY", "CNY") ?? 0), 0) ?? 0;
    const saving = confirmedIncome - confirmedExpense;
    const savingRate = confirmedIncome > 0 ? saving / confirmedIncome : 0;
    const missingRates = [...(expenseReview?.rows ?? []), ...(incomeReview?.rows ?? [])].filter(
      (row) => convertAmount(row.amount, row.transaction_date, row.currency ?? "CNY", "CNY") === null
    ).length;
    const unmapped = [...(expenseReview?.rows ?? []), ...(incomeReview?.rows ?? [])].filter((row) => !row.category_id).length;
    const unresolvedDuplicates = [...(expenseReview?.rows ?? []), ...(incomeReview?.rows ?? [])].filter((row) => isPendingDuplicate(row) && (row.include_in_stats ?? true)).length;
    const creditNet = creditCards.reduce(
      (sum, card) => sum + (-(Number(card.billed_amount) || 0) - (Number(card.unbilled_amount) || 0) + (Number(card.previous_unbilled_amount) || 0)),
      0
    );
    const projectedAssetGross = assetItems.reduce(
      (sum, asset) =>
        isAssetCountedInMonth(asset)
          ? sum + (convertAmount(Number(asset.month_end_amount) || 0, monthEndDate(selectedMonth), asset.currency ?? "CNY", "CNY") ?? 0)
          : sum,
      0
    );
    const projectedNetWorth = projectedAssetGross + creditNet;
    const formatFormulaNumber = (value: number, digits = 2) =>
      privacyMode
        ? "••••••"
        : new Intl.NumberFormat("zh-CN", {
            maximumFractionDigits: digits,
            minimumFractionDigits: digits
          }).format(value);
    const assetGrossFormula = assetItems.length > 0
      ? [
          "本月月末资产市值合计 = 所有资产的月末金额按月末汇率折算成人民币后求和。",
          ...assetItems.map((asset) => {
            if (!isAssetCountedInMonth(asset)) {
              return `${asset.name || "未命名资产"}：${assetMonthStatusLabel(asset)}，不计入本月月末资产市值合计。`;
            }
            const amount = Number(asset.month_end_amount) || 0;
            const currency = asset.currency ?? "CNY";
            const rate = getRate(monthEndDate(selectedMonth), currency, "CNY");
            const converted = convertAmount(amount, monthEndDate(selectedMonth), currency, "CNY");
            const sourceAmount = privacyMode ? `•••••• ${currency}` : `${formatFormulaNumber(amount)} ${currency}`;
            const rateText = currency === "CNY" ? "1.000000" : rate === null ? "缺失汇率" : formatFormulaNumber(rate, 6);
            const convertedText = converted === null ? "缺失汇率" : formatCurrency(converted, privacyMode);
            return `${asset.name || "未命名资产"}：${sourceAmount} × ${rateText} = ${convertedText}`;
          }),
          `本月月末资产市值合计 = ${formatCurrency(projectedAssetGross, privacyMode)}`
        ].join("\n")
      : "本月月末资产市值合计 = 暂无资产明细。";
    const creditNetFormula =
      `信用卡净调整 = -本月已出账单 - 本月未出账单 + 上月未出账单 = ${formatCurrency(creditNet, privacyMode)}。`;
    const previousMonth = previousPeriodMonth(selectedMonth);
    const previousMonthTrend = summary.monthly_trends.find((item) => item.period_month === previousMonth);
    const previousNetWorth = previousMonthTrend?.net_worth ?? (summary.snapshot_month === previousMonth ? summary.net_worth : 0);
    const finalMetrics = [
      {
        label: "总收入",
        value: formatCurrency(confirmedIncome, privacyMode),
        formula: "计入统计的收入明细逐条求和；外币按明细日期汇率折算为人民币。"
      },
      {
        label: "总支出",
        value: formatCurrency(confirmedExpense, privacyMode),
        formula: "计入统计的支出明细逐条求和；外币按明细日期汇率折算为人民币。"
      },
      {
        label: "储蓄金额",
        value: formatCurrency(saving, privacyMode),
        formula: "储蓄金额 = 总收入 - 总支出。"
      },
      {
        label: "储蓄率",
        value: formatPercent(savingRate),
        formula: "储蓄率 = 储蓄金额 / 总收入；总收入为 0 时按 0 处理。"
      },
      {
        label: "上个月资产总额",
        value: formatCurrency(previousNetWorth, privacyMode),
        formula: `读取已发布看板库 ${previousMonth} 的净资产；该数值已包含信用卡净调整。`
      },
      {
        label: "本月预计资产总额",
        value: formatCurrency(projectedNetWorth, privacyMode),
        formula: [
          "本月预计资产总额 = 本月月末资产市值合计 + 信用卡净调整。",
          assetGrossFormula,
          creditNetFormula,
          `本月预计资产总额 = ${formatCurrency(projectedAssetGross, privacyMode)} + ${formatCurrency(creditNet, privacyMode)} = ${formatCurrency(projectedNetWorth, privacyMode)}。`
        ].join("\n")
      }
    ];
    const blockers = [
      !completedSteps.expense ? "支出未确认" : null,
      !completedSteps.income ? "收入未确认" : null,
      !completedSteps.assets ? "资产未确认" : null,
      !completedSteps.creditCard ? "信用卡未确认" : null,
      missingRates > 0 ? `缺少汇率 ${missingRates} 条` : null,
      unmapped > 0 ? `未映射分类 ${unmapped} 条` : null,
      unresolvedDuplicates > 0 ? `未处理疑似重复 ${unresolvedDuplicates} 条` : null
    ].filter(Boolean);
    const canGenerate = blockers.length === 0;
    return (
      <article className="panel confirm-panel" data-monthly-section="final">
        <div className="panel-header">
          <div>
            <p className="eyebrow">06</p>
            <h2>总确认</h2>
          </div>
          <button
            className="primary-button compact"
            disabled={!canGenerate || generatingAnalysis}
            onClick={() => {
              setGeneratingAnalysis(true);
              setAnalysisGenerated(false);
              setMonthlyMessage("正在生成本月分析...");
              invoke<MonthlyStepStatus>("generate_monthly_analysis", { periodMonth: selectedMonth })
                .then(async (status) => {
                  applyMonthlyStatus(status);
                  const publishedSummary = await invoke<DashboardSeedSummary>("get_dashboard_seed_summary");
                  setSummary(publishedSummary);
                  setAnalysisGenerated(true);
                  setSuccessBanner("本月月报已生成。月底更新数据已发布到财务健康看板库。");
                  setMonthlyMessage(null);
                  setActiveHealthSection("总览");
                  setView("healthDashboard");
                  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                })
                .catch((err) => {
                  setAnalysisGenerated(false);
                  setMonthlyMessage(String(err));
                })
                .finally(() => setGeneratingAnalysis(false));
            }}
            type="button"
          >
            {generatingAnalysis ? "正在生成..." : "生成本月分析"}
          </button>
        </div>
        <div className="final-grid">
          {finalMetrics.map((metric) => (
            <div className="formula-metric" data-formula={metric.formula} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        {!canGenerate ? (
          <div className="blocker-list">
            <strong>暂不能生成月报</strong>
            {blockers.map((blocker) => (
              <button
                className="link-button"
                key={blocker}
                onClick={() => {
                  if (String(blocker).includes("收入")) locateRow((incomeReview?.rows ?? [])[0]);
                  if (String(blocker).includes("支出")) locateRow((expenseReview?.rows ?? [])[0]);
                  if (String(blocker).includes("资产")) scrollToSelector(".asset-table");
                  if (String(blocker).includes("信用卡")) scrollToSelector(".credit-card-list");
                }}
                type="button"
              >
                {blocker}
              </button>
            ))}
          </div>
        ) : null}
        {analysisGenerated ? <p className="form-message">本月分析已生成。</p> : null}
      </article>
    );
  };

  const renderHealthDashboard = () => {
    const savingGap = summary.saving_amount - summary.target_saving_amount;
    const spendUsage = summary.confirmed_income > 0 ? summary.confirmed_expense / summary.confirmed_income : 0;
    const activeModuleMeta: Record<HealthSection, { eyebrow: string; title: string; text: string }> = {
      总览: { eyebrow: "Overview", title: "今年核心状态", text: "净资产、可支配金额、储蓄质量和资金加权收益放在同一屏。" },
      收支储蓄: { eyebrow: "Cashflow", title: "收支与储蓄", text: "看收入支出缺口、储蓄率、目标达成和异常波动。" },
      支出结构: { eyebrow: "Spending", title: "支出结构", text: "看分类占比、环比变化和异常支出。" },
	      资产配置: { eyebrow: "Allocation", title: "资产配置", text: "看配置结构演变和当前资产比例；目标偏离、细分配比放在自定义项。" },
      投资表现: { eyebrow: "Performance", title: "投资表现", text: "看非现金资产组收益率、收益金额和资金加权收益。" },
      月报: { eyebrow: "Report", title: "月报", text: "生成本月总结、变化原因和下月提醒。" }
    };
    const module = activeModuleMeta[activeHealthSection];
    const allTrends = [...summary.monthly_trends].sort((a, b) => a.period_month.localeCompare(b.period_month));
    const trendMonths = new Set(dashboardTrends.map((item) => item.period_month));
    const rangeLabel = dashboardTrends.length > 0
      ? `${dashboardTrends[0].period_month} - ${dashboardTrends[dashboardTrends.length - 1].period_month}`
      : summary.snapshot_month;
    const previousTrend = allTrends.find((item, index) => allTrends[index + 1]?.period_month === summary.snapshot_month);
    const netWorthChange = previousTrend ? summary.net_worth - previousTrend.net_worth : 0;
    const maxTrendValue = Math.max(
      ...dashboardTrends.flatMap((item) => [item.income, item.expense, Math.abs(item.saving_amount), item.net_worth]),
      1
    );
    const hasInvestmentGroupData = (item: InvestmentGroupPerformance) =>
      item.group_name !== "现金" &&
      (
        Math.abs(item.ending_value) > 0.000_001 ||
        Math.abs(item.gain) > 0.000_001 ||
        Math.abs(item.buy) > 0.000_001 ||
        Math.abs(item.sell) > 0.000_001 ||
        Math.abs(item.dividend) > 0.000_001 ||
        (item.return_rate !== null && item.return_rate !== undefined)
      );
    const investmentGroupRows = summary.investment_group_performances.filter(hasInvestmentGroupData);
    const investmentGain = investmentGroupRows.reduce((sum, item) => sum + item.gain, 0);
    const monthlyXirr = dashboardTrends.find((item) => item.period_month === summary.snapshot_month)?.monthly_xirr ?? null;
    const xirrToPeriodReturn = (rate: number | null | undefined, periodMonth: string) => {
      if (rate === null || rate === undefined || rate <= -0.999_999) return null;
      return Math.pow(1 + rate, daysInMonth(periodMonth) / 365) - 1;
    };
    const monthlyXirrPeriodReturn = xirrToPeriodReturn(monthlyXirr, summary.snapshot_month);
    const xirrDetail = monthlyXirr === null || monthlyXirr === undefined
      ? "资金加权收益待计算"
      : `按现金流日期折算本月 ${monthlyXirrPeriodReturn === null ? "待计算" : formatPercent(monthlyXirrPeriodReturn)}`;
    const ytdIncome = dashboardTrends.reduce((sum, item) => sum + item.income, 0);
    const ytdExpense = dashboardTrends.reduce((sum, item) => sum + item.expense, 0);
    const ytdSaving = ytdIncome - ytdExpense;
    const latestDiscretionaryAmount = [...summary.discretionary_trends].reverse().find((item) => item.period_month === summary.snapshot_month)?.amount ?? 0;
    const discretionaryScopeLabel = dashboardCustomSettings.discretionary_category_ids
      .map((id) => assetCategoryPathLabel(assetCategoryTree, id))
      .filter(Boolean)
      .slice(0, 3)
      .join("、");
    const returnGroupOrder = ["全球资产", "红利低波", "债券", "黄金", "A股权益", "其他"];
    const investmentTrendGroupNames = new Set(
      summary.investment_group_trends
        .filter((item) => hasInvestmentGroupData(item))
        .map((item) => item.group_name)
    );
    const availableReturnGroups = returnGroupOrder.filter((group) =>
      investmentTrendGroupNames.has(group) || investmentGroupRows.some((item) => item.group_name === group)
    );
    const expenseRowsForRange = dashboardRange === "本月" ? summary.expense_categories : summary.expense_year_rank;
    const expenseScopeLabel = dashboardRange === "本月" ? "本月" : `${rangeLabel} 累计`;
    const expenseTotalForRange = expenseRowsForRange.reduce((sum, item) => sum + item.amount, 0);
	    const topExpenseCategory = expenseRowsForRange[0];
	    const topExpensePercent = expenseTotalForRange > 0 && topExpenseCategory ? topExpenseCategory.amount / expenseTotalForRange : 0;
		    const categoryCount = expenseRowsForRange.filter((item) => item.amount > 0).length;
		    const allocationTargetGroups = summary.allocation_target_groups ?? [];
		    const customAllocationDetailLabel = assetCategoryPathLabel(assetCategoryTree, dashboardCustomSettings.allocation_detail_parent_id);
		    const hasMainAllocationTargets =
	      summary.portfolio_targets.length > 0 ||
	      summary.asset_allocations.some((item) => item.target_percent !== null && item.target_percent !== undefined);
	    const majorAllocationDeviationCount =
	      summary.portfolio_targets.filter((item) => Math.abs(item.deviation_percent) >= 0.05).length +
	      allocationTargetGroups.reduce(
        (sum, group) => sum + group.rows.filter((item) => item.target_percent !== null && item.target_percent !== undefined && Math.abs(item.deviation_percent ?? 0) >= 0.05).length,
        0
      );
    const negativeGroupRows = investmentGroupRows.filter((item) => item.gain < 0);
    const alerts = [
      summary.confirmed_income === 0 ? "收入为 0：请检查收入确认表。" : "",
      summary.confirmed_income > 0 && summary.saving_rate < summary.target_saving_rate ? "储蓄率低于目标。" : "",
      savingGap < 0 ? `本月储蓄少于目标 ${formatCurrency(Math.abs(savingGap), privacyMode)}。` : "",
      netWorthChange < 0 ? "调整信用卡后净资产环比下降。" : "",
      investmentGain < 0 ? "本月非现金投资收益为负。" : "",
      negativeGroupRows.length > 0 ? `亏损资产组：${negativeGroupRows.map((item) => item.group_name).join("、")}。` : "",
      majorAllocationDeviationCount > 0 ? `资产配置有 ${majorAllocationDeviationCount} 项偏离超过 5%。` : "",
      summary.spending_anomalies.length > 0 ? `有 ${summary.spending_anomalies.length} 笔大额异常支出。` : "",
      monthlyXirr === null || monthlyXirr === undefined ? "本月 XIRR 暂无法计算，请检查现金流是否完整。" : "",
      allTrends.length >= 4 && summary.confirmed_expense > allTrends.slice(-4, -1).reduce((sum, item) => sum + item.expense, 0) / 3
        ? "支出高于近 3 月均值。"
        : "",
      allTrends.length >= 4 && summary.confirmed_income < allTrends.slice(-4, -1).reduce((sum, item) => sum + item.income, 0) / 3
        ? "收入低于近 3 月均值。"
        : ""
    ].filter(Boolean);
    const chartColors = themePalettes[dashboardTheme];
    const chartCurrency = (value: number) => {
      if (privacyMode) return "••••";
      const sign = value < 0 ? "-" : "";
      const amount = Math.abs(value);
      const formatted = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(amount);
      return `${sign}${formatted}`;
    };
    const signedChartCurrency = (value: number) => `${value >= 0 ? "+" : ""}${chartCurrency(value)}`;
    const xPoint = (index: number, total: number, left = 54, right = 24, width = 720) => {
      if (total <= 1) return width / 2;
      return left + ((width - left - right) * index) / (total - 1);
    };
    const linePath = (points: { x: number; y: number }[]) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const tooltipPosition = (event: MouseEvent<Element>) => ({
      x: Math.min(event.clientX + 14, Math.max(window.innerWidth - 310, 24)),
      y: Math.min(event.clientY + 14, Math.max(window.innerHeight - 130, 24))
    });
    const showTooltip = (event: MouseEvent<Element>, title: string, body: string, pinned = false) => {
      const position = tooltipPosition(event);
      setDashboardTooltip({ ...position, title, body, pinned });
      setDashboardDetail(`${title}｜${body}`);
    };
    const moveTooltip = (event: MouseEvent<Element>) => {
      setDashboardTooltip((current) => {
        if (!current || current.pinned) return current;
        return { ...current, ...tooltipPosition(event) };
      });
    };
    const hideTooltip = () => {
      setDashboardTooltip((current) => (current?.pinned ? current : null));
    };
    const tooltipEvents = (title: string, body: string, onClick?: () => void) => ({
      onMouseEnter: (event: MouseEvent<Element>) => showTooltip(event, title, body),
      onMouseMove: moveTooltip,
      onMouseLeave: hideTooltip,
      onClick: (event: MouseEvent<Element>) => {
        onClick?.();
        showTooltip(event, title, body, true);
      }
	    });
		    const dashboardItemEnabled = (id: string) =>
		      enabledDashboardItemSet.has(id) && (!isTargetDependentDashboardItem(id) || hasMainAllocationTargets);
	    const customDashboardItemEnabledInSection = (id: string, section: HealthSection = activeHealthSection) =>
	      dashboardItemEnabled(id) && customItemSection(id) === section;
	    const renderChartCard = (title: string, subtitle: string, children: ReactNode, className = "") => (
      <article className={`dashboard-visual-card ${className}`}>
        <div className="visual-card-header">
          <div>
            <h3>{title}</h3>
            <span>{subtitle}</span>
          </div>
        </div>
        {children}
      </article>
    );
    const renderChartLegend = (items: { label: string; color: string; detail?: string }[]) => (
      <div className="chart-legend">
        {items.map((item) => (
          <button key={item.label} type="button" {...tooltipEvents(item.label, item.detail ?? item.label)}>
            <i style={{ background: item.color }} />
            {item.label}
          </button>
        ))}
      </div>
    );
    const renderHorizontalGrid = (
      width: number,
      height: number,
      top: number,
      bottom: number,
      labelFor?: (ratio: number) => string,
      left = 44,
      right = 24
    ) => (
      <>
        {Array.from({ length: 5 }, (_, tick) => {
          const ratio = tick / 4;
          const y = top + (height - top - bottom) * ratio;
          return (
            <g key={`grid-${width}-${height}-${tick}`}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid-line" />
              {labelFor ? (
                <text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                  {labelFor(ratio)}
                </text>
              ) : null}
            </g>
          );
        })}
      </>
    );
    const renderCashflowAreaChart = () => {
      const rows = dashboardTrends.filter((item) => item.income > 0 || item.expense > 0);
      if (rows.length === 0) return <div className="dashboard-empty-state compact">暂无数据：缺少收支趋势。</div>;
      const width = 720;
      const height = 260;
      const top = 26;
      const bottom = 48;
      const maxAmount = Math.max(...rows.flatMap((item) => [item.income, item.expense, Math.abs(item.saving_amount)]), 1);
      const maxRate = Math.max(summary.target_saving_rate, ...rows.map((item) => Math.max(item.saving_rate, 0)), 1);
      const yAmount = (value: number) => top + (height - top - bottom) * (1 - value / maxAmount);
      const yRate = (value: number) => top + (height - top - bottom) * (1 - Math.max(Math.min(value / maxRate, 1), 0));
      const incomePoints = rows.map((item, index) => ({ x: xPoint(index, rows.length), y: yAmount(item.income) }));
      const expensePoints = rows.map((item, index) => ({ x: xPoint(index, rows.length), y: yAmount(item.expense) }));
      const savingRatePoints = rows.map((item, index) => ({ x: xPoint(index, rows.length), y: yRate(item.saving_rate) }));
      const targetRatePoints = rows.map((item, index) => ({ x: xPoint(index, rows.length), y: yRate(summary.target_saving_rate) }));
      const areaPath = `${linePath(incomePoints)} ${expensePoints.slice().reverse().map((point) => `L ${point.x} ${point.y}`).join(" ")} Z`;
      return renderChartCard(
        "收入 / 支出 / 储蓄缺口",
        "面积色差是储蓄空间；圆点和悬浮显示具体金额。",
        <>
          <svg className="dashboard-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="收入支出面积图">
            {renderHorizontalGrid(width, height, top, bottom, (ratio) => chartCurrency(maxAmount * (1 - ratio)))}
            <path d={areaPath} fill="rgba(91, 143, 123, 0.18)" stroke="none">
              <title>收入和支出之间的面积代表储蓄空间</title>
            </path>
            <path className="chart-line primary" d={linePath(incomePoints)} />
            <path className="chart-line muted" d={linePath(expensePoints)} />
            <path className="chart-line accent" d={linePath(savingRatePoints)} />
            <path className="chart-line target" d={linePath(targetRatePoints)} />
            {rows.map((item, index) => {
              const x = xPoint(index, rows.length);
              return (
                <g key={`cashflow-${item.period_month}`}>
                  <circle
                    cx={x}
                    cy={yAmount(item.income)}
                    r="4.5"
                    className="chart-dot primary"
                    {...tooltipEvents(`${item.period_month} 收入`, formatCurrency(item.income, privacyMode))}
                  >
                    <title>{`${item.period_month} 收入 ${formatCurrency(item.income, privacyMode)}`}</title>
                  </circle>
                  <circle
                    cx={x}
                    cy={yAmount(item.expense)}
                    r="4.5"
                    className="chart-dot muted"
                    {...tooltipEvents(`${item.period_month} 支出`, formatCurrency(item.expense, privacyMode))}
                  >
                    <title>{`${item.period_month} 支出 ${formatCurrency(item.expense, privacyMode)}`}</title>
                  </circle>
                  <circle
                    cx={x}
                    cy={yRate(item.saving_rate)}
                    r="4"
                    className="chart-dot accent"
                    {...tooltipEvents(`${item.period_month} 储蓄率`, `${formatPercent(item.saving_rate)}，储蓄 ${formatCurrency(item.saving_amount, privacyMode)}`)}
                  >
                    <title>{`${item.period_month} 储蓄率 ${formatPercent(item.saving_rate)}`}</title>
                  </circle>
                  <text x={x} y={height - 18} textAnchor="middle" className="chart-axis-label">{item.period_month.slice(5)}</text>
                  <text x={x} y={Math.min(yAmount(item.income), yAmount(item.expense)) - 8} textAnchor="middle" className="chart-data-label saving-gap-label">{chartCurrency(item.saving_amount)}</text>
                </g>
              );
            })}
          </svg>
          {renderChartLegend([
            { label: "收入", color: "var(--dash-ink)" },
            { label: "支出", color: "var(--dash-blue)" },
            { label: "储蓄率", color: "var(--dash-accent)" },
            { label: "目标储蓄率", color: "var(--dash-accent-2)", detail: `目标 ${formatPercent(summary.target_saving_rate)}，对应虚线` }
          ])}
        </>,
        "wide"
      );
    };
    const renderSavingTargetChart = () => {
      const rows = dashboardTrends.filter((item) => item.income > 0 || item.expense > 0);
      if (rows.length === 0) return <div className="dashboard-empty-state compact">暂无数据：缺少储蓄趋势。</div>;
      const width = 720;
      const height = 230;
      const top = 26;
      const bottom = 44;
      const maxAmount = Math.max(...rows.flatMap((item) => [Math.abs(item.saving_amount), item.income * summary.target_saving_rate]), 1);
      const zeroY = top + (height - top - bottom) * 0.72;
      const yAmount = (value: number) => {
        const scaled = (Math.abs(value) / maxAmount) * 102;
        return value >= 0 ? zeroY - scaled : zeroY;
      };
      const yGap = (value: number) => Math.max(top, Math.min(height - bottom, zeroY - (value / maxAmount) * 102));
      const gapPoints = rows.map((item, index) => {
        const target = item.income * summary.target_saving_rate;
        return { x: xPoint(index, rows.length), y: yGap(item.saving_amount - target), gap: item.saving_amount - target, month: item.period_month };
      });
      const barWidth = Math.max(Math.min((width - 96) / Math.max(rows.length * 2.5, 1), 28), 12);
      return renderChartCard(
        "储蓄目标达成",
        "柱是实际和目标，线是距离目标还差/超额。",
        <>
          <svg className="dashboard-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="储蓄目标达成图">
            {renderHorizontalGrid(width, height, top, bottom)}
            <line x1="44" x2={width - 24} y1={zeroY} y2={zeroY} className="chart-zero-line" />
            {rows.map((item, index) => {
              const target = item.income * summary.target_saving_rate;
              const x = xPoint(index, rows.length);
              const actualHeight = Math.max((Math.abs(item.saving_amount) / maxAmount) * 102, 4);
              const targetHeight = Math.max((Math.abs(target) / maxAmount) * 102, 4);
              return (
                <g key={`saving-target-${item.period_month}`}>
                  <rect
                    x={x - barWidth - 2}
                    y={yAmount(item.saving_amount)}
                    width={barWidth}
                    height={actualHeight}
                    rx="4"
                    className="chart-bar saving-actual"
                    {...tooltipEvents(`${item.period_month} 实际储蓄`, `${formatCurrency(item.saving_amount, privacyMode)}｜目标 ${formatCurrency(target, privacyMode)}`)}
                  />
                  <rect
                    x={x + 2}
                    y={yAmount(target)}
                    width={barWidth}
                    height={targetHeight}
                    rx="4"
                    className="chart-bar saving-target"
                    {...tooltipEvents(`${item.period_month} 目标储蓄`, formatCurrency(target, privacyMode))}
                  />
                  <text x={x} y={height - 14} textAnchor="middle" className="chart-axis-label">{item.period_month.slice(5)}</text>
                </g>
              );
            })}
            {gapPoints.length > 1 ? <path className="chart-line accent" d={linePath(gapPoints)} /> : null}
            {gapPoints.map((item) => (
              <g key={`saving-gap-${item.month}`}>
                <circle
                  cx={item.x}
                  cy={item.y}
                  r="4"
                  className="chart-dot accent"
                  {...tooltipEvents(`${item.month} 储蓄差额`, `${item.gap >= 0 ? "超目标" : "差目标"} ${formatCurrency(Math.abs(item.gap), privacyMode)}`)}
                />
                <text x={item.x} y={item.y - 8} textAnchor="middle" className={`chart-data-label tiny ${item.gap >= 0 ? "positive" : "negative"}`}>
                  {item.gap >= 0 ? "+" : "-"}{chartCurrency(Math.abs(item.gap))}
                </text>
              </g>
            ))}
          </svg>
          {renderChartLegend([
            { label: "实际储蓄", color: "#6f927f", detail: `本月 ${formatCurrency(summary.saving_amount, privacyMode)}` },
            { label: "目标储蓄", color: "#9cacbf", detail: `本月 ${formatCurrency(summary.target_saving_amount, privacyMode)}` },
            { label: "目标差额", color: "#b9975b", detail: `本月 ${savingGap >= 0 ? "超目标" : "差目标"} ${formatCurrency(Math.abs(savingGap), privacyMode)}` }
          ])}
        </>,
        "wide"
      );
    };
    const renderNetWorthCompositeChart = () => {
      const rows = dashboardTrends.filter((item) => item.asset_gross_value > 0 || item.net_worth > 0);
      if (rows.length === 0) return <div className="dashboard-empty-state compact">暂无数据：缺少资产快照。</div>;
      const width = 720;
      const height = 270;
      const top = 24;
      const bottom = 46;
      const maxAmount = Math.max(...rows.map((item) => item.net_worth), 1);
      const growthRows = rows.map((item, index) => {
        const previous = allTrends.find((trend, trendIndex) => allTrends[trendIndex + 1]?.period_month === item.period_month)?.net_worth ?? 0;
        return {
          ...item,
          growthRate: Math.abs(previous) < 0.000_001 ? null : (item.net_worth - previous) / Math.abs(previous)
        };
      });
      const maxGrowth = Math.max(...growthRows.map((item) => Math.abs(item.growthRate ?? 0)), 0.01);
      const yAmount = (value: number) => top + (height - top - bottom) * (1 - value / maxAmount);
      const yGrowth = (value: number) => top + (height - top - bottom) * (1 - ((value / maxGrowth) + 1) / 2);
      const barWidth = Math.max(Math.min((width - 96) / Math.max(rows.length * 1.7, 1), 34), 14);
      const growthPoints = growthRows.flatMap((item, index) => (
        item.growthRate === null ? [] : [{ x: xPoint(index, rows.length), y: yGrowth(item.growthRate) }]
      ));
      return renderChartCard(
        "净资产规模 / 增长率",
        "柱是扣除信用卡后的净资产，线是环比增长率。",
        <>
          <svg className="dashboard-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="净资产规模和增长率复合图">
            {renderHorizontalGrid(width, height, top, bottom, (ratio) => chartCurrency(maxAmount * (1 - ratio)))}
            {growthRows.map((item, index) => {
              const x = xPoint(index, rows.length) - barWidth / 2;
              const y = yAmount(item.net_worth);
              const barHeight = Math.max(height - bottom - y, 4);
              const showAmountLabel = rows.length <= 8 || index === 0 || index === rows.length - 1;
              return (
                <g key={`net-bar-${item.period_month}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="5"
                    className="chart-bar neutral"
                    {...tooltipEvents(`${item.period_month} 净资产`, `${formatCurrency(item.net_worth, privacyMode)}｜增长率 ${item.growthRate === null ? "无上月基准" : formatPercent(item.growthRate)}`)}
                  >
                    <title>{`${item.period_month} 净资产 ${formatCurrency(item.net_worth, privacyMode)}`}</title>
                  </rect>
                  {showAmountLabel ? (
                    <text x={x + barWidth / 2} y={Math.min(y + 16, height - bottom - 6)} textAnchor="middle" className="chart-data-label tiny on-bar">
                      {chartCurrency(item.net_worth)}
                    </text>
                  ) : null}
                  <text x={x + barWidth / 2} y={height - 16} textAnchor="middle" className="chart-axis-label">{item.period_month.slice(5)}</text>
                </g>
              );
            })}
            {growthPoints.length > 1 ? <path className="chart-line accent" d={linePath(growthPoints)} /> : null}
            {growthRows.map((item, index) => {
              if (item.growthRate === null) return null;
              const x = xPoint(index, rows.length);
              const y = yGrowth(item.growthRate);
              const labelY = item.growthRate >= 0 ? y - 12 : y + 17;
              return (
                <g key={`net-growth-${item.period_month}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4.5"
                    className="chart-dot accent"
                    {...tooltipEvents(`${item.period_month} 净资产增长率`, `${formatPercent(item.growthRate)}｜净资产 ${formatCurrency(item.net_worth, privacyMode)}`)}
                  />
                  <text x={x} y={labelY} textAnchor="middle" className={`chart-data-label tiny ${item.growthRate >= 0 ? "positive" : "negative"}`}>
                    {item.growthRate >= 0 ? "+" : ""}{formatPercent(item.growthRate)}
                  </text>
                </g>
              );
            })}
          </svg>
          {renderChartLegend([
            { label: "净资产", color: "#16231f", detail: `最新 ${formatCurrency(summary.net_worth, privacyMode)}` },
            { label: "增长率", color: "#b9975b", detail: `最新 ${growthRows[growthRows.length - 1]?.growthRate === null ? "无上月基准" : formatPercent(growthRows[growthRows.length - 1]?.growthRate ?? 0)}` }
          ])}
        </>,
        "wide"
      );
    };
    const compactBreakdownRows = (rows: { category: string; amount: number; percent: number }[], limit = 6) => {
      const positiveRows = rows.filter((item) => Math.abs(item.amount) > 0.000_001 && item.percent > 0);
      if (positiveRows.length <= limit) return positiveRows;
      const head = positiveRows.slice(0, limit - 1);
      const rest = positiveRows.slice(limit - 1);
      const otherAmount = rest.reduce((sum, item) => sum + item.amount, 0);
      const otherPercent = rest.reduce((sum, item) => sum + item.percent, 0);
      return [...head, { category: "其他", amount: otherAmount, percent: otherPercent }];
    };
    const renderDonutChart = (rows: { category: string; amount: number; percent: number }[], title: string, subtitle: string) => {
      const chartRows = compactBreakdownRows(rows);
      if (chartRows.length === 0) return renderChartCard(title, subtitle, <div className="dashboard-empty-state compact">暂无数据。</div>);
      let cursor = 0;
      const segments = chartRows.map((item, index) => {
        const start = cursor;
        const end = cursor + item.percent * 100;
        cursor = end;
        const middle = (start + end) / 2;
        const angle = middle * 3.6 - 90;
        const radians = (angle * Math.PI) / 180;
        const labelRadius = item.percent >= 0.07 ? 38 : 55;
        return {
          ...item,
          color: chartColors[index % chartColors.length],
          start,
          end,
          labelX: 50 + Math.cos(radians) * labelRadius,
          labelY: 50 + Math.sin(radians) * labelRadius,
          labelOutside: item.percent < 0.07
        };
      });
      const gradient = segments.map((item) => `${item.color} ${item.start}% ${item.end}%`).join(", ");
      return renderChartCard(
        title,
        subtitle,
        <div className="donut-layout">
          <div className="donut-visual">
            <div
              className="donut-chart"
              style={{ background: `conic-gradient(${gradient})` }}
              {...tooltipEvents(title, segments.map((item) => `${item.category} ${formatPercent(item.percent)}`).join(" / "))}
            >
              <span>占比</span>
              <div className="donut-slice-labels" aria-hidden="true">
                {segments.map((item) => (
                  <em
                    className={item.labelOutside ? "outside" : ""}
                    key={`${title}-${item.category}-slice-label`}
                    style={{
                      left: `${item.labelX}%`,
                      top: `${item.labelY}%`,
                      borderColor: item.color
                    }}
                  >
                    <b>{item.category}</b>
                    <small>{formatPercent(item.percent)}</small>
                  </em>
                ))}
              </div>
            </div>
          </div>
          <div className="donut-legend" aria-label={`${title} 图例`}>
            {segments.map((item) => (
              <button
                key={`${title}-${item.category}-legend`}
                type="button"
                {...tooltipEvents(item.category, `${formatCurrency(item.amount, privacyMode)}｜${formatPercent(item.percent)}`)}
              >
                <i style={{ background: item.color }} />
                <span>{item.category}</span>
                <strong>{formatPercent(item.percent)}</strong>
                <small>{formatCurrency(item.amount, privacyMode)}</small>
              </button>
            ))}
          </div>
        </div>
      );
    };
    const renderStackedAllocationChart = () => {
      const rows = summary.asset_allocation_trends.filter((item) => trendMonths.has(item.period_month));
      const fallbackRows = summary.asset_allocations.map((item) => ({ period_month: summary.snapshot_month, category: item.category, amount: item.amount, percent: item.percent }));
      const chartRows = rows.length > 0 ? rows : fallbackRows;
      const months = Array.from(new Set(chartRows.map((item) => item.period_month))).sort();
      const categories = Array.from(new Set(chartRows.map((item) => item.category)));
      const latestMonth = months[months.length - 1] ?? summary.snapshot_month;
      if (chartRows.length === 0) return <div className="dashboard-empty-state compact">暂无数据：缺少资产配置趋势。</div>;
      return renderChartCard(
        "资产配置轨迹",
        "按月展示各资产类别在组合中的权重变化。",
        <>
          <div className="stacked-chart">
            {months.map((month) => {
              const monthRows = categories.map((category) => chartRows.find((item) => item.period_month === month && item.category === category) ?? { period_month: month, category, amount: 0, percent: 0 });
              return (
                <div className="stacked-column" key={month}>
                  <div className="stacked-bar" aria-label={`${month} 资产配置`}>
                    {monthRows.map((item, index) => (
                      <button
                        key={`${month}-${item.category}`}
                        style={{ height: `${Math.max(item.percent * 100, item.amount > 0 ? 2 : 0)}%`, background: chartColors[index % chartColors.length] }}
                        type="button"
                        {...tooltipEvents(`${month} ${item.category}`, `${formatCurrency(item.amount, privacyMode)}｜${formatPercent(item.percent)}`)}
                      >
                        {item.percent >= 0.12 ? <strong>{formatPercent(item.percent)}</strong> : null}
                      </button>
                    ))}
                  </div>
                  <span>{month.slice(5)}</span>
                </div>
              );
            })}
          </div>
          {renderChartLegend(categories.map((category, index) => {
            const item = chartRows.find((row) => row.period_month === latestMonth && row.category === category);
            return {
              label: category,
              color: chartColors[index % chartColors.length],
              detail: `${latestMonth}｜${formatCurrency(item?.amount ?? 0, privacyMode)}｜${formatPercent(item?.percent ?? 0)}`
            };
          }))}
        </>,
        "wide"
      );
    };
	    const renderDiscretionaryChart = () => {
	      const rows = summary.discretionary_trends.filter((item) => trendMonths.has(item.period_month));
	      if (rows.length === 0) return <div className="dashboard-empty-state compact">暂无数据：缺少可支配资产快照。</div>;
      const width = 720;
      const height = 220;
      const top = 24;
      const bottom = 42;
      const maxAmount = Math.max(...rows.map((item) => item.amount), 1);
      const yAmount = (value: number) => top + (height - top - bottom) * (1 - value / maxAmount);
      const points = rows.map((item, index) => ({ x: xPoint(index, rows.length), y: yAmount(item.amount) }));
      const areaPath = `${linePath(points)} L ${xPoint(rows.length - 1, rows.length)} ${height - bottom} L ${xPoint(0, rows.length)} ${height - bottom} Z`;
	      return renderChartCard(
	        "可支配金额趋势",
	        discretionaryScopeLabel ? `按自定义范围：${discretionaryScopeLabel}` : "按自定义范围计算。",
	        <svg className="dashboard-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="可支配金额趋势">
          {renderHorizontalGrid(width, height, top, bottom, (ratio) => chartCurrency(maxAmount * (1 - ratio)))}
          <path d={areaPath} fill="rgba(91, 114, 137, 0.16)" />
          <path className="chart-line primary" d={linePath(points)} />
          {rows.map((item, index) => {
            const x = xPoint(index, rows.length);
            return (
              <g key={`discretionary-${item.period_month}`}>
                <circle
                  cx={x}
                  cy={yAmount(item.amount)}
                  r="4.5"
                  className="chart-dot primary"
                  {...tooltipEvents(`${item.period_month} 可支配金额`, formatCurrency(item.amount, privacyMode))}
                >
                  <title>{`${item.period_month} 可支配金额 ${formatCurrency(item.amount, privacyMode)}`}</title>
                </circle>
                <text x={x} y={yAmount(item.amount) - 9} textAnchor="middle" className="chart-data-label">{chartCurrency(item.amount)}</text>
                <text x={x} y={height - 16} textAnchor="middle" className="chart-axis-label">{item.period_month.slice(5)}</text>
              </g>
            );
          })}
        </svg>,
	        "wide"
	      );
	    };
	    const renderAllocationTargetGapList = () => (
	      <div className="allocation-list">
	        {(summary.asset_allocations.length ? summary.asset_allocations : summary.portfolio_targets).map((item) => {
	          const category = "category" in item ? item.category : "";
	          const amount = "amount" in item ? item.amount : item.current_amount;
	          const percent = "percent" in item ? item.percent : item.current_percent;
	          const target = "target_percent" in item ? item.target_percent : item.target_percent;
	          const deviation = "deviation_percent" in item ? item.deviation_percent : item.deviation_percent;
	          return (
	            <div className="allocation-row" key={category}>
	              <div className="allocation-label">
	                <strong>{category}</strong>
	                <span>{formatCurrency(amount, privacyMode)}</span>
	              </div>
	              <div className="allocation-bar" aria-label={`${category} 当前占比`}>
	                <div className="allocation-fill" style={{ width: `${Math.max(percent * 100, 2)}%` }} />
	              </div>
	              <div className="allocation-metrics">
	                <span>当前 {formatPercent(percent)}</span>
	                <span>目标 {target === null || target === undefined ? "暂无" : formatPercent(target)}</span>
	                <b className={(deviation ?? 0) >= 0 ? "positive" : "negative"}>
	                  {deviation === null || deviation === undefined ? "暂无偏离" : `${deviation >= 0 ? "+" : ""}${formatPercent(deviation)}`}
	                </b>
	              </div>
	            </div>
	          );
	        })}
	      </div>
	    );
		    const renderSubAllocationDetailGroups = () => (
		      <>
		        {allocationTargetGroups.length === 0 ? <div className="dashboard-empty-state compact">暂无下级目标配比。</div> : allocationTargetGroups.map((group) => (
	          <div className="dashboard-stack" key={`target-group-${group.parent_category_id}`}>
	            <h3 className="dashboard-subtitle">{group.parent_category}目标差距</h3>
	            <div className="allocation-list">
	              {group.rows.map((item) => {
	                const hasTarget = item.target_percent !== null && item.target_percent !== undefined;
	                const deviation = item.deviation_percent ?? 0;
	                return (
	                  <div className="allocation-row" key={`${group.parent_category_id}-${item.category}`}>
	                    <div className="allocation-label">
	                      <strong>{item.category}</strong>
	                      <span>{formatCurrency(item.amount, privacyMode)}</span>
	                    </div>
	                    <div className="allocation-bar" aria-label={`${group.parent_category} ${item.category} 当前占比`}>
	                      <div className="allocation-fill" style={{ width: `${Math.max(item.percent * 100, item.amount > 0 ? 2 : 0)}%` }} />
	                    </div>
	                    <div className="allocation-metrics">
	                      <span>当前 {formatPercent(item.percent)}</span>
	                      <span>目标 {hasTarget ? formatPercent(item.target_percent ?? 0) : "暂无"}</span>
	                      <b className={!hasTarget ? "" : deviation >= 0 ? "positive" : "negative"}>
	                        {!hasTarget ? "未设目标" : `${deviation >= 0 ? "+" : ""}${formatPercent(deviation)}`}
	                      </b>
	                    </div>
	                  </div>
	                );
	              })}
	            </div>
	          </div>
		        ))}
		      </>
		    );
		    const renderCustomAllocationDetailRatioChart = () =>
		      renderDonutChart(
		        summary.custom_allocation_detail_allocations ?? [],
		        `${customAllocationDetailLabel || "自定义分类"}下级资产配比`,
		        "只展示实际资产金额占比，不比较目标配置。"
		      );
		    const renderAssignedCustomPanels = (section: HealthSection) => {
	      const rows = section === "资产配置" ? [] : dashboardCustomItemDefinitions.filter((item) => customDashboardItemEnabledInSection(item.id, section));
	      if (rows.length === 0) return null;
	      return (
	        <div className="dashboard-stack custom-dashboard-panels">
	          <h3 className="dashboard-subtitle">自定义分析点</h3>
	          {rows.map((item) => {
	            if (item.id === "allocation_discretionary_amount") {
	              return (
	                <div className="dashboard-stack" key={item.id}>
	                  <div className="dashboard-split">
	                    <div>
	                      <span>{item.label}</span>
	                      <strong>{formatCurrency(latestDiscretionaryAmount, privacyMode)}</strong>
	                      <small>{discretionaryScopeLabel ? `按自定义范围：${discretionaryScopeLabel}` : "按自定义范围计算"}</small>
	                    </div>
	                  </div>
	                  {renderDiscretionaryChart()}
	                </div>
	              );
	            }
		            if (item.id === "allocation_target_deviation_value") {
		              return renderChartCard(
		                item.label,
		                hasMainAllocationTargets ? "显示当前比例、目标比例和偏离值。" : "暂无目标配比；请先设置目标资产配比。",
		                hasMainAllocationTargets ? renderAllocationTargetGapList() : <div className="dashboard-empty-state compact">暂无目标配比。</div>,
		                "wide"
		              );
	            }
		            if (item.id === "allocation_sub_detail_ratio") {
		              return renderCustomAllocationDetailRatioChart();
		            }
		            if (item.id === "allocation_sub_target_gap_chart") {
		              return renderChartCard(
		                item.label,
		                "按已填写的下级目标配比，展示实际比例和目标比例的差距。",
		                renderSubAllocationDetailGroups(),
		                "wide"
		              );
		            }
	            return null;
	          })}
		        </div>
	      );
	    };
	    const renderInvestmentGroupChart = () => {
      const sourceRows = summary.investment_group_trends.filter((item) => trendMonths.has(item.period_month) && item.group_name !== "现金");
      const fallbackRows = investmentGroupRows.map((item) => ({ ...item, period_month: summary.snapshot_month }));
      const rows = sourceRows.length > 0 ? sourceRows : fallbackRows;
      const months = Array.from(new Set(rows.map((item) => item.period_month))).sort();
      const groups = availableReturnGroups.filter((group) => rows.some((item) => item.group_name === group));
      if (rows.length === 0 || groups.length === 0) return <div className="dashboard-empty-state compact">暂无数据：缺少分组收益。</div>;
      const width = 720;
      const height = 270;
      const top = 30;
      const bottom = 48;
      const maxRate = Math.max(...rows.map((item) => Math.abs(item.return_rate ?? 0)), 0.01);
      const zeroY = top + (height - top - bottom) / 2;
      const monthWidth = (width - 72) / Math.max(months.length, 1);
      const barWidth = Math.max(Math.min(monthWidth / Math.max(groups.length + 1, 2), 18), 5);
      const rateTicks = [-1, -0.5, 0, 0.5, 1].map((ratio) => maxRate * ratio);
      const yRateTick = (rate: number) => zeroY - (rate / maxRate) * 86;
      return renderChartCard(
        "资产组月度收益率",
        "只展示有可计算收益率的月份；悬浮看收益金额和收益率。",
        <>
          <svg className="dashboard-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="资产组月度收益率柱状图">
            {rateTicks.map((rate) => (
              <g key={`group-rate-tick-${rate}`}>
                <line x1="44" x2={width - 24} y1={yRateTick(rate)} y2={yRateTick(rate)} className={Math.abs(rate) < 0.000_001 ? "chart-zero-line" : "chart-grid-line"} />
                <text x="38" y={yRateTick(rate) + 4} textAnchor="end" className="chart-axis-label">{formatPercent(rate)}</text>
              </g>
            ))}
            <line x1="44" x2={width - 24} y1={zeroY} y2={zeroY} className="chart-zero-line" />
            {months.map((month, monthIndex) => {
              const baseX = 46 + monthIndex * monthWidth + monthWidth / 2 - (groups.length * barWidth) / 2;
              return (
                <g key={`group-month-${month}`}>
                  {groups.map((group, groupIndex) => {
                    const item = rows.find((row) => row.period_month === month && row.group_name === group);
                    if (!item || item.return_rate === null || item.return_rate === undefined) {
                      return (
                        <rect
                          key={`${month}-${group}-empty`}
                          x={baseX + groupIndex * barWidth}
                          y={zeroY - 1}
                          width={barWidth - 2}
                          height="2"
                          rx="1"
                          fill="rgba(22, 35, 31, 0.12)"
                          {...tooltipEvents(`${month} ${group}`, "收益率待计算")}
                        />
                      );
                    }
                    const rate = item.return_rate;
                    const barHeight = Math.max((Math.abs(rate) / maxRate) * 86, 6);
                    const y = rate >= 0 ? zeroY - barHeight : zeroY;
                    return (
                      <g key={`${month}-${group}`}>
                        <rect
                          x={baseX + groupIndex * barWidth}
                          y={y}
                          width={barWidth - 2}
                          height={barHeight}
                          rx="3"
                          className={rate >= 0 ? "chart-bar positive" : "chart-bar negative"}
                          style={{ fill: chartColors[groupIndex % chartColors.length] }}
                          {...tooltipEvents(`${month} ${group}`, `收益率 ${formatPercent(rate)}｜收益 ${formatCurrency(item.gain, privacyMode)}`)}
                        >
                          <title>{`${month} ${group} 收益率 ${formatPercent(rate)}，收益 ${formatCurrency(item.gain, privacyMode)}`}</title>
                        </rect>
                        {months.length <= 6 ? (
                          <text x={baseX + groupIndex * barWidth + (barWidth - 2) / 2} y={rate >= 0 ? y - 6 : y + barHeight + 12} textAnchor="middle" className="chart-data-label tiny">
                            {formatPercent(rate)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                  <text x={46 + monthIndex * monthWidth + monthWidth / 2} y={height - 16} textAnchor="middle" className="chart-axis-label">{month.slice(5)}</text>
                </g>
              );
            })}
          </svg>
          {renderChartLegend(groups.map((group, index) => {
            const item = rows.find((row) => row.period_month === summary.snapshot_month && row.group_name === group) ?? rows.find((row) => row.group_name === group);
            return {
              label: group,
              color: chartColors[index % chartColors.length],
              detail: `收益 ${formatCurrency(item?.gain ?? 0, privacyMode)}｜收益率 ${item?.return_rate === null || item?.return_rate === undefined ? "待计算" : formatPercent(item.return_rate)}`
            };
          }))}
        </>,
        "wide"
      );
    };
    const renderReturnWheelChart = () => {
      if (availableReturnGroups.length === 0) {
        return renderChartCard("资产组回报透视", "只展示有持仓或现金流的资产组。", <div className="dashboard-empty-state compact">暂无数据：缺少资产组收益。</div>, "wide");
      }
      const group = availableReturnGroups.includes(selectedReturnGroup) ? selectedReturnGroup : availableReturnGroups[0];
      const rows = dashboardTrends.map((trend) => {
        const item = summary.investment_group_trends.find((row) => row.period_month === trend.period_month && row.group_name === group);
        return {
          period_month: trend.period_month,
          return_rate: item?.return_rate ?? null,
          gain: item?.gain ?? 0
        };
      });
      const width = 720;
      const height = 230;
      const top = 28;
      const bottom = 44;
      const maxRate = Math.max(...rows.map((item) => Math.abs(item.return_rate ?? 0)), 0.01);
      const zeroY = top + (height - top - bottom) / 2;
      const barWidth = Math.max(Math.min((width - 100) / Math.max(rows.length * 1.8, 1), 34), 14);
      const rateTicks = [-1, -0.5, 0, 0.5, 1].map((ratio) => maxRate * ratio);
      const yRateTick = (rate: number) => zeroY - (rate / maxRate) * 72;
      const nextGroup = (direction: 1 | -1) => {
        const index = availableReturnGroups.indexOf(group);
        const nextIndex = (index + direction + availableReturnGroups.length) % availableReturnGroups.length;
        setSelectedReturnGroup(availableReturnGroups[nextIndex]);
      };
      return renderChartCard(
        "资产组回报透视",
        "在图上滚动切换资产组；空位代表该月收益率待计算。",
        <div
          className="return-wheel"
          onWheel={(event) => {
            event.preventDefault();
            nextGroup(event.deltaY >= 0 ? 1 : -1);
          }}
        >
          <svg className="dashboard-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${group} 月度收益率`}>
            {rateTicks.map((rate) => (
              <g key={`wheel-rate-tick-${rate}`}>
                <line x1="44" x2={width - 24} y1={yRateTick(rate)} y2={yRateTick(rate)} className={Math.abs(rate) < 0.000_001 ? "chart-zero-line" : "chart-grid-line"} />
                <text x="38" y={yRateTick(rate) + 4} textAnchor="end" className="chart-axis-label">{formatPercent(rate)}</text>
              </g>
            ))}
            <line x1="44" x2={width - 24} y1={zeroY} y2={zeroY} className="chart-zero-line" />
            {rows.map((item, index) => {
              const x = xPoint(index, rows.length) - barWidth / 2;
              if (item.return_rate === null || item.return_rate === undefined) {
                return (
                  <g key={`return-wheel-empty-${item.period_month}`}>
                    <rect
                      x={x}
                      y={zeroY - 1}
                      width={barWidth}
                      height="2"
                      rx="1"
                      fill="rgba(22, 35, 31, 0.12)"
                      {...tooltipEvents(`${item.period_month} ${group}`, "收益率待计算")}
                    />
                    <text x={x + barWidth / 2} y={height - 14} textAnchor="middle" className="chart-axis-label">{item.period_month.slice(5)}</text>
                  </g>
                );
              }
              const barHeight = Math.max((Math.abs(item.return_rate) / maxRate) * 72, 6);
              const y = item.return_rate >= 0 ? zeroY - barHeight : zeroY;
              return (
                <g key={`return-wheel-${item.period_month}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="5"
                    className={item.return_rate >= 0 ? "chart-bar positive" : "chart-bar negative"}
                    {...tooltipEvents(`${item.period_month} ${group}`, `收益率 ${formatPercent(item.return_rate)}｜收益 ${formatCurrency(item.gain, privacyMode)}`)}
                  />
                  <text x={x + barWidth / 2} y={item.return_rate >= 0 ? y - 7 : y + barHeight + 13} textAnchor="middle" className="chart-data-label tiny">
                    {formatPercent(item.return_rate)}
                  </text>
                  <text x={x + barWidth / 2} y={height - 14} textAnchor="middle" className="chart-axis-label">{item.period_month.slice(5)}</text>
                </g>
              );
            })}
          </svg>
          <div className="return-switcher">
            {availableReturnGroups.map((item) => (
              <button
                className={item === group ? "active" : ""}
                key={item}
                onClick={() => setSelectedReturnGroup(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>,
        "wide"
      );
    };
    const renderInvestmentMonthlyChart = () => {
      const rows = dashboardTrends.filter((item) => item.asset_gross_value > 0);
      if (rows.length === 0) return <div className="dashboard-empty-state compact">暂无数据：缺少投资月度趋势。</div>;
      const width = 720;
      const height = 250;
      const top = 30;
      const bottom = 48;
      const maxGain = Math.max(...rows.map((item) => Math.abs(item.investment_gain)), 1);
      const rowsWithPeriodReturn = rows.map((item) => ({
        ...item,
        xirrPeriodReturn: xirrToPeriodReturn(item.monthly_xirr, item.period_month)
      }));
      const maxRate = Math.max(...rowsWithPeriodReturn.map((item) => Math.abs(item.xirrPeriodReturn ?? 0)), 0.01);
      const zeroY = top + (height - top - bottom) / 2;
      const yGain = (value: number) => {
        const heightScale = (Math.abs(value) / maxGain) * 78;
        return value >= 0 ? zeroY - heightScale : zeroY;
      };
      const yRate = (value: number) => top + (height - top - bottom) * (1 - ((value / maxRate) + 1) / 2);
      const barWidth = Math.max(Math.min((width - 100) / Math.max(rows.length * 2, 1), 34), 14);
      const ratePoints = rowsWithPeriodReturn.flatMap((item, index) => (
        item.xirrPeriodReturn === null || item.xirrPeriodReturn === undefined ? [] : [{ x: xPoint(index, rows.length), y: yRate(item.xirrPeriodReturn) }]
      ));
      return renderChartCard(
        "月度收益 / 资金加权收益率",
        "柱是非现金投资收益；线是按每笔现金流日期计算后折算到当月的收益率。",
        <>
          <svg className="dashboard-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="历史月度收益与 XIRR 图">
            {renderHorizontalGrid(width, height, top, bottom)}
            <line x1="44" x2={width - 24} y1={zeroY} y2={zeroY} className="chart-zero-line" />
            {rowsWithPeriodReturn.map((item, index) => {
              const x = xPoint(index, rows.length) - barWidth / 2;
              const barHeight = Math.max((Math.abs(item.investment_gain) / maxGain) * 78, item.investment_gain === 0 ? 2 : 6);
              return (
                <g key={`monthly-investment-${item.period_month}`}>
                  <rect
                    x={x}
                    y={yGain(item.investment_gain)}
                    width={barWidth}
                    height={barHeight}
                    rx="5"
                    className={item.investment_gain >= 0 ? "chart-bar positive" : "chart-bar negative"}
                    {...tooltipEvents(`${item.period_month} 投资收益`, `${item.investment_gain >= 0 ? "+" : ""}${formatCurrency(item.investment_gain, privacyMode)}｜资金加权收益 ${item.xirrPeriodReturn === null || item.xirrPeriodReturn === undefined ? "待计算" : formatPercent(item.xirrPeriodReturn)}`)}
                  >
                    <title>{`${item.period_month} 投资收益 ${formatCurrency(item.investment_gain, privacyMode)}`}</title>
                  </rect>
                  <text x={x + barWidth / 2} y={item.investment_gain >= 0 ? yGain(item.investment_gain) - 6 : yGain(item.investment_gain) + barHeight + 13} textAnchor="middle" className="chart-data-label tiny">
                    {signedChartCurrency(item.investment_gain)}
                  </text>
                  <text x={x + barWidth / 2} y={height - 16} textAnchor="middle" className="chart-axis-label">{item.period_month.slice(5)}</text>
                </g>
              );
            })}
            {ratePoints.length > 1 ? <path className="chart-line accent" d={linePath(ratePoints)} /> : null}
            {rowsWithPeriodReturn.map((item, index) => {
              if (item.xirrPeriodReturn === null || item.xirrPeriodReturn === undefined) return null;
              const x = xPoint(index, rows.length);
              return (
                <circle
                  key={`monthly-xirr-${item.period_month}`}
                  cx={x}
                  cy={yRate(item.xirrPeriodReturn)}
                  r="4"
                  className="chart-dot accent"
                  {...tooltipEvents(`${item.period_month} 资金加权收益`, formatPercent(item.xirrPeriodReturn))}
                />
              );
            })}
          </svg>
          {renderChartLegend([
            { label: "投资收益", color: "#5b8f7b", detail: `本月 ${formatCurrency(investmentGain, privacyMode)}` },
            { label: "资金加权收益率", color: "#b9975b", detail: xirrDetail }
          ])}
          <p className="chart-note">现金流按日期进入 XIRR；主图展示折算到当月的收益率，不展示年化放大值。</p>
        </>,
        "wide"
      );
    };
    const renderCategoryAmountChart = (rows: CategoryBreakdown[], title: string, subtitle: string) => {
      const visible = rows.slice(0, 8);
      const total = Math.max(...visible.map((item) => item.amount), 1);
      return renderChartCard(
        title,
        subtitle,
        <div className="category-bar-chart">
          {visible.length === 0 ? (
            <div className="dashboard-empty-state compact">暂无分类数据。</div>
          ) : (
            visible.map((item, index) => (
              <button key={`${title}-${item.category}`} onClick={() => setDashboardDetail(`${item.category}｜${formatCurrency(item.amount, privacyMode)}｜${formatPercent(item.percent)}`)} type="button">
                <span>{item.category}</span>
                <i><b style={{ width: `${Math.max((item.amount / total) * 100, 3)}%`, background: chartColors[index % chartColors.length] }} /></i>
                <strong>{formatCurrency(item.amount, privacyMode)}</strong>
              </button>
            ))
          )}
        </div>
      );
    };
    const renderDeltaChart = (rows: CategoryBreakdown[]) => {
      const visible = rows.filter((item) => item.month_over_month_delta !== 0).slice(0, 8);
      const maxDelta = Math.max(...visible.map((item) => Math.abs(item.month_over_month_delta)), 1);
      return renderChartCard(
        "分类环比变化",
        "看本期相对上一期的分类变化。",
        <div className="delta-chart">
          {visible.length === 0 ? (
            <div className="dashboard-empty-state compact">暂无环比变化。</div>
          ) : (
            visible.map((item) => (
              <button
                key={`delta-${item.category}`}
                type="button"
                {...tooltipEvents(item.category, `环比 ${item.month_over_month_delta >= 0 ? "+" : ""}${formatCurrency(item.month_over_month_delta, privacyMode)}`)}
              >
                <span>{item.category}</span>
                <div>
                  <i className={item.month_over_month_delta >= 0 ? "positive" : "negative"} style={{ width: `${Math.max((Math.abs(item.month_over_month_delta) / maxDelta) * 48, 3)}%` }} />
                </div>
                <strong className={item.month_over_month_delta >= 0 ? "positive" : "negative"}>{signedChartCurrency(item.month_over_month_delta)}</strong>
              </button>
            ))
          )}
        </div>
      );
    };
    const renderMiniTrend = (field: keyof MonthlyTrend, label: string) => (
      <div className="dashboard-mini-chart">
        <div className="mini-chart-header">
          <strong>{label}</strong>
          <span>{dashboardRange}</span>
        </div>
        {dashboardTrends.length === 0 ? (
          <div className="dashboard-empty-state compact">暂无数据：缺少月度趋势数据。</div>
        ) : (
          dashboardTrends.map((item) => {
            const value = Number(item[field]) || 0;
            return (
              <button className="mini-chart-row" key={`${label}-${item.period_month}`} onClick={() => setDashboardDetail(`${label}｜${item.period_month}`)} type="button">
                <span>{item.period_month}</span>
                <div><i style={{ width: `${Math.max((Math.abs(value) / maxTrendValue) * 100, 2)}%` }} /></div>
                <b>{field === "saving_rate" ? formatPercent(value) : formatCurrency(value, privacyMode)}</b>
              </button>
            );
          })
        )}
      </div>
    );
    const renderPillBars = (rows: CategoryBreakdown[], key: string) => {
      const total = rows.reduce((sum, item) => sum + item.amount, 0) || 1;
      return (
        <div className="dashboard-pill-bars">
          {visibleRows(key, rows).map((item) => (
            <button key={`${key}-${item.category}`} onClick={() => setDashboardDetail(`${item.category}｜${formatCurrency(item.amount, privacyMode)}｜${formatPercent(item.percent)}`)} type="button">
              <span>{item.category}</span>
              <i><b style={{ width: `${Math.max((item.amount / total) * 100, 3)}%` }} /></i>
              <strong>{formatCurrency(item.amount, privacyMode)}</strong>
            </button>
          ))}
        </div>
      );
    };
    const renderRatioStrip = (items: { label: string; amount: number; className?: string }[]) => {
      const total = items.reduce((sum, item) => sum + item.amount, 0) || 1;
      return (
        <div className="ratio-strip">
          {items.map((item) => (
            <button
              className={item.className}
              key={item.label}
              onClick={() => setDashboardDetail(`${item.label}｜${formatCurrency(item.amount, privacyMode)}｜${formatPercent(item.amount / total)}`)}
              style={{ width: `${Math.max((item.amount / total) * 100, 4)}%` }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      );
    };
    const renderCategoryRows = (key: string, rows: CategoryBreakdown[], showDelta = true) => (
      <div className="dashboard-table">
        {rows.length === 0 ? (
          <div className="dashboard-empty-state compact">暂无数据：缺少已确认分类记录。</div>
        ) : (
          <>
            {visibleRows(key, rows).map((item) => (
              <button
                className={`dashboard-table-row ${showDelta ? "" : "no-delta"}`}
                key={`${key}-${item.category}`}
                onClick={() => setDashboardDetail(showDelta
                  ? `${item.category}｜${formatCurrency(item.amount, privacyMode)}｜环比 ${item.month_over_month_delta >= 0 ? "+" : ""}${formatCurrency(item.month_over_month_delta, privacyMode)}`
                  : `${item.category}｜${formatCurrency(item.amount, privacyMode)}｜${formatPercent(item.percent)}`)}
                type="button"
              >
                <strong>{item.category}</strong>
                <span>{formatCurrency(item.amount, privacyMode)}</span>
                <span>{formatPercent(item.percent)}</span>
                {showDelta ? (
                  <small className={item.month_over_month_delta >= 0 ? "positive" : "negative"}>
                    {item.month_over_month_delta >= 0 ? "+" : ""}{formatCurrency(item.month_over_month_delta, privacyMode)}
                  </small>
                ) : null}
              </button>
            ))}
            {rows.length > 4 ? (
              <button className="link-button" onClick={() => toggleDashboardList(key)} type="button">
                {expandedDashboardLists[key] ? "收起" : "展开全部"}
              </button>
            ) : null}
          </>
        )}
      </div>
    );
    const renderCollapsedCategoryRows = (key: string, rows: CategoryBreakdown[]) => (
      <div className="dashboard-table">
        {rows.length === 0 ? (
          <div className="dashboard-empty-state compact">暂无数据：缺少已确认分类记录。</div>
        ) : expandedDashboardLists[key] ? (
          <>
            {rows.map((item) => (
              <button
                className="dashboard-table-row"
                key={`${key}-${item.category}`}
                type="button"
                {...tooltipEvents(item.category, `${formatCurrency(item.amount, privacyMode)}｜${formatPercent(item.percent)}｜环比 ${item.month_over_month_delta >= 0 ? "+" : ""}${formatCurrency(item.month_over_month_delta, privacyMode)}`)}
              >
                <strong>{item.category}</strong>
                <span>{formatCurrency(item.amount, privacyMode)}</span>
                <span>{formatPercent(item.percent)}</span>
                <small className={item.month_over_month_delta >= 0 ? "positive" : "negative"}>
                  {item.month_over_month_delta >= 0 ? "+" : ""}{formatCurrency(item.month_over_month_delta, privacyMode)}
                </small>
              </button>
            ))}
            <button className="link-button" onClick={() => toggleDashboardList(key)} type="button">收起</button>
          </>
        ) : (
          <button className="secondary-button compact" onClick={() => toggleDashboardList(key)} type="button">
            展开 {rows.length} 个分类
          </button>
        )}
      </div>
    );
    const renderInvestmentRows = (key: string, rows: InvestmentAssetPerformance[], field: "buy" | "sell" | "gain") => (
      <div className="dashboard-table">
        {rows.length === 0 ? (
          <div className="dashboard-empty-state compact">暂无数据：缺少对应投资现金流或收益。</div>
        ) : (
          rows.map((item) => (
            <button className="dashboard-table-row" key={`${key}-${item.asset_name}`} onClick={() => setDashboardDetail(`${item.asset_name}｜收益 ${formatCurrency(item.gain, privacyMode)}｜区间收益率 ${item.period_return === null || item.period_return === undefined ? "待计算" : formatPercent(item.period_return)}`)} type="button">
              <strong>{item.asset_name}</strong>
              <span>{formatCurrency(item[field], privacyMode)}</span>
              <span>{item.monthly_xirr === null || item.monthly_xirr === undefined ? "XIRR 待计算" : formatPercent(item.monthly_xirr)}</span>
            </button>
          ))
        )}
      </div>
    );
    const sectionIcon = (section: HealthSection) => {
      if (section === "总览") return <BarChart3 size={19} />;
      if (section === "收支储蓄") return <PiggyBank size={19} />;
      if (section === "支出结构") return <WalletCards size={19} />;
      if (section === "资产配置") return <Landmark size={19} />;
      if (section === "投资表现") return <Target size={19} />;
      return <FileText size={19} />;
    };
    const kpiItems = [
      { label: "最新完成月份", value: summary.snapshot_month || "暂无", meta: "数据库最新 completed 月结", icon: <CheckCircle2 size={20} />, section: "总览" as HealthSection },
      { label: "本月收入", value: formatCurrency(summary.confirmed_income, privacyMode), meta: "已确认收入", icon: <PiggyBank size={20} />, section: "收支储蓄" as HealthSection, itemId: "cashflow_gap_chart" },
      { label: "本月支出", value: formatCurrency(summary.confirmed_expense, privacyMode), meta: `支出占收入 ${formatPercent(spendUsage)}`, icon: <WalletCards size={20} />, section: "支出结构" as HealthSection },
      { label: "储蓄金额", value: formatCurrency(summary.saving_amount, privacyMode), meta: "收入 - 支出", icon: <PiggyBank size={20} />, section: "收支储蓄" as HealthSection, itemId: "cashflow_month_saving" },
      { label: "储蓄率", value: formatPercent(summary.saving_rate), meta: `目标 ${formatPercent(summary.target_saving_rate)}`, icon: <Target size={20} />, section: "收支储蓄" as HealthSection, itemId: "cashflow_target_rate" },
      { label: "目标储蓄率", value: formatPercent(summary.target_saving_rate), meta: `目标金额 ${formatCurrency(summary.target_saving_amount, privacyMode)}`, icon: <Target size={20} />, section: "收支储蓄" as HealthSection, itemId: "cashflow_target_rate" },
      { label: "资产原值", value: formatCurrency(summary.asset_gross_value, privacyMode), meta: "未扣信用卡调整", icon: <Landmark size={20} />, section: "资产配置" as HealthSection, itemId: "allocation_current_chart" },
      { label: "信用卡净调整", value: formatCurrency(summary.credit_card_net_adjustment, privacyMode), meta: "已确认信用卡记录", icon: <WalletCards size={20} />, section: "总览" as HealthSection },
      { label: "净资产", value: formatCurrency(summary.net_worth, privacyMode), meta: `环比 ${netWorthChange >= 0 ? "+" : ""}${formatCurrency(netWorthChange, privacyMode)}`, icon: <Landmark size={20} />, section: "总览" as HealthSection },
      { label: "本月投资买入", value: formatCurrency(summary.investment_buy, privacyMode), meta: "含手动买入和自动定投", icon: <ArrowRight size={20} />, section: "投资表现" as HealthSection, itemId: "investment_cashflow_amounts" },
      { label: "本月投资卖出", value: formatCurrency(summary.investment_sell, privacyMode), meta: `已登记分红 ${formatCurrency(summary.investment_dividend, privacyMode)}`, icon: <RefreshCcw size={20} />, section: "投资表现" as HealthSection, itemId: "investment_cashflow_amounts" },
      {
        label: "本月投资收益",
        value: formatCurrency(investmentGain, privacyMode),
        meta: `资金加权收益 ${monthlyXirrPeriodReturn === null ? "待计算" : formatPercent(monthlyXirrPeriodReturn)}`,
        icon: <BarChart3 size={20} />,
        section: "投资表现" as HealthSection,
        itemId: "investment_weighted_return"
      }
    ];
    const filteredKpiItems = kpiItems.filter((item) => !("itemId" in item) || !item.itemId || dashboardItemEnabled(item.itemId));
    const visibleKpis = kpisExpanded ? filteredKpiItems : filteredKpiItems.slice(0, 4);
    const reportTemplateOptions = contentTemplates.filter((item) => item.template_type === "monthly_report");

    return (
      <section className={`workspace-view dashboard-workspace dashboard-theme-${dashboardTheme} ${privacyMode ? "privacy-on" : ""}`}>
        <button className="back-button" onClick={() => setView("home")} type="button">
          <ChevronLeft size={18} />
          返回首页
        </button>
        <div className="view-heading dashboard-heading">
          <div>
            <p className="eyebrow">Health Board</p>
            <h1>财务健康看板</h1>
            <span>仅显示已生成月报后的看板库数据。月底更新未发布前，不影响这里。</span>
          </div>
        </div>

	        <div className="health-tabs">
	          {visibleHealthSections.map((section) => (
            <button
              className={activeHealthSection === section ? "active" : ""}
              key={section}
              onClick={() => setActiveHealthSection(section)}
              type="button"
            >
              {section}
            </button>
          ))}
        </div>
        <div className="dashboard-range-tabs">
          {dashboardRanges.map((range) => (
            <button
              className={dashboardRange === range ? "active" : ""}
              key={range}
              onClick={() => setDashboardRange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>

        <section className="dashboard-hero-panel">
          <div>
            <p className="eyebrow">{module.eyebrow}</p>
            <h2>{module.title}</h2>
            <span>{module.text} 当前范围：{dashboardRange}。</span>
          </div>
          <div className="dashboard-hero-metric">
            <span>{summary.snapshot_month}</span>
            <strong>{formatCurrency(summary.net_worth, privacyMode)}</strong>
          </div>
        </section>

        <section className="kpi-shell">
          <div className="kpi-shell-header">
            <span>总览</span>
            <button className="link-button" onClick={() => setKpisExpanded((current) => !current)} type="button">
              {kpisExpanded ? "收起" : "展开全部"}
            </button>
          </div>
          <div className="kpi-grid dashboard-kpis">
            {visibleKpis.map((item) => (
              <button
                className="kpi-card interactive"
                key={item.label}
                {...tooltipEvents(item.label, `${item.value}｜${item.meta}`, () => {
                  setActiveHealthSection(item.section);
                })}
                type="button"
              >
                <div className="kpi-icon">
                  {item.icon}
                </div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <span>{item.meta}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-module-grid">
          <article className="panel dashboard-main-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{module.eyebrow}</p>
                <h2>{module.title}</h2>
              </div>
              <span>数据范围 {rangeLabel}</span>
            </div>
            <div className="dashboard-inline-detail">
              <span>点击明细</span>
              <strong>{dashboardDetail ?? "点击 KPI、图表、分类、资产后，这里显示对应数据。"}</strong>
            </div>

            {activeHealthSection === "总览" ? (
              <div className="dashboard-stack">
                <div className="dashboard-split">
                  <div>
                    <span>净资产变化</span>
                    <strong className={netWorthChange >= 0 ? "positive" : "negative"}>{netWorthChange >= 0 ? "+" : ""}{formatCurrency(netWorthChange, privacyMode)}</strong>
                    <small>资产原值 + 信用卡净调整</small>
                  </div>
                  <div>
                    <span>非现金投资资金加权收益率</span>
                    <strong className={investmentGain >= 0 ? "positive" : "negative"}>
                      {monthlyXirrPeriodReturn === null ? "待计算" : formatPercent(monthlyXirrPeriodReturn)}
                    </strong>
                    <small>{xirrDetail}</small>
                  </div>
                </div>
                {renderNetWorthCompositeChart()}
                {renderDiscretionaryChart()}
                <div className="dashboard-chart-grid">
                  {renderDonutChart(summary.asset_allocations, "当前资产配置", "看资产占比；悬浮/点图例看金额。")}
                  {renderInvestmentGroupChart()}
                </div>
                <div className="dashboard-alerts">
                  <h3 className="dashboard-subtitle">本月提醒</h3>
                  {alerts.length === 0 ? <div className="dashboard-empty-state compact">暂无异常：当前核心指标未触发提醒。</div> : alerts.map((item) => <button key={item} onClick={() => setDashboardDetail(item)} type="button">{item}</button>)}
                </div>
              </div>
            ) : null}

            {activeHealthSection === "收支储蓄" ? (
              <div className="dashboard-stack">
                <div className="dashboard-metric-grid">
                  {dashboardItemEnabled("cashflow_range_saving") ? <div>
                    <span>当前范围累计储蓄</span>
                    <strong>{formatCurrency(ytdSaving, privacyMode)}</strong>
                    <small>{dashboardRange}</small>
                  </div> : null}
                  {dashboardItemEnabled("cashflow_month_saving") ? <div>
                    <span>本月储蓄</span>
                    <strong>{formatCurrency(summary.saving_amount, privacyMode)}</strong>
                    <small className={savingGap >= 0 ? "positive" : "negative"}>距目标 {savingGap >= 0 ? "+" : ""}{formatCurrency(savingGap, privacyMode)}</small>
                  </div> : null}
                  {dashboardItemEnabled("cashflow_target_rate") ? <div>
                    <span>目标储蓄率</span>
                    <strong>{formatPercent(summary.target_saving_rate)}</strong>
                    <small>当前 {formatPercent(summary.saving_rate)}</small>
                  </div> : null}
                  {dashboardItemEnabled("cashflow_target_amount") ? <div>
                    <span>目标储蓄金额</span>
                    <strong>{formatCurrency(summary.target_saving_amount, privacyMode)}</strong>
                    <small>本月收入 × 目标率</small>
                  </div> : null}
                </div>
                {dashboardItemEnabled("cashflow_gap_chart") ? renderCashflowAreaChart() : null}
                {dashboardItemEnabled("saving_goal_chart") ? renderSavingTargetChart() : null}
                <div className="dashboard-alerts">
                  <h3 className="dashboard-subtitle">异常</h3>
                  {alerts.length === 0 ? <div className="dashboard-empty-state compact">暂无异常：收入、支出、储蓄率未触发提醒。</div> : alerts.map((item) => <button key={item} onClick={() => setDashboardDetail(item)} type="button">{item}</button>)}
                </div>
              </div>
            ) : null}

            {activeHealthSection === "支出结构" ? (
              <div className="dashboard-stack">
                <div className="dashboard-split">
                  {dashboardItemEnabled("expense_category_count") ? <div>
                    <span>支出分类数</span>
                    <strong>{categoryCount}</strong>
                    <small>{expenseScopeLabel} 有金额的分类</small>
                  </div> : null}
                  {dashboardItemEnabled("expense_largest_category") ? <div>
                    <span>最大支出分类</span>
                    <strong>{topExpenseCategory?.category ?? "暂无"}</strong>
                    <small>{topExpenseCategory ? `${formatCurrency(topExpenseCategory.amount, privacyMode)}｜${formatPercent(topExpensePercent)}` : "暂无占比"}</small>
                  </div> : null}
                </div>
                {dashboardItemEnabled("expense_category_share_chart") ? renderDonutChart(expenseRowsForRange, "支出分类占比", `${expenseScopeLabel}主要类别占比，完整明细在下方展开。`) : null}
                {dashboardItemEnabled("expense_category_delta_chart") ? renderDeltaChart(summary.expense_categories) : null}
                {dashboardItemEnabled("expense_category_detail") ? (
                  <>
                    <h3 className="dashboard-subtitle">分类金额明细</h3>
                    {renderCollapsedCategoryRows("expenseCategories", expenseRowsForRange)}
                  </>
                ) : null}
                {dashboardItemEnabled("expense_range_rank") ? (
                  <>
                    <h3 className="dashboard-subtitle">年内分类累计排行</h3>
                    {renderCategoryRows("expenseYearRank", summary.expense_year_rank, false)}
                  </>
                ) : null}
                {dashboardItemEnabled("expense_large_anomaly") ? (
                  <>
                    <h3 className="dashboard-subtitle">大额异常支出</h3>
                    <div className="dashboard-table">
                      {summary.spending_anomalies.length === 0 ? (
                        <div className="dashboard-empty-state compact">暂无数据：未发现超过阈值的大额异常支出。</div>
                      ) : (
                        summary.spending_anomalies.map((item) => (
                          <button className="dashboard-table-row" key={`${item.transaction_date}-${item.category}-${item.amount}`} onClick={() => setDashboardDetail(`${item.transaction_date}｜${item.category}｜${item.reason}`)} type="button">
                            <strong>{item.category}</strong>
                            <span>{item.transaction_date}</span>
                            <span>{formatCurrency(item.amount, privacyMode)}</span>
                            <small>{item.reason}</small>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

	            {activeHealthSection === "资产配置" ? (
	              <div className="dashboard-stack">
	                {customDashboardItemEnabledInSection("allocation_discretionary_amount", "资产配置") ? (
	                  <div className="dashboard-split">
	                    <div>
	                      <span>可支配总额</span>
	                      <strong>{formatCurrency(latestDiscretionaryAmount, privacyMode)}</strong>
	                      <small>{discretionaryScopeLabel ? `按自定义范围：${discretionaryScopeLabel}` : "按自定义范围计算"}</small>
	                    </div>
	                  </div>
	                ) : null}
                {dashboardItemEnabled("allocation_trend_chart") ? renderStackedAllocationChart() : null}
                {customDashboardItemEnabledInSection("allocation_discretionary_amount", "资产配置") ? renderDiscretionaryChart() : null}
                {dashboardItemEnabled("allocation_current_chart") ? (
                  <div className="dashboard-chart-grid">
                    {renderDonutChart(summary.asset_allocations, "当前资产配置", "各资产类别金额占比。")}
                  </div>
                ) : null}
			                {customDashboardItemEnabledInSection("allocation_target_deviation_value", "资产配置")
			                  ? renderChartCard(
			                      "目标资产配置偏离图表",
			                      hasMainAllocationTargets ? "按当前实际配置和目标配置计算；显示当前比例、目标比例和偏离值。" : "暂无目标配比；请先在偏好设置里填写目标资产配比。",
			                      hasMainAllocationTargets ? renderAllocationTargetGapList() : <div className="dashboard-empty-state compact">暂无目标配比。</div>,
			                      "wide"
		                    )
		                  : null}
                {customDashboardItemEnabledInSection("allocation_sub_detail_ratio", "资产配置") ? renderCustomAllocationDetailRatioChart() : null}
                {customDashboardItemEnabledInSection("allocation_sub_target_gap_chart", "资产配置") ? renderChartCard(
                  "二级 / 三级分类目标差距",
                  "按已填写的下级目标配比，展示实际比例和目标比例的差距。",
                  renderSubAllocationDetailGroups(),
                  "wide"
                ) : null}
              </div>
            ) : null}

            {activeHealthSection === "投资表现" ? (
              <div className="dashboard-stack">
                <div className="dashboard-split">
                  {dashboardItemEnabled("investment_cashflow_amounts") ? <div>
                    <span>买入 / 卖出 / 分红</span>
                    <strong>{formatCurrency(summary.investment_buy, privacyMode)}</strong>
                    <small>
                      卖出 {formatCurrency(summary.investment_sell, privacyMode)}，现金分红 {formatCurrency(summary.investment_dividend, privacyMode)}
                    </small>
                  </div> : null}
                  {dashboardItemEnabled("investment_weighted_return") ? <div>
                    <span>本月资金加权收益</span>
                    <strong>{monthlyXirrPeriodReturn === null ? "待计算" : formatPercent(monthlyXirrPeriodReturn)}</strong>
                    <small>{xirrDetail}</small>
                  </div> : null}
                </div>
                <div className="dashboard-split">
                  {dashboardItemEnabled("investment_asset_return_chart") ? <div>
                    <span>本月收益金额</span>
                    <strong>{formatCurrency(investmentGain, privacyMode)}</strong>
                    <small>月末市值 - 月初市值 - 买入 + 卖出；现金分红另列</small>
                  </div> : null}
	                  {dashboardItemEnabled("investment_non_cash_group_count") ? <div>
	                    <span>非现金资产组</span>
	                    <strong>{availableReturnGroups.length}</strong>
	                    <small>只展示有持仓、现金流或收益数据的资产组</small>
	                  </div> : null}
                </div>
                {dashboardItemEnabled("investment_asset_return_chart") ? renderInvestmentGroupChart() : null}
                {dashboardItemEnabled("investment_group_perspective_chart") ? renderReturnWheelChart() : null}
                {dashboardItemEnabled("investment_return_xirr_chart") ? (
                  <>
                    <h3 className="dashboard-subtitle">历史月度收益与资金加权收益</h3>
                    {renderInvestmentMonthlyChart()}
                  </>
                ) : null}
                {dashboardItemEnabled("investment_group_return_table") ? (
                  <>
                    <h3 className="dashboard-subtitle">资产组收益 / 区间收益率</h3>
                    <div className="dashboard-table">
                      {investmentGroupRows.length === 0 ? (
                        <div className="dashboard-empty-state compact">暂无数据：缺少分组收益数据。</div>
                      ) : (
                        investmentGroupRows.map((item) => (
                          <button
                            className="dashboard-table-row"
                            key={item.group_name}
                            type="button"
                            {...tooltipEvents(
                              item.group_name,
                              `收益 ${formatCurrency(item.gain, privacyMode)}｜收益率 ${item.return_rate === null || item.return_rate === undefined ? "待计算" : formatPercent(item.return_rate)}｜月末 ${formatCurrency(item.ending_value, privacyMode)}`
                            )}
                          >
                            <strong>{item.group_name}</strong>
                            <span>收益 {formatCurrency(item.gain, privacyMode)}</span>
                            <span>{item.return_rate === null || item.return_rate === undefined ? "收益率待算" : formatPercent(item.return_rate)}</span>
                            <small>月末 {formatCurrency(item.ending_value, privacyMode)}</small>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {activeHealthSection === "月报" ? (
              <div className="dashboard-stack">
                {dashboardItemEnabled("report_template_picker") || dashboardItemEnabled("report_content_preview") ? (
                  <div className="report-template-bar">
                    {dashboardItemEnabled("report_template_picker") ? (
                      <label>
                        使用模板
                        <select value={reportTemplateId} onChange={(event) => setReportTemplateId(event.target.value)}>
                          <option value="">默认月报模板</option>
                          {reportTemplateOptions.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}{template.is_default ? "（默认）" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {dashboardItemEnabled("report_content_preview") ? (
                      <button className="primary-button compact" onClick={() => renderMonthlyReportWithTemplate()} type="button">
                        <Eye size={15} />
                        预览生成内容
                      </button>
                    ) : null}
                    <button className="secondary-button compact" onClick={() => {
                      const template = reportTemplateOptions.find((item) => item.id === reportTemplateId) ?? reportTemplateOptions.find((item) => item.is_default);
                      if (template) applyTemplateToDraft(template);
                      setView("contentTemplates");
                    }} type="button">
                      <Edit3 size={15} />
                      编辑模板
                    </button>
                  </div>
                ) : null}
                {dashboardItemEnabled("report_content_preview") && reportPreview ? (
                  <div className="dashboard-inline-detail">
                    <span>当前模板</span>
                    <strong>{reportPreview.template_name}｜{reportPreview.period_month}</strong>
                  </div>
                ) : null}
                {dashboardItemEnabled("report_content_preview") ? (
                  <div className="report-preview" dangerouslySetInnerHTML={{ __html: (reportPreview?.html ?? summary.monthly_report_html) || "<p>暂无数据：缺少月报 HTML。</p>" }} />
                ) : null}
                {dashboardItemEnabled("report_export_actions") ? (
                  <div className="report-actions">
                    <button className="secondary-button compact" onClick={() => setDashboardDetail("导出 HTML 将使用当前月报 HTML 预览内容。")} type="button">导出 HTML</button>
                    <button className="secondary-button compact" disabled type="button">导出 PDF 后续接入</button>
                    <button className="secondary-button compact" disabled type="button">导出 Excel 后续接入</button>
                  </div>
	                ) : null}
	              </div>
	            ) : null}
	            {renderAssignedCustomPanels(activeHealthSection)}
	          </article>

          <aside className="panel dashboard-side-panel compact-rail">
            <div className="dashboard-module-list">
	              {visibleHealthSections.map((section) => (
                <button
                  className={activeHealthSection === section ? "active" : ""}
                  key={section}
                  onClick={() => {
                    setActiveHealthSection(section);
                    setDashboardDetail(`${section}｜当前范围 ${dashboardRange}`);
                  }}
                  aria-label={section}
                  type="button"
                >
                  {sectionIcon(section)}
                  <strong>{section}</strong>
                </button>
              ))}
            </div>
            <div className="dashboard-detail-panel">
              <p className="eyebrow">Detail</p>
              <h3>点击明细</h3>
              <span>{dashboardDetail ?? "点击图表、KPI、分类或资产后，这里显示对应数据上下文。"}</span>
            </div>
          </aside>
          {dashboardTooltip ? (
            <div
              className={`dashboard-floating-tooltip ${dashboardTooltip.pinned ? "pinned" : ""}`}
              onMouseLeave={() => {
                setDashboardTooltip((current) => (current?.pinned ? current : null));
              }}
              style={{ left: dashboardTooltip.x, top: dashboardTooltip.y }}
            >
              {dashboardTooltip.pinned ? (
                <button aria-label="关闭明细" onClick={() => setDashboardTooltip(null)} type="button">
                  ×
                </button>
              ) : null}
              <span>{dashboardTooltip.title}</span>
              <strong>{dashboardTooltip.body}</strong>
            </div>
          ) : null}
        </section>
      </section>
    );
  };

  return (
    <main className={`shell dashboard-theme-${dashboardTheme} ${privacyMode ? "privacy-on" : ""}`}>
		      {renderHeader()}
		      {view === "home" ? renderHome() : null}
		      {view === "onboarding" ? renderOnboarding("setup") : null}
		      {view === "preferences" ? renderOnboarding("preferences") : null}
		      {view === "monthlyUpdate" ? renderMonthlyUpdate() : null}
      {view === "healthDashboard" ? renderHealthDashboard() : null}
      {view === "contentTemplates" ? renderContentTemplateSettings() : null}
      {renderConfirmDialog()}
      {renderSettingsDialog()}
      {renderMobilePairingDialog()}
    </main>
  );
}
