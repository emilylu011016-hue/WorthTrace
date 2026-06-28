const MOBILE_APP_VERSION = "0.2.2";
const DB_NAME = "worthtrace_mobile_v3";
const DB_VERSION = 1;
const RECORD_STORE = "offline_records";
const SETTINGS_KEY = "worthtrace_mobile_settings_v2";
const CUSTOM_CATEGORIES_KEY = "worthtrace_mobile_custom_categories_v2";
const RELEASE_RESET_KEY = "worthtrace_mobile_release_reset_v3";
const DEVICE_ID_KEY = "worthtrace_mobile_device_id_v2";
const ACCOUNT_ID_KEY = "worthtrace_mobile_account_id_v2";
const DEFAULT_SYNC_ENDPOINT = "http://127.0.0.1:18742";
const LEGACY_DB_NAMES = ["worthtrace_mobile_v1", "worthtrace_mobile_v2"];
const LEGACY_STORAGE_KEYS = ["worthtrace_mobile_settings_v1", "worthtrace_mobile_custom_categories_v1"];

const baseCategories = {
  expense: ["餐饮", "交通", "购物", "居住", "日用", "医疗", "娱乐", "旅行", "人情", "学习", "运动", "宠物", "保险", "税费", "其他支出"],
  income: ["工资", "奖金", "副业", "投资收益", "分红", "利息", "报销", "退款", "红包", "租金", "其他收入"]
};

await resetLegacyLocalData();

const settings = readSettings();
const customCategories = readCustomCategories();
const syncEndpoint = resolveSyncEndpoint();
const deviceId = resolveDeviceId();
let accountId = localStorage.getItem(ACCOUNT_ID_KEY) || "";
const icons = {
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.1 12s3.6-7 9.9-7 9.9 7 9.9 7-3.6 7-9.9 7-9.9-7-9.9-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6A3 3 0 0 0 13.4 13.4"/><path d="M9.9 4.4A10.7 10.7 0 0 1 12 4.2c6.3 0 9.9 7 9.9 7a16.2 16.2 0 0 1-3.1 3.9"/><path d="M6.5 6.8A16.1 16.1 0 0 0 2.1 12s3.6 7 9.9 7a10.7 10.7 0 0 0 4.1-.8"/></svg>',
  palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.2-3.6 1.2 1.2 0 0 1 .8-2.1H17a4 4 0 0 0 0-8h-1.2A4.9 4.9 0 0 1 12 3Z"/><circle cx="7.8" cy="10" r=".8"/><circle cx="10.4" cy="7.7" r=".8"/><circle cx="14" cy="7.8" r=".8"/></svg>'
};

const state = {
  view: "home",
  type: "expense",
  draftSection: "",
  records: [],
  online: navigator.onLine,
  privacy: true,
  theme: settings.theme
};

const pageTitle = document.querySelector("#pageTitle");
const offlineBanner = document.querySelector("#offlineBanner");
const syncCard = document.querySelector("#syncCard");
const syncCardTitle = document.querySelector("#syncCardTitle");
const syncCardText = document.querySelector("#syncCardText");
const syncCount = document.querySelector("#syncCount");
const syncDot = document.querySelector("#syncDot");
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
const privacyButton = document.querySelector("#privacyButton");
const themeButton = document.querySelector("#themeButton");
const themePanel = document.querySelector("#themePanel");
const homePendingCount = document.querySelector("#homePendingCount");
const infoToast = document.querySelector("#infoToast");
const mayAnomalyButton = document.querySelector("#mayAnomalyButton");
const mayAnomalyDetail = document.querySelector("#mayAnomalyDetail");
const targetDeviationSection = document.querySelector("#targetDeviationSection");
const assetRing = document.querySelector("#assetRing");
const allocationLegend = document.querySelector("#allocationLegend");
let toastTimer = null;

let mobileDashboardSnapshot = {
  snapshotMonth: "2026-05",
  netWorth: 244229.82,
  assetAllocations: [
    { category: "全球资产", amount: 122114.91, percent: 0.5 },
    { category: "现金", amount: 51288.26, percent: 0.21 },
    { category: "债券", amount: 34192.17, percent: 0.14 },
    { category: "黄金", amount: 19538.39, percent: 0.08 },
    { category: "其他", amount: 17096.09, percent: 0.07 }
  ],
  allocationTargets: []
};

dateInput.value = new Date().toISOString().slice(0, 10);
applyTheme();
renderCategoryOptions();
void loadMobileDashboardSnapshot();
renderAssetDashboard();
renderTargetDeviation();

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

privacyButton.addEventListener("click", () => {
  state.privacy = !state.privacy;
  writeSettings();
  render();
  showToast(state.privacy ? "金额已隐藏" : "金额已显示");
});

themeButton.addEventListener("click", () => {
  themePanel.hidden = !themePanel.hidden;
  themeButton.classList.toggle("active", !themePanel.hidden);
  showToast(themePanel.hidden ? "风格面板已收起" : "选择一种风格");
});

