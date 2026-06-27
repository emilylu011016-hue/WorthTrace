const DB_NAME = "worthtrace_mobile_v1";
const DB_VERSION = 1;
const RECORD_STORE = "offline_records";
const SETTINGS_KEY = "worthtrace_mobile_settings_v1";
const CUSTOM_CATEGORIES_KEY = "worthtrace_mobile_custom_categories_v1";

const baseCategories = {
  expense: ["餐饮", "交通", "购物", "居住", "日用", "医疗", "娱乐", "旅行", "人情", "学习", "运动", "宠物", "保险", "税费", "其他支出"],
  income: ["工资", "奖金", "副业", "投资收益", "分红", "利息", "报销", "退款", "红包", "租金", "其他收入"]
};

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
const localRecords = document.querySelector("#localRecords");
const bookForm = document.querySelector("#bookForm");
const dateInput = document.querySelector("#dateInput");
const amountInput = document.querySelector("#amountInput");
const categoryInput = document.querySelector("#categoryInput");
const noteInput = document.querySelector("#noteInput");
const syncDialog = document.querySelector("#syncDialog");
const syncDialogText = document.querySelector("#syncDialogText");
const privacyButton = document.querySelector("#privacyButton");
const themeButton = document.querySelector("#themeButton");
const themePanel = document.querySelector("#themePanel");
const categoryGrid = document.querySelector("#categoryGrid");
const categoryHint = document.querySelector("#categoryHint");
const homePendingCount = document.querySelector("#homePendingCount");
const infoToast = document.querySelector("#infoToast");
let toastTimer = null;

dateInput.value = new Date().toISOString().slice(0, 10);
applyTheme();
renderCategoryOptions();

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

document.querySelector("#syncButton").addEventListener("click", showSyncDialog);
document.querySelector("#confirmSyncButton").addEventListener("click", showSyncDialog);
document.querySelector("#closeDialogButton").addEventListener("click", () => syncDialog.close());
document.querySelector("#mockSyncButton").addEventListener("click", async () => {
  state.records = state.records.map((record) => ({
    ...record,
    sync_status: "synced",
    server_id: record.server_id || `mock_${record.local_id}`
  }));
  await replaceRecords(state.records);
  syncDialog.close();
  render();
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
  categoryHint.textContent = state.type === "income" ? "收入分类" : "支出分类";
  categoryGrid.innerHTML = categories.slice(0, 12).map((category) => (
    `<button type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  )).join("");
  categoryGrid.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      categoryInput.value = button.dataset.category;
    });
  });
}

function pendingRecords() {
  return state.records.filter((record) => record.sync_status !== "synced");
}

function render() {
  const pending = pendingRecords();
  syncCount.textContent = String(pending.length);
  homePendingCount.textContent = `${pending.length} 条`;
  syncDot.classList.toggle("offline", !state.online);
  offlineBanner.hidden = state.online;
  syncCard.hidden = pending.length === 0;
  syncCardTitle.textContent = pending.length ? `有 ${pending.length} 条记录待同步` : "没有待同步记录";
  syncCardText.textContent = state.online
    ? "已检测到网络。下一步会连接电脑本地服务。"
    : "离线记录会先保存在手机，连上电脑后同步。";
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
  if (!state.records.length) {
    localRecords.innerHTML = `
      <div class="list-row static">
        <i class="tile gold"></i>
        <span><b>还没有手机本地记录</b><small>先记一笔，看看待同步状态。</small></span>
        <em>空</em>
      </div>
    `;
    return;
  }
  localRecords.innerHTML = state.records.slice(0, 8).map((record) => {
    const sign = record.transaction_type === "income" ? "+" : "-";
    const status = record.sync_status === "synced" ? "已同步" : "待同步";
    return `
      <div class="list-row static">
        <i class="tile ${record.transaction_type === "income" ? "gold" : "rose"}"></i>
        <span>
          <b>${escapeHtml(record.category)}</b>
          <small>${record.transaction_date}${record.note ? ` · ${escapeHtml(record.note)}` : ""}</small>
        </span>
        <em>${sign}${state.privacy ? "****" : record.amount.toFixed(2)} · ${status}</em>
      </div>
    `;
  }).join("");
}

function showSyncDialog() {
  const pending = pendingRecords();
  syncDialogText.textContent = pending.length
    ? `当前有 ${pending.length} 条待同步记录。现在是原型模式，点击“模拟同步完成”会把它们标记为已同步。`
    : "当前没有待同步记录。";
  syncDialog.showModal();
}

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { theme: "champagne", ...stored };
  } catch {
    return { theme: "champagne" };
  }
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
