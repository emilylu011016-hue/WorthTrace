const MOBILE_APP_VERSION = "0.3.28";
const DB_NAME = "worthtrace_mobile_v3";
const DB_VERSION = 1;
const RECORD_STORE = "offline_records";
const SETTINGS_KEY = "worthtrace_mobile_settings_v2";
const CUSTOM_CATEGORIES_KEY = "worthtrace_mobile_custom_categories_v2";
const RELEASE_RESET_KEY = "worthtrace_mobile_release_reset_v3";
const DEVICE_ID_KEY = "worthtrace_mobile_device_id_v2";
const ACCOUNT_ID_KEY = "worthtrace_mobile_account_id_v3";
const BINDING_INFO_KEY = "worthtrace_mobile_binding_info_v1";
const MOBILE_SESSION_UNLOCK_KEY = "worthtrace_mobile_unlocked_session_v1";
const CLOUD_SESSION_KEY = "worthtrace_mobile_cloud_session_v1";
const DEFAULT_SYNC_ENDPOINT = "http://127.0.0.1:18742";
const CLOUD_SYNC_URL = "https://yyhuxgxohiguyaskhqco.supabase.co";
const CLOUD_SYNC_PUBLISHABLE_KEY = "sb_publishable_TW9SJoYzougEOl5vvHZVpg_17iMWHH9";
const LEGACY_DB_NAMES = ["worthtrace_mobile_v1", "worthtrace_mobile_v2"];
const LEGACY_STORAGE_KEYS = ["worthtrace_mobile_settings_v1", "worthtrace_mobile_custom_categories_v1"];

const baseCategories = {
  expense: ["餐饮", "交通", "购物", "居住", "日用", "医疗", "娱乐", "旅行", "人情", "学习", "运动", "宠物", "保险", "税费", "其他支出"],
  income: ["工资", "奖金", "副业", "投资收益", "分红", "利息", "报销", "退款", "红包", "租金", "其他收入"]
};
const healthSections = ["总览", "收支储蓄", "支出结构", "资产配置", "投资表现"];
const dashboardRanges = ["本月", "近 3 个月", "半年", "今年以来", "投资至今"];
const investmentGroupOrder = ["全球资产", "红利低波", "债券", "黄金", "A股权益", "其他"];

await resetRuntimeCacheIfRequested();
await resetLegacyLocalData();
resetBindingFromUrlIfNeeded();

const settings = readSettings();
const customCategories = readCustomCategories();
const syncEndpoint = resolveSyncEndpoint();
const deviceId = resolveDeviceId();
let accountId = localStorage.getItem(ACCOUNT_ID_KEY) || "";
let cloudSession = readCloudSession();
const icons = {
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.1 12s3.6-7 9.9-7 9.9 7 9.9 7-3.6 7-9.9 7-9.9-7-9.9-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6A3 3 0 0 0 13.4 13.4"/><path d="M9.9 4.4A10.7 10.7 0 0 1 12 4.2c6.3 0 9.9 7 9.9 7a16.2 16.2 0 0 1-3.1 3.9"/><path d="M6.5 6.8A16.1 16.1 0 0 0 2.1 12s3.6 7 9.9 7a10.7 10.7 0 0 0 4.1-.8"/></svg>',
  palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.2-3.6 1.2 1.2 0 0 1 .8-2.1H17a4 4 0 0 0 0-8h-1.2A4.9 4.9 0 0 1 12 3Z"/><circle cx="7.8" cy="10" r=".8"/><circle cx="10.4" cy="7.7" r=".8"/><circle cx="14" cy="7.8" r=".8"/></svg>',
  desktop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/><path d="M9 10h6"/></svg>',
  account: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M18.5 5.5v4"/><path d="M20.5 7.5h-4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>'
};

const state = {
  view: "book",
  type: "expense",
  draftSection: "all",
  records: [],
  online: navigator.onLine,
  privacy: true,
  theme: settings.theme,
  assetRange: "ytd",
  dashboardSection: "总览",
  dashboardRange: "今年以来",
  bookMonth: currentMonthKey(),
  editingLocalId: ""
};

const pageTitle = document.querySelector("#pageTitle");
const offlineBanner = document.querySelector("#offlineBanner");
const syncCard = document.querySelector("#syncCard");
const syncCardTitle = document.querySelector("#syncCardTitle");
const syncCardText = document.querySelector("#syncCardText");
const syncCount = document.querySelector("#syncCount");
const syncDot = document.querySelector("#syncDot");
const pairCard = document.querySelector("#pairCard");
const pairCardTitle = document.querySelector("#pairCardTitle");
const pairCardText = document.querySelector("#pairCardText");
const cloudLoginButton = document.querySelector("#cloudLoginButton");
const draftEntryGrid = document.querySelector("#draftEntryGrid");
const localRecords = document.querySelector("#localRecords");
const bookForm = document.querySelector("#bookForm");
const dateInput = document.querySelector("#dateInput");
const amountInput = document.querySelector("#amountInput");
const categoryInput = document.querySelector("#categoryInput");
const noteInput = document.querySelector("#noteInput");
const bookMonthInput = document.querySelector("#bookMonthInput");
const bookTodayButton = document.querySelector("#bookTodayButton");
const bookMonthIncome = document.querySelector("#bookMonthIncome");
const bookMonthExpense = document.querySelector("#bookMonthExpense");
const openBookDialogButton = document.querySelector("#openBookDialogButton");
const bookDialog = document.querySelector("#bookDialog");
const bookModeLabel = document.querySelector("#bookModeLabel");
const bookMonthTitle = document.querySelector("#bookMonthTitle");
const bookRecordTitle = document.querySelector("#bookRecordTitle");
const cancelEditButton = document.querySelector("#cancelEditButton");
const closeBookDialogButton = document.querySelector("#closeBookDialogButton");
const syncDialog = document.querySelector("#syncDialog");
const syncDialogTitle = document.querySelector("#syncDialogTitle");
const syncDialogText = document.querySelector("#syncDialogText");
const pairDialog = document.querySelector("#pairDialog");
const pairForm = document.querySelector("#pairForm");
const pairDialogIntro = document.querySelector("#pairDialogIntro");
const bindingDetail = document.querySelector("#bindingDetail");
const pairCodeInput = document.querySelector("#pairCodeInput");
const pairSubmitButton = document.querySelector("#pairSubmitButton");
const unpairButton = document.querySelector("#unpairButton");
const cloudDialog = document.querySelector("#cloudDialog");
const cloudForm = document.querySelector("#cloudForm");
const cloudDialogCopy = document.querySelector("#cloudDialogCopy");
const cloudAccountDetail = document.querySelector("#cloudAccountDetail");
const cloudEmailField = document.querySelector("#cloudEmailField");
const cloudEmailInput = document.querySelector("#cloudEmailInput");
const cloudPasswordField = document.querySelector("#cloudPasswordField");
const cloudPasswordInput = document.querySelector("#cloudPasswordInput");
const cloudPasswordToggle = document.querySelector("#cloudPasswordToggle");
const cloudHint = document.querySelector("#cloudHint");
const cloudResendButton = document.querySelector("#cloudResendButton");
const cloudSignupButton = document.querySelector("#cloudSignupButton");
const cloudLogoutButton = document.querySelector("#cloudLogoutButton");
const cloudLoginSubmitButton = document.querySelector("#cloudLoginSubmitButton");
const categoryDialog = document.querySelector("#categoryDialog");
const categoryForm = document.querySelector("#categoryForm");
const categoryDialogTitle = document.querySelector("#categoryDialogTitle");
const categoryNameInput = document.querySelector("#categoryNameInput");
const passwordDialog = document.querySelector("#passwordDialog");
const passwordForm = document.querySelector("#passwordForm");
const passwordInput = document.querySelector("#passwordInput");
const passwordHint = document.querySelector("#passwordHint");
const passwordSubmitButton = document.querySelector("#passwordSubmitButton");
const clearBindingButton = document.querySelector("#clearBindingButton");
const passwordChangeDialog = document.querySelector("#passwordChangeDialog");
const passwordChangeForm = document.querySelector("#passwordChangeForm");
const currentPasswordInput = document.querySelector("#currentPasswordInput");
const newPasswordInput = document.querySelector("#newPasswordInput");
const passwordChangeHint = document.querySelector("#passwordChangeHint");
const passwordChangeSubmitButton = document.querySelector("#passwordChangeSubmitButton");
const privacyButton = document.querySelector("#privacyButton");
const themeButton = document.querySelector("#themeButton");
const securityButton = document.querySelector("#securityButton");
const bindingInfoButton = document.querySelector("#bindingInfoButton");
const themePanel = document.querySelector("#themePanel");
const homePendingCount = document.querySelector("#homePendingCount");
const infoToast = document.querySelector("#infoToast");
const mayAnomalyButton = document.querySelector("#mayAnomalyButton");
const mayAnomalyDetail = document.querySelector("#mayAnomalyDetail");
const targetDeviationSection = document.querySelector("#targetDeviationSection");
const assetRing = document.querySelector("#assetRing");
const allocationLegend = document.querySelector("#allocationLegend");
const assetRangeTabs = document.querySelector("#assetRangeTabs");
const assetRangeSummary = document.querySelector("#assetRangeSummary");
const dashboardModuleGrid = document.querySelector("#dashboardModuleGrid");
const dashboardSectionTabs = document.querySelector("#dashboardSectionTabs");
const dashboardRangeTabs = document.querySelector("#dashboardRangeTabs");
const dashboardHealthContent = document.querySelector("#dashboardHealthContent");
const dashboardDataStamp = document.querySelector("#dashboardDataStamp");
let toastTimer = null;
let pendingCategoryType = "expense";

let mobileDashboardSnapshot = makeEmptyDashboardSnapshot();

const assetRanges = [
  { key: "1m", label: "1月", months: 1 },
  { key: "3m", label: "3月", months: 3 },
  { key: "6m", label: "半年", months: 6 },
  { key: "ytd", label: "今年", months: null },
  { key: "1y", label: "一年", months: 12 }
];

dateInput.value = todayKey();
if (bookMonthInput) bookMonthInput.value = state.bookMonth;
applyTheme();
renderCategoryOptions();
void loadMobileDashboardSnapshot();
renderAssetDashboard();
renderTargetDeviation();
showPasswordGateIfNeeded();

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.bookType) setBookType(button.dataset.bookType);
    navigate(button.dataset.nav);
  });
});

document.querySelectorAll(".segmented [data-type]").forEach((button) => {
  button.addEventListener("click", () => setBookType(button.dataset.type));
});

document.querySelectorAll(".theme-choice").forEach((button) => {
  button.addEventListener("click", () => {
    state.theme = button.dataset.theme;
    themePanel.hidden = true;
    themeButton.classList.remove("active");
    writeSettings();
    applyTheme();
    showToast(`已切换为${button.textContent.trim()}风格`);
  });
});
assetRangeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset-range]");
  if (!button) return;
  state.assetRange = button.dataset.assetRange;
  renderAssetDashboard();
  render();
});
dashboardSectionTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-section]");
  if (!button) return;
  state.dashboardSection = button.dataset.dashboardSection;
  render();
});
dashboardRangeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-range]");
  if (!button) return;
  state.dashboardRange = button.dataset.dashboardRange;
  render();
});

bookMonthInput?.addEventListener("change", () => {
  state.bookMonth = bookMonthInput.value || currentMonthKey();
  state.draftSection = "all";
  render();
});

bookTodayButton?.addEventListener("click", () => {
  state.bookMonth = currentMonthKey();
  if (bookMonthInput) bookMonthInput.value = state.bookMonth;
  state.draftSection = "all";
  render();
});

openBookDialogButton?.addEventListener("click", () => {
  clearBookEditForm();
  setBookType("expense");
  render();
  openBookDialog();
});

privacyButton.addEventListener("click", () => {
  state.privacy = !state.privacy;
  writeSettings();
  renderAssetDashboard();
  renderTargetDeviation();
  render();
  showToast(state.privacy ? "金额已隐藏" : "金额已显示");
});

themeButton.addEventListener("click", () => {
  themePanel.hidden = !themePanel.hidden;
  themeButton.classList.toggle("active", !themePanel.hidden);
  showToast(themePanel.hidden ? "风格面板已收起" : "选择一种风格");
});

document.querySelector("#addCategoryButton").addEventListener("click", () => {
  pendingCategoryType = state.type;
  categoryDialogTitle.textContent = `新增${state.type === "income" ? "收入" : "支出"}分类`;
  categoryNameInput.value = "";
  openModal(categoryDialog);
  categoryNameInput.focus();
});
document.querySelector("#closeCategoryDialogButton").addEventListener("click", () => closeModal(categoryDialog));
categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = categoryNameInput.value.trim();
  if (!name) return;
  const list = categoriesForType(pendingCategoryType);
  if (!list.includes(name)) {
    customCategories[pendingCategoryType].push(name);
    writeCustomCategories();
  }
  renderCategoryOptions(name);
  closeModal(categoryDialog);
});
passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void unlockMobileApp();
});
clearBindingButton.addEventListener("click", () => {
  clearLocalBinding();
  closeModal(passwordDialog);
  renderAssetDashboard();
  renderTargetDeviation();
  render();
  showToast("已清除本机绑定");
});
securityButton.addEventListener("click", () => {
  void openPasswordChangeIfConnected();
});
document.querySelector("#closePasswordChangeButton").addEventListener("click", () => closeModal(passwordChangeDialog));
passwordChangeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void changeMobilePassword();
});

bookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = Number(amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    amountInput.focus();
    return;
  }
  const now = new Date().toISOString();
  const editingRecord = state.editingLocalId
    ? state.records.find((item) => item.local_id === state.editingLocalId)
    : null;
  const record = {
    ...(editingRecord || {}),
    local_id: editingRecord?.local_id || createLocalId("txn"),
    server_id: editingRecord?.server_id || null,
    record_kind: "transaction",
    operation: editingRecord ? "update" : "create",
    sync_status: "pending",
    transaction_type: state.type,
    amount,
    currency: "CNY",
    category: categoryInput.value,
    transaction_date: dateInput.value,
    note: noteInput.value.trim(),
    created_at: editingRecord?.created_at || now,
    updated_at: now
  };
  state.records = [record, ...state.records.filter((item) => item.local_id !== record.local_id)];
  await putRecord(record);
  amountInput.value = "";
  noteInput.value = "";
  dateInput.value = todayKey();
  state.editingLocalId = "";
  render();
  void reportMobileStatus();
  closeModal(bookDialog);
  navigate("book");
});

cancelEditButton.addEventListener("click", () => {
  clearBookEditForm();
  render();
  closeModal(bookDialog);
});
closeBookDialogButton.addEventListener("click", () => {
  clearBookEditForm();
  render();
  closeModal(bookDialog);
});

