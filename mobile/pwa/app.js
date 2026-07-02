const MOBILE_APP_VERSION = "0.3.4";
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
  view: "home",
  type: "expense",
  draftSection: "",
  records: [],
  online: navigator.onLine,
  privacy: true,
  theme: settings.theme,
  assetRange: "ytd"
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
const creditCardForm = document.querySelector("#creditCardForm");
const cardBilledInput = document.querySelector("#cardBilledInput");
const cardUnbilledInput = document.querySelector("#cardUnbilledInput");
const cardPreviousUnbilledInput = document.querySelector("#cardPreviousUnbilledInput");
const syncDialog = document.querySelector("#syncDialog");
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

dateInput.value = new Date().toISOString().slice(0, 10);
applyTheme();
renderCategoryOptions();
if (canUseDesktopData()) void loadMobileDashboardSnapshot();
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
assetRangeTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset-range]");
  if (!button) return;
  state.assetRange = button.dataset.assetRange;
  renderAssetDashboard();
  render();
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
  const record = {
    local_id: createLocalId("txn"),
    server_id: null,
    record_kind: "transaction",
    operation: "create",
    sync_status: "pending",
    transaction_type: state.type,
    amount,
    currency: "CNY",
    category: categoryInput.value,
    transaction_date: dateInput.value,
    note: noteInput.value.trim(),
    created_at: now,
    updated_at: now
  };
  state.records.unshift(record);
  await putRecord(record);
  amountInput.value = "";
  noteInput.value = "";
  render();
  void reportMobileStatus();
  navigate("home");
});

creditCardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const currentBilledAmount = Number(cardBilledInput.value || 0);
  const currentUnbilledAmount = Number(cardUnbilledInput.value || 0);
  const previousUnbilledAmount = Number(cardPreviousUnbilledInput.value || 0);
  if (![currentBilledAmount, currentUnbilledAmount, previousUnbilledAmount].every(Number.isFinite)) {
    cardBilledInput.focus();
    return;
  }
  const now = new Date().toISOString();
  const periodMonth = currentMonthKey();
  const record = {
    local_id: createLocalId("card"),
    server_id: null,
    record_kind: "credit_card_adjustment",
    operation: "create",
    sync_status: "pending",
    period_month: periodMonth,
    current_billed_amount: Math.max(0, currentBilledAmount),
    current_unbilled_amount: Math.max(0, currentUnbilledAmount),
    previous_unbilled_amount: Math.max(0, previousUnbilledAmount),
    net_adjustment: -Math.max(0, currentBilledAmount) - Math.max(0, currentUnbilledAmount) + Math.max(0, previousUnbilledAmount),
    created_at: now,
    updated_at: now
  };
  state.records.unshift(record);
  await putRecord(record);
  cardBilledInput.value = "";
  cardUnbilledInput.value = "";
  cardPreviousUnbilledInput.value = "";
  render();
  void reportMobileStatus();
  showToast("已保存 6 月信用卡调整草稿");
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
draftEntryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-draft-section]");
  if (!button) return;
  state.draftSection = state.draftSection === button.dataset.draftSection ? "" : button.dataset.draftSection;
  renderLocalRecords();
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
render();
await pairFromUrlIfNeeded();
void reportMobileStatus();

function navigate(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });
  document.querySelectorAll(".bottom-nav [data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === view);
  });
  pageTitle.textContent = {
    home: "今天",
    book: "记一笔",
    cashflow: "收支",
    allocation: "资产"
  }[view] || "今天";
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
  return state.records.filter((record) => record.sync_status !== "synced");
}

function render() {
  const pending = pendingRecords();
  const pendingSummary = summarizeRecords(pending);
  updateAccessState();
  syncCount.textContent = String(pending.length);
  homePendingCount.textContent = `${pending.length} 条`;
  syncDot.classList.toggle("offline", !state.online);
  offlineBanner.hidden = state.online;
  syncCard.hidden = pending.length === 0;
  syncCardTitle.textContent = pending.length ? `有 ${pending.length} 条 6 月草稿待同步` : "没有待同步记录";
  syncCardText.textContent = state.online
    ? `收入 ${pendingSummary.incomeCount} 笔，支出 ${pendingSummary.expenseCount} 笔，信用卡 ${pendingSummary.creditCardCount} 条。同步后进入云端草稿箱。`
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
  renderSyncedDashboard();
  renderMayAnomalies();
  document.querySelectorAll(".money").forEach((node) => {
    node.textContent = state.privacy ? "••••••" : node.dataset.value;
  });
  document.querySelectorAll(".percent").forEach((node) => {
    node.textContent = state.privacy ? "••••••" : node.dataset.value;
  });
  renderLocalRecords();
}

