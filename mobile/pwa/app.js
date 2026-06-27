const MOBILE_APP_VERSION = "0.2.0";
const DB_NAME = "worthtrace_mobile_v2";
const DB_VERSION = 1;
const RECORD_STORE = "offline_records";
const SETTINGS_KEY = "worthtrace_mobile_settings_v2";
const CUSTOM_CATEGORIES_KEY = "worthtrace_mobile_custom_categories_v2";
const RELEASE_RESET_KEY = "worthtrace_mobile_release_reset_v2";
const LEGACY_DB_NAMES = ["worthtrace_mobile_v1"];
const LEGACY_STORAGE_KEYS = ["worthtrace_mobile_settings_v1", "worthtrace_mobile_custom_categories_v1"];

const baseCategories = {
  expense: ["餐饮", "交通", "购物", "居住", "日用", "医疗", "娱乐", "旅行", "人情", "学习", "运动", "宠物", "保险", "税费", "其他支出"],
  income: ["工资", "奖金", "副业", "投资收益", "分红", "利息", "报销", "退款", "红包", "租金", "其他收入"]
};

await resetLegacyLocalData();

const settings = readSettings();
const customCategories = readCustomCategories();
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
let toastTimer = null;

const mobileDashboardSnapshot = {
  hasAllocationTargets: false,
  allocationTargets: []
};

dateInput.value = new Date().toISOString().slice(0, 10);
applyTheme();
renderCategoryOptions();
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
  const pending = pendingRecords();
  state.records = state.records.map((record) => ({
    ...record,
    sync_status: "synced",
    server_id: record.server_id || `mock_${record.local_id}`
  }));
  await replaceRecords(state.records);
  syncDialog.close();
  render();
  showToast(`已模拟同步 ${pending.length} 条月度草稿；5 月看板不会变化。`);
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
      <p class="sync-prototype-note">当前仍是原型模式：按钮只把手机本地记录标记为“已同步”。</p>
    `
    : `
      <div class="sync-empty">
        <strong>当前没有待同步的 6 月草稿</strong>
        <span>新增收入、支出或信用卡调整后，这里会显示本次同步内容。</span>
      </div>
    `;
  syncDialog.showModal();
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

function renderTargetDeviation() {
  if (!mobileDashboardSnapshot.hasAllocationTargets || !mobileDashboardSnapshot.allocationTargets.length) {
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
            <span>${escapeHtml(item.name)}</span>
            <span>
              <i style="--current: ${Math.max(0, Math.min(100, item.current))}%; --target: ${Math.max(0, Math.min(100, item.target))}%"></i>
              <small>${item.current}% / ${item.target}%</small>
            </span>
            <b class="${item.deviation > 0 ? "positive" : item.deviation < 0 ? "negative" : ""}">${item.deviation > 0 ? "+" : ""}${item.deviation}%</b>
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

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { theme: "champagne", ...stored };
  } catch {
    return { theme: "champagne" };
  }
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
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: state.theme }));
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