document.querySelector("#syncButton").addEventListener("click", showSyncDialog);
document.querySelector("#confirmSyncButton").addEventListener("click", showSyncDialog);
document.querySelector("#closeDialogButton").addEventListener("click", () => closeModal(syncDialog));
cloudLoginButton.addEventListener("click", () => showCloudDialog());
bindingInfoButton.addEventListener("click", () => showCloudDialog());
document.querySelector("#closePairDialogButton").addEventListener("click", () => closeModal(pairDialog));
document.querySelector("#closeCloudDialogButton").addEventListener("click", () => closeModal(cloudDialog));
cloudResendButton.addEventListener("click", () => {
  void cloudResendConfirmation();
});
cloudLogoutButton.addEventListener("click", () => {
  rememberCloudSession(null);
  closeModal(cloudDialog);
  showToast("已退出账号同步");
});
cloudPasswordToggle.addEventListener("click", () => {
  const visible = cloudPasswordInput.type === "text";
  cloudPasswordInput.type = visible ? "password" : "text";
  cloudPasswordToggle.textContent = visible ? "显示" : "隐藏";
  cloudPasswordToggle.setAttribute("aria-label", visible ? "显示密码" : "隐藏密码");
  cloudPasswordToggle.setAttribute("title", visible ? "显示密码" : "隐藏密码");
  cloudPasswordInput.focus();
});
unpairButton.addEventListener("click", () => {
  void unpairThisDevice();
});
cloudSignupButton.addEventListener("click", () => {
  void cloudAuth("signup");
});
cloudForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void cloudAuth("signin");
});
pairForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = pairCodeInput.value.trim();
  if (!code) {
    pairCodeInput.focus();
    return;
  }
  closeModal(pairDialog);
  void pairWithDesktop(code);
});
mayAnomalyButton.addEventListener("click", () => {
  mayAnomalyDetail.hidden = !mayAnomalyDetail.hidden;
});
draftEntryGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-draft-section]");
  if (!button) return;
  state.draftSection = state.draftSection === button.dataset.draftSection ? "all" : button.dataset.draftSection;
  renderLocalRecords();
});
localRecords.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-record]");
  if (!button) return;
  startEditingRecord(button.dataset.editRecord);
});
dashboardHealthContent?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-detail-toast]");
  if (!target) return;
  showToast(target.dataset.detailToast);
});
document.querySelector("#mockSyncButton").addEventListener("click", async () => {
  await syncPendingToDesktop();
});

window.addEventListener("online", () => {
  state.online = true;
  render();
  if (pendingRecords().length > 0) showSyncDialog();
});

window.addEventListener("offline", () => {
  state.online = false;
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

state.records = await readRecords();
navigate(state.view);
render();
await pairFromUrlIfNeeded();
void reportMobileStatus();

function navigate(view) {
  const dashboardAliases = {
    home: "总览",
    cashflow: "收支储蓄",
    allocation: "资产配置"
  };
  if (dashboardAliases[view]) {
    state.dashboardSection = dashboardAliases[view];
    view = "dashboard";
  }
  if (view === "monthEnd") view = "book";
  state.view = view;
  if (view === "book" && !state.editingLocalId) {
    dateInput.value = todayKey();
  }
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });
  document.querySelectorAll(".bottom-nav [data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === view);
  });
  pageTitle.textContent = {
    book: "记一笔",
    dashboard: "财务健康看板"
  }[view] || "记一笔";
}

function setBookType(type) {
  state.type = type;
  document.querySelectorAll(".segmented [data-type]").forEach((item) => {
    item.classList.toggle("active", item.dataset.type === type);
  });
  renderCategoryOptions();
}

function categoriesForType(type) {
  return [...baseCategories[type], ...customCategories[type]];
}

function renderCategoryOptions(selected = categoryInput.value) {
  const categories = categoriesForType(state.type);
  categoryInput.innerHTML = categories.map((category) => `<option>${escapeHtml(category)}</option>`).join("");
  categoryInput.value = categories.includes(selected) ? selected : categories[0];
}

function pendingRecords() {
  return state.records.filter((record) => record.sync_status !== "synced" && (record.record_kind || "transaction") === "transaction");
}

function render() {
  const pending = pendingRecords();
  const pendingSummary = summarizeRecords(pending);
  const draftMonth = activeDraftMonthKey();
  const draftMonthLabel = formatMonthShortLabel(draftMonth);
  updateAccessState();
  syncCount.textContent = String(pending.length);
  homePendingCount.textContent = `${pending.length} 条`;
  setText("#homePendingLabel", `${draftMonthLabel}草稿待同步`);
  syncDot.classList.toggle("offline", !state.online);
  offlineBanner.hidden = state.online;
  syncCard.hidden = pending.length === 0;
  syncCardTitle.textContent = pending.length ? `有 ${pending.length} 条 ${draftMonthLabel}草稿待同步` : "没有待同步记录";
  syncCardText.textContent = state.online
    ? `收入 ${pendingSummary.incomeCount} 笔，支出 ${pendingSummary.expenseCount} 笔。同步后进入云端草稿箱。`
    : "离线记录会先保存在手机。恢复网络后同步到云端草稿箱。";
  privacyButton.innerHTML = state.privacy ? icons.eyeOff : icons.eye;
  privacyButton.setAttribute("aria-label", state.privacy ? "显示金额" : "隐藏金额");
  privacyButton.setAttribute("title", state.privacy ? "显示金额" : "隐藏金额");
  privacyButton.dataset.tooltip = state.privacy ? "显示金额" : "隐藏金额";
  themeButton.innerHTML = icons.palette;
  securityButton.innerHTML = icons.lock;
  securityButton.hidden = !accountId;
  renderPairCard();
  document.body.classList.toggle("privacy-on", state.privacy);
  renderBookMeta();
  renderSyncedDashboard();
  renderMayAnomalies();
  renderDashboardModules();
  renderHealthDashboard();
  document.querySelectorAll(".money").forEach((node) => {
    if (node.closest("[data-view='book']")) return;
    node.textContent = state.privacy ? "••••••" : node.dataset.value;
  });
  document.querySelectorAll(".percent").forEach((node) => {
    if (node.closest("[data-view='book']")) return;
    node.textContent = state.privacy ? "••••••" : node.dataset.value;
  });
  renderLocalRecords();
}

function renderLocalRecords() {
  const month = activeDraftMonthKey();
  const monthLabel = formatMonthShortLabel(month);
  const monthTransactions = state.records.filter((record) => (record.record_kind || "transaction") === "transaction" && String(record.transaction_date || "").startsWith(month));
  const monthIncome = monthTransactions.filter((record) => record.transaction_type === "income");
  const monthExpense = monthTransactions.filter((record) => record.transaction_type === "expense");
  const monthCards = state.records.filter((record) => record.record_kind === "credit_card_adjustment" && (record.period_month || "").startsWith(month));
  renderDraftEntryGrid(monthIncome, monthExpense, monthCards);
  renderBookTotals(monthIncome, monthExpense);
  if (!monthTransactions.length && !monthCards.length) {
    localRecords.innerHTML = `
      <div class="list-row static">
        <i class="tile gold"></i>
        <span><b>${monthLabel}还没有记账明细</b><small>可切换月份查看过往记录，或先记一笔收入/支出。</small></span>
        <em>空</em>
      </div>
    `;
    return;
  }
  if (state.draftSection === "income") {
    localRecords.innerHTML = renderTransactionGroup("收入", monthIncome, "income");
  } else if (state.draftSection === "expense") {
    localRecords.innerHTML = renderTransactionGroup("支出", monthExpense, "expense");
  } else if (state.draftSection === "credit" && monthCards.length) {
    localRecords.innerHTML = renderCreditCardDraftGroup(monthCards);
  } else {
    localRecords.innerHTML = renderAllDraftRecords(monthTransactions, monthCards);
  }
}

function showSyncDialog() {
  const pending = pendingRecords();
  const summary = summarizeRecords(pending);
  const draftMonthLabel = formatMonthShortLabel(activeDraftMonthKey());
  const publishedMonthLabel = formatMonthShortLabel(mobileDashboardSnapshot.snapshotMonth);
  if (syncDialogTitle) syncDialogTitle.textContent = `同步 ${draftMonthLabel}草稿`;
  syncDialogText.innerHTML = pending.length
    ? `
      <div class="sync-summary-grid">
        <article><span>收入</span><strong>${summary.incomeCount} 笔</strong><small>${formatPlainMoney(summary.incomeAmount)}</small></article>
        <article><span>支出</span><strong>${summary.expenseCount} 笔</strong><small>${formatPlainMoney(summary.expenseAmount)}</small></article>
      </div>
      <div class="sync-impact-list">
        <section>
          <b>同步后会影响</b>
          <p>${draftMonthLabel}手机记账草稿。</p>
        </section>
        <section>
          <b>暂不影响</b>
          <p>${publishedMonthLabel}首页看板、资产总额、净资产、资产配置、正式健康看板和月报。</p>
        </section>
        <section>
          <b>下一步</b>
          <p>电脑端确认 ${draftMonthLabel}收支并发布财务健康看板后，手机看板刷新。</p>
        </section>
      </div>
    `
    : `
      <div class="sync-empty">
        <strong>当前没有待同步的 ${draftMonthLabel}草稿</strong>
        <span>新增收入或支出后，这里会显示本次同步内容。</span>
      </div>
    `;
  openModal(syncDialog);
}

function openModal(dialog) {
  if (!dialog) return;
  try {
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
      dialog.classList.add("modal-open");
      return;
    }
  } catch {
    // Some mobile browsers expose dialog.showModal but fail to display it reliably.
  }
  dialog.setAttribute("open", "");
  dialog.classList.add("modal-open");
}

function closeModal(dialog) {
  if (!dialog) return;
  try {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  } catch {
    dialog.removeAttribute("open");
  }
  dialog.classList.remove("modal-open");
}

async function reportMobileStatus() {
  if (!accountId) return;
  try {
    const pending = pendingRecords();
    const synced = state.records.filter((record) => record.sync_status === "synced");
    await fetch(`${syncEndpoint}/mobile-sync/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        account_id: accountId,
        app_version: MOBILE_APP_VERSION,
        pending_count: pending.length,
        synced_count: synced.length
      })
    });
  } catch {
    // 电脑 App 未启动时，手机继续保留本地草稿。
  }
}

function renderPairCard() {
  const signedIn = Boolean(cloudSession?.access_token);
  pairCard.hidden = signedIn;
  bindingInfoButton.hidden = !signedIn;
  bindingInfoButton.innerHTML = icons.account;
  bindingInfoButton.setAttribute("aria-label", "账号同步");
  bindingInfoButton.setAttribute("title", "账号同步");
  bindingInfoButton.dataset.tooltip = "账号同步";
  pairCard.classList.toggle("bound", signedIn);
  pairCardTitle.textContent = signedIn ? "账号已登录" : "登录或注册账号";
  pairCardText.textContent = signedIn
    ? "手机草稿会先进入云端草稿箱。"
    : "先登录账号。新邮箱登录失败后，可以直接创建账号。";
  cloudLoginButton.textContent = signedIn ? "账号同步" : "登录 / 注册";
}

function showPairDialog(options = {}) {
  const showDetail = Boolean(options.showDetail && accountId);
  const bindingInfo = readBindingInfo();
  pairDialog.querySelector("h2").textContent = showDetail ? "电脑绑定" : "绑定电脑";
  pairDialogIntro.textContent = showDetail
    ? "当前手机已经和电脑同步入口绑定。重新绑定只会更换手机连接的电脑账户。"
    : "输入电脑端显示的绑定码。绑定后，手机草稿会进入电脑端手机收件箱。";
  bindingDetail.hidden = !showDetail;
  if (showDetail) {
    bindingDetail.innerHTML = `
      <section><b>电脑地址</b><span>${escapeHtml(bindingInfo.syncEndpoint || syncEndpoint)}</span></section>
      <section><b>绑定码</b><span>${escapeHtml(bindingInfo.pairingCode || "请以电脑端当前显示为准")}</span></section>
      <section><b>绑定时间</b><span>${escapeHtml(bindingInfo.pairedAt || "本机已绑定")}</span></section>
      <section><b>连接状态</b><span id="bindingConnectionStatus">检查中</span></section>
      <p>未同步草稿仍保存在这台手机；重新绑定后会同步到新的电脑收件箱。已进入电脑收件箱或已入库的数据不会因为手机重新绑定而删除。</p>
    `;
  } else {
    bindingDetail.innerHTML = "";
  }
  pairCodeInput.value = "";
  pairSubmitButton.textContent = accountId ? "重新绑定" : "绑定";
  unpairButton.hidden = !showDetail;
  openModal(pairDialog);
  pairCodeInput.focus();
  if (showDetail) void checkBindingConnection();
}

async function unpairThisDevice() {
  try {
    await fetch(`${syncEndpoint}/mobile-sync/unpair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, account_id: accountId })
    });
  } catch {
    // 即使电脑暂时不在线，本机也先退出绑定。
  }
  clearLocalBinding();
  closeModal(pairDialog);
  renderAssetDashboard();
  renderTargetDeviation();
  render();
  renderPairCard();
  showToast("已解除本机绑定");
}

function clearLocalBinding() {
  accountId = "";
  localStorage.removeItem(ACCOUNT_ID_KEY);
  localStorage.removeItem(BINDING_INFO_KEY);
  sessionStorage.removeItem(MOBILE_SESSION_UNLOCK_KEY);
  mobileDashboardSnapshot = makeEmptyDashboardSnapshot();
}

async function checkBindingConnection() {
  const status = document.querySelector("#bindingConnectionStatus");
  if (!status) return;
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/health`);
    status.textContent = response.ok ? "已连到电脑，同步可用" : "电脑同步服务未响应";
  } catch {
    status.textContent = "未连到电脑，请确认同一 Wi-Fi/热点且电脑允许局域网访问";
  }
}

async function canReachBoundDesktop() {
  if (!accountId) return false;
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function openPasswordChangeIfConnected() {
  if (!accountId) {
    showToast("请先绑定电脑");
    return;
  }
  const connected = await canReachBoundDesktop();
  if (!connected) {
    showToast("连接电脑后才能修改密码");
    return;
  }
  currentPasswordInput.value = "";
  newPasswordInput.value = "";
  passwordChangeHint.textContent = "新密码至少 6 位。只有连接到已绑定电脑时才能修改。";
  openModal(passwordChangeDialog);
  currentPasswordInput.focus();
}

function showPasswordGateIfNeeded() {
  if (!accountId || sessionStorage.getItem(MOBILE_SESSION_UNLOCK_KEY) === "true") return;
  openModal(passwordDialog);
  passwordInput.focus();
}

async function unlockMobileApp() {
  const password = passwordInput.value;
  if (!password) {
    passwordInput.focus();
    return;
  }
  passwordSubmitButton.disabled = true;
  passwordSubmitButton.textContent = "验证中";
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) throw new Error(await response.text());
    sessionStorage.setItem(MOBILE_SESSION_UNLOCK_KEY, "true");
    passwordInput.value = "";
    closeModal(passwordDialog);
    await loadMobileDashboardSnapshot();
    showToast("已解锁");
  } catch {
    passwordHint.textContent = "密码不正确，或电脑端不在同一网络。请确认电脑 App 已打开。";
    passwordInput.focus();
  } finally {
    passwordSubmitButton.disabled = false;
    passwordSubmitButton.textContent = "解锁";
  }
}

async function changeMobilePassword() {
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  if (!(await canReachBoundDesktop())) {
    passwordChangeHint.textContent = "当前没有连到已绑定电脑，不能修改密码。";
    return;
  }
  if (newPassword.length < 6) {
    passwordChangeHint.textContent = "新密码至少 6 位。";
    newPasswordInput.focus();
    return;
  }
  passwordChangeSubmitButton.disabled = true;
  passwordChangeSubmitButton.textContent = "保存中";
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
    if (!response.ok) throw new Error(await response.text());
    closeModal(passwordChangeDialog);
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    showToast("密码已修改");
  } catch {
    passwordChangeHint.textContent = "修改失败：请确认当前密码正确，且电脑 App 已打开。";
  } finally {
    passwordChangeSubmitButton.disabled = false;
    passwordChangeSubmitButton.textContent = "保存";
  }
}

function cloudSyncConfigured() {
  return Boolean(CLOUD_SYNC_URL && CLOUD_SYNC_PUBLISHABLE_KEY && !CLOUD_SYNC_PUBLISHABLE_KEY.includes("PASTE_"));
}

function readCloudSession() {
  try {
    const raw = localStorage.getItem(CLOUD_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function rememberCloudSession(session) {
  cloudSession = session;
  if (session) {
    localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(CLOUD_SESSION_KEY);
  }
  void loadMobileDashboardSnapshot();
  render();
}

function cloudHeaders(session = cloudSession) {
  return {
    apikey: CLOUD_SYNC_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session?.access_token || CLOUD_SYNC_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
}

function isCloudTokenExpiredText(text) {
  return /jwt expired|pgrst303/i.test(String(text || ""));
}

async function refreshCloudSession() {
  if (!cloudSession?.refresh_token) {
    rememberCloudSession(null);
    throw new Error("登录已过期，请重新登录账号同步。");
  }
  const response = await fetch(`${CLOUD_SYNC_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: cloudHeaders(null),
    body: JSON.stringify({ refresh_token: cloudSession.refresh_token })
  });
  if (!response.ok) {
    rememberCloudSession(null);
    throw new Error("登录已过期，请重新登录账号同步。");
  }
  const refreshed = await response.json();
  rememberCloudSession({ ...refreshed, user: refreshed.user || cloudSession.user });
  return cloudSession;
}