document.querySelector("#addCategoryButton").addEventListener("click", () => {
  const value = window.prompt(`新增${state.type === "income" ? "收入" : "支出"}分类名称`);
  const name = value?.trim();
  if (!name) return;
  const list = categoriesForType(state.type);
  if (!list.includes(name)) {
    customCategories[state.type].push(name);
    writeCustomCategories();
  }
  renderCategoryOptions(name);
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
    local_id: crypto.randomUUID(),
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
    local_id: crypto.randomUUID(),
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
document.querySelector("#closeDialogButton").addEventListener("click", () => syncDialog.close());
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
  syncCount.textContent = String(pending.length);
  homePendingCount.textContent = `${pending.length} 条`;
  syncDot.classList.toggle("offline", !state.online);
  offlineBanner.hidden = state.online;
  syncCard.hidden = pending.length === 0;
  syncCardTitle.textContent = pending.length ? `有 ${pending.length} 条 6 月草稿待同步` : "没有待同步记录";
  syncCardText.textContent = state.online
    ? `收入 ${pendingSummary.incomeCount} 笔，支出 ${pendingSummary.expenseCount} 笔，信用卡 ${pendingSummary.creditCardCount} 条。同步后进入电脑端 6 月草稿。`
    : "离线记录会先保存在手机。恢复连接后同步到电脑端 6 月草稿。";
  privacyButton.innerHTML = state.privacy ? icons.eyeOff : icons.eye;
  privacyButton.setAttribute("aria-label", state.privacy ? "显示金额" : "隐藏金额");
  privacyButton.setAttribute("title", state.privacy ? "显示金额" : "隐藏金额");
  privacyButton.dataset.tooltip = state.privacy ? "显示金额" : "隐藏金额";
  themeButton.innerHTML = icons.palette;
  document.body.classList.toggle("privacy-on", state.privacy);
  document.querySelectorAll(".money").forEach((node) => {
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
          <p>电脑端 6 月收支确认和信用卡调整草稿。</p>
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
      <p class="sync-prototype-note">当前连接电脑 Test 同步入口：${escapeHtml(syncEndpoint)}。成功后进入电脑端手机收件箱。</p>
    `
    : `
      <div class="sync-empty">
        <strong>当前没有待同步的 6 月草稿</strong>
        <span>新增收入、支出或信用卡调整后，这里会显示本次同步内容。</span>
      </div>
    `;
  syncDialog.showModal();
}

async function reportMobileStatus() {
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
    // 电脑 test app 未启动时，手机继续保留本地草稿。
  }
}

async function syncPendingToDesktop() {
  const pending = pendingRecords();
  if (!accountId) {
    showToast("请先用电脑端绑定码绑定手机");
    syncDialogText.insertAdjacentHTML(
      "beforeend",
      `<p class="sync-prototype-note">未绑定电脑账户。请在电脑端打开手机绑定，再用手机打开绑定链接。</p>`
    );
    return;
  }
  if (!pending.length) {
    syncDialog.close();
    showToast("没有待同步草稿");
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
    syncDialog.close();
    render();
    void reportMobileStatus();
    showToast(`已同步 ${result.accepted_count || 0} 条到电脑 Test 收件箱`);
  } catch (err) {
    showToast("同步失败：请确认电脑 Test App 已打开");
    syncDialogText.insertAdjacentHTML(
      "beforeend",
      `<p class="sync-prototype-note">同步失败。${escapeHtml(String(err))}</p>`
    );
  } finally {
    syncButton.disabled = false;
    syncButton.textContent = "同步到电脑";
  }
}

async function pairFromUrlIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  const pairCode = params.get("pairCode")?.trim();
  if (!pairCode) return;
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
      showToast("已绑定电脑账户");
    }
  } catch (err) {
    showToast("绑定失败：请检查电脑端绑定码");
    console.warn(err);
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
  try {
    const response = await fetch(`${syncEndpoint}/mobile-sync/dashboard`);
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    mobileDashboardSnapshot = {
      snapshotMonth: data.snapshot_month || mobileDashboardSnapshot.snapshotMonth,
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
        : []
    };
    renderAssetDashboard();
    renderTargetDeviation();
    render();
  } catch {
    renderAssetDashboard();
    renderTargetDeviation();
  }
}

function renderAssetDashboard() {
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
      <b>${formatPercent(item.percent)}</b>
    </div>
  `).join("");
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
              <small>${formatPercent(item.current)} / ${formatPercent(item.target)}</small>
            </span>
            <b class="${item.deviation > 0 ? "positive" : item.deviation < 0 ? "negative" : ""}">${item.deviation > 0 ? "+" : ""}${formatPercent(item.deviation)}</b>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function formatPlainMoney(value) {
  return `CNY ${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatMonthLabel(value) {
  if (!value || value.length < 7) return "已发布";
  return `${value.slice(0, 4)} 年 ${Number(value.slice(5, 7))} 月`;
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
  return String(settings.syncEndpoint || DEFAULT_SYNC_ENDPOINT).replace(/\/$/, "");
}

function resolveDeviceId() {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const value = `mobile_${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_ID_KEY, value);
  return value;
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