function renderLocalRecords() {
  const month = currentMonthKey();
  const monthTransactions = state.records.filter((record) => (record.record_kind || "transaction") === "transaction" && String(record.transaction_date || "").startsWith(month));
  const monthIncome = monthTransactions.filter((record) => record.transaction_type === "income");
  const monthExpense = monthTransactions.filter((record) => record.transaction_type === "expense");
  const monthCards = state.records.filter((record) => record.record_kind === "credit_card_adjustment" && (record.period_month || "").startsWith(month));
  renderDraftEntryGrid(monthIncome, monthExpense, monthCards);
  if (!monthTransactions.length && !monthCards.length) {
    localRecords.innerHTML = `
      <div class="list-row static">
        <i class="tile gold"></i>
        <span><b>6 月还没有手机草稿</b><small>先记一笔收入、支出，或保存信用卡调整。</small></span>
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
    localRecords.innerHTML = `<div class="draft-empty-card">选择上方收入、支出${monthCards.length ? "或信用卡" : ""}，查看 6 月草稿明细。</div>`;
  }
}

function showSyncDialog() {
  const pending = pendingRecords();
  const summary = summarizeRecords(pending);
  syncDialogText.innerHTML = pending.length
    ? `
      <div class="sync-summary-grid">
        <article><span>收入</span><strong>${summary.incomeCount} 笔</strong><small>${formatPlainMoney(summary.incomeAmount)}</small></article>
        <article><span>支出</span><strong>${summary.expenseCount} 笔</strong><small>${formatPlainMoney(summary.expenseAmount)}</small></article>
        <article><span>信用卡</span><strong>${summary.creditCardCount} 条</strong><small>净调整 ${formatPlainMoney(summary.creditCardNetAdjustment)}</small></article>
      </div>
      <div class="sync-impact-list">
        <section>
          <b>同步后会影响</b>
          <p>6 月收支确认和信用卡调整草稿。</p>
        </section>
        <section>
          <b>暂不影响</b>
          <p>5 月首页看板、资产总额、净资产、资产配置、正式健康看板和月报。</p>
        </section>
        <section>
          <b>下一步</b>
          <p>电脑端确认 6 月收支、补资产和信用卡，并生成 6 月月报后，才刷新手机看板。</p>
        </section>
      </div>
    `
    : `
      <div class="sync-empty">
        <strong>当前没有待同步的 6 月草稿</strong>
        <span>新增收入、支出或信用卡调整后，这里会显示本次同步内容。</span>
      </div>
    `;
  openModal(syncDialog);
}

function openModal(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function closeModal(dialog) {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
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
  render();
}

function cloudHeaders(session = cloudSession) {
  return {
    apikey: CLOUD_SYNC_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session?.access_token || CLOUD_SYNC_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
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
  const payload = { ...record };
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
  const response = await fetch(`${CLOUD_SYNC_URL}/rest/v1/mobile_cloud_drafts?on_conflict=user_id,local_id`, {
    method: "POST",
    headers: {
      ...cloudHeaders(),
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
  const statusText = rows.length ? `${rows.length} 笔 · 合计 ${state.privacy ? "••••••" : formatPlainMoney(total)}` : "0 笔";
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
  const incomeTotal = incomeRows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const expenseTotal = expenseRows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const cardTotal = cardRows.reduce((sum, record) => sum + (Number(record.net_adjustment) || 0), 0);
  const cards = [
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
      <small>${state.privacy ? "••••••" : formatPlainMoney(amount)}</small>
    </button>
  `;
}

function renderTransactionRow(record, type) {
  const sign = type === "income" ? "+" : "-";
  const status = record.sync_status === "synced" ? "已同步" : "待同步";
  return `
    <div class="draft-row">
      <span>${escapeHtml(record.transaction_date || "")}</span>
      <span>${escapeHtml(record.category || "未分类")}<small>${escapeHtml(status)}</small></span>
      <span>${sign}${state.privacy ? "••••••" : formatPlainMoney(record.amount).replace("CNY ", "")}</span>
    </div>
  `;
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
  return new Date().toISOString().slice(0, 7);
}

async function loadMobileDashboardSnapshot() {
  if (!canUseDesktopData()) {
    mobileDashboardSnapshot = makeEmptyDashboardSnapshot();
    renderAssetDashboard();
    renderTargetDeviation();
    render();
    return;
  }
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/dashboard`);
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    mobileDashboardSnapshot = {
      snapshotMonth: data.snapshot_month || mobileDashboardSnapshot.snapshotMonth,
      targetSavingRate: Number(data.target_saving_rate) || 0,
      netWorth: Number(data.net_worth) || mobileDashboardSnapshot.netWorth,
      assetAllocations: Array.isArray(data.asset_allocations)
        ? data.asset_allocations.map((item) => ({
          category: item.category,
          amount: Number(item.amount) || 0,
          percent: Number(item.percent) || 0
        }))
        : mobileDashboardSnapshot.assetAllocations,
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
          investmentGain: Number(item.investment_gain) || 0,
          monthlyXirr: item.monthly_xirr === null || item.monthly_xirr === undefined ? null : Number(item.monthly_xirr)
        }))
        : [],
      expenseCategories: Array.isArray(data.expense_categories)
        ? data.expense_categories.map((item) => ({
          category: item.category || "未分类",
          amount: Number(item.amount) || 0,
          percent: Number(item.percent) || 0
        }))
        : [],
      spendingAnomalies: Array.isArray(data.spending_anomalies)
        ? data.spending_anomalies.map((item) => ({
          transactionDate: item.transaction_date || "",
          category: item.category || "未分类",
          amount: Number(item.amount) || 0,
          note: item.note || "",
          reason: item.reason || ""
        }))
        : []
    };
    renderAssetDashboard();
    renderTargetDeviation();
    render();
  } catch {
    mobileDashboardSnapshot = makeEmptyDashboardSnapshot();
    renderAssetDashboard();
    renderTargetDeviation();
    render();
  }
}

function makeEmptyDashboardSnapshot() {
  return {
    snapshotMonth: "",
    targetSavingRate: 0,
    netWorth: 0,
    assetAllocations: [],
    allocationTargets: [],
    monthlyTrends: [],
    expenseCategories: [],
    spendingAnomalies: []
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