async function cloudFetch(url, options = {}) {
  const buildOptions = () => ({
    ...options,
    headers: {
      ...(options.headers || {}),
      ...cloudHeaders(),
      Accept: options.headers?.Accept || "application/json"
    }
  });
  let response = await fetch(url, buildOptions());
  if (response.ok) return response;
  const text = await response.text();
  if (!isCloudTokenExpiredText(text)) throw new Error(text);
  await refreshCloudSession();
  response = await fetch(url, buildOptions());
  if (!response.ok) throw new Error(await response.text());
  return response;
}

function showCloudDialog() {
  if (!cloudSyncConfigured()) {
    showToast("云同步还没有配置完成");
    return;
  }
  const signedIn = Boolean(cloudSession?.access_token);
  cloudDialogCopy.textContent = signedIn
    ? "当前手机已登录账号同步。手机草稿会先进云端草稿箱；电脑端需要用同一账号拉取。"
    : "同步后，手机草稿会进入云端草稿箱，电脑端再确认入库。";
  cloudAccountDetail.hidden = !signedIn;
  cloudAccountDetail.innerHTML = signedIn
    ? `
      <section><b>当前账号</b><span>${escapeHtml(cloudSession.user?.email || cloudSession.user?.id || "账号")}</span></section>
      <section><b>下一步</b><span>在电脑端 WorthTrace 打开“账号与同步”，登录同一账号，再拉取云端草稿。</span></section>
    `
    : "";
  cloudEmailField.hidden = signedIn;
  cloudPasswordField.hidden = signedIn;
  cloudEmailInput.value = signedIn ? "" : "";
  cloudPasswordInput.value = "";
  cloudPasswordInput.type = "password";
  cloudPasswordToggle.textContent = "显示";
  cloudResendButton.hidden = true;
  cloudSignupButton.hidden = true;
  cloudLogoutButton.hidden = !signedIn;
  cloudLoginSubmitButton.hidden = signedIn;
  cloudHint.textContent = signedIn ? "账号同步已开启。" : "输入邮箱和密码登录。密码区分大小写。";
  openModal(cloudDialog);
  if (!signedIn) cloudEmailInput.focus();
}

async function readAuthError(response) {
  try {
    const data = await response.json();
    return data.msg || data.message || data.error_description || data.error || response.statusText;
  } catch {
    return response.statusText || "请求失败";
  }
}

function friendlyAuthError(message, mode) {
  const text = String(message || "").replace(/^Error:\s*/, "").trim();
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

function shouldShowResendConfirmation(message) {
  return /验证|确认|confirm|confirmed|confirmation/i.test(String(message || ""));
}

async function cloudResendConfirmation() {
  const email = cloudEmailInput.value.trim();
  if (!email) {
    cloudHint.textContent = "请输入邮箱后再重发验证邮件。";
    cloudEmailInput.focus();
    return;
  }
  cloudResendButton.disabled = true;
  cloudHint.textContent = "正在重新发送验证邮件。";
  try {
    const response = await fetch(`${CLOUD_SYNC_URL}/auth/v1/resend`, {
      method: "POST",
      headers: cloudHeaders(null),
      body: JSON.stringify({ type: "signup", email })
    });
    if (!response.ok) throw new Error(await readAuthError(response));
    cloudHint.textContent = "验证邮件已重新发送。请检查收件箱和垃圾邮件。";
  } catch (err) {
    cloudHint.textContent = friendlyAuthError(err, "signup");
  } finally {
    cloudResendButton.disabled = false;
  }
}

async function cloudAuth(mode) {
  if (cloudSession?.access_token) {
    showCloudDialog();
    return;
  }
  if (!cloudSyncConfigured()) {
    cloudHint.textContent = "云同步还没有配置完成。";
    return;
  }
  const email = cloudEmailInput.value.trim();
  const password = cloudPasswordInput.value;
  if (!email || password.length < 6) {
    cloudHint.textContent = "请输入邮箱和至少 6 位密码。";
    return;
  }
  if (mode === "signin") {
    cloudSignupButton.hidden = true;
    cloudResendButton.hidden = true;
  }
  cloudLoginSubmitButton.disabled = true;
  cloudSignupButton.disabled = true;
  cloudResendButton.disabled = true;
  try {
    const path = mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
    const response = await fetch(`${CLOUD_SYNC_URL}${path}`, {
      method: "POST",
      headers: cloudHeaders(null),
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error(await readAuthError(response));
    const session = await response.json();
    if (!session?.access_token) {
      cloudHint.textContent = mode === "signup"
        ? "账号注册已提交。请先打开邮箱完成验证，验证后回到这里登录。"
        : "登录失败，请检查邮箱、密码或邮箱验证状态。";
      cloudResendButton.hidden = !shouldShowResendConfirmation(cloudHint.textContent);
      if (mode === "signup") {
        cloudSignupButton.hidden = true;
      }
      return;
    }
    rememberCloudSession(session);
    closeModal(cloudDialog);
    showToast(mode === "signup" ? "账号已创建" : "已登录账号同步");
  } catch (err) {
    const message = friendlyAuthError(err, mode);
    if (mode === "signin") {
      cloudHint.textContent = message;
      cloudSignupButton.hidden = !message.includes("新邮箱");
      cloudResendButton.hidden = false;
    } else {
      cloudHint.textContent = message;
      cloudSignupButton.hidden = true;
      cloudResendButton.hidden = !email;
    }
  } finally {
    cloudLoginSubmitButton.disabled = false;
    cloudSignupButton.disabled = false;
    cloudResendButton.disabled = false;
  }
}

function cloudDraftFromRecord(record) {
  const payload = record.payload_json && typeof record.payload_json === "object"
    ? {
      ...record.payload_json,
      local_id: record.local_id,
      record_kind: record.record_kind || "transaction",
      operation: record.operation,
      sync_status: record.sync_status,
      period_month: record.period_month,
      updated_at: record.updated_at
    }
    : { ...record };
  if (record.record_kind === "credit_card_adjustment") {
    payload.net_adjustment = record.net_adjustment;
  }
  return {
    user_id: cloudSession.user.id,
    device_id: deviceId,
    local_id: record.local_id,
    record_kind: record.record_kind || "transaction",
    transaction_type: record.transaction_type || null,
    transaction_date: record.transaction_date || null,
    period_month: record.period_month || null,
    amount: record.amount ?? null,
    currency: record.currency || "CNY",
    category: record.category || null,
    note: record.note || null,
    payload_json: payload,
    sync_status: "pending",
    updated_at: new Date().toISOString()
  };
}

async function syncPendingToCloud(pending) {
  if (!cloudSession) {
    showCloudDialog();
    return false;
  }
  const response = await cloudFetch(`${CLOUD_SYNC_URL}/rest/v1/mobile_cloud_drafts?on_conflict=user_id,local_id`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(pending.map(cloudDraftFromRecord))
  });
  if (!response.ok) throw new Error(await response.text());
  state.records = state.records.map((record) =>
    pending.some((item) => item.local_id === record.local_id)
      ? { ...record, sync_status: "synced", server_id: `cloud:${record.local_id}`, updated_at: new Date().toISOString() }
      : record
  );
  await replaceRecords(state.records);
  render();
  showToast(`已上传 ${pending.length} 条到云端草稿箱`);
  return true;
}

async function syncPendingToDesktop() {
  const pending = pendingRecords();
  if (!pending.length) {
    closeModal(syncDialog);
    showToast("没有待同步草稿");
    return;
  }
  if (!accountId) {
    if (await syncPendingToCloud(pending)) {
      closeModal(syncDialog);
      return;
    }
    return;
  }
  const syncButton = document.querySelector("#mockSyncButton");
  syncButton.disabled = true;
  syncButton.textContent = "同步中";
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        account_id: accountId,
        app_version: MOBILE_APP_VERSION,
        records: pending
      })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const result = await response.json();
    const ackByLocalId = new Map((result.records || []).map((record) => [record.local_id, record]));
    state.records = state.records.map((record) => {
      const ack = ackByLocalId.get(record.local_id);
      if (!ack) return record;
      return {
        ...record,
        sync_status: "synced",
        server_id: ack.server_id,
        updated_at: new Date().toISOString()
      };
    });
    await replaceRecords(state.records);
    closeModal(syncDialog);
    render();
    void reportMobileStatus();
    showToast(`已同步 ${result.accepted_count || 0} 条到电脑收件箱`);
  } catch (err) {
    if (cloudSession && (await syncPendingToCloud(pending))) {
      closeModal(syncDialog);
    } else {
      showToast("同步失败：请确认电脑 App 已打开，或登录账号同步");
      syncDialogText.insertAdjacentHTML(
        "beforeend",
        `<p class="sync-prototype-note">同步失败。${escapeHtml(String(err))}</p>`
      );
    }
  } finally {
    syncButton.disabled = false;
    syncButton.textContent = "同步草稿";
  }
}

async function pairFromUrlIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  const pairCode = params.get("pairCode")?.trim();
  if (!pairCode) return;
  await pairWithDesktop(pairCode);
}

async function pairWithDesktop(pairCode) {
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        device_name: navigator.userAgent.includes("iPhone") ? "iPhone" : navigator.userAgent.includes("Android") ? "Android" : "Mobile Browser",
        pairing_code: pairCode,
        app_version: MOBILE_APP_VERSION
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    accountId = result.account_id || "";
    if (accountId) {
      localStorage.setItem(ACCOUNT_ID_KEY, accountId);
      localStorage.setItem(BINDING_INFO_KEY, JSON.stringify({
        syncEndpoint,
        pairingCode: pairCode.trim().toUpperCase(),
        pairedAt: new Date().toLocaleString("zh-CN", { hour12: false })
      }));
      mobileDashboardSnapshot = makeEmptyDashboardSnapshot();
      renderPairCard();
      render();
      showPasswordGateIfNeeded();
      void reportMobileStatus();
      showToast("已绑定电脑账户");
    }
  } catch (err) {
    showToast("绑定失败：请检查电脑端绑定码");
    console.warn(err);
  }
}

function readBindingInfo() {
  try {
    return JSON.parse(localStorage.getItem(BINDING_INFO_KEY) || "{}");
  } catch {
    return {};
  }
}

function summarizeRecords(records) {
  return records.reduce(
    (summary, record) => {
      const kind = record.record_kind || "transaction";
      if (kind === "credit_card_adjustment") {
        summary.creditCardCount += 1;
        summary.creditCardNetAdjustment += Number(record.net_adjustment) || 0;
      } else if (record.transaction_type === "income") {
        summary.incomeCount += 1;
        summary.incomeAmount += Number(record.amount) || 0;
      } else if (record.transaction_type === "expense") {
        summary.expenseCount += 1;
        summary.expenseAmount += Number(record.amount) || 0;
      }
      return summary;
    },
    { incomeCount: 0, incomeAmount: 0, expenseCount: 0, expenseAmount: 0, creditCardCount: 0, creditCardNetAdjustment: 0 }
  );
}

function renderTransactionGroup(title, rows, type) {
  const total = rows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const statusText = rows.length ? `${rows.length} 笔 · 合计 ${formatPlainMoney(total)}` : "0 笔";
  return `
    <section class="draft-group">
      <header>
        <strong>${title}</strong>
        <span>${statusText}</span>
      </header>
      <div class="draft-table">
        <div class="draft-row draft-head"><span>日期</span><span>分类</span><span>金额</span></div>
        ${rows.length ? rows.map((record) => renderTransactionRow(record, type)).join("") : `<div class="draft-empty">${title}暂无记录</div>`}
      </div>
    </section>
  `;
}

function renderDraftEntryGrid(incomeRows, expenseRows, cardRows) {
  if (!draftEntryGrid) return;
  const incomeTotal = incomeRows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const expenseTotal = expenseRows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const cardTotal = cardRows.reduce((sum, record) => sum + (Number(record.net_adjustment) || 0), 0);
  const cards = [
    draftEntryButton("all", "明细", incomeRows.length + expenseRows.length, incomeTotal - expenseTotal),
    draftEntryButton("income", "收入", incomeRows.length, incomeTotal),
    draftEntryButton("expense", "支出", expenseRows.length, expenseTotal)
  ];
  if (cardRows.length > 0) {
    cards.push(draftEntryButton("credit", "信用卡", cardRows.length, cardTotal));
  }
  draftEntryGrid.innerHTML = cards.join("");
}

function draftEntryButton(section, label, count, amount) {
  const active = state.draftSection === section ? " active" : "";
  return `
    <button class="draft-entry${active}" data-draft-section="${section}" type="button">
      <span>${label}</span>
      <strong>${count} ${section === "credit" ? "条" : "笔"}</strong>
      <small>${formatPlainMoney(amount)}</small>
    </button>
  `;
}

function renderTransactionRow(record, type) {
  const sign = type === "income" ? "+" : "-";
  const status = record.sync_status === "synced" ? "已同步" : "待同步";
  const icon = categoryIcon(record.category, type);
  const active = state.editingLocalId === record.local_id ? " editing" : "";
  return `
    <button class="draft-row draft-row-button${active}" data-edit-record="${escapeHtml(record.local_id)}" type="button">
      <span class="draft-date">${formatDayLabel(record.transaction_date || "")}</span>
      <span class="draft-category"><i>${icon}</i><b>${escapeHtml(record.note || record.category || "未分类")}</b><small>${escapeHtml(record.category || "未分类")} · ${escapeHtml(status)}</small></span>
      <span>${sign}${formatPlainMoney(record.amount).replace("CNY ", "")}</span>
    </button>
  `;
}

function renderAllDraftRecords(transactionRows, cardRows) {
  const rows = [...transactionRows].sort((a, b) => String(b.transaction_date || "").localeCompare(String(a.transaction_date || "")));
  const transactionHtml = rows.length
    ? renderTransactionsByDate(rows)
    : "";
  return `
    <section class="draft-group">
      <header>
        <strong>明细</strong>
        <span>${rows.length} 笔 · 收入支出合并</span>
      </header>
      <div class="draft-table detailed">
        ${transactionHtml || `<div class="draft-empty">本月暂无收入/支出记录</div>`}
      </div>
    </section>
  `;
}

function renderTransactionsByDate(rows) {
  const groups = rows.reduce((map, record) => {
    const date = record.transaction_date || "";
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(record);
    return map;
  }, new Map());
  return Array.from(groups.entries()).map(([date, records]) => {
    const summary = summarizeRecords(records);
    const parts = [];
    if (summary.incomeAmount) parts.push(`收入 ${formatPlainMoney(summary.incomeAmount).replace("CNY ", "")}`);
    if (summary.expenseAmount) parts.push(`支出 ${formatPlainMoney(summary.expenseAmount).replace("CNY ", "")}`);
    return `
      <section class="book-day-group">
        <header>
          <span>${formatDateHeader(date)}</span>
          <em>${parts.join(" · ") || `${records.length} 笔`}</em>
        </header>
        ${records.map((record) => renderTransactionRow(record, record.transaction_type)).join("")}
      </section>
    `;
  }).join("");
}

function renderBookTotals(incomeRows, expenseRows) {
  const incomeTotal = incomeRows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const expenseTotal = expenseRows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  if (bookMonthIncome) {
    bookMonthIncome.dataset.value = formatPlainMoney(incomeTotal);
    bookMonthIncome.textContent = bookMonthIncome.dataset.value;
  }
  if (bookMonthExpense) {
    bookMonthExpense.dataset.value = formatPlainMoney(expenseTotal);
    bookMonthExpense.textContent = bookMonthExpense.dataset.value;
  }
  if (bookMonthInput && bookMonthInput.value !== state.bookMonth) {
    bookMonthInput.value = state.bookMonth;
  }
}

function formatDateHeader(value) {
  if (!value || value.length < 10) return "未填日期";
  const date = new Date(`${value}T00:00:00`);
  const weekday = Number.isNaN(date.getTime())
    ? ""
    : `星期${"日一二三四五六"[date.getDay()]}`;
  return `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日${weekday ? ` ${weekday}` : ""}`;
}

function renderCreditCardDraftGroup(rows) {
  if (!rows.length) return "";
  const total = rows.reduce((sum, record) => sum + (Number(record.net_adjustment) || 0), 0);
  return `
    <section class="draft-group">
      <header>
        <strong>信用卡调整</strong>
        <span>${rows.length} 条 · 净调整 ${state.privacy ? "••••••" : formatPlainMoney(total)}</span>
      </header>
      <div class="draft-table">
        <div class="draft-row draft-head"><span>月份</span><span>项目</span><span>金额</span></div>
        ${rows.map((record) => `
          <div class="draft-row">
            <span>${escapeHtml(record.period_month || "")}</span>
            <span>净调整<small>${record.sync_status === "synced" ? "已同步" : "待同步"}</small></span>
            <span>${state.privacy ? "••••••" : formatPlainMoney(record.net_adjustment).replace("CNY ", "")}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function currentMonthKey() {
  return todayKey().slice(0, 7);
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function activeDraftMonthKey() {
  return state.bookMonth || currentMonthKey();
}

function nextMonthKey(monthKey) {
  if (!monthKey || monthKey.length < 7) return currentMonthKey();
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return currentMonthKey();
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function resetRuntimeCacheIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("resetCache") !== "1" || params.get("cacheResetDone") === MOBILE_APP_VERSION) return;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache reset is best-effort; versioned asset URLs still force a fresh fetch.
  }
  params.set("cacheResetDone", MOBILE_APP_VERSION);
  window.location.replace(`${window.location.pathname}?${params.toString()}`);
  await new Promise(() => {});
}

function previousMonthKey(monthKey = currentMonthKey()) {
  if (!monthKey || monthKey.length < 7) return "";
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isPublishedTrendMonth(periodMonth, snapshotMonth) {
  return Boolean(periodMonth)
    && periodMonth < currentMonthKey()
    && (!snapshotMonth || periodMonth <= snapshotMonth);
}

function resolvePublishedSnapshotMonth(data, snapshotMonthOverride = "") {
  const requestedMonth = snapshotMonthOverride || data.snapshot_month || "";
  if (requestedMonth && requestedMonth < currentMonthKey()) return requestedMonth;
  const trendMonths = Array.isArray(data.monthly_trends)
    ? data.monthly_trends
      .map((item) => item.period_month || "")
      .filter((periodMonth) => periodMonth && periodMonth < currentMonthKey())
      .sort((a, b) => a.localeCompare(b))
    : [];
  return trendMonths[trendMonths.length - 1] || previousMonthKey();
}

async function fetchDesktopDashboardSnapshot() {
  const response = await fetch(`${syncEndpoint}/mobile-sync/dashboard`);
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return normalizeDashboardSnapshot(data);
}

function renderLoadedDashboardSnapshot(snapshot) {
  mobileDashboardSnapshot = snapshot;
  renderAssetDashboard();
  renderTargetDeviation();
  render();
}

async function loadMobileDashboardSnapshot() {
  if (cloudSession?.access_token) {
    try {
      const response = await cloudFetch(
        `${CLOUD_SYNC_URL}/rest/v1/mobile_dashboard_snapshots?select=snapshot_month,payload_json&order=updated_at.desc&limit=1`,
        {
          headers: {
            Accept: "application/json"
          }
        }
      );
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      if (Array.isArray(rows) && rows[0]?.payload_json) {
        const cloudSnapshot = normalizeDashboardSnapshot(rows[0].payload_json, rows[0].snapshot_month || "");
        try {
          const desktopSnapshot = await fetchDesktopDashboardSnapshot();
          renderLoadedDashboardSnapshot(desktopSnapshot.snapshotMonth ? desktopSnapshot : cloudSnapshot);
        } catch {
          renderLoadedDashboardSnapshot(cloudSnapshot);
        }
        return;
      }
    } catch {
      try {
        renderLoadedDashboardSnapshot(await fetchDesktopDashboardSnapshot());
      } catch {
        renderLoadedDashboardSnapshot(makeEmptyDashboardSnapshot());
      }
      return;
    }
  }
  if (!canUseDesktopData()) {
    renderLoadedDashboardSnapshot(makeEmptyDashboardSnapshot());
    return;
  }
  try {
    renderLoadedDashboardSnapshot(await fetchDesktopDashboardSnapshot());
  } catch {
    renderLoadedDashboardSnapshot(makeEmptyDashboardSnapshot());
  }
}

function normalizeDashboardSnapshot(data, snapshotMonthOverride = "") {
  const snapshotMonth = resolvePublishedSnapshotMonth(data, snapshotMonthOverride);
  return {
    snapshotMonth,
    targetSavingRate: Number(data.target_saving_rate) || 0,
    assetGrossValue: Number(data.asset_gross_value) || 0,
    creditCardNetAdjustment: Number(data.credit_card_net_adjustment) || 0,
    netWorth: Number(data.net_worth) || 0,
    investmentBuy: Number(data.investment_buy) || 0,
    investmentSell: Number(data.investment_sell) || 0,
    investmentDividend: Number(data.investment_dividend) || 0,
    assetAllocations: Array.isArray(data.asset_allocations)
      ? data.asset_allocations.map((item) => ({
        category: item.category,
        amount: Number(item.amount) || 0,
        percent: Number(item.percent) || 0
      }))
      : [],
    allocationTargets: Array.isArray(data.portfolio_targets)
      ? data.portfolio_targets.map((item) => ({
        category: item.category,
        target: Number(item.target_percent) || 0,
        current: Number(item.current_percent) || 0,
        amount: Number(item.current_amount) || 0,
        deviation: Number(item.deviation_percent) || 0
      }))
      : [],
    monthlyTrends: Array.isArray(data.monthly_trends)
      ? data.monthly_trends.map((item) => ({
        periodMonth: item.period_month,
        income: Number(item.income) || 0,
        expense: Number(item.expense) || 0,
        savingAmount: Number(item.saving_amount) || 0,
        netWorth: Number(item.net_worth) || 0,
        savingRate: Number(item.saving_rate) || 0,
        investmentBuy: Number(item.investment_buy) || 0,
        investmentSell: Number(item.investment_sell) || 0,
        investmentDividend: Number(item.investment_dividend) || 0,
        investmentGain: Number(item.investment_gain) || 0,
        monthlyXirr: item.monthly_xirr === null || item.monthly_xirr === undefined ? null : Number(item.monthly_xirr)
      }))
        .filter((item) => isPublishedTrendMonth(item.periodMonth, snapshotMonth))
        .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
      : [],
    expenseCategories: Array.isArray(data.expense_categories)
      ? data.expense_categories.map((item) => ({
        category: item.category || "未分类",
        amount: Number(item.amount) || 0,
        percent: Number(item.percent) || 0
      }))
      : [],
    expenseYearRank: Array.isArray(data.expense_year_rank)
      ? data.expense_year_rank.map((item) => ({
        category: item.category || "未分类",
        amount: Number(item.amount) || 0,
        percent: Number(item.percent) || 0
      }))
      : [],
    expenseCategoryTrends: Array.isArray(data.expense_category_trends)
      ? data.expense_category_trends.map((item) => ({
        periodMonth: item.period_month || "",
        category: item.category || "未分类",
        amount: Number(item.amount) || 0
      }))
        .filter((item) => isPublishedTrendMonth(item.periodMonth, snapshotMonth))
      : [],
    spendingAnomalies: Array.isArray(data.spending_anomalies)
      ? data.spending_anomalies.map((item) => ({
        transactionDate: item.transaction_date || "",
        category: item.category || "未分类",
        amount: Number(item.amount) || 0,
        note: item.note || "",
        reason: item.reason || ""
      }))
      : [],
    investmentAssets: Array.isArray(data.investment_assets)
      ? data.investment_assets.map((item) => ({
        assetName: item.asset_name || "未命名资产",
        beginningValue: Number(item.beginning_value) || 0,
        endingValue: Number(item.ending_value) || 0,
        buy: Number(item.buy) || 0,
        sell: Number(item.sell) || 0,
        dividend: Number(item.dividend) || 0,
        gain: Number(item.gain) || 0,
        periodReturn: item.period_return === null || item.period_return === undefined ? null : Number(item.period_return),
        monthlyXirr: item.monthly_xirr === null || item.monthly_xirr === undefined ? null : Number(item.monthly_xirr)
      }))
      : [],
    investmentGroupPerformances: Array.isArray(data.investment_group_performances)
      ? data.investment_group_performances.map(normalizeInvestmentGroupPerformance)
      : [],
    investmentGroupTrends: Array.isArray(data.investment_group_trends)
      ? data.investment_group_trends.map((item) => ({
        ...normalizeInvestmentGroupPerformance(item),
        periodMonth: item.period_month || ""
      }))
        .filter((item) => isPublishedTrendMonth(item.periodMonth, snapshotMonth))
      : [],
    investmentCashflowCalendar: Array.isArray(data.investment_cashflow_calendar)
      ? data.investment_cashflow_calendar.map((item) => ({
        flowDate: item.flow_date || "",
        assetName: item.asset_name || "未命名资产",
        flowType: item.flow_type || "",
        amount: Number(item.amount) || 0
      }))
      : [],
    assetEntryItems: Array.isArray(data.asset_entry_items)
      ? data.asset_entry_items.map(normalizeAssetEntryItem)
      : [],
    dcaCashflows: Array.isArray(data.dca_cashflows)
      ? data.dca_cashflows.map(normalizeDcaCashflow)
      : []
  };
}

function makeEmptyDashboardSnapshot() {
  return {
    snapshotMonth: "",
    targetSavingRate: 0,
    assetGrossValue: 0,
    creditCardNetAdjustment: 0,
    netWorth: 0,
    investmentBuy: 0,
    investmentSell: 0,
    investmentDividend: 0,
    assetAllocations: [],
    allocationTargets: [],
    monthlyTrends: [],
    expenseCategories: [],
    expenseYearRank: [],
    expenseCategoryTrends: [],
    spendingAnomalies: [],
    investmentAssets: [],
    investmentGroupPerformances: [],
    investmentGroupTrends: [],
    investmentCashflowCalendar: [],
    assetEntryItems: [],
    dcaCashflows: []
  };
}

function normalizeAssetEntryItem(item) {
  return {
    id: item.id || item.asset_id || createLocalId("asset"),
    name: item.name || item.asset_name || "未命名资产",
    asset_type: item.asset_type || null,
    main_asset_category_id: item.main_asset_category_id || null,
    sub_asset_category_id: item.sub_asset_category_id || null,
    main_category: item.main_category || "",
    sub_category: item.sub_category || null,
    tags: item.tags || "",
    currency: item.currency || "CNY",
    platform: item.platform || "",
    is_dca: Boolean(item.is_dca),
    asset_status: item.asset_status || "active",
    note: item.note || "",
    month_end_amount: Number(item.month_end_amount) || 0,
    month_status: item.month_status || "held",
    previous_snapshot_month: item.previous_snapshot_month || "",
    previous_month_amount: Number(item.previous_month_amount) || 0,
    previous_month_status: item.previous_month_status || "missing",
    confirmed: Boolean(item.confirmed),
    dca_plans: Array.isArray(item.dca_plans) ? item.dca_plans.map(normalizeDcaPlan) : [],
    cashflows: Array.isArray(item.cashflows) ? item.cashflows.map(normalizeDcaCashflow) : []
  };
}

function normalizeDcaPlan(plan) {
  return {
    id: plan.id ?? null,
    frequency: plan.frequency || "monthly",
    amount: Number(plan.amount) || 0,
    start_date: plan.start_date || `${activeDraftMonthKey()}-01`,
    end_date: plan.end_date || null,
    weekly_rules_json: plan.weekly_rules_json || null,
    monthly_day: plan.monthly_day === null || plan.monthly_day === undefined ? 1 : Number(plan.monthly_day) || 1
  };
}

function normalizeDcaCashflow(flow) {
  return {
    id: flow.id || createLocalId("flow"),
    asset_id: flow.asset_id || "",
    asset_name: flow.asset_name || "",
    flow_date: flow.flow_date || `${activeDraftMonthKey()}-28`,
    flow_type: flow.flow_type || "buy",
    amount: Number(flow.amount) || 0,
    currency: flow.currency || "CNY",
    source_kind: flow.source_kind || "monthly_asset_entry",
    dca_plan_id: flow.dca_plan_id ?? null,
    note: flow.note || "",
    included: flow.included !== false
  };
}

function normalizeInvestmentGroupPerformance(item) {
  return {
    groupName: item.group_name || "未命名资产组",
    buy: Number(item.buy) || 0,
    sell: Number(item.sell) || 0,
    dividend: Number(item.dividend) || 0,
    gain: Number(item.gain) || 0,
    endingValue: Number(item.ending_value) || 0,
    returnRate: item.return_rate === null || item.return_rate === undefined ? null : Number(item.return_rate)
  };
}

function hasUnlockedSession() {
  return sessionStorage.getItem(MOBILE_SESSION_UNLOCK_KEY) === "true";
}

function canUseDesktopData() {
  return Boolean(accountId) && hasUnlockedSession();
}

function updateAccessState() {
  document.body.classList.toggle("needs-binding", !accountId && !cloudSession?.access_token);
  document.body.classList.toggle("needs-unlock", Boolean(accountId) && !hasUnlockedSession());
}

function renderAssetDashboard() {
  renderAssetRangeTabs();
  const colors = ["#88a998", "#c7a76d", "#9cacbf", "#c47766", "#627d9a", "#b6927a", "#7d927f"];
  const allocations = mobileDashboardSnapshot.assetAllocations.filter((item) => item.percent > 0.0001);
  let cursor = 0;
  const segments = allocations.map((item, index) => {
    const start = cursor;
    const end = Math.min(100, cursor + item.percent * 100);
    cursor = end;
    return `${colors[index % colors.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  assetRing.style.background = segments.length ? `conic-gradient(${segments.join(", ")})` : "";
  const assetValue = document.querySelector("[data-view='allocation'] .wallet-hero .money");
  if (assetValue) {
    assetValue.dataset.value = formatPlainMoney(mobileDashboardSnapshot.netWorth);
  }
  const stamp = document.querySelector("[data-view='allocation'] .data-stamp");
  if (stamp) {
    stamp.textContent = `截至 ${formatMonthLabel(mobileDashboardSnapshot.snapshotMonth)}月报；本月手机草稿未计入`;
  }
  allocationLegend.innerHTML = allocations.map((item, index) => `
    <div class="allocation-legend-row">
      <i style="background:${colors[index % colors.length]}"></i>
      <span>${escapeHtml(item.category)}</span>
      <b class="percent" data-value="${formatPercentRaw(item.percent)}">${formatPercent(item.percent)}</b>
    </div>
  `).join("");
  renderAssetRangeSummary();
}

function renderAssetRangeTabs() {
  assetRangeTabs.innerHTML = assetRanges.map((range) => `
    <button class="${state.assetRange === range.key ? "active" : ""}" data-asset-range="${range.key}" type="button">${range.label}</button>
  `).join("");
}

function rangeTrendRows() {
  const rows = [...mobileDashboardSnapshot.monthlyTrends].sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
  if (!rows.length) return [];
  const active = assetRanges.find((item) => item.key === state.assetRange) || assetRanges[3];
  if (active.key === "ytd") {
    const year = rows[rows.length - 1].periodMonth.slice(0, 4);
    return rows.filter((item) => item.periodMonth.startsWith(year));
  }
  return rows.slice(-active.months);
}

function renderAssetRangeSummary() {
  const rows = rangeTrendRows();
  if (!rows.length) {
    assetRangeSummary.innerHTML = "";
    return;
  }
  const first = rows[0];
  const latest = rows[rows.length - 1];
  const active = assetRanges.find((item) => item.key === state.assetRange) || assetRanges[3];
  const netWorthChange = latest.netWorth - first.netWorth;
  const investmentGain = rows.reduce((sum, item) => sum + item.investmentGain, 0);
  assetRangeSummary.innerHTML = `
    <article><span>${active.label}净资产变化</span><b class="money" data-value="${formatPlainMoney(netWorthChange)}">${state.privacy ? "••••••" : formatPlainMoney(netWorthChange)}</b></article>
    <article><span>${formatMonthShortLabel(latest.periodMonth)}储蓄率</span><b class="percent" data-value="${formatPercentRaw(latest.savingRate)}">${formatPercent(latest.savingRate)}</b></article>
    <article><span>${active.label}投资收益</span><b class="money" data-value="${formatPlainMoney(investmentGain)}">${state.privacy ? "••••••" : formatPlainMoney(investmentGain)}</b></article>
  `;
}

function renderTargetDeviation() {
  if (!mobileDashboardSnapshot.allocationTargets.length) {
    targetDeviationSection.innerHTML = "";
    return;
  }
  targetDeviationSection.innerHTML = `
    <div class="asset-insight-card">
      <h2>目标偏离</h2>
      <div class="target-table">
        <div class="target-row target-head"><span>类别</span><span>当前 / 目标</span><span>偏离</span></div>
        ${mobileDashboardSnapshot.allocationTargets.map((item) => `
          <div class="target-row">
            <span>${escapeHtml(item.category)}</span>
            <span>
              <i style="--current: ${Math.max(0, Math.min(100, item.current * 100))}%; --target: ${Math.max(0, Math.min(100, item.target * 100))}%"></i>
              <small><span class="percent" data-value="${formatPercentRaw(item.current)}">${formatPercent(item.current)}</span> / <span class="percent" data-value="${formatPercentRaw(item.target)}">${formatPercent(item.target)}</span></small>
            </span>
            <b class="${item.deviation > 0 ? "positive" : item.deviation < 0 ? "negative" : ""}"><span class="percent" data-value="${formatSignedPercentRaw(item.deviation)}">${formatSignedPercent(item.deviation)}</span></b>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function latestMonthlyTrend() {
  return [...mobileDashboardSnapshot.monthlyTrends]
    .filter((item) => !mobileDashboardSnapshot.snapshotMonth || item.periodMonth <= mobileDashboardSnapshot.snapshotMonth)
    .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
    .pop() || null;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setMoney(selector, value) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.dataset.value = formatPlainMoney(value);
  node.textContent = state.privacy ? "••••••" : node.dataset.value;
}

function setPercent(selector, value) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.dataset.value = formatPercentRaw(value);
  node.textContent = formatPercent(value);
}

function renderSyncedDashboard() {
  const latest = latestMonthlyTrend();
  const monthLabel = formatMonthShortLabel(mobileDashboardSnapshot.snapshotMonth);
  const fullMonthLabel = formatMonthLabel(mobileDashboardSnapshot.snapshotMonth);
  setMoney("#homeNetWorth", mobileDashboardSnapshot.netWorth);
  setMoney("#homeExpense", latest?.expense || 0);
  setPercent("#homeSavingRate", latest?.savingRate || 0);
  setPercent("#homeYieldRate", latest?.monthlyXirr || 0);
  setMoney("#homeIncome", latest?.income || 0);
  setMoney("#homeSaving", latest?.savingAmount || 0);
  setText("#homeExpenseLabel", `${monthLabel}支出`);
  setText("#homeSavingRateLabel", `${monthLabel}储蓄率`);
  setText("#homeYieldRateLabel", `${monthLabel}收益率`);
  setText("#homeIncomeLabel", `${monthLabel}收入`);
  setText("#homeSavingLabel", `${monthLabel}储蓄`);
  setText("#homeDeviationCount", `${mobileDashboardSnapshot.allocationTargets.filter((item) => Math.abs(item.deviation) >= 0.01).length} 项`);
  setText("#homeDataStamp", mobileDashboardSnapshot.snapshotMonth ? `截至 ${fullMonthLabel}月报；本月手机草稿未计入` : "电脑端登录同一账号后同步已发布月报。");
  setText("#homeStatusTitle", mobileDashboardSnapshot.snapshotMonth ? `看板数据截至 ${fullMonthLabel}` : "看板数据待同步");
  setText("#homeStatusText", mobileDashboardSnapshot.snapshotMonth ? "首页金额、收益率、收入支出来自电脑端已发布月报，不包含手机草稿。" : "电脑端登录同一账号后显示已发布月报，不包含手机草稿。");
  setText("#homeCashflowTitle", mobileDashboardSnapshot.snapshotMonth ? `收支摘要显示 ${fullMonthLabel}` : "收支摘要待同步");
  setText("#homeAssetStatusTitle", mobileDashboardSnapshot.snapshotMonth ? `资产看板显示 ${fullMonthLabel}` : "资产看板待同步");
  setText("#homeAssetStatusText", mobileDashboardSnapshot.snapshotMonth ? "资产配置、资金趋势来自电脑端已发布月报；手机只负责展示。" : "电脑端登录同一账号后同步资产看板。");

  setText("#cashflowHeroTitle", `${monthLabel}已发布月报储蓄率`);
  setPercent("#cashflowSavingRate", latest?.savingRate || 0);
  setText("#cashflowDataStamp", mobileDashboardSnapshot.snapshotMonth ? `${fullMonthLabel}；本月手机记账未计入` : "电脑端登录同一账号后同步已发布月报。");
  setMoney("#cashflowIncome", latest?.income || 0);
  setMoney("#cashflowExpense", latest?.expense || 0);
  setMoney("#cashflowSaving", latest?.savingAmount || 0);
  setText("#cashflowIncomeLabel", `${monthLabel}收入`);
  setText("#cashflowExpenseLabel", `${monthLabel}支出`);
  setText("#cashflowSavingLabel", `${monthLabel}储蓄`);

  const targetRate = mobileDashboardSnapshot.targetSavingRate || 0;
  const hitTarget = Boolean(latest) && latest.savingRate >= targetRate;
  setText("#savingGoalTitle", latest ? `${monthLabel}储蓄目标${hitTarget ? "达成" : "未达成"}` : "储蓄目标待同步");
  const savingGoalText = document.querySelector("#savingGoalText");
  if (savingGoalText) {
    savingGoalText.innerHTML = latest
      ? `目标储蓄率 <span class="percent" data-value="${formatPercentRaw(targetRate)}">${formatPercent(targetRate)}</span>，${monthLabel}月报储蓄率 <span class="percent" data-value="${formatPercentRaw(latest.savingRate)}">${formatPercent(latest.savingRate)}</span>。`
      : "电脑端登录同一账号后同步目标和当前储蓄率。";
  }
  setText("#savingGoalStatus", latest ? (hitTarget ? "达成" : "未达成") : "待同步");

  const categories = mobileDashboardSnapshot.expenseCategories.slice(0, 4);
  const categoryChart = document.querySelector("#cashflowCategoryChart");
  if (categoryChart) {
    categoryChart.innerHTML = categories.length
      ? categories.map((item) => `
        <div class="bar-row"><span>${escapeHtml(item.category)}</span><i style="--w: ${Math.max(4, Math.min(100, item.percent * 100))}%"></i><b class="money" data-value="${formatPlainMoney(item.amount)}">${state.privacy ? "••••••" : formatPlainMoney(item.amount)}</b></div>
      `).join("")
      : `<div class="draft-empty-card">电脑端登录同一账号并生成月报后显示支出分类。</div>`;
  }
}

function renderBookMeta() {
  const monthLabel = formatMonthShortLabel(activeDraftMonthKey());
  if (bookMonthTitle) bookMonthTitle.textContent = `${monthLabel}记账`;
  if (bookRecordTitle) bookRecordTitle.textContent = `${monthLabel}记账记录`;
  if (bookModeLabel) bookModeLabel.textContent = state.editingLocalId ? "修改记录" : "新增记录";
  if (cancelEditButton) cancelEditButton.hidden = !state.editingLocalId;
}

function openBookDialog() {
  openModal(bookDialog);
  amountInput.focus();
}

function startEditingRecord(localId) {
  const record = state.records.find((item) => item.local_id === localId);
  if (!record || (record.record_kind || "transaction") !== "transaction") return;
  state.editingLocalId = record.local_id;
  setBookType(record.transaction_type || "expense");
  amountInput.value = String(record.amount || "");
  renderCategoryOptions(record.category || "");
  dateInput.value = record.transaction_date || todayKey();
  noteInput.value = record.note || "";
  render();
  openBookDialog();
}

function clearBookEditForm() {
  state.editingLocalId = "";
  amountInput.value = "";
  noteInput.value = "";
  dateInput.value = todayKey();
}

function categoryIcon(category, type) {
  const text = String(category || "");
  if (type === "income") {
    if (/工资|奖金|租|补贴/.test(text)) return "¥";
    if (/投资|分红|利息/.test(text)) return "↗";
    return "+";
  }
  if (/餐|饭|饮/.test(text)) return "🍽";
  if (/交通|车|机票|高铁|打车/.test(text)) return "✈";
  if (/购物|日用/.test(text)) return "□";
  if (/居住|房|租/.test(text)) return "⌂";
  if (/医疗|保险/.test(text)) return "+";
  if (/娱乐|旅行/.test(text)) return "♪";
  return "•";
}

function formatDayLabel(value) {
  if (!value || value.length < 10) return "";
  return `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
}

function healthTrendRows() {
  const rows = [...mobileDashboardSnapshot.monthlyTrends]
    .filter((item) => isPublishedTrendMonth(item.periodMonth, mobileDashboardSnapshot.snapshotMonth))
    .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
  if (!rows.length) return [];
  if (state.dashboardRange === "本月") {
    return rows.filter((item) => item.periodMonth === mobileDashboardSnapshot.snapshotMonth);
  }
  if (state.dashboardRange === "近 3 个月") return rows.slice(-3);
  if (state.dashboardRange === "半年") return rows.slice(-6);
  if (state.dashboardRange === "今年以来") {
    const year = (mobileDashboardSnapshot.snapshotMonth || rows[rows.length - 1].periodMonth).slice(0, 4);
    return rows.filter((item) => item.periodMonth.startsWith(year));
  }
  return rows;
}

function sumHealthRows(rows) {
  return rows.reduce((total, item) => ({
    income: total.income + item.income,
    expense: total.expense + item.expense,
    savingAmount: total.savingAmount + item.savingAmount,
    investmentBuy: total.investmentBuy + item.investmentBuy,
    investmentSell: total.investmentSell + item.investmentSell,
    investmentDividend: total.investmentDividend + item.investmentDividend,
    investmentGain: total.investmentGain + item.investmentGain
  }), {
    income: 0,
    expense: 0,
    savingAmount: 0,
    investmentBuy: 0,
    investmentSell: 0,
    investmentDividend: 0,
    investmentGain: 0
  });
}

function renderHealthDashboard() {
  if (!dashboardHealthContent) return;
  if (!healthSections.includes(state.dashboardSection)) state.dashboardSection = "总览";
  if (!dashboardRanges.includes(state.dashboardRange)) state.dashboardRange = "今年以来";
  if (dashboardDataStamp) {
    dashboardDataStamp.textContent = mobileDashboardSnapshot.snapshotMonth
      ? `截至 ${formatMonthLabel(mobileDashboardSnapshot.snapshotMonth)}月报`
      : "等待电脑端发布看板";
  }
  dashboardSectionTabs.innerHTML = healthSections.map((section) => `
    <button class="${state.dashboardSection === section ? "active" : ""}" data-dashboard-section="${section}" type="button">${section}</button>
  `).join("");
  dashboardRangeTabs.innerHTML = dashboardRanges.map((range) => `
    <button class="${state.dashboardRange === range ? "active" : ""}" data-dashboard-range="${range}" type="button">${range}</button>
  `).join("");
  const rows = healthTrendRows();
  if (!mobileDashboardSnapshot.snapshotMonth && !rows.length) {
    dashboardHealthContent.innerHTML = `
      <div class="health-empty">
        <b>财务健康看板待同步</b>
        <span>电脑端生成并发布月报后，手机端同步展示同一套模块和数据。</span>
      </div>
    `;
    return;
  }
  const renderers = {
    总览: renderHealthOverview,
    收支储蓄: renderHealthCashflow,
    支出结构: renderHealthExpense,
    资产配置: renderHealthAllocation,
    投资表现: renderHealthInvestment
  };
  dashboardHealthContent.innerHTML = renderers[state.dashboardSection](rows);
}

function renderKpi(label, value, tone = "") {
  return `<article class="${tone}"><span>${escapeHtml(label)}</span><b>${value}</b></article>`;
}

function renderMiniTrend(rows, key, label, formatter = privacyMoney) {
  if (!rows.length) return `<div class="health-empty small">暂无${escapeHtml(label)}数据</div>`;
  const max = Math.max(...rows.map((item) => Math.abs(Number(item[key]) || 0)), 1);
  return `
    <div class="health-chart-list">
      ${rows.map((item) => {
        const value = Number(item[key]) || 0;
        return `
        <div class="health-row signed ${value < 0 ? "negative" : "positive"}">
          <span>${formatMonthShortLabel(item.periodMonth)}</span>
          <i style="--positive:${value > 0 ? Math.max(4, Math.min(50, Math.abs(value) / max * 50)) : 0}%; --negative:${value < 0 ? Math.max(4, Math.min(50, Math.abs(value) / max * 50)) : 0}%"></i>
          <b>${formatter(value)}</b>
        </div>
      `;
      }).join("")}
    </div>
  `;
}

function renderNetWorthBarChart(rows) {
  if (!rows.length) return `<div class="health-empty small">暂无净资产趋势数据</div>`;
  const max = Math.max(...rows.map((item) => Math.abs(Number(item.netWorth) || 0)), 1);
  return `
    <div class="mobile-svg-wrap">
      <svg class="mobile-svg-chart mobile-bar-chart" viewBox="0 0 360 220" role="img" aria-label="净资产趋势条形图">
        ${rows.map((item, index) => {
          const count = rows.length;
          const gap = 14;
          const chartLeft = 28;
          const chartWidth = 304;
          const barWidth = Math.max(16, Math.min(34, (chartWidth - gap * Math.max(0, count - 1)) / Math.max(count, 1)));
          const x = chartLeft + index * (barWidth + gap);
          const height = Math.max(8, Math.abs(item.netWorth) / max * 128);
          const y = 154 - height;
          return `
            <g>
              <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="7"></rect>
              <text class="chart-value-label" x="${x + barWidth / 2}" y="${Math.max(14, y - 7)}" text-anchor="middle">${state.privacy ? "•••" : chartMoneyShort(item.netWorth)}</text>
              <text x="${x + barWidth / 2}" y="181" text-anchor="middle">${formatMonthShortLabel(item.periodMonth)}</text>
              <title>${item.periodMonth} 净资产 ${formatPlainMoney(item.netWorth)}</title>
            </g>
          `;
        }).join("")}
        <line x1="20" x2="342" y1="154" y2="154"></line>
      </svg>
    </div>
  `;
}

function renderAllocationDonutChart(rows, title = "当前资产配置") {
  const rawRows = rows.filter((item) => Math.abs(item.amount) > 0.0001 || Math.abs(item.percent) > 0.0001);
  const sortedRows = [...rawRows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const topRows = sortedRows.slice(0, 5);
  const otherRows = sortedRows.slice(5);
  const totalAmount = sortedRows.reduce((sum, item) => sum + item.amount, 0);
  const otherAmount = otherRows.reduce((sum, item) => sum + item.amount, 0);
  const visibleRows = otherRows.length
    ? [...topRows, { category: "其他", amount: otherAmount, percent: totalAmount > 0 ? otherAmount / totalAmount : 0 }]
    : topRows;
  if (!visibleRows.length) return `<div class="health-empty small">暂无${escapeHtml(title)}数据</div>`;
  const colors = ["#c7a76d", "#88a998", "#9cacbf", "#c47766", "#627d9a", "#b6927a"];
  let offset = 25;
  const circles = visibleRows.map((item, index) => {
    const dash = Math.max(0.2, item.percent * 100);
    const detail = `${item.category}：${formatPlainMoney(item.amount)}，占比 ${formatPercentRaw(item.percent)}`;
    const circle = `<circle data-detail-toast="${escapeHtml(detail)}" pathLength="100" r="46" cx="60" cy="60" fill="transparent" stroke="${colors[index % colors.length]}" stroke-width="18" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${offset}"><title>${escapeHtml(detail)}</title></circle>`;
    offset -= dash;
    return circle;
  }).join("");
  return `
    <div class="mobile-donut-layout">
      <svg class="mobile-donut-chart" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(title)}饼状图">
        <circle pathLength="100" r="46" cx="60" cy="60" fill="transparent" stroke="rgba(127,127,127,.14)" stroke-width="18"></circle>
        ${circles}
        <circle r="30" cx="60" cy="60" fill="var(--panel)"></circle>
        <text x="60" y="57" text-anchor="middle">配置</text>
        <text x="60" y="73" text-anchor="middle">${visibleRows.length} 类</text>
      </svg>
      <div class="mobile-donut-legend">
        ${visibleRows.map((item, index) => `
          <span data-detail-toast="${escapeHtml(`${item.category}：${formatPlainMoney(item.amount)}，占比 ${formatPercentRaw(item.percent)}`)}"><i style="background:${colors[index % colors.length]}"></i><b>${escapeHtml(item.category)}</b><em>${formatPercent(item.percent)}</em></span>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCashflowGapChart(rows) {
  const chartRows = rows.filter((item) => item.income > 0 || item.expense > 0);
  if (!chartRows.length) return `<div class="health-empty small">暂无数据：缺少收支趋势。</div>`;
  const maxAmount = Math.max(...chartRows.flatMap((item) => [item.income, item.expense, Math.abs(item.savingAmount)]), 1);
  const maxRate = Math.max(mobileDashboardSnapshot.targetSavingRate, ...chartRows.map((item) => Math.max(item.savingRate, 0)), 1);
  const xPoint = (index) => chartRows.length === 1 ? 180 : 36 + index * (288 / (chartRows.length - 1));
  const yAmount = (value) => 24 + 126 * (1 - value / maxAmount);
  const yRate = (value) => 24 + 126 * (1 - Math.max(Math.min(value / maxRate, 1), 0));
  const points = (key, mapper = yAmount) => chartRows.map((item, index) => `${xPoint(index)},${mapper(item[key])}`).join(" ");
  const incomeLine = points("income");
  const expenseLine = points("expense");
  const savingRateLine = chartRows.map((item, index) => `${xPoint(index)},${yRate(item.savingRate)}`).join(" ");
  const targetRateLine = chartRows.map((item, index) => `${xPoint(index)},${yRate(mobileDashboardSnapshot.targetSavingRate)}`).join(" ");
  const areaPath = `M ${incomeLine.split(" ").join(" L ")} L ${[...chartRows].reverse().map((item, reverseIndex) => {
    const index = chartRows.length - 1 - reverseIndex;
    return `${xPoint(index)},${yAmount(item.expense)}`;
  }).join(" L ")} Z`;
  return `
    <div class="mobile-svg-wrap">
      <svg class="mobile-svg-chart cashflow-gap-chart" viewBox="0 0 360 220" role="img" aria-label="收入支出储蓄缺口图表">
        <path d="${areaPath}"></path>
        <polyline class="income-line" points="${incomeLine}"></polyline>
        <polyline class="expense-line" points="${expenseLine}"></polyline>
        <polyline class="rate-line" points="${savingRateLine}"></polyline>
        <polyline class="target-line" points="${targetRateLine}"></polyline>
        ${chartRows.map((item, index) => {
          const x = xPoint(index);
          return `
            <g>
              <circle class="income-dot" cx="${x}" cy="${yAmount(item.income)}" r="4"></circle>
              <circle class="expense-dot" cx="${x}" cy="${yAmount(item.expense)}" r="4"></circle>
              <circle class="rate-dot" cx="${x}" cy="${yRate(item.savingRate)}" r="4"></circle>
              <text x="${x}" y="184" text-anchor="middle">${item.periodMonth.slice(5)}</text>
              <text x="${x}" y="${Math.min(yAmount(item.income), yAmount(item.expense)) - 8}" text-anchor="middle">${state.privacy ? "•••" : chartMoneyShort(item.savingAmount)}</text>
              <title>${item.periodMonth} 收入 ${formatPlainMoney(item.income)}，支出 ${formatPlainMoney(item.expense)}，储蓄 ${formatPlainMoney(item.savingAmount)}，储蓄率 ${formatPercentRaw(item.savingRate)}</title>
            </g>
          `;
        }).join("")}
      </svg>
      <div class="mobile-chart-legend">
        <span><i class="income"></i>收入</span>
        <span><i class="expense"></i>支出</span>
        <span><i class="rate"></i>储蓄率</span>
        <span><i class="target"></i>目标储蓄率</span>
      </div>
    </div>
  `;
}

function renderSavingTargetMobileChart(rows) {
  const chartRows = rows.filter((item) => item.income > 0 || item.expense > 0);
  if (!chartRows.length) return `<div class="health-empty small">暂无数据：缺少储蓄趋势。</div>`;
  const maxAmount = Math.max(...chartRows.flatMap((item) => [Math.abs(item.savingAmount), item.income * mobileDashboardSnapshot.targetSavingRate]), 1);
  return `
    <div class="health-chart-list">
      ${chartRows.map((item) => {
        const target = item.income * mobileDashboardSnapshot.targetSavingRate;
        return `
          <div class="health-row dual">
            <span>${formatMonthShortLabel(item.periodMonth)}</span>
            <i style="--w:${Math.max(4, Math.min(100, Math.abs(item.savingAmount) / maxAmount * 100))}%; --target:${Math.max(4, Math.min(100, Math.abs(target) / maxAmount * 100))}%"></i>
            <b>${privacyMoney(item.savingAmount)}</b>
          </div>
        `;
      }).join("")}
    </div>
    <div class="mobile-chart-legend"><span><i class="saving"></i>实际储蓄</span><span><i class="target"></i>目标储蓄</span></div>
  `;
}

function rangeSavingRate(rows) {
  const totals = sumHealthRows(rows);
  return totals.income > 0 ? totals.savingAmount / totals.income : 0;
}

function dashboardSnapshotMonthLabel() {
  return mobileDashboardSnapshot.snapshotMonth
    ? formatMonthShortLabel(mobileDashboardSnapshot.snapshotMonth)
    : "看板最新月";
}

function renderHealthOverview(rows) {
  const latest = latestMonthlyTrend();
  const totals = sumHealthRows(rows);
  const snapshotLabel = dashboardSnapshotMonthLabel();
  return `
    <article class="health-panel lead">
      <p>总览</p>
      <strong>${privacyMoney(mobileDashboardSnapshot.netWorth)}</strong>
      <small>净资产趋势、当前资产配置、${snapshotLabel}异常提醒。</small>
    </article>
    <div class="health-kpi-grid">
      ${renderKpi(`${state.dashboardRange}收入`, privacyMoney(totals.income))}
      ${renderKpi(`${state.dashboardRange}支出`, privacyMoney(totals.expense))}
      ${renderKpi(`${state.dashboardRange}储蓄`, privacyMoney(totals.savingAmount), totals.savingAmount >= 0 ? "positive" : "negative")}
      ${renderKpi(`${snapshotLabel}储蓄率`, formatPercent(latest?.savingRate || 0))}
    </div>
    <section class="health-panel">
      <h3>净资产金额变化 / 增长率</h3>
      ${renderAssetEvolutionChart(rows)}
    </section>
    <section class="health-panel">
      <h3>当前资产配置</h3>
      ${renderAllocationDonutChart(mobileDashboardSnapshot.assetAllocations, "当前资产配置")}
    </section>
    <section class="health-panel">
      <h3>${snapshotLabel}异常提醒 / 大额支出提醒</h3>
      ${renderAnomalyRows(3)}
    </section>
  `;
}

function renderHealthCashflow(rows) {
  const latest = latestMonthlyTrend();
  const totals = sumHealthRows(rows);
  const activeSavingRate = rangeSavingRate(rows);
  const snapshotLabel = dashboardSnapshotMonthLabel();
  return `
    <div class="health-kpi-grid">
      ${renderKpi("当前范围累计储蓄", privacyMoney(totals.savingAmount), totals.savingAmount >= 0 ? "positive" : "negative")}
      ${renderKpi(`${state.dashboardRange}储蓄率`, formatPercent(activeSavingRate))}
      ${renderKpi("目标储蓄率", formatPercent(mobileDashboardSnapshot.targetSavingRate))}
      ${renderKpi(`${snapshotLabel}储蓄`, privacyMoney(latest?.savingAmount || 0))}
    </div>
    <section class="health-panel">
      <h3>收入支出储蓄缺口图表</h3>
      ${renderCashflowGapChart(rows)}
    </section>
  `;
}

function expenseRowsForHealthRange() {
  const trendRows = healthTrendRows();
  const months = new Set(trendRows.map((item) => item.periodMonth));
  const grouped = new Map();
  (mobileDashboardSnapshot.expenseCategoryTrends || [])
    .filter((item) => months.has(item.periodMonth))
    .forEach((item) => {
      grouped.set(item.category, (grouped.get(item.category) || 0) + item.amount);
    });
  const total = [...grouped.values()].reduce((sum, amount) => sum + amount, 0);
  const rows = [...grouped.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? amount / total : 0
    }))
    .sort((a, b) => b.amount - a.amount);
  if (rows.length) return rows;
  return state.dashboardRange === "本月"
    ? mobileDashboardSnapshot.expenseCategories
    : (mobileDashboardSnapshot.expenseYearRank.length ? mobileDashboardSnapshot.expenseYearRank : mobileDashboardSnapshot.expenseCategories);
}

function renderExpenseShareRows(rows) {
  if (!rows.length) return `<div class="health-empty small">暂无分类数据</div>`;
  return renderCategoryRows(rows);
}

function renderHealthExpense() {
  const rows = expenseRowsForHealthRange();
  const largest = [...rows].sort((a, b) => b.amount - a.amount)[0];
  return `
    <div class="health-kpi-grid">
      ${renderKpi("最大支出分类", largest ? escapeHtml(largest.category) : "待同步")}
    </div>
    <section class="health-panel">
      <h3>分类花费金额排行</h3>
      ${renderExpenseShareRows(rows)}
    </section>
    <section class="health-panel">
      <h3>支出分类占比图表</h3>
      ${renderAllocationDonutChart(rows, "支出分类占比")}
    </section>
    <section class="health-panel">
      <h3>大额异常支出</h3>
      ${renderAnomalyRows(6)}
    </section>
  `;
}

function renderAssetEvolutionChart(rows) {
  const chartRows = rows
    .filter((item) => isPublishedTrendMonth(item.periodMonth, mobileDashboardSnapshot.snapshotMonth))
    .filter((item) => Math.abs(item.netWorth || 0) > 0.0001);
  if (!chartRows.length) return `<div class="health-empty small">暂无资产结构演变数据</div>`;
  const max = Math.max(...chartRows.map((item) => Math.abs(item.netWorth || 0)), 1);
  const allRows = [...mobileDashboardSnapshot.monthlyTrends]
    .filter((item) => isPublishedTrendMonth(item.periodMonth, mobileDashboardSnapshot.snapshotMonth))
    .filter((item) => Math.abs(item.netWorth || 0) > 0.0001)
    .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
  const previousNetWorthByMonth = new Map();
  allRows.forEach((item, index) => {
    const previous = allRows[index - 1];
    previousNetWorthByMonth.set(item.periodMonth, previous ? previous.netWorth : null);
  });
  const growthValues = chartRows.map((item) => {
    const previous = previousNetWorthByMonth.get(item.periodMonth);
    return previous === null || previous === undefined || Math.abs(previous) < 0.000001
      ? null
      : (item.netWorth - previous) / Math.abs(previous);
  });
  const count = chartRows.length;
  const gap = 14;
  const chartLeft = 30;
  const chartWidth = 300;
  const barWidth = Math.max(15, Math.min(32, (chartWidth - gap * Math.max(0, count - 1)) / Math.max(count, 1)));
  const barLayout = chartRows.map((item, index) => {
    const x = count === 1 ? chartLeft + chartWidth / 2 - barWidth / 2 : chartLeft + index * (barWidth + gap);
    const height = Math.max(8, Math.abs(item.netWorth || 0) / max * 112);
    const y = 154 - height;
    return {
      item,
      index,
      x,
      y,
      height,
      centerX: x + barWidth / 2,
      topY: y
    };
  });
  const growthPointItems = chartRows.flatMap((item, index) => {
    const growth = growthValues[index];
    if (growth === null) return [];
    const layout = barLayout[index];
    const y = Math.max(18, layout.topY - 9);
    return [{
      month: item.periodMonth,
      growth,
      x: layout.centerX,
      y
    }];
  });
  const growthSegments = growthPointItems.slice(1).map((item, index) => {
    const previous = growthPointItems[index];
    return `<line class="growth-segment" x1="${previous.x}" y1="${previous.y}" x2="${item.x}" y2="${item.y}"></line>`;
  }).join("");
  return `
    <div class="mobile-svg-wrap">
      <svg class="mobile-svg-chart mobile-composite-chart" viewBox="0 0 360 210" role="img" aria-label="资产配置结构演变复合图表">
        ${barLayout.map(({ item, index, x, y, height }) => {
          return `
            <g>
              <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="7"></rect>
              <text class="chart-value-label" x="${x + barWidth / 2}" y="${Math.max(14, y - 7)}" text-anchor="middle">${state.privacy ? "•••" : chartMoneyShort(item.netWorth)}</text>
              <text x="${x + barWidth / 2}" y="181" text-anchor="middle">${formatMonthShortLabel(item.periodMonth)}</text>
              <title>${item.periodMonth} 净资产 ${formatPlainMoney(item.netWorth)}，增长率 ${growthValues[index] === null ? "无上月基准" : formatSignedPercentRaw(growthValues[index])}</title>
            </g>
          `;
        }).join("")}
        ${growthSegments}
        ${growthPointItems.map((item) => `
          <g>
            <circle class="chart-dot growth" cx="${item.x}" cy="${item.y}" r="4"></circle>
            <text class="chart-value-label growth-label" x="${item.x}" y="${item.growth >= 0 ? item.y - 10 : item.y + 18}" text-anchor="middle">${formatSignedPercentRaw(item.growth)}</text>
            <title>${item.month} 增长率 ${formatSignedPercentRaw(item.growth)}</title>
          </g>
        `).join("")}
        <line x1="20" x2="342" y1="154" y2="154"></line>
      </svg>
      <div class="mobile-chart-legend"><span><i class="saving"></i>金额变化</span><span><i class="growth"></i>增长率</span></div>
    </div>
  `;
}

function renderHealthAllocation() {
  return `
    <section class="health-panel">
      <h3>资产配置饼图</h3>
      ${renderAllocationDonutChart(mobileDashboardSnapshot.assetAllocations, "资产配置")}
    </section>
    <section class="health-panel">
      <h3>目标资产配置偏离图表</h3>
      ${renderTargetRows()}
    </section>
    <section class="health-panel">
      <h3>结构演变</h3>
      ${renderAssetEvolutionChart(healthTrendRows())}
    </section>
  `;
}

function renderHealthInvestment(rows) {
  const totals = sumHealthRows(rows);
  const latest = latestMonthlyTrend();
  return `
    <div class="health-kpi-grid">
      ${renderKpi("买入", privacyMoney(totals.investmentBuy))}
      ${renderKpi("卖出", privacyMoney(totals.investmentSell))}
      ${renderKpi("分红", privacyMoney(totals.investmentDividend))}
      ${renderKpi("月度 XIRR", latest?.monthlyXirr === null || latest?.monthlyXirr === undefined ? "待计算" : formatPercent(latest.monthlyXirr))}
    </div>
    <section class="health-panel">
      <h3>历史月度收益与资金加权收益</h3>
      ${renderInvestmentMonthlyComposite(rows)}
    </section>
  `;
}

function renderCategoryRows(rows) {
  if (!rows.length) return `<div class="health-empty small">暂无分类数据</div>`;
  const max = Math.max(...rows.map((item) => Math.abs(item.amount)), 1);
  return `
    <div class="health-chart-list">
      ${rows.map((item) => `
        <div class="health-row">
          <span>${escapeHtml(item.category)}</span>
          <i style="--w:${Math.max(4, Math.min(100, Math.abs(item.amount) / max * 100))}%"></i>
          <b>${privacyMoney(item.amount)} · ${formatPercent(item.percent)}</b>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAllocationRows(rows) {
  const visibleRows = rows.filter((item) => Math.abs(item.amount) > 0.0001 || Math.abs(item.percent) > 0.0001);
  if (!visibleRows.length) return `<div class="health-empty small">暂无资产配置数据</div>`;
  return `
    <div class="health-chart-list">
      ${visibleRows.map((item) => `
        <div class="health-row">
          <span>${escapeHtml(item.category)}</span>
          <i style="--w:${Math.max(4, Math.min(100, item.percent * 100))}%"></i>
          <b>${privacyMoney(item.amount)} · ${formatPercent(item.percent)}</b>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTargetRows() {
  const rows = mobileDashboardSnapshot.allocationTargets || [];
  if (!rows.length) return `<div class="health-empty small">暂无目标偏离数据</div>`;
  const max = Math.max(...rows.flatMap((item) => [Math.abs(item.current), Math.abs(item.target), Math.abs(item.deviation)]), 0.01);
  return `
    <div class="target-gap-chart">
      ${rows.map((item) => `
        <div class="target-gap-row">
          <span>${escapeHtml(item.category)}</span>
          <div>
            <i class="current" style="--w:${Math.max(4, Math.min(100, Math.abs(item.current) / max * 100))}%"></i>
            <i class="target" style="--w:${Math.max(4, Math.min(100, Math.abs(item.target) / max * 100))}%"></i>
            <i class="gap" style="--w:${Math.max(4, Math.min(100, Math.abs(item.deviation) / max * 100))}%"></i>
          </div>
          <b>${formatPercent(item.current)} / ${formatPercent(item.target)} · Gap ${formatSignedPercent(item.deviation)}</b>
        </div>
      `).join("")}
    </div>
    <div class="mobile-chart-legend"><span><i class="saving"></i>目前</span><span><i class="target"></i>计划目标</span><span><i class="expense"></i>Gap</span></div>
  `;
}

function renderInvestmentFlowRows() {
  const rows = (mobileDashboardSnapshot.investmentCashflowCalendar || []).slice(0, 8);
  if (!rows.length) return `<div class="health-empty small">暂无买入卖出分红记录</div>`;
  return rows.map((item) => `
    <div class="list-row static">
      <i class="tile green"></i>
      <span><b>${escapeHtml(item.assetName)}</b><small>${escapeHtml(item.flowDate)} · ${escapeHtml(item.flowType)}</small></span>
      <em>${privacyMoney(item.amount)}</em>
    </div>
  `).join("");
}

function hasInvestmentGroupData(item) {
  return item.groupName !== "现金" && (
    Math.abs(item.endingValue || 0) > 0.0001 ||
    Math.abs(item.gain || 0) > 0.0001 ||
    Math.abs(item.buy || 0) > 0.0001 ||
    Math.abs(item.sell || 0) > 0.0001 ||
    Math.abs(item.dividend || 0) > 0.0001 ||
    item.returnRate !== null
  );
}

function orderedInvestmentGroups(rows) {
  const names = [...new Set(rows.filter(hasInvestmentGroupData).map((item) => item.groupName))];
  return [
    ...investmentGroupOrder.filter((name) => names.includes(name)),
    ...names.filter((name) => !investmentGroupOrder.includes(name)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
  ];
}

function investmentGroupRowsForSnapshot() {
  const performanceRows = (mobileDashboardSnapshot.investmentGroupPerformances || []).filter(hasInvestmentGroupData);
  if (performanceRows.length) return performanceRows;
  return (mobileDashboardSnapshot.investmentGroupTrends || [])
    .filter((item) => item.periodMonth === mobileDashboardSnapshot.snapshotMonth)
    .filter(hasInvestmentGroupData);
}

function investmentGroupTrendRowsForRange(rangeRows) {
  const months = new Set(rangeRows.map((item) => item.periodMonth));
  const trendRows = (mobileDashboardSnapshot.investmentGroupTrends || [])
    .filter((item) => months.has(item.periodMonth))
    .filter(hasInvestmentGroupData);
  if (trendRows.length) return trendRows;
  return investmentGroupRowsForSnapshot().map((item) => ({
    ...item,
    periodMonth: mobileDashboardSnapshot.snapshotMonth
  }));
}

function chartRateScale(rows) {
  return Math.max(...rows.map((item) => Math.abs(item.returnRate || 0)), 0.01);
}

function renderInvestmentGroupRateChart(rangeRows) {
  const rows = investmentGroupTrendRowsForRange(rangeRows);
  const groups = orderedInvestmentGroups(rows);
  const months = [...new Set(rows.map((item) => item.periodMonth))].sort((a, b) => a.localeCompare(b));
  if (!rows.length || !groups.length) return `<div class="health-empty small">暂无资产组收益数据。请先在电脑端发布包含资产组的看板快照。</div>`;
  const maxRate = chartRateScale(rows);
  const zeroY = 104;
  const yTick = (rate) => zeroY - (rate / maxRate) * 70;
  const monthWidth = 300 / Math.max(months.length, 1);
  const barWidth = Math.max(4, Math.min(12, monthWidth / Math.max(groups.length + 1, 2)));
  const colors = ["#17231f", "#c2a05b", "#719681", "#9cacbf", "#c47766", "#627d9a"];
  return `
    <div class="mobile-svg-wrap">
      <svg class="mobile-svg-chart investment-rate-chart" viewBox="0 0 360 220" role="img" aria-label="资产组月度收益率">
        ${[-1, -0.5, 0, 0.5, 1].map((ratio) => {
          const rate = maxRate * ratio;
          return `
            <g>
              <line class="${Math.abs(rate) < 0.0001 ? "zero" : ""}" x1="34" x2="342" y1="${yTick(rate)}" y2="${yTick(rate)}"></line>
              <text x="29" y="${yTick(rate) + 4}" text-anchor="end">${formatPercentRaw(rate)}</text>
            </g>
          `;
        }).join("")}
        ${months.map((month, monthIndex) => {
          const baseX = 42 + monthIndex * monthWidth + monthWidth / 2 - groups.length * barWidth / 2;
          return `
            <g>
              ${groups.map((group, groupIndex) => {
                const item = rows.find((row) => row.periodMonth === month && row.groupName === group);
                if (!item || item.returnRate === null) return `<rect class="empty" x="${baseX + groupIndex * barWidth}" y="${zeroY - 1}" width="${Math.max(2, barWidth - 2)}" height="2" rx="1"></rect>`;
                const height = Math.max(5, Math.abs(item.returnRate) / maxRate * 70);
                const y = item.returnRate >= 0 ? zeroY - height : zeroY;
                return `
                  <g>
                    <rect class="${item.returnRate >= 0 ? "positive" : "negative"}" style="fill:${colors[groupIndex % colors.length]}" x="${baseX + groupIndex * barWidth}" y="${y}" width="${Math.max(2, barWidth - 2)}" height="${height}" rx="3"></rect>
                    ${months.length <= 6 ? `<text class="chart-value-label" x="${baseX + groupIndex * barWidth + barWidth / 2}" y="${item.returnRate >= 0 ? y - 5 : y + height + 12}" text-anchor="middle">${formatPercentRaw(item.returnRate)}</text>` : ""}
                    <title>${month} ${group} 收益率 ${formatPercentRaw(item.returnRate)}，收益 ${formatPlainMoney(item.gain)}</title>
                  </g>
                `;
              }).join("")}
              <text x="${42 + monthIndex * monthWidth + monthWidth / 2}" y="197" text-anchor="middle">${month.slice(5)}</text>
            </g>
          `;
        }).join("")}
      </svg>
      <div class="mobile-chart-legend">
        ${groups.map((group, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(group)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderInvestmentReturnPerspective(rangeRows) {
  const rows = investmentGroupTrendRowsForRange(rangeRows);
  const groups = orderedInvestmentGroups(rows);
  const group = groups[0];
  if (!group) return `<div class="health-empty small">暂无资产组回报透视数据</div>`;
  const chartRows = rangeRows.map((trend) => {
    const item = rows.find((row) => row.periodMonth === trend.periodMonth && row.groupName === group);
    return {
      periodMonth: trend.periodMonth,
      returnRate: item?.returnRate ?? null,
      gain: item?.gain ?? 0
    };
  });
  const maxRate = Math.max(...chartRows.map((item) => Math.abs(item.returnRate || 0)), 0.01);
  const zeroY = 96;
  return `
    <div class="mobile-svg-wrap">
      <svg class="mobile-svg-chart investment-focus-chart" viewBox="0 0 360 206" role="img" aria-label="${escapeHtml(group)}回报透视">
        ${[-1, -0.5, 0, 0.5, 1].map((ratio) => {
          const rate = maxRate * ratio;
          const y = zeroY - (rate / maxRate) * 64;
          return `<line class="${Math.abs(rate) < 0.0001 ? "zero" : ""}" x1="32" x2="340" y1="${y}" y2="${y}"></line>`;
        }).join("")}
        ${chartRows.map((item, index) => {
          const x = chartRows.length === 1 ? 178 : 42 + index * (286 / (chartRows.length - 1));
          if (item.returnRate === null) return `<rect class="empty" x="${x - 13}" y="${zeroY - 1}" width="26" height="2" rx="1"></rect><text x="${x}" y="180" text-anchor="middle">${item.periodMonth.slice(5)}</text>`;
          const height = Math.max(6, Math.abs(item.returnRate) / maxRate * 64);
          const y = item.returnRate >= 0 ? zeroY - height : zeroY;
          return `
            <g>
              <rect class="${item.returnRate >= 0 ? "positive" : "negative"}" x="${x - 13}" y="${y}" width="26" height="${height}" rx="6"></rect>
              <text class="chart-value-label" x="${x}" y="${item.returnRate >= 0 ? y - 7 : y + height + 14}" text-anchor="middle">${formatPercentRaw(item.returnRate)}</text>
              <text x="${x}" y="180" text-anchor="middle">${item.periodMonth.slice(5)}</text>
              <title>${item.periodMonth} ${group} 收益率 ${formatPercentRaw(item.returnRate)}，收益 ${formatPlainMoney(item.gain)}</title>
            </g>
          `;
        }).join("")}
      </svg>
      <div class="return-switcher mobile-return-groups">
        ${groups.map((name, index) => `<button class="${index === 0 ? "active" : ""}" data-detail-toast="${escapeHtml(`${name}：手机端默认展示第一个资产组；完整多组收益率见上方资产组月度收益率。`)}" type="button">${escapeHtml(name)}</button>`).join("")}
      </div>
    </div>
  `;
}

function daysInMonthFromKey(periodMonth) {
  const year = Number(String(periodMonth).slice(0, 4));
  const month = Number(String(periodMonth).slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  return new Date(year, month, 0).getDate();
}

function xirrToPeriodReturn(rate, periodMonth) {
  if (rate === null || rate === undefined || rate <= -0.999999) return null;
  return Math.pow(1 + rate, daysInMonthFromKey(periodMonth) / 365) - 1;
}

function renderInvestmentMonthlyComposite(rows) {
  const chartRows = rows.filter((item) => Math.abs(item.investmentGain || 0) > 0.0001 || item.monthlyXirr !== null);
  if (!chartRows.length) return `<div class="health-empty small">暂无历史月度收益数据</div>`;
  const maxGain = Math.max(...chartRows.map((item) => Math.abs(item.investmentGain || 0)), 1);
  const rateRows = chartRows.map((item) => ({ ...item, xirrPeriodReturn: xirrToPeriodReturn(item.monthlyXirr, item.periodMonth) }));
  const maxRate = Math.max(...rateRows.map((item) => Math.abs(item.xirrPeriodReturn || 0)), 0.01);
  const zeroY = 104;
  const points = rateRows.flatMap((item, index) => {
    if (item.xirrPeriodReturn === null) return [];
    const x = rateRows.length === 1 ? 180 : 42 + index * (286 / (rateRows.length - 1));
    const y = 104 - (item.xirrPeriodReturn / maxRate) * 66;
    return [{ x, y, rate: item.xirrPeriodReturn, month: item.periodMonth }];
  });
  return `
    <div class="mobile-svg-wrap">
      <svg class="mobile-svg-chart investment-monthly-chart" viewBox="0 0 360 220" role="img" aria-label="历史月度收益与资金加权收益">
        <line class="zero" x1="32" x2="340" y1="${zeroY}" y2="${zeroY}"></line>
        ${rateRows.map((item, index) => {
          const x = rateRows.length === 1 ? 180 : 42 + index * (286 / (rateRows.length - 1));
          const height = Math.max(item.investmentGain === 0 ? 2 : 6, Math.abs(item.investmentGain || 0) / maxGain * 70);
          const y = item.investmentGain >= 0 ? zeroY - height : zeroY;
          return `
            <g>
              <rect class="${item.investmentGain >= 0 ? "positive" : "negative"}" x="${x - 13}" y="${y}" width="26" height="${height}" rx="6"></rect>
              <text class="chart-value-label" x="${x}" y="${item.investmentGain >= 0 ? y - 7 : y + height + 14}" text-anchor="middle">${state.privacy ? "•••" : chartMoneyShort(item.investmentGain)}</text>
              <text x="${x}" y="194" text-anchor="middle">${item.periodMonth.slice(5)}</text>
              <title>${item.periodMonth} 投资收益 ${formatPlainMoney(item.investmentGain)}，资金加权收益 ${item.xirrPeriodReturn === null ? "待计算" : formatPercentRaw(item.xirrPeriodReturn)}</title>
            </g>
          `;
        }).join("")}
        ${points.slice(1).map((item, index) => {
          const previous = points[index];
          return `<line class="rate-line" x1="${previous.x}" y1="${previous.y}" x2="${item.x}" y2="${item.y}"></line>`;
        }).join("")}
        ${points.map((item) => `<circle class="rate-dot" cx="${item.x}" cy="${item.y}" r="4"><title>${item.month} 资金加权收益 ${formatPercentRaw(item.rate)}</title></circle>`).join("")}
      </svg>
      <div class="mobile-chart-legend"><span><i class="saving"></i>投资收益</span><span><i class="growth"></i>资金加权收益率</span></div>
    </div>
  `;
}

function renderInvestmentAssetRows() {
  const rows = mobileDashboardSnapshot.investmentAssets || [];
  if (!rows.length) return `<div class="health-empty small">暂无资产明细收益数据。请同步电脑端包含资产名称的看板快照。</div>`;
  const totalEnding = rows.reduce((sum, item) => sum + Math.max(0, item.endingValue), 0);
  return `
    <div class="investment-detail-list">
      ${rows.map((item) => {
        const netInvest = item.buy - item.sell;
        const baseValue = item.beginningValue + netInvest;
        const growthRate = baseValue > 0 ? item.gain / baseValue : null;
        const share = totalEnding > 0 ? item.endingValue / totalEnding : 0;
        return `
          <button class="investment-detail-row" data-detail-toast="${escapeHtml(`${item.assetName}：期末 ${formatPlainMoney(item.endingValue)}，收益 ${formatPlainMoney(item.gain)}，占比 ${formatPercentRaw(share)}`)}" type="button">
            <span>
              <b>${escapeHtml(item.assetName)}</b>
              <small>区间收益率 ${item.periodReturn === null ? "待计算" : formatPercent(item.periodReturn)} · XIRR ${item.monthlyXirr === null ? "待计算" : formatPercent(item.monthlyXirr)} · 增长 ${growthRate === null ? "待计算" : formatSignedPercent(growthRate)}</small>
            </span>
            <i style="--w:${Math.max(4, Math.min(100, share * 100))}%"></i>
            <em>${privacyMoney(item.endingValue)} · ${formatPercent(share)}</em>
            <small>买入 ${privacyMoney(item.buy)} / 卖出 ${privacyMoney(item.sell)} / 分红 ${privacyMoney(item.dividend)} / 收益 ${privacyMoney(item.gain)}</small>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderInvestmentGroupRows() {
  const rows = investmentGroupRowsForSnapshot();
  if (!rows.length) return `<div class="health-empty small">暂无资产组收益数据。请同步电脑端包含资产组的看板快照。</div>`;
  const totalEnding = rows.reduce((sum, item) => sum + Math.max(0, item.endingValue), 0);
  return `
    <div class="investment-detail-list">
      ${rows.map((item) => {
        const share = totalEnding > 0 ? item.endingValue / totalEnding : 0;
        return `
          <button class="investment-detail-row" data-detail-toast="${escapeHtml(`${item.groupName}：期末 ${formatPlainMoney(item.endingValue)}，收益 ${formatPlainMoney(item.gain)}，收益率 ${item.returnRate === null ? "待计算" : formatPercentRaw(item.returnRate)}`)}" type="button">
            <span>
              <b>${escapeHtml(item.groupName)}</b>
              <small>收益率 ${item.returnRate === null ? "待计算" : formatPercent(item.returnRate)} · 占比 ${formatPercent(share)}</small>
            </span>
            <i style="--w:${Math.max(4, Math.min(100, share * 100))}%"></i>
            <em>${privacyMoney(item.endingValue)} · ${formatPercent(share)}</em>
            <small>买入 ${privacyMoney(item.buy)} / 卖出 ${privacyMoney(item.sell)} / 分红 ${privacyMoney(item.dividend)} / 收益 ${privacyMoney(item.gain)}</small>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderAnomalyRows(limit) {
  const rows = (mobileDashboardSnapshot.spendingAnomalies || []).slice(0, limit);
  if (!rows.length) return `<div class="health-empty small">暂无异常支出</div>`;
  return rows.map((item) => `
    <div class="list-row static">
      <i class="tile gold"></i>
      <span><b>${escapeHtml(item.category)}</b><small>${escapeHtml(item.transactionDate || "")} ${escapeHtml(item.note || item.reason || "")}</small></span>
      <em>${privacyMoney(item.amount)}</em>
    </div>
  `).join("");
}

function renderDashboardModules() {
  if (!dashboardModuleGrid) return;
  const latest = latestMonthlyTrend();
  const monthLabel = formatMonthShortLabel(mobileDashboardSnapshot.snapshotMonth);
  const snapshotLabel = dashboardSnapshotMonthLabel();
  const categories = mobileDashboardSnapshot.expenseCategories || [];
  const largestCategory = [...categories].sort((a, b) => b.amount - a.amount)[0];
  const modules = [
    { section: "总览", icon: "◎", title: "总览", value: mobileDashboardSnapshot.snapshotMonth ? `截至 ${monthLabel}` : "待同步", detail: `关键指标、净资产趋势、${snapshotLabel}异常提醒。` },
    { section: "收支储蓄", icon: "↕", title: "收支储蓄", value: latest ? formatPercentRaw(latest.savingRate) : "待同步", detail: "收支储蓄趋势、储蓄目标达成。" },
    { section: "支出结构", icon: "◫", title: "支出结构", value: largestCategory ? largestCategory.category : "待同步", detail: "支出分类占比、分类累计排行、大额异常支出。" },
    { section: "资产配置", icon: "◌", title: "资产配置", value: `${mobileDashboardSnapshot.allocationTargets.length} 项偏离`, detail: "资产配置饼图、目标资产配置偏离图表。" },
    { section: "投资表现", icon: "↗", title: "投资表现", value: latest ? (state.privacy ? "••••••" : formatPlainMoney(latest.investmentGain)) : "待同步", detail: "买入卖出分红、月度 XIRR、资产组收益。" }
  ];
  dashboardModuleGrid.innerHTML = modules.map((item) => `
    <button class="module-card" data-dashboard-section="${item.section}" type="button">
      <i>${item.icon}</i>
      <span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></span>
      <em>${escapeHtml(item.value)}</em>
    </button>
  `).join("");
  dashboardModuleGrid.querySelectorAll("[data-dashboard-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dashboardSection = button.dataset.dashboardSection;
      navigate("dashboard");
      render();
    });
  });
}

function renderMayAnomalies() {
  const anomalies = mobileDashboardSnapshot.spendingAnomalies || [];
  const monthLabel = formatMonthShortLabel(mobileDashboardSnapshot.snapshotMonth);
  mayAnomalyButton.innerHTML = `
    <i class="tile gold"></i>
    <span>
      <b>${monthLabel}异常支出</b>
      <small>${anomalies.length ? `${anomalies.length} 条，来自电脑端已发布月报。` : "电脑端已发布月报未发现异常支出。"}</small>
    </span>
    <em>${anomalies.length ? "查看" : "暂无"}</em>
  `;
  if (!anomalies.length) {
    mayAnomalyDetail.innerHTML = `
      <strong>暂无 ${monthLabel} 异常支出明细</strong>
      <span>已和电脑端已发布月报同步。</span>
    `;
    return;
  }
  mayAnomalyDetail.innerHTML = anomalies.map((item) => `
    <div class="list-row static">
      <i class="tile gold"></i>
      <span>
        <b>${escapeHtml(item.transactionDate || monthLabel)} · ${escapeHtml(item.category)}</b>
        <small>${escapeHtml(item.note || item.reason || "电脑端标记为异常支出")}</small>
      </span>
      <em class="money" data-value="${formatPlainMoney(item.amount)}">${state.privacy ? "••••••" : formatPlainMoney(item.amount)}</em>
    </div>
  `).join("");
}

function formatPlainMoney(value) {
  return `CNY ${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function chartMoneyShort(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  if (absolute >= 10000) return `${sign}${(absolute / 10000).toFixed(1)}万`;
  if (absolute >= 1000) return `${sign}${(absolute / 1000).toFixed(1)}k`;
  return `${sign}${absolute.toFixed(0)}`;
}

function privacyMoney(value) {
  return state.privacy ? "••••••" : formatPlainMoney(value);
}

function formatPercent(value) {
  if (state.privacy) return "••••••";
  return formatPercentRaw(value);
}

function formatPercentRaw(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatSignedPercent(value) {
  if (state.privacy) return "••••••";
  return formatSignedPercentRaw(value);
}

function formatSignedPercentRaw(value) {
  return `${Number(value || 0) > 0 ? "+" : ""}${formatPercentRaw(value)}`;
}

function formatMonthLabel(value) {
  if (!value || value.length < 7) return "已发布";
  return `${value.slice(0, 4)} 年 ${Number(value.slice(5, 7))} 月`;
}

function formatMonthShortLabel(value) {
  if (!value || value.length < 7) return "已发布";
  return `${Number(value.slice(5, 7))} 月`;
}

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { theme: "champagne", syncEndpoint: DEFAULT_SYNC_ENDPOINT, ...stored };
  } catch {
    return { theme: "champagne", syncEndpoint: DEFAULT_SYNC_ENDPOINT };
  }
}

function resolveSyncEndpoint() {
  const params = new URLSearchParams(window.location.search);
  const urlValue = params.get("syncUrl")?.trim();
  if (urlValue) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, syncEndpoint: urlValue.replace(/\/$/, "") }));
    return urlValue.replace(/\/$/, "");
  }
  const storedEndpoint = String(settings.syncEndpoint || "").replace(/\/$/, "");
  if (storedEndpoint && storedEndpoint !== DEFAULT_SYNC_ENDPOINT) return storedEndpoint;
  const host = window.location.hostname;
  if (host && !["localhost", "127.0.0.1", "::1"].includes(host)) {
    const inferredEndpoint = `http://${host}:18742`;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, syncEndpoint: inferredEndpoint }));
    return inferredEndpoint;
  }
  return DEFAULT_SYNC_ENDPOINT;
}

function resetBindingFromUrlIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("resetBinding") !== "1") return;
  localStorage.removeItem(ACCOUNT_ID_KEY);
  localStorage.removeItem(BINDING_INFO_KEY);
  sessionStorage.removeItem(MOBILE_SESSION_UNLOCK_KEY);
}

function resolveDeviceId() {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const value = createLocalId("mobile");
  localStorage.setItem(DEVICE_ID_KEY, value);
  return value;
}

function createLocalId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  const randomPart = Math.random().toString(36).slice(2, 12);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

async function resetLegacyLocalData() {
  if (localStorage.getItem(RELEASE_RESET_KEY) === MOBILE_APP_VERSION) return;
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  await Promise.all(LEGACY_DB_NAMES.map((name) => deleteDatabase(name)));
  localStorage.setItem(RELEASE_RESET_KEY, MOBILE_APP_VERSION);
}

function deleteDatabase(name) {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
  });
}

function writeSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: state.theme, syncEndpoint }));
}

function readCustomCategories() {
  try {
    return { expense: [], income: [], ...JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY) || "{}") };
  } catch {
    return { expense: [], income: [] };
  }
}

function writeCustomCategories() {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
}

function applyTheme() {
  document.body.classList.remove("theme-champagne", "theme-sage", "theme-graphite");
  document.body.classList.add(`theme-${state.theme}`);
  document.querySelectorAll(".theme-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === state.theme);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  if (!message) return;
  infoToast.textContent = message;
  infoToast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    infoToast.hidden = true;
  }, 1800);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const store = db.createObjectStore(RECORD_STORE, { keyPath: "local_id" });
        store.createIndex("sync_status", "sync_status");
        store.createIndex("transaction_date", "transaction_date");
        store.createIndex("updated_at", "updated_at");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRecords() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readonly");
    const request = tx.objectStore(RECORD_STORE).getAll();
    request.onsuccess = () => {
      resolve(request.result.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    };
    request.onerror = () => reject(request.error);
  });
}

async function putRecord(record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readwrite");
    tx.objectStore(RECORD_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replaceRecords(records) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readwrite");
    const store = tx.objectStore(RECORD_STORE);
    store.clear();
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
